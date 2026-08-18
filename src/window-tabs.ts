/**
 * The chrome tabs every one of this plugin's windows wears.
 *
 * OpenStation gives an admin-page window a tab strip under its title bar, one
 * tab per submenu page — open Settings and General, Writing, Reading are right
 * there. This plugin's four surfaces are native windows rather than one iframe,
 * so that strip does not come for free; this module puts it back.
 *
 * Every window carries the same four tabs, its own tab active. A sibling tab is
 * a **door, not a pane**: the four surfaces stay separate windows on purpose —
 * a group tile is dragged from Field Groups onto a post type in the Content
 * Model, which needs both on screen at once — so activating a sibling tab
 * opens (or focuses) that window and puts the strip back on this one, rather
 * than swapping this window's body out from under it.
 */

import { t } from './api';
import { shell } from './shell';

/** What this module needs of the shell's `Window` handle. */
interface WindowTabsHandle {
	setTabs?: (
		entries: ReadonlyArray< { value: string; label: string } >,
		activeValue?: string
	) => void;
	activateTab?: ( value: string ) => void;
}

/**
 * The sibling windows, in the order the admin menu lists their pages.
 *
 * Values are the shell window ids, which are also the admin page slugs — the
 * same strings `atcf_admin_page_slugs()` holds on the PHP side.
 */
function family(): Array< { value: string; label: string } > {
	return [
		{ value: 'allterrain-fields', label: t( 'windowGroups', 'Field Groups' ) },
		{ value: 'allterrain-fields-model', label: t( 'windowModel', 'Content Model' ) },
		{ value: 'allterrain-fields-bulk', label: t( 'windowBulk', 'Bulk Editor' ) },
		{ value: 'allterrain-fields-tools', label: t( 'windowTools', 'Field Tools' ) },
	];
}

/**
 * Mounts the sibling-window tab strip on a native window.
 *
 * Degrades to nothing everywhere the strip cannot exist: outside the shell,
 * on a shell too old to expose `setTabs`, or when the body is not inside a
 * window at all (the plain admin page reuses the same mount function).
 *
 * @param selfId The window id of the surface calling — its tab stays active.
 * @param body   The window body the surface mounted into.
 */
export function mountWindowTabs( selfId: string, body: HTMLElement ): void {
	const os = shell();
	const winEl = body.closest< HTMLElement >( '.os-window' );

	if ( ! os || ! winEl ) {
		return;
	}

	// The strip belongs to the window *instance*. A second Field Groups window
	// has its own id — the shell names roots `wp-window-<id>` — and asking the
	// manager for the base id from inside it would hand back the first one.
	const instanceId = winEl.id.startsWith( 'wp-window-' )
		? winEl.id.slice( 'wp-window-'.length )
		: selfId;

	const win =
		( os.windowManager?.getById?.( instanceId ) as WindowTabsHandle | undefined ) ??
		( os.windowManager?.getById?.( selfId ) as WindowTabsHandle | undefined );

	if ( ! win?.setTabs ) {
		return;
	}

	win.setTabs( family(), selfId );

	winEl.addEventListener( 'os-window-tab-change', ( event ) => {
		const value = ( event as CustomEvent< { value?: string } > ).detail?.value;

		if ( ! value || value === selfId ) {
			return;
		}

		// Put the strip back first, then open the sibling: `activateTab` fires
		// this same event with our own value, which the guard above swallows.
		win.activateTab?.( selfId );
		os.openWindow?.( value );
	} );
}
