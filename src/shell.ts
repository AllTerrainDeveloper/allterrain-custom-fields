/**
 * Talking to OpenStation, or not.
 *
 * One module owns every reach into `wp.os`, and everything else in this plugin
 * asks it. That is not tidiness for its own sake: the shell is optional, its API
 * surface is partly Experimental, and it has already renamed itself once. A
 * hundred call sites each doing their own `window.wp?.os?.something?.()` is a
 * hundred places to update and ninety-nine to forget.
 *
 * Every function here degrades. With no shell, `notify()` falls back to the
 * admin's own notice area, `confirm()` falls back to `window.confirm`, and
 * `loadComponents()` resolves without doing anything — so the caller never has
 * to know which world it is in.
 */

import type { DroppedEntity, DragPayload, ShellApi } from './types';

/** The shell, if there is one on this page. */
export function shell(): ShellApi | null {
	return ( window as unknown as { wp?: { os?: ShellApi } } ).wp?.os ?? null;
}

/** Whether the desktop shell is mounted and switched on. */
export function shellIsActive(): boolean {
	const os = shell();

	// `isActive()` and not merely "does `wp.os` exist": the shell publishes its
	// namespace on every admin page and reports false when the user has it
	// switched off, so presence alone would have this plugin render a desktop
	// affordance on a classic admin screen.
	return Boolean( os?.isActive?.() );
}

/**
 * Runs a callback once the shell is ready, or immediately when there is none.
 *
 * Script order is not guaranteed: a bundle can load before the shell has defined
 * `wp.os`, and reading it once at module load then giving up is how an
 * integration silently never appears. `os-init` is the shell's own "I am ready"
 * event, so the fallback is a real signal rather than a timeout.
 *
 * @param cb What to run.
 */
export function whenShellReady( cb: () => void ): void {
	const os = shell();

	if ( os?.ready ) {
		os.ready( cb );

		return;
	}

	if ( os?.whenReady ) {
		os.whenReady( cb );

		return;
	}

	if ( os ) {
		cb();

		return;
	}

	// No shell yet. It may still be loading — or it may not be installed, in
	// which case this listener never fires and the fallback below runs instead.
	let ran = false;

	const once = () => {
		if ( ran ) {
			return;
		}

		ran = true;
		cb();
	};

	document.addEventListener( 'os-init', once, { once: true } );

	// A shell that is not installed never dispatches `os-init`, so the callback
	// has to run anyway — on the next tick, so a caller that registers a listener
	// and then returns has finished doing so first.
	window.setTimeout( once, 0 );
}

/**
 * Makes `<os-*>` tags upgrade, when the kit is reachable.
 *
 * Resolves either way. A caller awaits this and then emits whatever markup it
 * was going to emit; the components are an enhancement, and a screen that waited
 * on them before rendering would be a screen that never renders without the
 * shell.
 *
 * @param tags Which tags are wanted.
 * @return A promise that always resolves.
 */
export async function loadComponents( tags: readonly string[] ): Promise< boolean > {
	const os = shell();

	if ( ! os?.loadComponents ) {
		return false;
	}

	try {
		await os.loadComponents( tags );

		return true;
	} catch {
		// The kit failed to load — offline, a CSP, a 404 after a partial
		// upgrade. Every control this plugin emits has a working plain-HTML
		// form, so the honest response is to carry on with that.
		return false;
	}
}

/**
 * Whether a given `<os-*>` tag has actually upgraded.
 *
 * Asked before emitting one. `loadComponents()` resolving is not the same as the
 * tag being defined: the kit registers a subset at boot and the rest per bundle,
 * so a tag can be missing even after a successful load.
 *
 * @param tag The tag name.
 * @return True when the custom element is defined.
 */
export function hasComponent( tag: string ): boolean {
	return typeof customElements !== 'undefined' && Boolean( customElements.get( tag ) );
}

/**
 * Shows a message.
 *
 * @param title What happened.
 * @param body  Any detail.
 * @param type  `success`, `error`, `warning` or `info`.
 */
export function notify( title: string, body = '', type = 'info' ): void {
	const os = shell();

	if ( os?.notify ) {
		os.notify( { title, body, type } );

		return;
	}

	// No shell: an admin notice, inserted where core puts its own so it lands
	// under the page heading rather than at the top of the document.
	const notice = document.createElement( 'div' );

	notice.className = `notice notice-${ 'error' === type ? 'error' : 'success' } is-dismissible atcf-notice`;
	notice.setAttribute( 'role', 'status' );
	notice.innerHTML = '';

	const paragraph = document.createElement( 'p' );

	paragraph.textContent = body ? `${ title } — ${ body }` : title;
	notice.appendChild( paragraph );

	const anchor = document.querySelector( '.wrap > h1, .wrap > .wp-heading-inline' );

	if ( anchor?.parentElement ) {
		anchor.parentElement.insertBefore( notice, anchor.nextSibling );
	} else {
		document.body.prepend( notice );
	}

	window.setTimeout( () => notice.remove(), 6000 );
}

/**
 * Asks a yes/no question.
 *
 * Never `window.confirm` when the shell is present: a native dialog blocks the
 * whole browser event loop, which inside OpenStation stops the shell receiving
 * any further message at all.
 *
 * @param message What is being asked.
 * @param opts    Title, button label, and whether this is destructive.
 * @return Whether the user said yes.
 */
