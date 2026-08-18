/**
 * The family window's tab plumbing.
 *
 * All four surfaces live in one window as tabs. Opening a surface must open
 * that window, write the tab into the window params (what a fresh open reads),
 * and activate the tab (what an already-open window needs) — waiting out the
 * shell's async open rather than assuming the handle exists.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { activateFamilyTab, openFamilyTab } from '../../src/shell';

interface Handle {
	activateTab: ReturnType< typeof vi.fn >;
}

function stubShell( win?: Handle ): { openWindow: ReturnType< typeof vi.fn >; expose: ( h: Handle ) => void } {
	const openWindow = vi.fn( () => true );
	let current: Handle | undefined = win;

	( window as unknown as { wp?: unknown } ).wp = {
		os: {
			openWindow,
			windowManager: {
				getById: () => current,
			},
		},
	};

	return { openWindow, expose: ( h: Handle ) => ( current = h ) };
}

describe( 'family tabs', () => {
	beforeEach( () => {
		vi.useFakeTimers();
	} );

	afterEach( () => {
		vi.useRealTimers();
		delete ( window as unknown as { wp?: unknown } ).wp;
	} );

	it( 'opens the window with the tab in its params and activates it', () => {
		const win: Handle = { activateTab: vi.fn() };
		const { openWindow } = stubShell( win );

		openFamilyTab( 'bulk', 'dock' );

		expect( openWindow ).toHaveBeenCalledWith( 'allterrain-fields', {
			source: 'dock',
			params: { tab: 'bulk' },
		} );
		expect( win.activateTab ).toHaveBeenCalledWith( 'bulk' );
	} );

	it( 'waits for the window handle before activating', () => {
		const { expose } = stubShell();

		activateFamilyTab( 'tools' );

		const win: Handle = { activateTab: vi.fn() };

		// Two polls later the shell has finished opening the window.
		vi.advanceTimersByTime( 50 );
		expose( win );
		vi.advanceTimersByTime( 50 );

		expect( win.activateTab ).toHaveBeenCalledWith( 'tools' );
	} );

	it( 'gives up quietly when the window never materialises', () => {
		stubShell();

		expect( () => {
			activateFamilyTab( 'model' );
			vi.advanceTimersByTime( 60_000 );
		} ).not.toThrow();
	} );

	it( 'does nothing without a shell', () => {
		expect( () => openFamilyTab( 'main' ) ).not.toThrow();
	} );
} );
