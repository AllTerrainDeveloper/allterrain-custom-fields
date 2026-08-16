/**
 * The tools window's boot spinner actually goes away.
 *
 * The spinner is printed by PHP as a *sibling* of the mount root, so nothing
 * the app paints can ever cover it — it has to be removed on purpose, on every
 * path out of loading. The bug this guards against is invisible in code review
 * and glaring on screen: a window that finished loading, forever captioned
 * "Checking what is on disk…" with a spinner beside it.
 *
 * The REST layer is stubbed at `fetch`, which is where the module boundary
 * actually is — the panes drawn are the real ones.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The shape `atcf_tools_template()` prints. */
function template(): void {
	document.body.innerHTML =
		'<div class="atcft" data-atcft-root>' +
		'<div class="atcft__bar" data-atcft-bar><span class="atcft__loading">Checking what is on disk…</span></div>' +
		'<div class="atcft__body" data-atcft-body></div>' +
		'</div>';
}

/** A minimal ok response. */
function ok( body: unknown ): Promise< Response > {
	return Promise.resolve( {
		ok: true,
		status: 200,
		json: () => Promise.resolve( body ),
	} as Response );
}

/** A refusal, as the REST server sends one. */
function refused( status: number ): Promise< Response > {
	return Promise.resolve( {
		ok: false,
		status,
		json: () => Promise.resolve( { message: 'No.', code: 'atcf_forbidden' } ),
	} as Response );
}

/** Polls until the condition holds, or a second has passed. */
async function waitFor( condition: () => boolean ): Promise< void > {
	for ( let i = 0; i < 200 && ! condition(); i++ ) {
		await new Promise( ( resolve ) => setTimeout( resolve, 5 ) );
	}
}

describe( 'the tools window boot spinner', () => {
	beforeEach( () => {
		vi.resetModules();
		template();
	} );

	afterEach( () => {
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	} );

	it( 'is dismissed once the window has painted', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn( ( url: string ) => {
				if ( String( url ).includes( 'groups' ) ) {
					return ok( [] );
				}

				// The sync probe may fail without failing the window.
				return refused( 404 );
			} )
		);

		await import( '../../src/tools' );
		await waitFor( () => null === document.querySelector( '[data-atcft-bar]' ) );

		expect( document.querySelector( '[data-atcft-bar]' ) ).toBeNull();
		expect( document.querySelectorAll( '.atcft__pane' ).length ).toBeGreaterThanOrEqual( 3 );
	} );

	it( 'is dismissed when loading fails, too', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn( () => refused( 403 ) )
		);

		await import( '../../src/tools' );
		await waitFor( () => null === document.querySelector( '[data-atcft-bar]' ) );

		// The failure is shown in the body — not spun over forever.
		expect( document.querySelector( '[data-atcft-bar]' ) ).toBeNull();
		expect( document.querySelector( '.atcft__error' )?.textContent ).toBe( 'No.' );
	} );
} );
