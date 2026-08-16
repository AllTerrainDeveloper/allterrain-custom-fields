/**
 * The field, drawn as it will look.
 *
 * The canvas used to be a list of *descriptions* of fields — an icon, the label
 * as static text, the type name underneath. Everything about how a field will
 * actually appear lived in an inspector on the right, or in a preview window you
 * had to open, so the canvas never answered the one question you look at a field
 * builder to answer: **what will this edit screen look like?**
 *
 * Now the card draws the control.
 *
 * # Why this is not a second renderer
 *
 * A builder that draws its own approximation of a control is a builder that
 * drifts from what it ships. Two things stop that here, and both matter.
 *
 * **The stylesheet is the real one.** `builder.css` is registered with
 * `fields.css` as a dependency, so every class the edit screen uses —
 * `.atcf-field__header`, `.atcf-field__label`, `.atcf-input`, `.atcf-choice` — is
 * already in the document. Emitting those class names inside an `.atcf-fields`
 * means the
 * radius, borders, spacing, label position and colours are the ones an author
 * will see, because they are the same CSS. Nothing about the look is
 * reimplemented.
 *
 * **The shapes are a small closed set.** Forty field types share about a dozen
 * visual shapes — a text box, a taller box, a dropdown, a list of options, a
 * switch. This maps a type to a *shape* rather than to markup, and
 * `field-preview.test.ts` asserts that every registered type has one, so a type
 * added later cannot silently render as an empty card.
 *
 * # Everything on the card is edited on the card
 *
 * The control is a `contenteditable` **wearing the real control's class** —
 * `.atcf-input` — so the border, the radius and the padding are the stylesheet's
 * and only the text inside is ours. Type into the box and you are writing the
 * field's placeholder. Type on the label and you are writing the label. Type on
 * an option and you are renaming it; press its × and it is gone; press *Add an
 * option* and there is another.
 *
 * That is the difference between a preview and a builder, and it is the thing
 * two earlier attempts here missed. The first drew divs that merely wore the
 * class names — a grey rectangle where a control should be. The second drew real
 * `<input disabled>` elements, which looked right and could not be touched: a
 * picture of a form rather than the form. Neither answered *"what will this look
 * like, and can I change it here"*, which is the only question a canvas is for.
 *
 * `contenteditable` rather than a real input, for the same reason the label is:
 * an input has a fixed height and its own text metrics, so a control standing in
 * for one has to be told each of them back. A `contenteditable` wearing the
 * class is the control's own box, one line tall, with a caret in it.
 *
 * It is also why the card's header no longer repeats the label — the label is
 * *in* the preview now, and the header says only what type the field is.
 *
 * # What it deliberately does not do
 *
 * It does not run the real control JavaScript. `renderField()` exists, is used
 * by the preview window and the inspector widget, and would be the obvious thing
 * to call — but it mounts media pickers, fetches related posts and boots
 * repeaters. On a canvas of thirteen fields that is thirteen REST round-trips
 * every time you drag a card, to draw something nobody is going to interact with.
 *
 * Nor does it chase pixel fidelity for the elaborate types. A gallery, a
 * location, a flexible-content block render as a labelled placeholder saying what
 * they are. Claiming to be a faithful preview and then being subtly wrong is
 * worse than being visibly a summary.
 */

import { el } from '../ui';
import type { Field, FieldType } from '../types';

/** The visual families a field can be drawn as. */
export type PreviewShape =
	| 'text'
	| 'textarea'
	| 'select'
	| 'options'
	| 'toggle'
	| 'range'
	| 'colour'
	| 'media'
	| 'relational'
	| 'container'
	| 'static'
	| 'computed';

/**
 * Which shape each field type is drawn as.
 *
 * Every registered type is in here. The test asserts it against the live
 * registry rather than against this list, so a type added in PHP and forgotten
 * here fails a test instead of rendering as a blank card that nobody notices
 * until a user reports "the builder looks broken on my site".
 */
