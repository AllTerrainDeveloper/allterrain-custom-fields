/**
 * Syncs the built plugin into the local WordPress Docker instance.
 *
 * The manual-QA site at http://localhost:8889 is the `wordpress-alcazaba`
 * docker-compose project. It bind-mounts its own checkout at /var/www, so
 * anything written into `<checkout>/src/wp-content/plugins/allterrain-fields` is
 * live in the container immediately -- no restart, no upload screen.
 *
 * A symlink would be tidier and does not work: the bind mount is the checkout
 * itself, so a link pointing at a sibling repository resolves to a path that
 * does not exist inside the container. Mirroring the files is what actually
 * reaches the site.
 *
 * Runs as part of `npm run build`, so every change reaches the site without a
 * separate step. When no WordPress checkout is present (CI, a fresh clone, a
 * different machine) it prints a note and exits successfully rather than failing
 * the build -- deploying is a convenience, not a build requirement.
 *
 * Override the destination with ATCF_DEPLOY_TARGET, or skip entirely with
 * ATCF_SKIP_DEPLOY=1.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ships } from './ships.mjs';

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );

/**
 * Marker proving a directory is an AllTerrain Fields install rather than something else.
 *
 * The sync deletes files the source no longer has, so it must never be pointed
 * at a directory it does not own. Refusing unless this file is present is the
 * guard, and it is why the check runs before the first write rather than after.
 */
const OWNERSHIP_MARKER = 'allterrain-fields.php';

/** Resolves the plugin directory to write to, or null when there is nothing to do. */
function resolveTarget() {
	if ( process.env.ATCF_SKIP_DEPLOY === '1' ) {
		return null;
	}

	if ( process.env.ATCF_DEPLOY_TARGET ) {
		return resolve( process.env.ATCF_DEPLOY_TARGET );
	}

	const candidates = [
		resolve( root, '../wordpress-alcazaba/src/wp-content/plugins' ),
		resolve( root, '../wordpress-develop/src/wp-content/plugins' ),
	];

	for ( const plugins of candidates ) {
		if ( existsSync( plugins ) ) {
			return join( plugins, 'allterrain-fields' );
		}
	}

	return null;
}

/**
 * Mirrors the source tree into the destination.
 *
 * Copies what changed and removes what the source no longer has, so a renamed or
 * deleted file cannot linger in the running site and mask a bug.
 *
 * @param {string}  from Source directory.
 * @param {string}  to   Destination directory.
 * @param {boolean} top  Whether this is the top level, where the ships() filter applies.
 * @return {{written: number, removed: number}} Counts.
 */
function mirror( from, to, top = false ) {
	let written = 0;
	let removed = 0;

	mkdirSync( to, { recursive: true } );

	const sourceEntries = readdirSync( from, { withFileTypes: true } ).filter(
		( entry ) => ! ( top && ! ships( entry.name ) ) && entry.name !== '.DS_Store'
	);
	const keep = new Set( sourceEntries.map( ( entry ) => entry.name ) );

	for ( const entry of readdirSync( to, { withFileTypes: true } ) ) {
		if ( ! keep.has( entry.name ) ) {
			rmSync( join( to, entry.name ), { recursive: true, force: true } );
			removed++;
		}
	}

	for ( const entry of sourceEntries ) {
		const src = join( from, entry.name );
		const dest = join( to, entry.name );

		if ( entry.isDirectory() ) {
			const nested = mirror( src, dest );
			written += nested.written;
			removed += nested.removed;
			continue;
		}

		// Skip bytes that are already identical, so a no-op deploy is genuinely
		// free and mtimes on the site stay meaningful.
		if ( existsSync( dest ) ) {
			const a = statSync( src );
			const b = statSync( dest );

			if ( a.size === b.size && a.mtimeMs <= b.mtimeMs ) {
				continue;
			}
		}

		cpSync( src, dest );
		written++;
	}

	return { written, removed };
}

const target = resolveTarget();

if ( ! target ) {
	console.log(
		'[allterrain-fields] No local WordPress checkout found — skipping deploy. ' +
			'Set ATCF_DEPLOY_TARGET to override.'
	);
	process.exit( 0 );
}

if ( existsSync( target ) && ! existsSync( join( target, OWNERSHIP_MARKER ) ) ) {
	console.error(
		`[allterrain-fields] Refusing to sync into ${ target }: it exists but has no ${ OWNERSHIP_MARKER }.\n` +
			'That directory does not look like an AllTerrain Fields install, and syncing removes files.'
	);
	process.exit( 1 );
}

// Deploying a half-built plugin puts a site into a state where the PHP is new
// and the bundles are old, which looks like a bug in the code rather than a
// missing build step.
for ( const required of [
	'assets/js/fields.min.js',
	'assets/js/builder.min.js',
	'assets/js/model.min.js',
	'assets/js/bulk.min.js',
	'assets/js/tools.min.js',
	'assets/js/widget.min.js',
	'assets/js/dock.min.js',
] ) {
	if ( ! existsSync( join( root, required ) ) ) {
		console.error(
			`[allterrain-fields] ${ required } is missing. Run \`npm run build\` rather than deploying alone.`
		);
		process.exit( 1 );
	}
}

const { written, removed } = mirror( root, target, true );

console.log(
	`[allterrain-fields] Deployed to ${ target } (${ written } file${ written === 1 ? '' : 's' } updated` +
		`${ removed ? `, ${ removed } removed` : '' }).`
);
