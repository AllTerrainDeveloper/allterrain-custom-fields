/**
 * The formula box.
 *
 * The tokeniser has its own tests; these cover the part that turns tokens into
 * something on a screen, and the wiring around it. What is deliberately not
 * tested here is caret restoration: it needs a real Selection over a real layout,
 * and jsdom's is a stub that would pass whatever it was given. Asserting on it
 * would be worse than not asserting — a green test that proves nothing about the
 * behaviour it names.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderFormulaEditor } from '../../src/builder/formula-editor';
import { openFormulaLab } from '../../src/builder/formula-lab';

/** The editor, with a small realistic vocabulary. */
function build( value: string, onChange = vi.fn() ) {
	const wrap = renderFormulaEditor( {
		value,
		fields: [
			{ name: 'price', label: 'Price' },
			{ name: 'floor_area', label: 'Floor area' },
		],
		functions: [ 'round', 'sum', 'if' ],
		onChange,
	} );

	document.body.append( wrap );

	return {
		wrap,
		onChange,
		box: wrap.querySelector< HTMLElement >( '.atcfb__formula' ) as HTMLElement,
		hint: wrap.querySelector< HTMLElement >( '.atcfb__formula-hint' ) as HTMLElement,
		problem: wrap.querySelector< HTMLElement >( '.atcfb__formula-problem' ) as HTMLElement,
		chips: () => Array.from( wrap.querySelectorAll( '.atcfb__chip' ) ) as HTMLElement[],
		tokens: () => Array.from( wrap.querySelectorAll( '.atcfb__token' ) ) as HTMLElement[],
	};
}

beforeEach( () => {
	document.body.replaceChildren();
} );