export async function confirm(
	message: string,
	opts: { title?: string; confirmLabel?: string; danger?: boolean } = {}
): Promise< boolean > {
	const os = shell();

	if ( os?.confirm ) {
		return os.confirm( { message, ...opts } );
	}

	// eslint-disable-next-line no-alert
	return window.confirm( message );
}

/**
 * The id of the window a given element is inside.
 *
 * Read from the DOM rather than threaded through every constructor, because a
 * native window's script is handed its body and never told which window that
 * body belongs to. Returns null on a plain admin page, where there is no window.
 *
 * @param element Anything inside the window.
 * @return The window id, or null.
 */
export function windowIdOf( element: HTMLElement ): string | null {
	const host = element.closest< HTMLElement >( '[data-window-id], .os-window' );

	if ( ! host ) {
		return null;
	}

	// Some shells stamp the id as an attribute; the current one carries it only
	// as the element's `id`, prefixed — `wp-window-allterrain-fields` for the
	// window the relations API knows as `allterrain-fields`. Reading the
	// attribute alone silently finds nothing, and an identity that is never set
	// draws no ties and reports no error, which is the quietest possible failure.
	const attribute = host.getAttribute( 'data-window-id' );

	if ( attribute ) {
		return attribute;
	}

	const id = host.id ?? '';

	return id ? id.replace( /^wp-window-/, '' ) : null;
}

/**
 * The payload slugs the shell uses for things dragged off the desktop.
 *
 * Both spellings, because the rename from Desktop Mode to OpenStation went all
 * the way down and this plugin ships to sites running either.
 */
export const DESKTOP_PAYLOAD_TYPES = [ 'shortcut', 'desktop-file', 'openstation/file', 'desktop-mode/file' ];

/** Whether a payload is one the field runtime might do something with. */
export function isDesktopPayload( payload: DragPayload ): boolean {
	return DESKTOP_PAYLOAD_TYPES.includes( payload.type );
}

/**
 * Everything a desktop payload is carrying, flattened.
 *
 * The multi-item fields (`items`, `placements`) are the whole set when the drag
 * began from a selection; the top-level fields describe the one the user
 * actually grabbed. Reading the set with a fallback to the single is the
 * framework's documented pattern, and it means "handle one" and "handle many"
 * are the same code with a different array length.
 *
 * @param payload The drag payload.
 * @return The entities, or an empty list.
 */
export function entitiesIn( payload: DragPayload ): DroppedEntity[] {
	const usable = ( entity: DroppedEntity ) => entity.kind !== '' && entity.ref !== '';

	if ( payload.type === 'shortcut' ) {
		const data = payload.data as ShortcutItem & { items?: ShortcutItem[] };
		const items = data.items?.length ? data.items : [ data ];

		return items.map( toEntity ).filter( usable );
	}

	if ( payload.type === 'desktop-file' ) {
		const data = payload.data as { placement?: Placement; placements?: Placement[] };
		const list = data.placements?.length ? data.placements : [ data.placement ];

		return list
			.map( ( placement ) =>
				toEntity( {
					kind: placement?.file?.type,
					ref: placement?.file?.ref,
					title: placement?.file?.title,
					thumbnail: placement?.file?.thumbnail,
				} )
			)
			.filter( usable );
	}

	// An `openstation/file`-shaped payload, which carries the file directly.
	const data = payload.data as ShortcutItem;

	return [ toEntity( data ) ].filter( usable );
}

interface ShortcutItem {
	kind?: string;
	type?: string;
	ref?: string;
	id?: number | string;
	title?: string;
	thumbnail?: string;
}

interface Placement {
	file?: { type?: string; ref?: string; title?: string; thumbnail?: string };
}

function toEntity( item: ShortcutItem | undefined ): DroppedEntity {
	return {
		kind: String( item?.kind ?? item?.type ?? '' ),
		ref: String( item?.ref ?? item?.id ?? '' ),
		title: String( item?.title ?? '' ).trim(),
		thumbnail: item?.thumbnail ? String( item.thumbnail ) : undefined,
	};
}

/**
 * The entities in a payload that are posts — which includes attachments.
 *
 * Media is a post, so a kind of `attachment` is both "a post" and "an image"
 * depending on which field is asking. The two helpers below split that
 * deliberately rather than making every caller remember it.
 *
 * @param entities Flattened entities.
 * @return The ones with a numeric post id.
 */
export function postEntities( entities: DroppedEntity[] ): DroppedEntity[] {
	const notPosts = [ 'user', 'term', 'folder', 'link', 'app' ];

	return entities.filter( ( entity ) => ! notPosts.includes( entity.kind ) && Number( entity.ref ) > 0 );
}

/**
 * The entities in a payload that are attachments.
 *
 * @param entities Flattened entities.
 * @return The media ones.
 */
export function mediaEntities( entities: DroppedEntity[] ): DroppedEntity[] {
	const media = [ 'attachment', 'media', 'image', 'file', 'video', 'audio' ];

	return entities.filter( ( entity ) => media.includes( entity.kind ) && Number( entity.ref ) > 0 );
}
