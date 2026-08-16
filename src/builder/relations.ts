/**
 * Where each window sits in the graph.
 *
 * OpenStation keeps a per-window *content identity* — what this window is
 * showing, and what that thing belongs to. From those it derives groups, draws
 * visible ties between the windows on the desktop, and fills the title bar's
 * **Related** menu.
 *
 * The shape here is the one the data already has:
 *
 *     field group ──────── root
 *       ├── preview ────── child of the group it previews
 *       └── post type ──── what it appears on, as a reference
 *
 * A field group is a root because it is the thing that outlives everything else:
 * a preview only means something in the context of the group it is previewing.
 * Making the *preview* the root would put every preview in a group of its own
 * and the desktop would draw no ties at all.
 *
 * Everything is optional-chained and every call is wrapped. `relations` is
 * Experimental in the shell, and a plugin that hard-depends on an experimental
 * API is a plugin that breaks on somebody else's release day.
 */

import { shell, windowIdOf } from '../shell';
import type { ContentRef } from '../types';

/**
 * The object types this plugin puts into the graph.
 *
 * Namespaced, because the type space is shared with every other plugin and
 * `group` is a word several of them will want. The shell requires
 * `/^[a-z0-9_/-]+$/`.
 */
export const GROUP_TYPE = 'allterrain-fields/group';
export const PREVIEW_TYPE = 'allterrain-fields/preview';
export const MODEL_TYPE = 'allterrain-fields/model';

/** How long to keep trying to reach a window that is still opening. */
const ATTACH_TIMEOUT_MS = 6000;

/** How often to look, while waiting. */
const ATTACH_POLL_MS = 120;

/** Whether a rejected identity has already been reported this page. */
let warned = false;

/** The most recent identity request per element, so retries cannot go stale. */
const pending = new WeakMap< HTMLElement, symbol >();

/**
 * The identity each mounted element wants, kept so it can be re-applied.
 *
 * Racing frames is not a reliable way to catch a window attaching: a fresh open
 * takes longer than a reopen (the DOM is cold, the bundle is parsing), and any
 * fixed number of frames is a guess that is too short on a slow machine and
 * wasteful on a fast one. The shell announces the moment content is in place, so
 * the identities are simply re-applied then.
 *
 * A `Map` rather than a `WeakMap`: this one is iterated, and it is pruned by
 * dropping entries whose element has left the document.
 */
const wanted = new Map< HTMLElement, ContentRef | null >();

/**
 * Sets a window's identity, or clears it. Safe with no shell.
 *
 * Retries while the window is still opening, because the first call routinely
 * arrives before the body is attached. The latest ref wins: a pending retry is
 * abandoned if another identity is set in the meantime, so a window that opens
 * and immediately changes what it shows does not end up announcing the older of
 * the two.
 *
 * @param element Anything inside the window.
 * @param ref     The identity, or null to clear it.
 */
export function setIdentity( element: HTMLElement, ref: ContentRef | null ): void {
	const api = shell()?.relations;

	// Remembered whether or not it can be applied right now, so the lifecycle
	// listener below can assert it once the window exists.
	wanted.set( element, ref );

	if ( ! api?.set ) {
		return;
	}

	const token = Symbol( 'atcf-identity' );

	const attempt = ( deadline: number ) => {
		// Superseded by a later call — stop, rather than overwriting the newer
		// identity with this stale one.
		if ( pending.get( element ) !== token ) {
			return;
		}

		const id = windowIdOf( element );

		if ( ! id ) {
			// Still detached. A native window's script runs before its body is
			// in the document, and how long that takes varies with whether the
			// bundle is warm — a fixed number of frames is a guess that is too
			// short exactly when the machine is busy, which is when it matters.
			if ( Date.now() < deadline ) {
				window.setTimeout( () => attempt( deadline ), ATTACH_POLL_MS );
			}

			return;
		}

		try {
			api.set?.( id, ref );
		} catch ( error ) {
			// A window with no identity just draws no ties, so this must not be
			// fatal — but it must not be *silent* either. Swallowing the
			// rejection is precisely how a malformed `related` array goes
			// unnoticed: the call runs, the shell refuses it, and nothing
			// anywhere says so. Reported once per page so a broken identity is
			// visible without a console full of repeats from the retry loop.
			if ( ! warned ) {
				warned = true;

				// eslint-disable-next-line no-console
				console.error( '[AllTerrain Fields] The shell refused a window identity.', error, ref );
			}

			pending.delete( element );

			return;
		}

		// Setting it is not the same as it sticking. The shell seeds a window's
		// identity from its config as part of opening, and that seeding lands
		// *after* a native window's script has run — so the first announcement is
		// accepted and then cleared, and `get()` a moment later returns nothing.
		// Reading it back is the only way to tell the two apart.
		const stuck = ! ref || api.get?.( id )?.id === ref.id;

		if ( stuck || Date.now() >= deadline ) {
			pending.delete( element );

			return;
		}

		window.setTimeout( () => attempt( deadline ), ATTACH_POLL_MS );
	};

	pending.set( element, token );
	attempt( Date.now() + ATTACH_TIMEOUT_MS );
}