describe( 'the formula box', () => {
	it( 'draws a known field as a chip', () => {
		const { tokens } = build( '{price} * 2' );
		const field = tokens().find( ( node ) => node.classList.contains( 'atcfb__token--field' ) );

		expect( field?.textContent ).toBe( '{price}' );
		expect( field?.classList.contains( 'is-unknown' ) ).toBe( false );
	} );

	it( 'draws a field nothing is called as visibly wrong', () => {
		const { tokens, problem } = build( '{floor_aera} * 2' );
		const field = tokens().find( ( node ) => node.classList.contains( 'atcfb__token--field' ) );

		expect( field?.classList.contains( 'is-unknown' ) ).toBe( true );

		// And says so in words. A chip drawn in red says *something* is wrong;
		// a sentence says what, which is the difference between a hint and a
		// puzzle.
		expect( problem.classList.contains( 'is-shown' ) ).toBe( true );
		expect( problem.textContent ).toContain( 'floor_aera' );
	} );

	it( 'says nothing when the formula resolves', () => {
		const { problem } = build( 'round({price}, 2)' );

		expect( problem.classList.contains( 'is-shown' ) ).toBe( false );
		expect( problem.textContent ).toBe( '' );
	} );

	it( 'mentions brackets that do not close', () => {
		expect( build( 'round({price}' ).problem.textContent ).toContain( 'brackets' );
	} );

	it( 'says nothing at all about an empty box', () => {
		// An empty formula is not a broken formula. Complaining about the
		// brackets in an empty box is the classic over-eager validator.
		expect( build( '' ).problem.classList.contains( 'is-shown' ) ).toBe( false );
	} );

	it( 'keeps the text exactly as stored', () => {
		const spaced = '{price}   *   2';

		expect( build( spaced ).box.textContent ).toBe( spaced );
	} );

	it( 'makes chips uneditable so the caret steps over them whole', () => {
		const { tokens } = build( '{price}' );

		expect( tokens()[ 0 ].getAttribute( 'contenteditable' ) ).toBe( 'false' );
	} );

	it( 'offers every field and every function in the palette', () => {
		const { chips } = build( '' );
		const labels = chips().map( ( chip ) => chip.textContent );

		expect( labels ).toEqual( [ 'Price', 'Floor area', 'round()', 'sum()', 'if()' ] );
	} );

	it( 'labels a field chip readably and says which meta key it inserts', () => {
		// Two different strings on purpose: a person picks "Floor area" and the
		// engine needs `{floor_area}`. Showing the meta key in the palette would
		// be asking somebody to recognise their own field by its slug — so the
		// chip is readable and the hint underneath names the key.
		const { chips, hint } = build( '' );

		expect( chips()[ 1 ].textContent ).toBe( 'Floor area' );

		chips()[ 1 ].dispatchEvent( new Event( 'pointerenter' ) );

		expect( hint.textContent ).toContain( '{floor_area}' );
		expect( hint.textContent ).toContain( 'Floor area' );
	} );

	it( 'explains a function under the palette, not in a tooltip', () => {
		// A `title` waits a second, is invisible on a touch screen, and cannot be
		// read by somebody tabbing through. The panel shows the same sentence at
		// once, and shows it on focus as well as on hover.
		const { chips, hint } = build( '' );
		const round = chips().find( ( chip ) => chip.textContent === 'round()' ) as HTMLElement;

		round.dispatchEvent( new Event( 'pointerenter' ) );

		expect( hint.textContent ).toContain( 'round(number, places)' );
		expect( hint.textContent ).toContain( 'Leave off places' );
	} );

	it( 'explains on focus too, for anybody tabbing through', () => {
		const { chips, hint } = build( '' );

		chips()[ 0 ].dispatchEvent( new Event( 'focus' ) );

		expect( hint.textContent ).not.toBe( '' );
	} );

	it( 'clears the explanation when the pointer leaves', () => {
		const { chips, hint } = build( '' );

		chips()[ 0 ].dispatchEvent( new Event( 'pointerenter' ) );
		chips()[ 0 ].dispatchEvent( new Event( 'pointerleave' ) );

		expect( hint.textContent ).toBe( '' );
	} );

	it( 'names every parameter of if, which is where people give up', () => {
		// `if(test, then, otherwise)` on its own says nothing about what may go
		// in `test`, and that is the entire difficulty of the function.
		const { chips, hint } = build( '' );
		const branch = chips().find( ( chip ) => chip.textContent === 'if()' ) as HTMLElement;

		branch.dispatchEvent( new Event( 'pointerenter' ) );

		expect( hint.textContent ).toContain( 'test' );
		expect( hint.textContent ).toContain( 'otherwise' );
		expect( hint.textContent ).toContain( '==' );
	} );

	it( 'inserts a field when its chip is pressed, and reports it', () => {
		const { chips, box, onChange } = build( '' );

		chips()[ 0 ].click();

		expect( box.textContent ).toBe( '{price}' );
		expect( onChange ).toHaveBeenCalledWith( '{price}' );
	} );

	it( 'redraws the inserted field as a token', () => {
		const { chips, tokens } = build( '' );

		chips()[ 0 ].click();

		expect( tokens().some( ( node ) => node.classList.contains( 'atcfb__token--field' ) ) ).toBe( true );
	} );

	it( 'appends rather than replacing when there is already a formula', () => {
		const { chips, box } = build( '2 * ' );

		chips()[ 0 ].click();

		expect( box.textContent ).toBe( '2 * {price}' );
	} );

	it( 'inserts a function with its brackets', () => {
		const { chips, box } = build( '' );

		chips()[ 2 ].click();

		expect( box.textContent ).toBe( 'round()' );
	} );

	it( 'reports whatever is typed, however it arrived', () => {
		const { box, onChange } = build( '' );

		// What the browser leaves behind after a keystroke, a paste, a drop or
		// dictation — the listener reads the text back rather than tracking how
		// it got there.
		box.textContent = '{price} + 1';
		box.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( onChange ).toHaveBeenCalledWith( '{price} + 1' );
	} );

	it( 'tokenises what was typed, not only what was inserted', () => {
		const { box, tokens } = build( '' );

		box.textContent = 'sum({price})';
		box.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( tokens().map( ( node ) => node.textContent ) ).toContain( 'sum' );
		expect( tokens().map( ( node ) => node.textContent ) ).toContain( '{price}' );
	} );

	it( 'refuses Enter, because a formula has no second line', () => {
		const { box } = build( '{price}' );
		const event = new KeyboardEvent( 'keydown', { key: 'Enter', bubbles: true, cancelable: true } );

		box.dispatchEvent( event );

		expect( event.defaultPrevented ).toBe( true );
	} );

	it( 'leaves other keys alone', () => {
		const { box } = build( '' );
		const event = new KeyboardEvent( 'keydown', { key: 'a', bubbles: true, cancelable: true } );

		box.dispatchEvent( event );

		expect( event.defaultPrevented ).toBe( false );
	} );

	it( 'carries a placeholder for an empty box to show', () => {
		expect( build( '' ).box.getAttribute( 'data-placeholder' ) ).toBe( '{price} * {quantity}' );
	} );

	it( 'is reachable and announced as a text box', () => {
		const { box } = build( '' );

		expect( box.getAttribute( 'role' ) ).toBe( 'textbox' );
		expect( box.getAttribute( 'aria-label' ) ).toBe( 'Formula' );
		expect( box.getAttribute( 'contenteditable' ) ).toBe( 'true' );
	} );
} );

