/**
 * What ends up inside each built bundle.
 *
 * Every other test in this suite runs against source. This one runs against the
 * **output**, because the bug it guards is invisible in source: `dock.ts`
 * registers the plugin's dock tile at module load, so a single `import` of one
 * constant from it dragged the whole file into the Content Model bundle. Opening
 * that window then registered the tile a second time, and the dock showed two
 * Fields apps side by side.
 *
 * Nothing was wrong with either file. The line that caused it —
 * `import { NEW_TYPE_FLAG } from '../dock'` — is the most ordinary line in the
 * codebase, and it is the kind of thing that gets written again. So the property
 * is asserted where it is actually true or false: in the bundle.
 *
 * `src/flags.ts` exists to give shared constants a home with no side effects,
 * and `registerTile()` guards itself as a second line of defence.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Reads a built bundle.
 *
 * Resolved from the working directory rather than from `import.meta.url`: Vitest
 * runs from the plugin root, and a URL-relative path depends on whether the test
 * is being run from source or from a transformed copy in a cache directory.
 */
function bundle( name: string ): string | null {
	const path = resolve( process.cwd(), 'assets/js', `${ name }.min.js` );

	return existsSync( path ) ? readFileSync( path, 'utf8' ) : null;
}

/** The bundles the plugin ships, and what each one is for. */
const BUNDLES = [ 'fields', 'builder', 'model', 'bulk', 'tools', 'widget', 'dock' ];

describe( 'the built bundles', () => {
	it( 'all exist, so the rest of this file is testing something', () => {
		BUNDLES.forEach( ( name ) => {
			expect( bundle( name ), `${ name }.min.js is missing — run npm run build.` ).toBeTruthy();
		} );
	} );

	it( 'registers the dock tile from the dock bundle and nowhere else', () => {
		// The whole point. A second copy anywhere is a second tile.
		const guilty = BUNDLES.filter( ( name ) => name !== 'dock' ).filter( ( name ) =>
			( bundle( name ) ?? '' ).includes( 'registerSystemTile' )
		);

		expect(
			guilty,
			`These bundles boot the dock as well: ${ guilty.join( ', ' ) }. Something imports from src/dock.ts — put the shared value in src/flags.ts instead.`
		).toEqual( [] );
	} );

	it( 'claims the admin URLs from the dock bundle and nowhere else', () => {
		// The same failure in its other half: two remap registrations for the
		// same URL is two claimants on one click.
		const guilty = BUNDLES.filter( ( name ) => name !== 'dock' ).filter( ( name ) =>
			( bundle( name ) ?? '' ).includes( 'registerNativeUrlRemap' )
		);

		expect( guilty ).toEqual( [] );
	} );

	it( 'keeps the dock bundle small, because everyone pays for it', () => {
		// It loads for every user who can reach the plugin, in every session,
		// whether or not they open a window. The windows load their own bundles.
		const size = ( bundle( 'dock' ) ?? '' ).length;

		expect( size, `dock.min.js is ${ size } bytes; it is meant to be registration and nothing else.` ).toBeLessThan(
			12000
		);
	} );

	it( 'does not put the calculator in the bundle that only renders fields', () => {
		// A sanity check on the same class of accident: the formula engine belongs
		// to the builder and the windows that evaluate one, not to the runtime
		// every edit screen loads.
		expect( ( bundle( 'dock' ) ?? '' ).includes( 'shunting' ) ).toBe( false );
	} );
} );
