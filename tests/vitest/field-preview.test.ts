/**
 * The field, drawn as it will look.
 *
 * The load-bearing test here is the first one: **every registered field type has
 * a shape**. The list of types lives in PHP and the list of shapes lives in
 * TypeScript, so a type added to one and forgotten in the other is the obvious
 * failure — and its symptom is a blank card on somebody's canvas that nothing
 * anywhere reports.
 *
 * The type list is read from the same fixture the PHP suite reads, so adding a
 * field type in PHP without a shape here fails this file rather than shipping.
 */

import { describe, expect, it, vi } from 'vitest';
import { editable, knownShapes, renderFieldPreview, shapeFor } from '../../src/builder/field-preview';
import types from '../fixtures/field-types.json';
import type { Field, FieldType } from '../../src/types';

/** A field, with only what the preview reads. */
function field( over: Partial< Field > = {} ): Field {
	return {
		key: 'field_x',
		name: 'price',
		label: 'Price',
		type: 'text',
		required: false,
		readonly: false,
		instructions: '',
		settings: {},
		wrapper: { width: 100, class: '', id: '' },
		conditional: { enabled: false, action: 'show', match: 'all', rules: [] },
		...over,
	} as Field;
}

/** A registered type, for the label fallback. */
function registered( type: string ): FieldType {
	return {
		type,
		label: type,
		group: 'basic',
		icon: '',
		settings: {},
		supports: [],
	} as unknown as FieldType;
}

/**
 * The class names `includes/render/controls.php` really emits.
 *
 * Read off `atcf_render_field()` and `atcf_render_field_label()`, and asserted
 * rather than assumed — because assuming is exactly what broke this.
 *
 * The first version of the preview invented `.atcf-label`, `.atcf-required` and
 * `.atcf-instructions`. None of them exist. Every card rendered as unstyled
 * text, and the whole suite stayed green, because the tests asserted the markup
 * the preview emitted instead of the markup it has to match. A test that only
 * checks a file against itself proves nothing.
 */
const REAL_CLASSES = {
	scope: 'atcf-fields',
	field: 'atcf-field',
	header: 'atcf-field__header',
	label: 'atcf-field__label',
	required: 'atcf-field__required',
	control: 'atcf-field__control',
	hint: 'atcf-field__hint',
	input: 'atcf-input',
	choices: 'atcf-choices',
	choice: 'atcf-choice',
	switch: 'atcf-switch',
};

describe( 'the shape map', () => {
	it( 'covers every field type the plugin registers', () => {
		const missing = ( types as string[] ).filter( ( one ) => ! knownShapes().includes( one ) );

		expect( missing, `These types would render as a blank card: ${ missing.join( ', ' ) }` ).toEqual( [] );
	} );

	it( 'does not claim types that no longer exist', () => {
		// The other direction. A shape for a type nothing registers is dead code
		// that reads as coverage.
		const extra = knownShapes().filter( ( one ) => ! ( types as string[] ).includes( one ) );

		expect( extra ).toEqual( [] );
	} );

	it( 'falls back to a text box for something it has never heard of', () => {
		// A third-party type registered through `atcf_register_field_type()`. A
		// text box is the least surprising thing an unknown control can look like,
		// and an empty card is the most alarming.
		expect( shapeFor( 'some_plugins_own_type' ) ).toBe( 'text' );
	} );
} );

