/**
 * The sibling-window tab strip: registered right, and a door rather than a pane.
 *
 * Every window declares the same four tabs with its own active; activating a
 * sibling tab must open that window and put the strip straight back — the
 * surfaces stay separate windows so they can sit side by side.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountWindowTabs } from '../../src/window-tabs';

interface Recorded {
	setTabs: ReturnType< typeof vi.fn >;
	activateTab: ReturnType< typeof vi.fn >;
}

function stubShell( handles: Record< string, Recorded > ): { openWindow: ReturnType< typeof vi.fn > } {
	const openWindow = vi.fn( () => true );

	( window as unknown as { wp?: unknown } ).wp = {
		os: {
			openWindow,
			windowManager: {
				getById: ( id: string ) => handles[ id ],
			},
		},
	};

	return { openWindow };
}

function windowEl( instanceId: string ): { winEl: HTMLElement; body: HTMLElement } {
	document.body.innerHTML =
		`<div class="os-window" id="wp-window-${ instanceId }"><div class="os-window__body"></div></div>`;

	const winEl = document.querySelector< HTMLElement >( '.os-window' )!;

	return { winEl, body: winEl.querySelector< HTMLElement >( '.os-window__body' )! };
}

function handle(): Recorded {
	return { setTabs: vi.fn(), activateTab: vi.fn() };
}

function change( winEl: HTMLElement, value: string ): void {
	winEl.dispatchEvent(
		new CustomEvent( 'os-window-tab-change', { bubbles: true, detail: { value } } )
	);
}

describe( 'mountWindowTabs', () => {
	beforeEach( () => {
		document.body.innerHTML = '';
	} );

	afterEach( () => {
		delete ( window as unknown as { wp?: unknown } ).wp;
	} );

	it( 'declares all four surfaces with the caller active', () => {
		const win = handle();

		stubShell( { 'allterrain-fields-tools': win } );

		const { body } = windowEl( 'allterrain-fields-tools' );

		mountWindowTabs( 'allterrain-fields-tools', body );

		expect( win.setTabs ).toHaveBeenCalledTimes( 1 );

		const [ entries, active ] = win.setTabs.mock.calls[ 0 ];

		expect( entries.map( ( one: { value: string } ) => one.value ) ).toEqual( [
			'allterrain-fields',
			'allterrain-fields-model',
			'allterrain-fields-bulk',
			'allterrain-fields-tools',
		] );
		expect( active ).toBe( 'allterrain-fields-tools' );
	} );

	it( 'opens the sibling and puts the strip back when a sibling tab activates', () => {
		const win = handle();
		const { openWindow } = stubShell( { 'allterrain-fields-tools': win } );
		const { winEl, body } = windowEl( 'allterrain-fields-tools' );

		mountWindowTabs( 'allterrain-fields-tools', body );
		change( winEl, 'allterrain-fields-bulk' );

		expect( win.activateTab ).toHaveBeenCalledWith( 'allterrain-fields-tools' );
		expect( openWindow ).toHaveBeenCalledWith( 'allterrain-fields-bulk' );
	} );

	it( 'ignores its own tab, so the revert cannot echo', () => {
		const win = handle();
		const { openWindow } = stubShell( { 'allterrain-fields-tools': win } );
		const { winEl, body } = windowEl( 'allterrain-fields-tools' );

		mountWindowTabs( 'allterrain-fields-tools', body );
		change( winEl, 'allterrain-fields-tools' );

		expect( win.activateTab ).not.toHaveBeenCalled();
		expect( openWindow ).not.toHaveBeenCalled();
	} );

	it( 'asks the manager for the window instance, not the base id', () => {
		const instance = handle();
		const base = handle();

		stubShell( { 'allterrain-fields:2': instance, 'allterrain-fields': base } );

		const { body } = windowEl( 'allterrain-fields:2' );

		mountWindowTabs( 'allterrain-fields', body );

		expect( instance.setTabs ).toHaveBeenCalledTimes( 1 );
		expect( base.setTabs ).not.toHaveBeenCalled();
	} );

	it( 'does nothing outside the shell or outside a window', () => {
		document.body.innerHTML = '<div id="page"></div>';

		expect( () =>
			mountWindowTabs( 'allterrain-fields-tools', document.getElementById( 'page' ) as HTMLElement )
		).not.toThrow();
	} );
} );
