/**
 * The formula lab.
 *
 * The same editor as the inspector's, in a dialog with room for the two things a
 * settings sidebar 220px wide cannot hold: **the answer**, and **the manual**.
 *
 * ## Why testing matters more than it sounds
 *
 * A computed field is the only field whose value nobody can see until there is a
 * post to see it on. Everything else in the builder shows its own result — a
 * dropdown shows its options, a repeater shows its rows — but `round(pct({sold},
 * {total}), 1)` shows nothing at all until somebody publishes something and
 * looks at a column. So the loop for getting a formula right used to be: guess,
 * save, open a post, fill three fields, save, look. Minutes per attempt, for an
 * expression you could have checked in a second.
 *
 * Here the fields are inputs, the answer is underneath, and it recalculates as
 * you type — in **the same engine that will run on the server**, because
 * `src/shared/calc.ts` and `includes/calc.php` are tested against one fixture
 * table precisely so that a number seen here is the number that will be stored.
 * A preview computed by a second, friendlier implementation would be worse than
 * no preview: it would be right until the day it was not.
 *
 * ## Why the small box stays
 *
 * This is a second door, not a replacement. Most formulas are `{a} * {b}` and
 * belong in the sidebar where the rest of the field's settings are; opening a
 * dialog to type six characters is a worse experience, not a better one. The
 * dialog is for the formula you are *working out*.
 */

import { calc, variables } from '../shared/calc';
import { el, icon } from '../ui';
import { hasComponent } from '../shell';
import { renderFormulaEditor } from './formula-editor';
import { DOCS, OPERATORS, READS } from './formula-docs';

/** What the lab needs. */
export interface FormulaLabOptions {
	/** The formula as it stands. */
	value: string;
	/** The fields the formula may reach. */
	fields: Array< { name: string; label: string } >;
	/** The functions the calculator implements. */
	functions: string[];
	/** Called with the formula when the lab is closed with Save. */
	onSave: ( value: string ) => void;
}

/**
 * Opens the lab.
 *
 * @param opts What to work on.
 * @return The dialog element, already in the document.
 */