describe( 'not fighting the person typing', () => {
	/**
	 * The bug this guards: the box lost focus on every keystroke.
	 *
	 * The cause was a redraw signature computed over *every* token. Formulas are
	 * dense in numbers and operators, so almost any character changed the token
	 * sequence, which rebuilt the DOM, which tore the caret out of the node it
	 * was in. The signature now counts only the names — the things that actually
	 * become chips — so ordinary typing leaves the DOM alone entirely.
	 */
	it( 'does not rebuild when a number is typed', () => {
		const { box } = build( '{price} * ' );
		const before = box.firstChild;

		box.append( document.createTextNode( '2' ) );
		box.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( box.firstChild ).toBe( before );
	} );

	it( 'does not rebuild when an operator is typed', () => {
		const { box } = build( '{price} ' );
		const before = box.firstChild;

		box.append( document.createTextNode( '*' ) );
		box.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( box.firstChild ).toBe( before );
	} );

	it( 'does rebuild when a field name finally closes', () => {
		// The moment a chip has to appear. Rebuilding here is the point.
		const { box, tokens } = build( '' );

		box.textContent = '{price';
		box.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( tokens() ).toHaveLength( 0 );

		box.textContent = '{price}';
		box.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( tokens() ).toHaveLength( 1 );
	} );

	it( 'does rebuild when a name stops being known', () => {
		const { box, tokens } = build( '{price}' );

		box.textContent = '{pricee}';
		box.dispatchEvent( new Event( 'input', { bubbles: true } ) );

		expect( tokens()[ 0 ].classList.contains( 'is-unknown' ) ).toBe( true );
	} );

	it( 'leaves numbers and operators as plain text, not as elements', () => {
		const { box } = build( '1 + 2' );

		expect( box.querySelectorAll( 'span' ) ).toHaveLength( 0 );
		expect( box.textContent ).toBe( '1 + 2' );
	} );
} );

