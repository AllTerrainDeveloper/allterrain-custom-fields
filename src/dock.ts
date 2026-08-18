/**
 * The dock tile.
 *
 * One tile, four destinations. OpenStation fans a system tile's `submenu` out of
 * the rail on hover — the shell calls it the constellation — so the plugin
 * occupies a single place in the dock rather than four tiles competing for the
 * same corner of the user's attention.
 *
 * Its own bundle, and a deliberately tiny one. The tile has to be registered at
 * boot for every user who can reach it, and loading the builder to draw a dock
 * icon would make everyone pay for a window most of them will not open in a
 * given session. This file is a couple of hundred bytes of registration and
 * nothing else; the windows load their own bundles when they open.
 */

import { NEW_TYPE_FLAG } from './flags';
import type { NativeUrlRemap, RuntimeConfig, ShellApi, SubmenuRow } from './types';

const config = ( window as unknown as { allTerrainFields?: RuntimeConfig } ).allTerrainFields;

/** The windows this tile can reach. */
const BUILDER = 'allterrain-fields';
const MODEL = 'allterrain-fields-model';
const BULK = 'allterrain-fields-bulk';
const TOOLS = 'allterrain-fields-tools';

/** The shell, if there is one on this page. */
function shell(): ShellApi | null {
	return ( window as unknown as { wp?: { os?: ShellApi } } ).wp?.os ?? null;
}

/** Opens a window through the shell. */
function open( id: string ): void {
	shell()?.openWindow?.( id, { source: 'dock' } );
}

/**
 * The rows this tile offers, for a given config.
 *
 * Exported so it can be tested directly — a pure function of the config rather
 * than something observed through the module's import side effects, because a
 * test that has to reset the module registry to see a menu is a test nobody will
 * extend.
 *
 * @param runtime What this page was given.
 * @return The rows, in the order they are shown.
 */
export function submenuFor( runtime: RuntimeConfig | undefined ): SubmenuRow[] {
	const rows: SubmenuRow[] = [];

	if ( ! runtime?.canManage ) {
		return rows;
	}

	// The builder goes first, and that ordering is load-bearing.
	//
	// A system tile has no landing page, so the shell runs the **first submenu
	// row** when its head is clicked. With the model first, clicking "Fields"
	// would open the content model — the tile would not do what its own name
	// says. Putting the builder at the top makes the head and the first row
	// agree, which is the pattern the shell is built around.
	rows.push( { title: 'Field groups', url: '', onSelect: () => open( BUILDER ), windowId: BUILDER } );

	rows.push( { title: 'Content model', url: '', onSelect: () => open( MODEL ), windowId: MODEL } );

	rows.push( { title: 'Bulk editor', url: '', onSelect: () => open( BULK ), windowId: BULK } );

	rows.push( { title: 'Import, export and sync', url: '', onSelect: () => open( TOOLS ), windowId: TOOLS } );

	// Creating a post type is the step *before* everything above it, and it was
	// reachable only from a panel inside one window. Somebody who has just
	// installed this plugin needs somewhere to put fields before any of the four
	// rows above is any use, and the dock is where they will look.
	rows.push( {
		title: 'New custom post type…',
		url: '',
		onSelect: () => {
			open( MODEL );

			// The model window may be opening for the first time, so this cannot
			// simply call into it. The window listens for the flag on its own
			// boot as well as while running.
			try {
				window.sessionStorage.setItem( NEW_TYPE_FLAG, '1' );
			} catch {
				// Private browsing. The Content Model still opens; it just opens
				// on the graph rather than on the form.
			}

			shell()?.broadcast?.( 'os.allterrain-fields.new-content-type', {} );
		},
		windowId: MODEL,
	} );

	return rows;
}