const SHAPES: Record< string, PreviewShape > = {
	// Things you type into.
	text: 'text',
	email: 'text',
	url: 'text',
	password: 'text',
	number: 'text',
	date_picker: 'text',
	date_time_picker: 'text',
	time_picker: 'text',
	page_link: 'text',
	oembed: 'text',
	icon: 'text',

	textarea: 'textarea',
	wysiwyg: 'textarea',
	code: 'textarea',
	json: 'textarea',

	select: 'select',
	taxonomy: 'select',

	radio: 'options',
	checkbox: 'options',
	button_group: 'options',

	true_false: 'toggle',

	range: 'range',
	color_picker: 'colour',

	image: 'media',
	file: 'media',
	gallery: 'media',

	post_object: 'relational',
	relationship: 'relational',
	user: 'relational',
	link: 'relational',
	location: 'relational',

	group: 'container',
	repeater: 'container',
	flexible_content: 'container',
	clone: 'container',
	table: 'container',

	message: 'static',
	tab: 'static',
	accordion: 'static',

	computed: 'computed',
};

/**
 * The shape a type is drawn as.
 *
 * @param type Field type slug.
 * @return Its shape; `text` for a type nothing has classified, which is the
 *         least surprising thing an unknown control can look like.
 */
export function shapeFor( type: string ): PreviewShape {
	return SHAPES[ type ] ?? 'text';
}

/** Every type this file knows how to draw. */
export function knownShapes(): string[] {
	return Object.keys( SHAPES );
}

/**
 * Draws a field as it will appear.
 *
 * @param field The field.
 * @param type  Its registered type, for the label and the icon.
 * @return The preview, in an `.atcf-fields` scope so the real CSS applies.
 */
export function renderFieldPreview(
	field: Field,
	type: FieldType | undefined,
	handlers: PreviewHandlers = {}
): HTMLElement {
	const settings = ( field.settings ?? {} ) as Record< string, unknown >;
	const shape = shapeFor( field.type );

	// Every class name below is transcribed from `atcf_render_field()` in
	// `includes/render/controls.php`, which is the markup an author will really
	// get. That transcription is the whole mechanism: `builder.css` depends on
	// `fields.css`, so these names are already styled by the same rules the edit
	// screen uses, and the preview inherits every change made to them.
	const wrap = el( 'div', {
		class: `atcf-fields atcfb__preview atcfb__preview--${ shape }`,
	} );

	const body = el( 'div', {
		class: `atcf-field atcf-field--${ field.type }${ field.required ? ' atcf-field--required' : '' }`,
		style: { '--atcf-width': '100%' } as Record< string, string >,
	} );

	// The furniture types have no header — a tab *is* its label, a message is
	// its text. `atcf_render_field()` makes the same exclusion, by name. A
	// toggle draws its own label beside the switch, exactly as the front end
	// does; a second one above it would be the same words twice.
	if ( 'static' !== shape && 'toggle' !== shape ) {
		body.append(
			el( 'div', {
				class: 'atcf-field__header',
				children: [
					el( 'span', {
						class: 'atcf-field__label',
						children: [
							// The handler itself, not an arrow that closes over it.
							// An arrow is always truthy, so wrapping one made every
							// preview editable — including the read-only ones in the
							// preview window, where a `contenteditable` in a pane
							// nothing listens to is a box that swallows typing.
							editable( field.label, 'Name this field…', handlers.onLabel ),
							field.required
								? el( 'span', { class: 'atcf-field__required', text: ' *' } )
								: null,
						],
					} ),
				],
			} )
		);
	}

	body.append(
		el( 'div', {
			class: 'atcf-field__control',
			children: [ control( shape, field, settings, type, handlers ) ],
		} )
	);

	// Offered whether or not the field has one, which is the difference between
	// a feature you can find and a feature you have to already know about.
	body.append(
		el( 'p', {
			class: 'atcf-field__hint',
			children: [
				editable( field.instructions, 'Add a hint…', handlers.onInstructions ),
			],
		} )
	);

	wrap.append( body );

	return wrap;
}

