/**
 * The formula window.
 *
 * The lab, as a real window beside the builder rather than a modal over it.
 *
 * A modal was the wrong instrument and it took using one to see why: it takes
 * the builder away. You cannot see the field you are writing the formula for,
 * you cannot glance at what its siblings are called, and checking either means
 * closing, looking and reopening. A window pairs — tile the two, leave the
 * formula window open across several fields, and let the shell's own title bar,
 * traffic lights and taskbar entry do the work a hand-rolled overlay was doing
 * badly.
 *
 * ## The handshake
 *
 * Two builders can be open on two field groups, and each can have its own
 * formula window. So nothing here is addressed to "the builder" — every message
 * quotes a **session**, a token minted by whichever builder pressed the button
 * and carried in this window's parameters.
 *
 * ```
 *   builder                                   window
 *      │  openWindow( id, { session } )          │
 *      │────────────────────────────────────────▶│
 *      │                                         │  reads its session from params
 *      │        formula-hello { session }        │
 *      │◀────────────────────────────────────────│
 *      │  formula-context { session, field,      │
 *      │                    fields, functions }  │
 *      │────────────────────────────────────────▶│  draws
 *      │                                         │
 *      │        formula-result { session, … }    │
 *      │◀────────────────────────────────────────│  on Use this formula
 * ```
 *
 * The window speaks first, which is the half that matters. The obvious design —
 * the builder broadcasts the context immediately after opening the window — is a
 * race it loses roughly half the time: a window that was already open receives
 * it, and a window still booting does not. Having the *window* announce itself
 * when it is ready removes the timing question entirely.
 */

import { calc, variables } from '../shared/calc';
import { el, numberField } from '../ui';
import { renderFormulaEditor } from './formula-editor';
import { shell, whenShellReady, windowIdOf } from '../shell';
import { DOCS, OPERATORS, READS } from './formula-docs';

/** What a builder sends when it answers a hello. */
export interface FormulaContext {
	session: string;
	/** What the field being edited is called, for the window's own heading. */
	label: string;
	formula: string;
	fields: Array< { name: string; label: string } >;
	functions: string[];
}

/** The bus topics. Prefixed like every other topic this plugin publishes. */
export const FORMULA_TOPICS = {
	hello: 'os.allterrain-fields.formula-hello',
	context: 'os.allterrain-fields.formula-context',
	result: 'os.allterrain-fields.formula-result',
} as const;

/**
 * Mounts the window, if this document is one.
 *
 * @param root The window body.
 */
export function mountFormulaWindow( root: HTMLElement ): void {
	const waiting = root.querySelector< HTMLElement >( '[data-atcflw-waiting]' );
	const panes = root.querySelector< HTMLElement >( '[data-atcflw-panes]' );
	const work = root.querySelector< HTMLElement >( '[data-atcflw-work]' );
	const manual = root.querySelector< HTMLElement >( '[data-atcflw-manual]' );
	const foot = root.querySelector< HTMLElement >( '[data-atcflw-foot]' );

	if ( ! panes || ! work || ! manual || ! foot ) {
		return;
	}

	whenShellReady( () => {
		const os = shell();
		const id = windowIdOf( root );
		const session = String( ( id ? os?.getWindowParams?.( id ) : undefined )?.session ?? '' );

		// Kept subscribed rather than torn down after the first context, and
		// **not** filtered on the session in this window's parameters.
		//
		// The window is a singleton: pressing Editor on a second field does not
		// open a second one, it re-uses this. That press carries a new session,
		// so a window that only ever accepted the token it was born with would
		// go on showing the first field forever. It accepts any context and
		// adopts its session — which is the token every reply then quotes, so
		// the formula still goes back to the builder that asked.
		os?.subscribe?.( FORMULA_TOPICS.context, ( payload ) => {
			const context = payload as FormulaContext;

			if ( ! context || ! Array.isArray( context.fields ) ) {
				return;
			}

			waiting?.remove();
			panes.hidden = false;
			foot.hidden = false;

			draw( { work, manual, foot, context, os } );
		} );

		// The hello carries the parameter session, which is the one the builder
		// that opened this window is waiting on.
		os?.broadcast?.( FORMULA_TOPICS.hello, { session } );
	} );
}