export function openFormulaLab( opts: FormulaLabOptions ): HTMLElement {
	let formula = opts.value;

	/** Sample values, one per field, kept as strings until they are read. */
	const samples: Record< string, string > = {};

	opts.fields.forEach( ( field, index ) => {
		// Something plausible rather than zero. A lab that opens showing
		// `0 / 0 = 0` has demonstrated nothing, and the first thing anybody does
		// is type numbers in — so it starts with numbers in.
		samples[ field.name ] = String( [ 100, 4, 25, 12, 3 ][ index % 5 ] );
	} );

	const answer = el( 'output', { class: 'atcfl__answer' } );
	const used = el( 'p', { class: 'atcfl__used' } );
	const inputs = el( 'div', { class: 'atcfl__samples' } );

	/** Recomputes, in the engine that will run on the server. */
	const evaluate = () => {
		const named = variables( formula );
		const values: Record< string, number > = {};

		Object.entries( samples ).forEach( ( [ name, raw ] ) => {
			values[ name ] = Number( raw ) || 0;
		} );

		const result = calc( formula, values );

		answer.textContent = '' === result ? '—' : String( result );
		answer.classList.toggle( 'is-empty', '' === result );

		used.textContent = named.length
			? `Using ${ named.map( ( one ) => `{${ one }}` ).join( ', ' ) }`
			: 'This formula reads no fields.';

		// Only the fields the formula actually mentions get a box. Twelve inputs
		// for a formula that reads two of them is a form somebody has to scan
		// before they can use it.
		Array.from( inputs.children ).forEach( ( child ) => {
			const node = child as HTMLElement;
			const name = node.dataset.field ?? '';

			node.hidden = ! named.includes( name );
		} );

		const missing = named.filter( ( name ) => ! ( name in samples ) );

		unknown.textContent = missing.length
			? `Nothing on this site is called ${ missing.map( ( one ) => `“${ one }”` ).join( ', ' ) }.`
			: '';
		unknown.classList.toggle( 'is-shown', missing.length > 0 );
	};

	const unknown = el( 'p', { class: 'atcfl__unknown' } );

	opts.fields.forEach( ( field ) => {
		const box = el( 'input', {
			class: 'atcfl__sample-input',
			attrs: { type: 'number', step: 'any', value: samples[ field.name ] },
		} ) as HTMLInputElement;

		box.addEventListener( 'input', () => {
			samples[ field.name ] = box.value;
			evaluate();
		} );

		inputs.append(
			el( 'label', {
				class: 'atcfl__sample',
				dataset: { field: field.name },
				children: [
					el( 'span', { class: 'atcfl__sample-name', text: field.label || field.name } ),
					box,
				],
			} )
		);
	} );

	/** Replaces what is in the box — what the "Try it" buttons do. */
	const setFormula = ( next: string ) => {
		formula = next;
		( editor as unknown as { setFormula?: ( value: string ) => void } ).setFormula?.( next );
		evaluate();
	};

	const editor = renderFormulaEditor( {
		value: opts.value,
		fields: opts.fields,
		functions: opts.functions,
		onChange: ( next ) => {
			formula = next;
			evaluate();
		},
	} );

	const reference = el( 'div', { class: 'atcfl__reference' } );

	opts.functions.forEach( ( name ) => {
		const doc = DOCS[ name ];

		if ( ! doc ) {
			reference.append(
				el( 'div', { class: 'atcfl__doc', children: [ el( 'code', { class: 'atcfl__doc-sig', text: `${ name }()` } ) ] } )
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

					// Every parameter named and explained. A signature alone is
					// only documentation to somebody who already knows what the
					// parameters mean, which is exactly the person who does not
					// need it.
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
								on: {
									click: () => {
										setFormula( doc.example.formula );
									},
								},
							} ),
						],
					} ),

					doc.note ? el( 'p', { class: 'atcfl__doc-note', text: doc.note } ) : null,
				],
			} )
		);
	} );

	const operators = el( 'dl', {
		class: 'atcfl__operators',
		children: OPERATORS.flatMap( ( one ) => [
			el( 'dt', { text: one.symbol } ),
			el( 'dd', { text: one.what } ),
		] ),
	} );

	const body = el( 'div', {
		class: 'atcfl__body',
		children: [
			el( 'div', {
				class: 'atcfl__work',
				children: [
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
					} ),
				],
			} ),

			el( 'div', {
				class: 'atcfl__manual',
				children: [
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
					operators,
					el( 'h3', { class: 'atcfl__heading', text: 'Functions' } ),
					el( 'p', {
						class: 'atcfl__lead',
						text: 'Open one to see what each part of it means, and press Try it to load the example.',
					} ),
					reference,
				],
			} ),
		],
	} );

	const save = el( 'button', {
		class: 'atcfl__save',
		text: 'Use this formula',
		attrs: { type: 'button', slot: 'footer' },
		on: {
			click: () => {
				opts.onSave( formula );
				close();
			},
		},
	} );

	const cancel = el( 'button', {
		class: 'atcfl__cancel',
		text: 'Cancel',
		attrs: { type: 'button', slot: 'footer' },
		on: { click: () => close() },
	} );

	const opener = document.activeElement as HTMLElement | null;

	let dialog: HTMLElement;
	let onKey: ( ( event: KeyboardEvent ) => void ) | null = null;

	/** Takes the dialog down and gives the focus back. */
	const close = () => {
		dialog.remove();

		if ( onKey ) {
			document.removeEventListener( 'keydown', onKey );
		}

		opener?.focus();
	};

	if ( hasComponent( 'os-modal' ) ) {
		// The kit's own overlay when there is one. It handles Escape, the click
		// outside and the focus trap, and — the part that matters most here — it
		// re-points the shared surface tokens on its own dialog, so anything
		// slotted into it resolves colours that are readable against a dark
		// surface instead of against whatever the page behind it happens to be.
		dialog = el( 'os-modal', {
			class: 'atcfl',
			attrs: { open: '', title: 'Formula', size: 'lg' },
			children: [ body, save, cancel ],
		} );

		dialog.addEventListener( 'os-modal-cancel', () => close() );
	} else {
		// No shell: an overlay of our own. The builder degrades to an ordinary
		// admin page, and a formula editor that only opened inside OpenStation
		// would be a feature half the installs never see.
		onKey = ( event: KeyboardEvent ) => {
			if ( 'Escape' === event.key ) {
				close();
			}
		};

		document.addEventListener( 'keydown', onKey );

		dialog = el( 'div', {
			class: 'atcfl atcfl--own',
			attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Formula editor' },
			children: [
				el( 'div', { class: 'atcfl__scrim', on: { click: () => close() } } ),
				el( 'div', {
					class: 'atcfl__panel',
					children: [
						el( 'div', {
							class: 'atcfl__head',
							children: [
								icon( 'dashicons-calculator' ),
								el( 'h2', { text: 'Formula' } ),
								el( 'button', {
									class: 'atcfl__close',
									text: '×',
									attrs: { type: 'button', 'aria-label': 'Close' },
									on: { click: () => close() },
								} ),
							],
						} ),
						body,
						el( 'div', { class: 'atcfl__foot', children: [ save, cancel ] } ),
					],
				} ),
			],
		} );
	}

	document.body.append( dialog );
	evaluate();

	dialog.querySelector< HTMLElement >( '.atcfb__formula' )?.focus();

	return dialog;
}
