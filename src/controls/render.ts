/**
 * Rendering a field in the browser.
 *
 * PHP renders the fields that are on the page when it loads. This renders the
 * ones that are not: a repeater row somebody just added, a flexible-content
 * block they just chose, the builder's live preview of a field they are still
 * typing the label of.
 *
 * It is deliberately the *same shape* of markup as `includes/render/controls.php`
 * — same wrapper classes, same label structure, same error slot — so one
 * stylesheet dresses both and a field looks identical whether it arrived with
 * the page or a second later. Two renderers producing two different DOMs is how
 * a repeater row ends up subtly narrower than the fields above it forever.
 *
 * What it is *not* is a second source of truth about values. Nothing here writes
 * to a form input; every control reports through `onChange`, and the container
 * holding it owns the value. The only things that submit are the hidden JSON
 * inputs PHP printed, one per top-level field.
 */

import { CHANGE_EVENTS, clear, control, el, readValue, t, uid } from './helpers';
import { mountFor } from './mount';
import { visible } from '../shared/logic';
import type { Field } from '../types';
import type { LogicValues } from '../shared/logic';

/** What `renderField()` gives back. */
export interface RenderedField {
	/** The wrapper, ready to append. */
	element: HTMLElement;
	/** The field it draws. */
	field: Field;
	/** Re-evaluates this field's condition against a set of values. */
	applyLogic: ( values: LogicValues ) => void;
	/** Tears down anything the control registered. */
	destroy: () => void;
}

/**
 * Renders one field.
 *
 * @param field    The field.
 * @param value    Its current value.
 * @param onChange Called whenever the value changes.
 * @return The rendered field.
 */
export function renderField( field: Field, value: unknown, onChange: ( value: unknown ) => void ): RenderedField {
	const id = uid( 'atcf-f' );
	const errorId = `${ id }-error`;
	const hintId = `${ id }-hint`;

	const wrapper = el( 'div', {
		class: `atcf-field atcf-field--${ field.type }${ field.required ? ' atcf-field--required' : '' }${
			field.wrapper?.class ? ` ${ field.wrapper.class }` : ''
		}`,
		dataset: {
			atcfField: field.key,
			atcfType: field.type,
			atcfName: field.name,
		},
		style: { ...( field.wrapper?.width ? { '--atcf-width': `${ field.wrapper.width }%` } : {} ) } as Partial< CSSStyleDeclaration >,
	} );

	const grouped = [ 'radio', 'checkbox', 'button_group' ].includes( field.type );

	if ( ! [ 'tab', 'accordion', 'message' ].includes( field.type ) ) {
		const label = el( grouped ? 'span' : 'label', {
			class: 'atcf-field__label',
			text: field.label,
			attrs: grouped ? {} : { for: id },
		} );

		if ( field.required ) {
			label.append( el( 'span', { class: 'atcf-field__required', text: ' *', attrs: { 'aria-hidden': 'true' } } ) );
		}

		wrapper.append( el( 'div', { class: 'atcf-field__header', children: [ label ] } ) );
	}

	const host = el( 'div', { class: 'atcf-field__control' } );

	wrapper.append( host );

	if ( field.instructions ) {
		wrapper.append( el( 'p', { class: 'atcf-field__hint', text: field.instructions, attrs: { id: hintId } } ) );
	}

	wrapper.append( el( 'p', { class: 'atcf-field__error', attrs: { id: errorId, role: 'alert' } } ) );

	const describedBy = [ field.instructions ? hintId : '', errorId ].filter( Boolean ).join( ' ' );
	const teardown = drawControl( { field, value, onChange, host, wrapper, id, describedBy } );

	return {
		element: wrapper,
		field,
		applyLogic: ( values ) => {
			const shown = visible( field.conditional, values );

			wrapper.hidden = ! shown;
			wrapper.classList.toggle( 'atcf-field--hidden', ! shown );

			// Disabled as well as hidden. A required control that is merely
			// invisible still blocks the browser's own form validation, and the
			// user gets "please fill in this field" pointing at nothing.
			wrapper.querySelectorAll< HTMLInputElement >( 'input, select, textarea' ).forEach( ( node ) => {
				node.disabled = ! shown;
			} );
		},
		destroy: () => teardown?.(),
	};
}

