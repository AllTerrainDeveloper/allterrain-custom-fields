/**
 * The event names the `<os-*>` kit actually emits.
 *
 * This exists because every control in the plugin was silently inert against
 * the real component kit, and nothing anywhere failed. The bug had two halves
 * and either one alone is enough to lose every interaction:
 *
 * 1. **The kit uses its own names.** `<os-switch>` emits `os-switch-change`,
 *    `<os-select>` emits `os-pick`, `<os-range-field>` emits `os-range-change`.
 *    None of them emit `change`. A listener bound to `change` hears nothing.
 * 2. **`change` cannot leave a shadow root.** Even where a component wraps a
 *    real `<input>`, the native `change` event is `composed: false` by spec, so
 *    it stops at the boundary. `input` is composed, which is the only reason the
 *    text fields ever worked — through a hole `change` does not have.
 *
 * The failure mode is the worst kind: the control moves under the pointer, shows
 * the new value, and saves nothing. Nothing throws, nothing logs, and the next
 * redraw quietly puts it back.
 *
 * So the list of names is asserted here rather than trusted. If the kit renames
 * an event, this fails loudly instead of a settings panel going quiet.
 */

import { describe, expect, it, vi } from 'vitest';
import { CHANGE_EVENTS, select, toggle } from '../../src/ui';
import { submenuFor } from '../../src/dock';

/** Defines a stand-in custom element so `hasComponent()` takes the kit branch. */
function defineStub( tag: string ): void {
	if ( customElements.get( tag ) ) {
		return;
	}

	customElements.define( tag, class extends HTMLElement {} );
}

describe( 'the change-event contract', () => {
	it( 'covers every name the kit emits', () => {
		// Transcribed from the components in `alcazaba-plugin/src/ui/components`.
		// A name here that the kit no longer emits is harmless; a name the kit
		// emits that is missing here is a dead control.
		[
			'os-input-change',
			'os-input-commit',
			'os-switch-change',
			'os-checkbox-change',
			'os-pick',
			'os-range-change',
			'os-color-change',
		].forEach( ( name ) => expect( CHANGE_EVENTS ).toContain( name ) );
	} );

	it( 'still covers the native names, for the no-shell fallback', () => {
		expect( CHANGE_EVENTS ).toContain( 'input' );
		expect( CHANGE_EVENTS ).toContain( 'change' );
	} );

	it( 'never listens for a name twice', () => {
		expect( CHANGE_EVENTS.length ).toBe( new Set( CHANGE_EVENTS ).size );
	} );
} );

describe( 'toggle', () => {
	it( 'sets the checked attribute, not a property the component cannot see', () => {
		defineStub( 'os-switch' );

		const node = toggle( true, 'Required', () => undefined );

		// The property route is what was there before, and it fails whenever the
		// element has not upgraded yet: the accessor installer skips any own
		// property it finds, so the value never reaches the attribute and the
		// switch renders off forever.
		expect( node.tagName.toLowerCase() ).toBe( 'os-switch' );
		expect( node.hasAttribute( 'checked' ) ).toBe( true );
	} );

	it( 'leaves the attribute off when the value is off', () => {
		defineStub( 'os-switch' );

		expect( toggle( false, 'Required', () => undefined ).hasAttribute( 'checked' ) ).toBe( false );
	} );

	it( 'hears the kit’s own change event', () => {
		defineStub( 'os-switch' );

		const onChange = vi.fn();
		const node = toggle( false, 'Required', onChange );

		// What the component does when somebody presses it: reflect, then
		// announce under its own name.
		node.setAttribute( 'checked', '' );
		node.dispatchEvent( new CustomEvent( 'os-switch-change', { bubbles: true, composed: true } ) );

		expect( onChange ).toHaveBeenCalledWith( true );
	} );

	it( 'reports one change per interaction, not one per event name', () => {
		defineStub( 'os-switch' );

		const onChange = vi.fn();
		const node = toggle( false, 'Required', onChange );

		node.setAttribute( 'checked', '' );
		node.dispatchEvent( new CustomEvent( 'os-switch-change' ) );
		node.dispatchEvent( new Event( 'change' ) );

		expect( onChange ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'labels itself rather than being wrapped in a loose span', () => {
		defineStub( 'os-switch' );

		const node = toggle( false, 'Allow several', () => undefined );

		expect( node.getAttribute( 'label' ) ).toBe( 'Allow several' );
	} );

	it( 'is not iridescent by default', () => {
		defineStub( 'os-switch' );

		// The kit's default tone is `holo`, reserved for the one control speaking
		// for the brand. A settings panel is a dozen of them, and the accent
		// token behind the obvious alternative is a magenta — so on reads green,
		// which is the colour every operating system has taught people to read
		// as on.
		expect( toggle( false, 'x', () => undefined ).getAttribute( 'tone' ) ).toBe( 'success' );
	} );

	it( 'still takes a louder tone when a caller asks', () => {
		defineStub( 'os-switch' );

		expect(
			toggle( false, 'x', () => undefined, { tone: 'danger' } ).getAttribute( 'tone' )
		).toBe( 'danger' );
	} );
} );

describe( 'select', () => {
	it( 'hears os-pick, which is the only thing the kit sends', () => {
		defineStub( 'os-select' );
		defineStub( 'os-option' );

		const onChange = vi.fn();
		const node = select(
			'a',
			[
				{ value: 'a', label: 'A' },
				{ value: 'b', label: 'B' },
			],
			onChange
		);

		( node as unknown as { value: string } ).value = 'b';
		node.dispatchEvent( new CustomEvent( 'os-pick', { bubbles: true, composed: true } ) );

		expect( onChange ).toHaveBeenCalledWith( 'b' );
	} );

	it( 'does not fire when nothing actually changed', () => {
		defineStub( 'os-select' );
		defineStub( 'os-option' );

		const onChange = vi.fn();
		const node = select( 'a', [ { value: 'a', label: 'A' } ], onChange );

		node.dispatchEvent( new CustomEvent( 'os-pick' ) );

		expect( onChange ).not.toHaveBeenCalled();
	} );
} );

describe( 'the dock submenu', () => {
	/**
	 * Creating a post type is the step *before* field groups, and it was
	 * reachable only from a panel inside one window. The dock is where somebody
	 * who has just installed the plugin will look for it.
	 *
	 * Named for what it is. "A new kind of thing" was meant to be welcoming and
	 * was really just vague — somebody who reads it cannot search for their own
	 * problem afterwards, because every answer on the web says "custom post
	 * type".
	 */
	it( 'offers a way to make a custom post type', () => {
		const rows = submenuFor( { canManage: true } as never );

		expect( rows.map( ( row ) => row.title ) ).toContain( 'New custom post type…' );
	} );

	it( 'still opens the builder from the tile head', () => {
		// A system tile runs its *first* row when the head is clicked, so the
		// head and the first row have to agree about what "Fields" means.
		const rows = submenuFor( { canManage: true } as never );

		expect( rows[ 0 ].title ).toBe( 'Field groups' );
	} );

	it( 'offers nothing to somebody who cannot manage fields', () => {
		expect( submenuFor( { canManage: false } as never ) ).toEqual( [] );
	} );
} );