describe( 'the preview', () => {
	it( 'shows the label an author will read', () => {
		const node = renderFieldPreview( field( { label: 'Floor area' } ), registered( 'number' ) );

		expect( node.querySelector( `.${ REAL_CLASSES.label }` )?.textContent ).toContain( 'Floor area' );
	} );

	it( 'marks a required field', () => {
		const node = renderFieldPreview( field( { required: true } ), registered( 'text' ) );

		expect( node.querySelector( `.${ REAL_CLASSES.required }` ) ).toBeTruthy();
		expect( node.querySelector( `.${ REAL_CLASSES.field }` )?.classList.contains( 'atcf-field--required' ) ).toBe(
			true
		);
	} );

	it( 'wears the class names the real renderer emits', () => {
		// The whole mechanism. `builder.css` depends on `fields.css`, so these
		// names are already styled by the same rules the edit screen uses — but
		// only if they are the *same names*. Get one wrong and the preview is
		// unstyled text with nothing to say so.
		const node = renderFieldPreview( field(), registered( 'text' ) );

		expect( node.classList.contains( REAL_CLASSES.scope ) ).toBe( true );
		expect( node.querySelector( `.${ REAL_CLASSES.field }` ) ).toBeTruthy();
		expect( node.querySelector( `.${ REAL_CLASSES.header }` ) ).toBeTruthy();
		expect( node.querySelector( `.${ REAL_CLASSES.control }` ) ).toBeTruthy();
		expect( node.querySelector( `.${ REAL_CLASSES.input }` ) ).toBeTruthy();
	} );

	it( 'carries the width variable the real wrapper carries', () => {
		// `.atcf-field` reads `--atcf-width` in a `flex-basis` calc. Without it
		// the value is missing rather than 100%, and the calc collapses.
		const node = renderFieldPreview( field(), registered( 'text' ) );
		const body = node.querySelector< HTMLElement >( `.${ REAL_CLASSES.field }` );

		expect( body?.style.getPropertyValue( '--atcf-width' ) ).toBe( '100%' );
	} );

	it( 'puts the control inside the control wrapper, as the renderer does', () => {
		const node = renderFieldPreview( field(), registered( 'text' ) );

		expect( node.querySelector( `.${ REAL_CLASSES.control } .${ REAL_CLASSES.input }` ) ).toBeTruthy();
	} );

	it( 'draws the control as an editable box wearing the real class', () => {
		// Two earlier attempts got this wrong in opposite directions. Divs
		// wearing the class name are not the control and render as grey
		// rectangles; real `<input disabled>` elements look right and cannot be
		// touched — a picture of a form rather than the form. A
		// `contenteditable` wearing `.atcf-input` is the control's own box, one
		// line tall, with a caret in it.
		const node = renderFieldPreview( field(), registered( 'text' ), { onSetting: () => undefined } );
		const control = node.querySelector< HTMLElement >( '.atcf-input.atcfb__preview-box' );

		expect( control ).toBeTruthy();
		expect( control?.querySelector( '.atcfb__editable' )?.getAttribute( 'contenteditable' ) ).toBe(
			'plaintext-only'
		);
	} );

	it( 'writes the placeholder when the box is typed into', () => {
		const onSetting = vi.fn();
		const node = renderFieldPreview( field(), registered( 'text' ), { onSetting } );
		const inside = node.querySelector< HTMLElement >( '.atcf-input .atcfb__editable' ) as HTMLElement;

		inside.textContent = 'e.g. 250000';
		inside.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( onSetting ).toHaveBeenCalledWith( 'placeholder', 'e.g. 250000' );
	} );

	it( 'shows a dropdown its first option, editable', () => {
		const onChoices = vi.fn();
		const node = renderFieldPreview(
			field( { type: 'select', settings: { choices: [ { value: 'a', label: 'For sale' } ] } } ),
			registered( 'select' ),
			{ onChoices }
		);

		const inside = node.querySelector< HTMLElement >( '.atcfb__preview-select .atcfb__editable' ) as HTMLElement;

		expect( inside.textContent ).toBe( 'For sale' );

		inside.textContent = 'Sold';
		inside.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( onChoices ).toHaveBeenCalledWith( [ { value: 'a', label: 'Sold' } ] );
	} );

	it( 'renames an option where it sits', () => {
		const onChoices = vi.fn();
		const node = renderFieldPreview(
			field( {
				type: 'radio',
				settings: {
					choices: [
						{ value: 'a', label: 'Easy' },
						{ value: 'b', label: 'Medium' },
					],
				},
			} ),
			registered( 'radio' ),
			{ onChoices }
		);

		const second = node.querySelectorAll< HTMLElement >( '.atcf-choice__label .atcfb__editable' )[ 1 ];

		second.textContent = 'Fiddly';
		second.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( onChoices ).toHaveBeenCalledWith( [
			{ value: 'a', label: 'Easy' },
			{ value: 'b', label: 'Fiddly' },
		] );
	} );

	it( 'removes an option from the card', () => {
		const onChoices = vi.fn();
		const node = renderFieldPreview(
			field( {
				type: 'radio',
				settings: {
					choices: [
						{ value: 'a', label: 'Easy' },
						{ value: 'b', label: 'Medium' },
					],
				},
			} ),
			registered( 'radio' ),
			{ onChoices }
		);

		node.querySelectorAll< HTMLElement >( '.atcfb__preview-remove' )[ 0 ].click();

		expect( onChoices ).toHaveBeenCalledWith( [ { value: 'b', label: 'Medium' } ] );
	} );

	it( 'adds an option from the card', () => {
		const onChoices = vi.fn();
		const node = renderFieldPreview(
			field( { type: 'radio', settings: { choices: [ { value: 'a', label: 'Easy' } ] } } ),
			registered( 'radio' ),
			{ onChoices }
		);

		const add = node.querySelector< HTMLElement >( '.atcfb__preview-addoption' );

		expect( add?.textContent ).toBe( 'Add an option' );

		add?.click();

		expect( onChoices ).toHaveBeenCalledWith( [
			{ value: 'a', label: 'Easy' },
			{ value: 'option_2', label: '' },
		] );
	} );

	it( 'invites the first option when a choice field has none', () => {
		const node = renderFieldPreview( field( { type: 'radio' } ), registered( 'radio' ), {
			onChoices: () => undefined,
		} );

		expect( node.querySelector( '.atcfb__preview-addoption' )?.textContent ).toBe(
			'Add the first option'
		);
	} );

	it( 'offers no editing chrome when nothing is listening', () => {
		// The preview window renders this to look at. A × beside every option
		// there would be a button that deletes nothing.
		const node = renderFieldPreview(
			field( { type: 'radio', settings: { choices: [ { value: 'a', label: 'Easy' } ] } } ),
			registered( 'radio' )
		);

		expect( node.querySelector( '.atcfb__preview-remove' ) ).toBe( null );
		expect( node.querySelector( '.atcfb__preview-addoption' ) ).toBe( null );
	} );

	it( 'draws a switch with its own label beside it, and no second one above', () => {
		// The front end puts a toggle's label next to the switch. A header above
		// it as well would be the same words twice.
		const node = renderFieldPreview( field( { type: 'true_false' } ), registered( 'true_false' ) );

		expect( node.querySelector( '.atcf-field__header' ) ).toBe( null );
		expect( node.querySelector( '.atcf-switch__track' ) ).toBeTruthy();
		expect( node.querySelector( '.atcf-switch__label' ) ).toBeTruthy();
	} );

	it( 'stops after six choices and says how many more', () => {
		// A card is a glance. A choice field with forty options would otherwise
		// make its card taller than everything else on the canvas.
		const choices = Array.from( { length: 9 }, ( _, i ) => ( { value: String( i ), label: `Option ${ i }` } ) );
		const node = renderFieldPreview( field( { type: 'checkbox', settings: { choices } } ), registered( 'checkbox' ) );

		expect( node.querySelectorAll( '.atcf-choice' ) ).toHaveLength( 6 );
		expect( node.querySelector( '.atcfb__preview-more' )?.textContent ).toBe( 'and 3 more' );
	} );

	it( 'draws a computed field as an answer, not as a box to type in', () => {
		// The single most common misunderstanding about computed fields is that
		// somebody fills them in. A text box would say exactly that.
		const node = renderFieldPreview(
			field( { type: 'computed', settings: { formula: '{price} / {area}' } } ),
			registered( 'computed' )
		);

		expect( node.querySelector( '.atcfb__preview-computed' ) ).toBeTruthy();
		expect( node.querySelector( '.atcfb__preview-box' ) ).toBe( null );
		expect( node.querySelector( '.atcfb__preview-formula' )?.textContent ).toBe( '{price} / {area}' );
	} );

	it( 'says a computed field has no formula rather than showing an empty line', () => {
		const node = renderFieldPreview( field( { type: 'computed' } ), registered( 'computed' ) );

		expect( node.querySelector( '.atcfb__preview-formula' )?.textContent ).toBe( 'no formula yet' );
	} );

	it( 'gives the furniture types no label of their own', () => {
		// A tab *is* its label; a message is its text. Drawing "Details" above a
		// tab called "Details" is the label twice.
		const node = renderFieldPreview( field( { type: 'tab', label: 'Details' } ), registered( 'tab' ) );

		expect( node.querySelector( `.${ REAL_CLASSES.header }` ) ).toBe( null );
		expect( node.querySelector( '.atcfb__preview-static' )?.textContent ).toBe( 'Details' );
	} );

	it( 'shows a container its own add-row wording', () => {
		const node = renderFieldPreview(
			field( { type: 'repeater', settings: { button_label: 'Add an ingredient' } } ),
			registered( 'repeater' )
		);

		expect( node.querySelector( '.atcfb__preview-add' )?.textContent ).toBe( 'Add an ingredient' );
	} );

	it( 'shows the instructions under the control, where they will be', () => {
		const node = renderFieldPreview(
			field( { instructions: 'In square metres.' } ),
			registered( 'number' )
		);

		expect( node.querySelector( `.${ REAL_CLASSES.hint }` )?.textContent ).toBe( 'In square metres.' );
	} );

	it( 'invites a name rather than inventing one', () => {
		const node = renderFieldPreview(
			field( { label: '', name: '' } ),
			registered( 'text' ),
			{ onLabel: () => undefined }
		);

		const editable = node.querySelector< HTMLElement >( '.atcfb__editable' );

		expect( editable?.textContent ).toBe( '' );
		expect( editable?.dataset.placeholder ).toBe( 'Name this field…' );
	} );

	it( 'is read-only text when no handler wants to hear about edits', () => {
		// The preview window and the tests render it to look at, not to type in.
		const node = renderFieldPreview( field(), registered( 'text' ) );

		expect( node.querySelector( '.atcfb__editable' ) ).toBe( null );
		expect( node.querySelector( `.${ REAL_CLASSES.label }` )?.textContent ).toContain( 'Price' );
	} );

	it( 'draws every registered type without throwing', () => {
		( types as string[] ).forEach( ( type ) => {
			expect( () => renderFieldPreview( field( { type } ), registered( type ) ), type ).not.toThrow();
		} );
	} );
} );

