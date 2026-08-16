/**
 * The drag entry point.
 *
 * These tests exist because of one bug, and it is worth writing down. The guard
 * in `startDrag()` that stops a press on an `<input>` lifting the whole field
 * also refused a press on the *draggable thing itself* — and a palette entry is
 * a `<button>`, because it has to be focusable and activate on Enter. The effect
 * was that dragging a field from the palette onto the canvas, the headline
 * gesture of the whole builder, silently never started.
 *
 * Nothing failed. No error, no console warning: the press simply did nothing,
 * and the keyboard path still worked, so the bug survived a typecheck, a build
 * and a hundred passing tests. Only driving it in a browser found it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertionIndex, startDrag } from '../../src/dnd';
import type { DragPayload } from '../../src/types';

/** A payload whose source is the given element. */
function payloadFor( source: HTMLElement ): DragPayload {
	return { type: 'allterrain-fields/field', source, data: {} };
}

/** A left-button pointerdown on an element. */
function press( target: HTMLElement ): PointerEvent {
	const event = new MouseEvent( 'pointerdown', { bubbles: true, button: 0 } ) as unknown as PointerEvent;

	Object.defineProperty( event, 'target', { value: target } );

	return event;
}

describe( 'startDrag', () => {
	beforeEach( () => {
		document.body.innerHTML = '';
	} );

	// The fallback manager is a module singleton with one active session at a
	// time — which is correct, and which means a test that starts a drag and
	// never releases it blocks every test after it. In a browser that cannot
	// happen: pointerup, pointercancel and window blur all end a session. Here it
	// has to be done by hand.
	afterEach( () => {
		document.dispatchEvent( new MouseEvent( 'pointerup', { bubbles: true } ) );
	} );

	it( 'lifts a draggable that is itself a button', () => {
		// The regression. A palette entry is a `<button>` and it is the source.
		const item = document.createElement( 'button' );

		document.body.append( item );

		const session = startDrag( press( item ), {
			payload: payloadFor( item ),
			origin: press( item ),
		} );

		expect( session ).not.toBeNull();
	} );

	it( 'lifts a draggable whose grab handle is a button inside it', () => {
		// A repeater row: the handle is a `<button>`, and it is also the source
		// the payload names, because that is what the ghost is measured from.
		const row = document.createElement( 'div' );
		const handle = document.createElement( 'button' );

		row.append( handle );
		document.body.append( row );

		const session = startDrag( press( handle ), {
			payload: payloadFor( handle ),
			origin: press( handle ),
		} );

		expect( session ).not.toBeNull();
	} );

	it( 'refuses a press on a control inside the draggable', () => {
		// The behaviour the guard was for: dragging to select text in a field's
		// label, or moving a slider, must not lift the whole card.
		const card = document.createElement( 'div' );
		const input = document.createElement( 'input' );

		card.append( input );
		document.body.append( card );

		const session = startDrag( press( input ), {
			payload: payloadFor( card ),
			origin: press( input ),
		} );

		expect( session ).toBeNull();
	} );

	it( 'refuses a press on an <os-button> inside the draggable', () => {
		// The bug this file's header describes, in its second form. Inside
		// OpenStation this plugin's buttons *are* components, and
		// `closest( 'button' )` does not match `<os-button>` — so pressing a
		// card's Delete began a drag of the card and the click never arrived.
		//
		// It passed every test before this one, because without the shell those
		// controls render as plain `<button>`s.
		const card = document.createElement( 'div' );
		const remove = document.createElement( 'os-button' );

		card.append( remove );
		document.body.append( card );

		expect(
			startDrag( press( remove ), { payload: payloadFor( card ), origin: press( remove ) } )
		).toBeNull();
	} );

	it( 'refuses a press on every interactive component the kit provides', () => {
		// One case per tag, so adding a component to the list without adding it
		// to `INTERACTIVE` fails here rather than on somebody's desktop.
		const tags = [ 'os-switch', 'os-select', 'os-text-field', 'os-range-field', 'os-checkbox-label' ];

		tags.forEach( ( tag ) => {
			const card = document.createElement( 'div' );
			const inner = document.createElement( tag );

			card.append( inner );
			document.body.append( card );

			expect(
				startDrag( press( inner ), { payload: payloadFor( card ), origin: press( inner ) } ),
				`${ tag } did not claim its own press`
			).toBeNull();
		} );
	} );

	it( 'still lifts from a decorative component', () => {
		// `<os-icon>` on a field card is grab surface, not a control. Listing it
		// would make the card undraggable from its own icon.
		const card = document.createElement( 'div' );
		const decoration = document.createElement( 'os-icon' );

		card.append( decoration );
		document.body.append( card );

		expect(
			startDrag( press( decoration ), { payload: payloadFor( card ), origin: press( decoration ) } )
		).not.toBeNull();
	} );

	it( 'refuses a press on an action button inside the draggable', () => {
		// The Delete button on a field card. Pressing it must not begin a drag,
		// or every deletion would first look like a failed one.
		const card = document.createElement( 'div' );
		const remove = document.createElement( 'button' );

		card.append( remove );
		document.body.append( card );

		expect(
			startDrag( press( remove ), { payload: payloadFor( card ), origin: press( remove ) } )
		).toBeNull();
	} );

	it( 'refuses anything but the left button', () => {
		const item = document.createElement( 'div' );
		const event = new MouseEvent( 'pointerdown', { bubbles: true, button: 2 } ) as unknown as PointerEvent;

		document.body.append( item );

		expect( startDrag( event, { payload: payloadFor( item ), origin: event } ) ).toBeNull();
	} );

	it( 'calls onClickOnly for a press that never moved', () => {
		const item = document.createElement( 'button' );
		const onClickOnly = vi.fn();

		document.body.append( item );

		const event = press( item );

		startDrag( event, { payload: payloadFor( item ), origin: event, onClickOnly } );

		// A pointerup with no intervening move is a click, and the click handler
		// lives here rather than on the element so that a press which *did*
		// become a drag never also fires it.
		document.dispatchEvent( new MouseEvent( 'pointerup', { bubbles: true } ) );

		expect( onClickOnly ).toHaveBeenCalledOnce();
	} );
} );

describe( 'insertionIndex', () => {
	beforeEach( () => {
		document.body.innerHTML = '';
	} );

	/** Three 100px-tall children, stacked. */
	function stack(): HTMLElement {
		const container = document.createElement( 'div' );

		[ 0, 100, 200 ].forEach( ( top ) => {
			const child = document.createElement( 'div' );

			child.className = 'row';
			child.getBoundingClientRect = () =>
				( { top, bottom: top + 100, height: 100, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ( {} ) } ) as DOMRect;

			container.append( child );
		} );

		document.body.append( container );

		return container;
	}

	it( 'flips at the midpoint, not at the edge', () => {
		const container = stack();

		// Just above the first child's middle: before it.
		expect( insertionIndex( container, '.row', 49 ) ).toBe( 0 );

		// Just below it: after it.
		expect( insertionIndex( container, '.row', 51 ) ).toBe( 1 );
	} );

	it( 'lands at the end below everything', () => {
		expect( insertionIndex( stack(), '.row', 400 ) ).toBe( 3 );
	} );

	it( 'ignores the element being dragged', () => {
		const container = stack();
		const dragged = container.children[ 0 ] as HTMLElement;

		// With the first row out of the count, the pointer at 151 is past the
		// midpoint of what is now the first remaining row.
		expect( insertionIndex( container, '.row', 151, dragged ) ).toBe( 1 );
	} );
} );