/**
 * What the canvas wants to know when a card is edited.
 *
 * `onEdit` is a keystroke: change the model, leave the DOM alone, because the
 * caret is inside the element a redraw would replace. `onRestructure` is a
 * change of *shape* — a choice added or removed — where the card genuinely has
 * to be rebuilt.
 *
 * Every handler is optional, and a preview given none of them is inert text.
 * That is what the preview window and the tests want, and it is why they are
 * passed rather than imported.
 */
export interface PreviewHandlers {
	/** The label was rewritten. */
	onLabel?: ( value: string ) => void;
	/** The hint was rewritten. */
	onInstructions?: ( value: string ) => void;
	/** A setting was rewritten in place — the placeholder, a button's wording. */
	onSetting?: ( key: string, value: unknown ) => void;
	/** The choices changed shape. Redraws. */
	onChoices?: ( choices: Array< { value: string; label: string } > ) => void;
}

/**
 * A piece of text that can be rewritten where it sits.
 *
 * A `contenteditable` span rather than an `<input>` styled to look like one: the
 * label has to wrap, sit on the stylesheet's own line-height and inherit its
 * font, and an input does none of those without being told each one — at which
 * point it is an input pretending to be text, and the pretence shows the moment
 * a label is long enough to wrap.
 *
 * `plaintext-only` keeps a paste from bringing markup with it.
 *
 * With no handler it is inert text, which is what the preview window and the
 * tests want.
 *
 * @param value       The text.
 * @param placeholder Shown, greyed, while it is empty.
 * @param onInput     Called on every keystroke; absent means read-only.
 * @return The element.
 */
export function editable(
	value: string,
	placeholder: string,
	onInput?: ( next: string ) => void,
	onCommit?: ( next: string ) => void
): HTMLElement {
	if ( ! onInput && ! onCommit ) {
		return el( 'span', { text: value } );
	}

	const node = el( 'span', {
		class: 'atcfb__editable',
		text: value,
		attrs: {
			contenteditable: 'plaintext-only',
			role: 'textbox',
			spellcheck: 'false',
			'data-placeholder': placeholder,
		},
	} );

	node.addEventListener( 'input', () => onInput?.( node.textContent ?? '' ) );

	// Committed on blur, for the edits that have to be *corrected* — a meta key
	// gets lower-cased and stripped of spaces, and doing that per keystroke means
	// typing "Price per" and watching the caret jump on every space.
	if ( onCommit ) {
		node.addEventListener( 'blur', () => onCommit( node.textContent ?? '' ) );
	}

	// The card is a drag handle and a click target. Neither is what somebody
	// pressing into a word wants, and a pointerdown that starts a drag makes the
	// text impossible to select.
	node.addEventListener( 'pointerdown', ( event ) => event.stopPropagation() );
	node.addEventListener( 'click', ( event ) => event.stopPropagation() );

	node.addEventListener( 'keydown', ( event ) => {
		const key = ( event as KeyboardEvent ).key;

		// Enter would add a line to a label that has one. Escape and the card's
		// own Delete handler must not fire while a caret is in here.
		if ( 'Enter' === key ) {
			event.preventDefault();
			node.blur();
		}

		event.stopPropagation();
	} );

	// So a caller can put the text back after correcting it, without hunting the
	// node down through the DOM.
	( node as unknown as { setText: ( next: string ) => void } ).setText = ( next: string ) => {
		if ( node.textContent !== next ) {
			node.textContent = next;
		}
	};

	return node;
}

/**
 * The control itself, per shape.
 *
 * A `contenteditable` wearing the real class, not a real input. See the file
 * header for why.
 */