/** Re-applies every stored identity whose element is still on screen. */
function reapply(): void {
	for ( const [ element, ref ] of wanted ) {
		if ( ! element.isConnected ) {
			wanted.delete( element );

			continue;
		}

		setIdentity( element, ref );
	}
}

if ( typeof document !== 'undefined' ) {
	// `content-loaded` is the shell saying a window's body is in place, which is
	// exactly the moment an identity set during script execution needs
	// re-asserting. `opened` covers a window restored from a session, where the
	// script may not run again at all.
	for ( const event of [ 'os-window-content-loaded', 'os-window-opened' ] ) {
		document.addEventListener( event, () => reapply() );
	}
}

/**
 * The identity of a builder window editing one field group.
 *
 * The group is a root — it has no `root` of its own — so the preview window and
 * anything else naming it gathers around this one.
 *
 * @param group    The group being edited.
 * @param adminUrl The site's admin URL.
 * @return The identity.
 */
export function groupIdentity(
	group: { id: number; key: string; title: string; types: string[] },
	adminUrl: string
): ContentRef {
	const related = group.types
		.filter( ( type ) => type !== '*' )
		.slice( 0, 12 )
		.map( ( type ) => ( {
			id: `allterrain-fields/type-${ type }`,
			label: type,
			url: `${ adminUrl }edit.php?post_type=${ encodeURIComponent( type ) }`,
			group: 'allterrain-fields/types',
			groupLabel: 'Appears on',
			icon: 'dashicons-admin-post',
		} ) );

	related.push( {
		id: 'allterrain-fields/model',
		label: 'The content model',
		url: `${ adminUrl }admin.php?page=allterrain-fields-model`,
		group: 'allterrain-fields',
		groupLabel: 'Fields',
		icon: 'dashicons-networking',
	} );

	return {
		type: GROUP_TYPE,
		id: group.id || group.key,
		label: group.title || 'Untitled group',
		related,
	};
}

/**
 * The identity of a preview window showing one group's edit screen.
 *
 * Rooted at the group, so the preview ties itself to the builder window editing
 * it and the two are drawn as a pair on the desktop.
 *
 * @param group The group being previewed.
 * @return The identity.
 */
export function previewIdentity( group: { id: number; key: string; title: string } ): ContentRef {
	return {
		type: PREVIEW_TYPE,
		id: `preview-${ group.id || group.key }`,
		root: { type: GROUP_TYPE, id: group.id || group.key },
		label: `Preview: ${ group.title }`,
	};
}

/**
 * The identity of the content model window.
 *
 * A root of its own with a reference to every group it draws, which is what
 * makes opening a group from the graph tie the two windows together.
 *
 * @param groups The groups on the graph.
 * @return The identity.
 */
export function modelIdentity( groups: Array< { id: number; key: string } > ): ContentRef {
	return {
		type: MODEL_TYPE,
		id: 'content-model',
		label: 'Content model',
		links: groups.slice( 0, 32 ).map( ( group ) => ( {
			type: GROUP_TYPE,
			id: group.id || group.key,
			rel: 'references' as const,
		} ) ),
	};
}