/** Registers the tile. */
function registerTile(): void {
	const os = shell();

	if ( ! os?.registerSystemTile ) {
		return;
	}

	// Registered once per document, whatever calls this and however many times.
	//
	// The guard is here because the failure it prevents was invisible: this file
	// registers at module load, so a *single* stray import of a constant from it
	// put a whole second copy of the dock inside another bundle, and the only
	// symptom was two identical tiles. `src/flags.ts` exists so that cannot
	// happen again; this is what makes it not matter if it does.
	const claimed = window as unknown as { atcfDockTile?: boolean };

	if ( claimed.atcfDockTile ) {
		return;
	}

	claimed.atcfDockTile = true;

	const submenu = submenuFor( config );

	if ( ! submenu.length ) {
		return;
	}

	try {
		os.registerSystemTile( {
			id: 'allterrain-fields',
			title: 'AllTerrain Custom Fields',
			icon: 'dashicons-index-card',
			// Ahead of the shell's own trailing cluster, which starts at 10.
			order: 6,
			// The flyout is a hover gesture and never fans out for keyboard or
			// touch, so the tile's own activation has to go somewhere useful:
			// the builder, which is what the tile is named after.
			onOpen: () => open( BUILDER ),
			isOpen: () =>
				Boolean(
					os.windowManager?.getById?.( BUILDER ) ||
						os.windowManager?.getById?.( MODEL ) ||
						os.windowManager?.getById?.( BULK ) ||
						os.windowManager?.getById?.( TOOLS )
				),
			submenu,
		} );
	} catch {
		// `registerSystemTile` throws on a shell whose validation differs from
		// the one this was written against. A missing tile costs a shortcut; the
		// windows are still reachable from the command palette and the admin
		// menu.
	}
}

/**
 * Claims this plugin's admin URLs for its native windows.
 *
 * Without this, every path that opens `admin.php?page=allterrain-fields` — the
 * dock row, an in-window link, a Related-menu item, a bookmark, the portal deep
 * link — opens an **iframe of the admin page**, which then mounts a second
 * builder inside it. Two builders, one of them in a frame, both editing the same
 * field group and neither knowing about the other.
 *
 * The registry is the same one Posts, Pages, Users and Media use to claim
 * `edit.php` and `upload.php`. A plugin shipping its own native replacement
 * joins it rather than inventing anything.
 */
function registerUrlRemaps(): void {
	const os = shell();

	if ( ! os?.registerNativeUrlRemap ) {
		return;
	}

	const pages: Array< [ string, string ] > = [
		[ 'allterrain-fields', BUILDER ],
		[ 'allterrain-fields-model', MODEL ],
		[ 'allterrain-fields-bulk', BULK ],
		[ 'allterrain-fields-tools', TOOLS ],
	];

	pages.forEach( ( [ page, windowId ] ) => {
		const entry: NativeUrlRemap = {
			id: `allterrain-fields/${ page }`,
			nativeWindowId: windowId,
			matches: ( _url, parsed ) =>
				parsed.pathname.endsWith( '/admin.php' ) && parsed.searchParams.get( 'page' ) === page,
		};

		// The builder also carries which group to open, so a link from the
		// Content Model lands on the right one — and, because params persist
		// with the session, the window comes back on the same group after a
		// reload rather than on whichever is first.
		if ( windowId === BUILDER ) {
			entry.params = ( _url, parsed ) => ( {
				group: Number( parsed.searchParams.get( 'group' ) ) || 0,
			} );
		}

		try {
			os.registerNativeUrlRemap?.( entry );
		} catch {
			// A shell whose validation differs simply keeps the iframe
			// behaviour, which is worse and is not broken.
		}
	} );
}

/**
 * Registers as soon as there is a shell to register with.
 *
 * Script order is not guaranteed: this bundle can load before the shell has
 * defined `wp.os`, and reading it once at module load then giving up is how the
 * tile silently never appears. `os-init` is the shell's own "I am ready" event,
 * so the fallback is a real signal rather than a timeout.
 *
 * @return True when registration was arranged.
 */
function boot(): boolean {
	const os = shell();

	const install = () => {
		registerTile();
		registerUrlRemaps();
	};

	if ( os?.ready ) {
		os.ready( install );

		return true;
	}

	if ( os?.whenReady ) {
		os.whenReady( install );

		return true;
	}

	if ( os?.registerSystemTile ) {
		install();

		return true;
	}

	return false;
}

if ( ! boot() ) {
	document.addEventListener( 'os-init', () => void boot(), { once: true } );
}