function control(
	shape: PreviewShape,
	field: Field,
	settings: Record< string, unknown >,
	type: FieldType | undefined,
	handlers: PreviewHandlers
): HTMLElement {
	const placeholder = () =>
		editable(
			String( settings.placeholder ?? '' ),
			'Placeholder…',
			handlers.onSetting && ( ( value ) => handlers.onSetting?.( 'placeholder', value ) )
		);

	switch ( shape ) {
		case 'text':
			return box( placeholder(), 'atcf-input' );

		case 'textarea':
			return box( placeholder(), 'atcf-input atcfb__preview-box--tall' );

		case 'select':
			// The chevron is drawn on the wrapper, so the box itself stays a
			// plain editable area.
			return el( 'div', {
				class: 'atcfb__preview-select',
				children: [ box( firstChoice( settings, handlers ), 'atcf-input' ) ],
			} );

		case 'options':
			return options( field, settings, handlers );

		case 'toggle':
			// The whole control, label included, exactly as
			// `atcf_control_true_false()` prints it.
			return el( 'span', {
				class: 'atcf-switch',
				children: [
					el( 'span', { class: 'atcf-switch__track', attrs: { 'aria-hidden': 'true' } } ),
					el( 'span', {
						class: 'atcf-switch__label',
						children: [
							editable(
								String( settings.message ?? '' ) || field.label,
								'What does this turn on?…',
								handlers.onLabel
							),
						],
					} ),
				],
			} );

		case 'range':
			return el( 'div', { class: 'atcfb__preview-range' } );

		case 'colour':
			return el( 'div', {
				class: 'atcfb__preview-colour',
				style: { background: swatch( settings ) } as Record< string, string >,
			} );

		case 'media':
			return el( 'div', {
				class: 'atcfb__preview-drop',
				text: 'gallery' === field.type ? 'Drop images here' : 'Drop a file here',
			} );

		case 'relational':
			return box(
				editable(
					'',
					'location' === field.type ? 'Search for an address…' : 'Search…',
					undefined
				),
				'atcf-input atcfb__preview-search'
			);

		case 'container':
			return el( 'div', {
				class: 'atcfb__preview-rows',
				children: [
					el( 'div', { class: 'atcfb__preview-row' } ),
					el( 'div', { class: 'atcfb__preview-row' } ),
					el( 'span', {
						class: 'atcfb__preview-add',
						children: [
							editable(
								String( settings.button_label ?? '' ),
								'Add row',
								handlers.onSetting && ( ( value ) => handlers.onSetting?.( 'button_label', value ) )
							),
						],
					} ),
				],
			} );

		case 'static':
			return el( 'div', {
				class: `atcfb__preview-static atcfb__preview-static--${ field.type }`,
				children: [
					editable(
						String( settings.message ?? '' ) || field.label || String( type?.label ?? field.type ),
						'message' === field.type ? 'Write the note…' : 'Name this section…',
						handlers.onLabel
					),
				],
			} );

		case 'computed':
			// Its own shape, because a computed field is the one control an
			// author never touches — it is an answer, not a question. Drawing it
			// as a text box would say the opposite.
			return el( 'div', {
				class: 'atcfb__preview-computed',
				children: [
					el( 'span', { class: 'atcfb__preview-computed-value', text: '—' } ),
					el( 'code', {
						class: 'atcfb__preview-formula',
						text: String( settings.formula ?? 'no formula yet' ),
					} ),
				],
			} );

		default:
			return box( placeholder(), 'atcf-input' );
	}
}

/**
 * A control's box: the real class, with something editable inside it.
 *
 * `min-block-size: 1lh` in the stylesheet keeps it one line tall rather than the
 * height a real input would be. A card is a glance at a field, not a rehearsal
 * of it, and thirteen full-height inputs make a canvas nobody can scan.
 *
 * @param inside The editable text.
 * @param css    The real control class, plus any modifier.
 * @return The box.
 */
function box( inside: HTMLElement, css: string ): HTMLElement {
	return el( 'div', { class: `${ css } atcfb__preview-box`, children: [ inside ] } );
}

/**
 * The options, each renamed, removed or added where it sits.
 *
 * The remove button appears on hover rather than sitting there: a column of ×
 * buttons beside every option is a canvas that looks like it is asking to be
 * dismantled.
 */