describe( 'the formula lab', () => {
	/**
	 * The bug this guards: the dialog was see-through.
	 *
	 * Every `--atcfb-*` token is declared on the builder's own root, and the
	 * dialog mounts on `document.body` — outside it. So every colour in the panel
	 * resolved to nothing and the builder was legible straight through it. An
	 * overlay is the one part of a component that does not live inside its own
	 * root, and it has to carry its palette with it.
	 */
	it( 'carries its own palette, because it mounts outside the builder', () => {
		const lab = openFormulaLab( {
			value: '{price} * 2',
			fields: [ { name: 'price', label: 'Price' } ],
			functions: [ 'round' ],
			onSave: () => undefined,
		} );

		expect( lab.classList.contains( 'atcfl' ) ).toBe( true );
		expect( lab.parentElement ).toBe( document.body );

		lab.remove();
	} );

	it( 'evaluates in the shared engine, so the preview is the stored value', () => {
		const lab = openFormulaLab( {
			value: 'round({price} / {area}, 2)',
			fields: [
				{ name: 'price', label: 'Price' },
				{ name: 'area', label: 'Area' },
			],
			functions: [ 'round' ],
			onSave: () => undefined,
		} );

		// The samples start at 100 and 4 — see `openFormulaLab`.
		expect( lab.querySelector( '.atcfl__answer' )?.textContent ).toBe( '25' );

		lab.remove();
	} );

	it( 'shows a dash rather than a zero for a formula that will not run', () => {
		// Zero is a legitimate answer. A refused formula showing `0` would be
		// indistinguishable from one that worked and came to nothing.
		const lab = openFormulaLab( {
			value: 'round({price}',
			fields: [ { name: 'price', label: 'Price' } ],
			functions: [ 'round' ],
			onSave: () => undefined,
		} );

		expect( lab.querySelector( '.atcfl__answer' )?.textContent ).toBe( '—' );

		lab.remove();
	} );

	it( 'only asks for the fields the formula actually reads', () => {
		const lab = openFormulaLab( {
			value: '{price} * 2',
			fields: [
				{ name: 'price', label: 'Price' },
				{ name: 'area', label: 'Area' },
			],
			functions: [],
			onSave: () => undefined,
		} );

		const rows = Array.from( lab.querySelectorAll< HTMLElement >( '.atcfl__sample' ) );

		expect( rows.find( ( row ) => row.dataset.field === 'price' )?.hidden ).toBe( false );
		expect( rows.find( ( row ) => row.dataset.field === 'area' )?.hidden ).toBe( true );

		lab.remove();
	} );

	it( 'names every parameter of every function it lists', () => {
		const lab = openFormulaLab( {
			value: '',
			fields: [],
			functions: [ 'if', 'clamp' ],
			onSave: () => undefined,
		} );

		const text = lab.querySelector( '.atcfl__reference' )?.textContent ?? '';

		// `if` is the one people give up on, and a bare signature is why.
		expect( text ).toContain( 'test' );
		expect( text ).toContain( 'otherwise' );
		expect( text ).toContain( 'lowest' );
		expect( text ).toContain( 'highest' );

		lab.remove();
	} );

	it( 'documents the operators, which no function list would mention', () => {
		const lab = openFormulaLab( { value: '', fields: [], functions: [], onSave: () => undefined } );
		const text = lab.querySelector( '.atcfl__operators' )?.textContent ?? '';

		expect( text ).toContain( '==' );
		expect( text ).toContain( '&&' );

		lab.remove();
	} );

	it( 'loads an example into the box when Try it is pressed', () => {
		const lab = openFormulaLab( {
			value: '',
			fields: [ { name: 'price', label: 'Price' } ],
			functions: [ 'round' ],
			onSave: () => undefined,
		} );

		lab.querySelector< HTMLElement >( '.atcfl__doc-try' )?.click();

		expect( lab.querySelector( '.atcfb__formula' )?.textContent ).toContain( 'round(' );

		lab.remove();
	} );

	it( 'hands the formula back and closes on save', () => {
		const onSave = vi.fn();
		const lab = openFormulaLab( {
			value: '{price} * 3',
			fields: [ { name: 'price', label: 'Price' } ],
			functions: [],
			onSave,
		} );

		lab.querySelector< HTMLElement >( '.atcfl__save' )?.click();

		expect( onSave ).toHaveBeenCalledWith( '{price} * 3' );
		expect( lab.parentElement ).toBe( null );
	} );

	it( 'hands nothing back on cancel', () => {
		const onSave = vi.fn();
		const lab = openFormulaLab( {
			value: '{price}',
			fields: [ { name: 'price', label: 'Price' } ],
			functions: [],
			onSave,
		} );

		lab.querySelector< HTMLElement >( '.atcfl__cancel' )?.click();

		expect( onSave ).not.toHaveBeenCalled();
		expect( lab.parentElement ).toBe( null );
	} );
} );