/** Everything the window draws once it knows what it is about. */
function draw( args: {
	work: HTMLElement;
	manual: HTMLElement;
	foot: HTMLElement;
	context: FormulaContext;
	os: ReturnType< typeof shell >;
} ): void {
	const { work, manual, foot, context, os } = args;

	let formula = context.formula;

	/** Sample values. Plausible numbers, not zeroes — see below. */
	const samples: Record< string, number > = {};

	context.fields.forEach( ( field, index ) => {
		// A window that opens showing `0 / 0 = 0` has demonstrated nothing, and
		// the first thing anybody does is type numbers in. So it starts with
		// numbers in.
		samples[ field.name ] = [ 100, 4, 25, 12, 3 ][ index % 5 ];
	} );

	const answer = el( 'output', { class: 'atcfl__answer' } );
	const used = el( 'p', { class: 'atcfl__used' } );
	const unknown = el( 'p', { class: 'atcfl__unknown' } );
	const inputs = el( 'div', { class: 'atcfl__samples' } );

	const evaluate = () => {
		const named = variables( formula );
		const result = calc( formula, samples );

		answer.textContent = '' === result ? '—' : String( result );
		answer.classList.toggle( 'is-empty', '' === result );

		used.textContent = named.length
			? `Using ${ named.map( ( one ) => `{${ one }}` ).join( ', ' ) }`
			: 'This formula reads no fields yet.';

		// Only the fields the formula mentions get a box. Twelve inputs for a
		// formula that reads two of them is a form somebody has to scan before
		// they can use it.
		Array.from( inputs.children ).forEach( ( child ) => {
			const node = child as HTMLElement;

			node.hidden = ! named.includes( node.dataset.field ?? '' );
		} );

		const missing = named.filter( ( name ) => ! ( name in samples ) );

		unknown.textContent = missing.length
			? `Nothing in this field group is called ${ missing.map( ( one ) => `“${ one }”` ).join( ', ' ) }.`
			: '';
		unknown.classList.toggle( 'is-shown', missing.length > 0 );
	};

	context.fields.forEach( ( field ) => {
		const input = numberField( samples[ field.name ], {}, ( value ) => {
			samples[ field.name ] = Number( value ) || 0;
			evaluate();
		} );

		inputs.append(
			el( 'div', {
				class: 'atcfl__sample',
				dataset: { field: field.name },
				children: [
					el( 'span', { class: 'atcfl__sample-name', text: field.label || field.name } ),
					input,
				],
			} )
		);
	} );

	const editor = renderFormulaEditor( {
		value: context.formula,
		fields: context.fields,
		functions: context.functions,
		onChange: ( next ) => {
			formula = next;
			evaluate();
		},
	} );

	/** Replaces what is in the box — what the Try it buttons do. */
	const setFormula = ( next: string ) => {
		formula = next;
		( editor as unknown as { setFormula?: ( value: string ) => void } ).setFormula?.( next );
		evaluate();
	};

	work.replaceChildren(
		el( 'h2', { class: 'atcflw__title', text: context.label || 'Formula' } ),
		editor,
		used,
		unknown,
		el( 'h3', { class: 'atcfl__heading', text: 'Try it' } ),
		el( 'p', {
			class: 'atcfl__lead',
			text: 'Put a value against each field and watch the answer. These are only for trying — nothing here is saved to any post.',
		} ),
		inputs,
		el( 'div', {
			class: 'atcfl__result',
			children: [ el( 'span', { text: 'Answer' } ), answer ],
		} )
	);

	manual.replaceChildren(
		el( 'h3', { class: 'atcfl__heading', text: 'What a formula can read' } ),
		el( 'dl', {
			class: 'atcfl__reads',
			children: READS.flatMap( ( one ) => [
				el( 'dt', { text: one.what } ),
				el( 'dd', { text: one.how } ),
			] ),
		} ),
		el( 'h3', { class: 'atcfl__heading', text: 'The basics' } ),
		el( 'p', {
			class: 'atcfl__lead',
			text: 'Everything else is ordinary arithmetic. Press any chip above to put a field or a function in.',
		} ),
		el( 'dl', {
			class: 'atcfl__operators',
			children: OPERATORS.flatMap( ( one ) => [
				el( 'dt', { text: one.symbol } ),
				el( 'dd', { text: one.what } ),
			] ),
		} ),
		el( 'h3', { class: 'atcfl__heading', text: 'Functions' } ),
		el( 'p', {
			class: 'atcfl__lead',
			text: 'Open one to see what each part of it means, and press Try it to load the example.',
		} ),
		renderReference( context.functions, setFormula )
	);

	const status = el( 'span', { class: 'atcflw__status' } );

	foot.replaceChildren(
		status,
		el( 'button', {
			class: 'atcfl__save',
			text: 'Use this formula',
			attrs: { type: 'button' },
			on: {
				click: () => {
					os?.broadcast?.( FORMULA_TOPICS.result, { session: context.session, formula } );

					// Said here rather than closing the window. Closing on save
					// would be the modal's behaviour, and the whole point of a
					// window is that it can stay open while you do the next
					// field — so it says what happened and waits.
					status.textContent = 'Sent to the builder.';

					window.setTimeout( () => {
						status.textContent = '';
					}, 2600 );
				},
			},
		} )
	);

	evaluate();
	work.querySelector< HTMLElement >( '.atcfb__formula' )?.focus();
}

/** The function reference, folded away one per function. */
export function renderReference( functions: string[], onTry: ( formula: string ) => void ): HTMLElement {
	const reference = el( 'div', { class: 'atcfl__reference' } );

	functions.forEach( ( name ) => {
		const doc = DOCS[ name ];

		if ( ! doc ) {
			reference.append(
				el( 'div', {
					class: 'atcfl__doc',
					children: [ el( 'code', { class: 'atcfl__doc-sig', text: `${ name }()` } ) ],
				} )
			);

			return;
		}

		reference.append(
			el( 'details', {
				class: 'atcfl__doc',
				children: [
					el( 'summary', {
						class: 'atcfl__doc-head',
						children: [
							el( 'code', { class: 'atcfl__doc-sig', text: doc.signature } ),
							el( 'span', { class: 'atcfl__doc-what', text: doc.what } ),
						],
					} ),
					el( 'dl', {
						class: 'atcfl__doc-params',
						children: doc.params.flatMap( ( param ) => [
							el( 'dt', { text: param.name } ),
							el( 'dd', { text: param.what } ),
						] ),
					} ),
					el( 'div', {
						class: 'atcfl__doc-eg',
						children: [
							el( 'code', { text: doc.example.formula } ),
							el( 'span', { class: 'atcfl__doc-gives', text: `gives ${ doc.example.gives }` } ),
							el( 'button', {
								class: 'atcfl__doc-try',
								text: 'Try it',
								attrs: { type: 'button', title: 'Put this example in the box above' },
								on: { click: () => onTry( doc.example.formula ) },
							} ),
						],
					} ),
					doc.note ? el( 'p', { class: 'atcfl__doc-note', text: doc.note } ) : null,
				],
			} )
		);
	} );

	return reference;
}