interface DrawContext {
	field: Field;
	value: unknown;
	onChange: ( value: unknown ) => void;
	host: HTMLElement;
	wrapper: HTMLElement;
	id: string;
	describedBy: string;
}

/**
 * Draws the control itself.
 *
 * The simple types are inline here rather than in the mount registry, because a
 * text input does not need a registration to be found — and a registry entry per
 * `<input type="text">` is a registry nobody reads.
 *
 * @param context Everything about the field.
 * @return A teardown, when the control registered anything.
 */
function drawControl( context: DrawContext ): ( () => void ) | void {
	const { field, host, id, describedBy } = context;
	const settings = field.settings as Record< string, unknown >;

	const shared = {
		id,
		'aria-describedby': describedBy,
		...( field.required ? { required: true, 'aria-required': 'true' } : {} ),
		...( field.readonly ? { readonly: true } : {} ),
	};

	switch ( field.type ) {
		case 'text':
		case 'email':
		case 'url':
		case 'password': {
			const input = control( 'os-text-field', 'input', {
				class: 'atcf-input',
				attrs: {
					type: field.type === 'text' ? 'text' : field.type,
					placeholder: String( settings.placeholder ?? '' ),
					...shared,
				},
			} );

			( input as HTMLInputElement ).value = String( context.value ?? '' );
			bind( input, () => context.onChange( readValue( input ) ) );
			host.append( affixed( settings, input ) );

			return;
		}

		case 'textarea':
		case 'code': {
			const input = control( 'os-textarea', 'textarea', {
				class: `atcf-input${ field.type === 'code' ? ' atcf-input--code' : '' }`,
				attrs: { rows: Number( settings.rows ?? 5 ), placeholder: String( settings.placeholder ?? '' ), ...shared },
			} );

			( input as HTMLTextAreaElement ).value = String( context.value ?? '' );
			bind( input, () => context.onChange( readValue( input ) ) );
			host.append( input );

			return;
		}

		case 'number':
		case 'range': {
			const input = control(
				field.type === 'range' ? 'os-range-field' : 'os-number-field',
				'input',
				{
					class: 'atcf-input',
					attrs: {
						type: field.type === 'range' ? 'range' : 'number',
						min: settings.min === '' ? null : Number( settings.min ),
						max: settings.max === '' ? null : Number( settings.max ),
						step: settings.step === '' ? null : Number( settings.step ),
						...shared,
					},
				}
			);

			( input as HTMLInputElement ).value = String( context.value ?? '' );
			bind( input, () => context.onChange( readValue( input ) ) );
			host.append( affixed( settings, input ) );

			return;
		}

		case 'true_false': {
			const input = el( 'input', { attrs: { type: 'checkbox', id, 'aria-describedby': describedBy } } ) as HTMLInputElement;

			input.checked = String( context.value ?? '' ) === '1' || context.value === true;
			input.addEventListener( 'change', () => context.onChange( input.checked ? '1' : '0' ) );

			host.append(
				el( 'label', {
					class: 'atcf-switch',
					attrs: { for: id },
					children: [ input, el( 'span', { class: 'atcf-switch__label', text: String( settings.message ?? '' ) } ) ],
				} )
			);

			return;
		}

		case 'select': {
			const choices = normalizeChoices( settings.choices );
			const multiple = Boolean( settings.multiple );
			const node = el( 'select', {
				class: 'atcf-input',
				attrs: { ...shared, multiple: multiple ? true : null },
			} ) as HTMLSelectElement;

			if ( settings.allow_null && ! multiple ) {
				node.append( el( 'option', { text: '— none —', attrs: { value: '' } } ) );
			}

			choices.forEach( ( choice ) => node.append( el( 'option', { text: choice.label, attrs: { value: choice.value } } ) ) );

			const chosen = toArray( context.value ).map( String );

			Array.from( node.options ).forEach( ( option ) => {
				option.selected = chosen.includes( option.value );
			} );

			node.addEventListener( 'change', () => {
				const picked = Array.from( node.selectedOptions ).map( ( option ) => option.value );

				context.onChange( multiple ? picked : picked[ 0 ] ?? '' );
			} );

			host.append( node );

			return;
		}

		case 'radio':
		case 'checkbox':
		case 'button_group': {
			const multiple = field.type === 'checkbox';
			const choices = normalizeChoices( settings.choices );
			const chosen = new Set( toArray( context.value ).map( String ) );
			const fieldset = el( 'fieldset', {
				class: `atcf-choices atcf-choices--${ settings.layout === 'horizontal' ? 'horizontal' : 'vertical' }${
					field.type === 'button_group' ? ' atcf-choices--buttons' : ''
				}`,
				attrs: { 'aria-describedby': describedBy },
				children: [ el( 'legend', { class: 'screen-reader-text', text: field.label } ) ],
			} );

			choices.forEach( ( choice, index ) => {
				const choiceId = `${ id }-${ index }`;
				const input = el( 'input', {
					attrs: {
						type: multiple ? 'checkbox' : 'radio',
						id: choiceId,
						name: multiple ? `${ id }[]` : id,
						value: choice.value,
					},
				} ) as HTMLInputElement;

				input.checked = chosen.has( choice.value );
				input.addEventListener( 'change', () => {
					if ( multiple ) {
						if ( input.checked ) {
							chosen.add( choice.value );
						} else {
							chosen.delete( choice.value );
						}

						context.onChange( Array.from( chosen ) );

						return;
					}

					context.onChange( choice.value );
				} );

				fieldset.append(
					el( 'label', {
						class: 'atcf-choice',
						attrs: { for: choiceId },
						children: [ input, el( 'span', { class: 'atcf-choice__label', text: choice.label } ) ],
					} )
				);
			} );

			host.append( fieldset );

			return;
		}

		case 'date_picker':
		case 'date_time_picker':
		case 'time_picker': {
			const types: Record< string, string > = {
				date_picker: 'date',
				date_time_picker: 'datetime-local',
				time_picker: 'time',
			};

			const input = el( 'input', {
				class: 'atcf-input',
				attrs: { type: types[ field.type ], ...shared },
			} ) as HTMLInputElement;

			input.value = toInputDate( String( context.value ?? '' ), types[ field.type ] );
			input.addEventListener( 'change', () => context.onChange( input.value ) );
			host.append( input );

			return;
		}

		case 'message': {
			host.append( el( 'div', { class: 'atcf-message', text: String( settings.message ?? '' ) } ) );

			return;
		}

		case 'tab':
		case 'accordion': {
			host.append(
				el( 'div', {
					class: `atcf-${ field.type }-marker`,
					text: field.label,
					dataset: { atcfMarker: field.key },
				} )
			);

			return;
		}

		default:
			break;
	}

	// Everything else is a mount: a control the browser has to build. If nothing
	// registered one — a field type from a plugin whose bundle is not on this
	// screen — the value is shown read-only rather than dropped, because a
	// container's JSON is submitted whole and a missing control would blank it.
	const renderer = mountFor( field.type );

	if ( ! renderer ) {
		host.append(
			el( 'p', {
				class: 'atcf-field__unknown',
				text: `${ field.type }: ${ JSON.stringify( context.value ?? null ) }`,
			} )
		);

		return;
	}

	return (
		renderer( {
			host,
			field,
			value: context.value,
			set: context.onChange,
			wrapper: context.wrapper,
		} ) ?? undefined
	);
}