function options( field: Field, settings: Record< string, unknown >, handlers: PreviewHandlers ): HTMLElement {
	const list = (
		Array.isArray( settings.choices ) ? settings.choices : []
	) as Array< { value?: string; label?: string } >;

	const buttons = 'button_group' === field.type;

	const wrap = el( 'div', {
		class: `atcf-choices atcf-choices--${ String( settings.layout ?? 'vertical' ) }${
			buttons ? ' atcf-choices--buttons' : ''
		}`,
	} );

	/** Hands the canvas a whole new list; it redraws. */
	const commit = ( next: Array< { value?: string; label?: string } > ) =>
		handlers.onChoices?.(
			// `||`, not `??`. A new option arrives with an empty string for both,
			// and `??` only catches null — so every added option was named `` and
			// two of them collided on the same value.
			next.map( ( one, index ) => ( {
				value: String( one.value || one.label || `option_${ index + 1 }` ),
				label: String( one.label ?? one.value ?? '' ),
			} ) )
		);

	// Six, then a count. A card is a glance; a choice field with forty options
	// would otherwise make its card taller than the rest of the canvas.
	list.slice( 0, 6 ).forEach( ( choice, index ) => {
		const row = el( 'span', {
			class: 'atcf-choice atcfb__preview-option',
			children: [
				el( 'span', { class: 'atcfb__preview-tick', attrs: { 'aria-hidden': 'true' } } ),
				el( 'span', {
					class: 'atcf-choice__label',
					children: [
						editable(
							String( choice.label ?? choice.value ?? '' ),
							`Option ${ index + 1 }…`,
							handlers.onChoices &&
								( ( value ) => {
									// The live list, rebuilt from this one edit. The
									// canvas is not redrawn — see `PreviewHandlers` —
									// so nothing under the caret is replaced.
									const next = list.slice();

									next[ index ] = { ...next[ index ], label: value };
									commit( next );
								} ),
						),
					],
				} ),
			],
		} );

		if ( handlers.onChoices ) {
			row.append(
				el( 'button', {
					class: 'atcfb__preview-remove',
					text: '×',
					attrs: { type: 'button', 'aria-label': `Remove option ${ index + 1 }` },
					on: {
						click: ( event ) => {
							event.stopPropagation();
							commit( list.filter( ( _, at ) => at !== index ) );
						},
					},
				} )
			);
		}

		wrap.append( row );
	} );

	if ( list.length > 6 ) {
		wrap.append(
			el( 'span', { class: 'atcfb__preview-more', text: `and ${ list.length - 6 } more` } )
		);
	}

	if ( handlers.onChoices ) {
		wrap.append(
			el( 'button', {
				class: 'atcfb__preview-addoption',
				text: list.length ? 'Add an option' : 'Add the first option',
				attrs: { type: 'button' },
				on: {
					click: ( event ) => {
						event.stopPropagation();
						commit( list.concat( [ { value: '', label: '' } ] ) );
					},
				},
			} )
		);
	}

	return wrap;
}

/** What a dropdown is showing: its first option, editable. */
function firstChoice( settings: Record< string, unknown >, handlers: PreviewHandlers ): HTMLElement {
	const list = (
		Array.isArray( settings.choices ) ? settings.choices : []
	) as Array< { value?: string; label?: string } >;

	const first = list[ 0 ];

	return editable(
		String( first?.label ?? first?.value ?? '' ),
		'Add the first option…',
		handlers.onChoices &&
			( ( value ) => {
				const next = list.length ? list.slice() : [ { value: '', label: '' } ];

				next[ 0 ] = { ...next[ 0 ], label: value };
				handlers.onChoices?.(
					next.map( ( one, index ) => ( {
						value: String( one.value || one.label || `option_${ index + 1 }` ),
						label: String( one.label ?? one.value ?? '' ),
					} ) )
				);
			} )
	);
}

/** A colour field's default, or a neutral if it has none. */
function swatch( settings: Record< string, unknown > ): string {
	const value = String( settings.default_value ?? '' );

	return /^#[0-9a-f]{6}$/i.test( value ) ? value : '#3858e9';
}