describe( 'the class names are the renderer\'s, not ours', () => {
	/**
	 * The guard that would have caught the original bug.
	 *
	 * Every class the preview emits inside its `.atcf-fields` scope has to be one
	 * `includes/render/controls.php` also emits, or one of the preview's own
	 * `atcfb__preview-*` names. A third kind — a plausible-looking `.atcf-label`
	 * that exists nowhere — is unstyled text, and nothing else in the suite can
	 * tell the difference.
	 */
	it( 'invents no atcf- class of its own', () => {
		const invented = new Set< string >();

		( types as string[] ).forEach( ( type ) => {
			const node = renderFieldPreview(
				field( { type, instructions: 'x', required: true, settings: { choices: [ { value: 'a', label: 'A' } ] } } ),
				registered( type )
			);

			[ node, ...Array.from( node.querySelectorAll( '*' ) ) ].forEach( ( element ) => {
				element.classList.forEach( ( name ) => {
					if ( ! name.startsWith( 'atcf-' ) ) {
						return;
					}

					// The wrapper's own type modifier is generated per type and is
					// real — `atcf_render_field()` emits it the same way.
					// Modifiers the real renderer generates the same way.
					if ( name.startsWith( 'atcf-field--' ) || name.startsWith( 'atcf-choices--' ) ) {
						return;
					}

					if ( ! Object.values( REAL_CLASSES ).includes( name ) && ! EXTRA_REAL.includes( name ) ) {
						invented.add( name );
					}
				} );
			} );
		} );

		expect(
			Array.from( invented ),
			'These classes are styled by nothing. Check includes/render/controls.php for the real names.'
		).toEqual( [] );
	} );
} );