/**
 * Listens for every name a control announces a change under.
 *
 * `input` and `change` alone were not enough and the gap was invisible: the
 * `<os-*>` kit emits its own names, and native `change` is `composed: false` so
 * it never crosses a shadow boundary anyway. A range slider — which emits only
 * `os-range-change` — moved on screen and saved nothing.
 */
function bind( node: HTMLElement, handler: () => void ): void {
	let last: string | null = null;

	CHANGE_EVENTS.forEach( ( name ) =>
		node.addEventListener( name, () => {
			// Several of these fire for one interaction. Reading the value and
			// comparing is cheaper than the double save each duplicate causes.
			const now = readValue( node );

			if ( now === last ) {
				return;
			}

			last = now;
			handler();
		} )
	);
}

/**
 * Wraps a control in its prepend/append affixes.
 *
 * Both are `aria-hidden`: an affix is a visual unit marker beside the input, and
 * a screen reader announcing "dollars, edit text, dollars" for a field labelled
 * "Price" is noise. The unit belongs in the label; the affix is a reminder for
 * people who can see it.
 *
 * @param settings The field's settings.
 * @param node     The control.
 * @return The control, wrapped only when there is something to wrap it in.
 */
function affixed( settings: Record< string, unknown >, node: HTMLElement ): HTMLElement {
	const before = String( settings.prepend ?? '' );
	const after = String( settings.append ?? '' );

	if ( ! before && ! after ) {
		return node;
	}

	return el( 'div', {
		class: 'atcf-affixed',
		children: [
			before ? el( 'span', { class: 'atcf-affix atcf-affix--before', text: before, attrs: { 'aria-hidden': 'true' } } ) : null,
			node,
			after ? el( 'span', { class: 'atcf-affix atcf-affix--after', text: after, attrs: { 'aria-hidden': 'true' } } ) : null,
		],
	} );
}

/** Coerces a stored value into an array. */
function toArray( value: unknown ): unknown[] {
	if ( Array.isArray( value ) ) {
		return value;
	}

	return value === '' || value === null || value === undefined ? [] : [ value ];
}

/**
 * Normalises the `choices` setting the same three ways PHP does.
 *
 * The list form is what the builder writes, the map form is what an ACF import
 * brings, and the one-per-line string is what somebody hand-editing produces.
 * All three are common enough that refusing two would be a bug report a week.
 *
 * @param choices The raw setting.
 * @return `{ value, label }` pairs.
 */
export function normalizeChoices( choices: unknown ): Array< { value: string; label: string } > {
	if ( typeof choices === 'string' ) {
		return choices
			.split( '\n' )
			.map( ( line ) => line.trim() )
			.filter( Boolean )
			.map( ( line ) => {
				const [ value, label ] = line.split( ':' ).map( ( part ) => part.trim() );

				return { value, label: label || value };
			} );
	}

	if ( Array.isArray( choices ) ) {
		return choices
			.map( ( choice ) => {
				if ( choice && typeof choice === 'object' ) {
					const one = choice as { value?: unknown; label?: unknown };

					return { value: String( one.value ?? '' ), label: String( one.label ?? one.value ?? '' ) };
				}

				return { value: String( choice ), label: String( choice ) };
			} )
			.filter( ( choice ) => choice.value !== '' );
	}

	if ( choices && typeof choices === 'object' ) {
		return Object.entries( choices as Record< string, unknown > ).map( ( [ value, label ] ) => ( {
			value,
			label: String( label ?? value ),
		} ) );
	}

	return [];
}

/**
 * Reshapes a stored date for the control that has to show it.
 *
 * `datetime-local` in particular refuses anything with a space instead of a `T`
 * and silently renders empty, which reads as the value having been lost.
 *
 * @param stored    What the store holds.
 * @param inputType The control's type.
 * @return The value the control accepts.
 */
export function toInputDate( stored: string, inputType: string ): string {
	if ( ! stored ) {
		return '';
	}

	if ( inputType === 'time' ) {
		return stored.slice( 0, 5 );
	}

	const iso = stored.replace( ' ', 'T' );

	return inputType === 'date' ? iso.slice( 0, 10 ) : iso.slice( 0, 16 );
}

/** Empties a host and renders a list of fields into it. */
export function renderFields(
	host: HTMLElement,
	fields: Field[],
	values: Record< string, unknown >,
	onChange: ( key: string, value: unknown ) => void
): RenderedField[] {
	clear( host );

	const rendered = fields.map( ( field ) =>
		renderField( field, values[ field.key ], ( value ) => onChange( field.key, value ) )
	);

	rendered.forEach( ( one ) => host.append( one.element ) );

	return rendered;
}

/** The translated label for a container's Add button. */
export function addLabel( settings: Record< string, unknown > ): string {
	return String( settings.button_label ?? t( 'addRow', 'Add row' ) );
}