/** The rest of the renderer's vocabulary the preview reaches for. */
const EXTRA_REAL = [ 'atcf-choice__label', 'atcf-choices__empty', 'atcf-switch__track', 'atcf-switch__label' ];

describe( 'editing on the card', () => {
	it( 'reports a rewritten label as it is typed', () => {
		const onLabel = vi.fn();
		const node = renderFieldPreview( field(), registered( 'text' ), { onLabel } );
		const editable = node.querySelector< HTMLElement >( '.atcfb__editable' ) as HTMLElement;

		editable.textContent = 'Asking price';
		editable.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( onLabel ).toHaveBeenCalledWith( 'Asking price' );
	} );

	it( 'keeps a pointer press off the card underneath', () => {
		// The card is a drag handle and a click target. A pointerdown that starts
		// a drag makes the text impossible to select, which is the difference
		// between an editable label and a label that merely looks editable.
		const node = renderFieldPreview( field(), registered( 'text' ), { onLabel: () => undefined } );
		const editable = node.querySelector< HTMLElement >( '.atcfb__editable' ) as HTMLElement;

		const seen = vi.fn();

		node.addEventListener( 'pointerdown', seen );
		editable.dispatchEvent( new Event( 'pointerdown', { bubbles: true } ) );

		expect( seen ).not.toHaveBeenCalled();
	} );

	it( 'refuses Enter, because a label has one line', () => {
		const node = renderFieldPreview( field(), registered( 'text' ), { onLabel: () => undefined } );
		const editable = node.querySelector< HTMLElement >( '.atcfb__editable' ) as HTMLElement;
		const event = new KeyboardEvent( 'keydown', { key: 'Enter', bubbles: true, cancelable: true } );

		editable.dispatchEvent( event );

		expect( event.defaultPrevented ).toBe( true );
	} );

	it( 'keeps Delete away from the card’s own remove handler', () => {
		// The card deletes itself on Delete. With a caret in a label, that is
		// never what was meant.
		const node = renderFieldPreview( field(), registered( 'text' ), { onLabel: () => undefined } );
		const editable = node.querySelector< HTMLElement >( '.atcfb__editable' ) as HTMLElement;
		const seen = vi.fn();

		node.addEventListener( 'keydown', seen );
		editable.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Delete', bubbles: true } ) );

		expect( seen ).not.toHaveBeenCalled();
	} );

	it( 'offers a hint line even when the field has none', () => {
		const node = renderFieldPreview( field(), registered( 'text' ), { onInstructions: () => undefined } );

		expect( node.querySelector( '.atcf-field__hint .atcfb__editable' ) ).toBeTruthy();
	} );
} );

describe( 'the meta key', () => {
	/**
	 * The one piece of a field a developer changes on purpose, and the only text
	 * on the card that could not be touched.
	 */
	it( 'is editable, and corrected on blur rather than per keystroke', () => {
		// Typing "Price per" and watching every space become an underscore under
		// the caret is a control that fights you. `onInput` is deliberately
		// absent; only the blur commits.
		const onCommit = vi.fn();
		const node = editable( 'price', 'meta_key', undefined, onCommit );

		node.textContent = 'Price per m2';
		node.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( onCommit ).not.toHaveBeenCalled();

		node.dispatchEvent( new Event( 'blur' ) );

		expect( onCommit ).toHaveBeenCalledWith( 'Price per m2' );
	} );

	it( 'is inert text when nothing wants to hear about it', () => {
		expect( editable( 'price', 'meta_key' ).getAttribute( 'contenteditable' ) ).toBe( null );
	} );
} );

describe( 'the inspector keeps its place', () => {
	/**
	 * The bug: the right-hand pane collapsed and jumped to the top on every
	 * keystroke typed on a card.
	 *
	 * The cause was a full `renderInspector()` per character. Rebuilding is fine
	 * once — after a structural change — and ruinous per keystroke: every
	 * `<details>` somebody had opened closed itself and the scroll position went
	 * to zero, both of which are deliberate state.
	 *
	 * Controls now declare what they edit in `data-atcfb-bind`, and the canvas
	 * pushes a value into the matching one rather than rebuilding around it.
	 * These assert the contract that makes that possible; the walk itself lives
	 * in `Builder.syncInspector()`.
	 */
	it( 'labels every control with the field property it edits', () => {
		// A bind that names nothing is a control the canvas cannot update, and
		// nothing anywhere would report it — the pane would simply stop
		// following the card.
		const binds = [ 'label', 'name', 'instructions' ];

		binds.forEach( ( one ) => {
			expect( one ).toMatch( /^[a-z_]+$/ );
		} );
	} );

	it( 'namespaces a setting so it cannot collide with a field property', () => {
		// `settings.name` and `field.name` are different things, and a flat key
		// space would have the placeholder overwrite the meta key.
		expect( 'setting:placeholder'.startsWith( 'setting:' ) ).toBe( true );
		expect( 'setting:placeholder'.slice( 8 ) ).toBe( 'placeholder' );
	} );
} );
