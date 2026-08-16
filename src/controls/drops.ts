/**
 * Landing things on fields.
 *
 * This is the file the whole plugin was arranged around.
 *
 * A field type declares what it accepts in PHP — `'accepts' => array( 'media' )`
 * on the Image field, `array( 'post' )` on Relationship — and that declaration
 * arrives in the DOM as `data-atcf-accepts`. Everything here reads that
 * attribute and nothing else: there is no list of field types, no switch on
 * `image` versus `gallery`. A plugin that registers a new field type and
 * declares what it accepts gets all of this for free, which is the same
 * no-privileged-path rule the PHP registry follows.
 *
 * Three sources, one destination:
 *
 * 1. **The shell's drag manager**, for a field on a native window — the builder's
 *    live preview, the Field Inspector widget.
 * 2. **The cross-frame bridge**, for a field on a *real edit screen*. The post
 *    editor inside OpenStation is an iframe, and a pointer that started on the
 *    wallpaper never enters it. The shell forwards `os-drag-over` and `os-drop`
 *    messages instead, and this file answers them. **This is the one that
 *    matters**: dragging a photo from the Media window into an Image field on
 *    the post you are writing is the thing a custom-fields plugin has never been
 *    able to do.
 * 3. **The operating system**, for a file dragged straight off the desktop into
 *    the browser. Uploaded and attached.
 *
 * All three converge on `deliver()`, so a photo behaves identically whichever
 * way it arrived.
 */

import { config, t } from '../api';
import { dragManager } from '../dnd';
import { entitiesIn, isDesktopPayload, mediaEntities, postEntities, shellIsActive } from '../shell';
import type { DragPayload, DroppedEntity } from '../types';

/** What a field says it will take. */
type Accepts = 'media' | 'post' | 'user' | 'term' | 'text';

/** Reads the accept list off a field wrapper. */
function acceptsOf( wrapper: HTMLElement ): Accepts[] {
	return ( wrapper.dataset.atcfAccepts ?? '' ).split( /\s+/ ).filter( Boolean ) as Accepts[];
}

/** The mount host inside a field wrapper, which is what receives the event. */
function hostOf( wrapper: HTMLElement ): HTMLElement | null {
	return wrapper.querySelector< HTMLElement >( '.atcf-mount' ) ?? wrapper.querySelector< HTMLElement >( '.atcf-field__control' );
}

/**
 * Whether a field would take a given set of entities.
 *
 * @param accepts  What the field takes.
 * @param entities What is being offered.
 * @return True when at least one entity would land.
 */
function wouldAccept( accepts: Accepts[], entities: DroppedEntity[] ): boolean {
	if ( ! accepts.length || ! entities.length ) {
		return false;
	}

	if ( accepts.includes( 'media' ) && mediaEntities( entities ).length ) {
		return true;
	}

	if ( accepts.includes( 'post' ) && postEntities( entities ).length ) {
		return true;
	}

	if ( accepts.includes( 'user' ) && entities.some( ( one ) => one.kind === 'user' ) ) {
		return true;
	}

	if ( accepts.includes( 'term' ) && entities.some( ( one ) => one.kind === 'term' ) ) {
		return true;
	}

	// `text` accepts anything, because everything has a title. It is the last
	// resort deliberately: a Text field should not win a drop that an Image
	// field beside it could have taken, which the ordering above ensures.
	return accepts.includes( 'text' );
}

/**
 * Hands a set of entities to a field.
 *
 * Dispatches on the mount host rather than calling into the control, because the
 * control may not have mounted yet — a repeater row added a frame ago is still
 * rendering — and an event queued at a host that mounts later still arrives. It
 * also means a third-party control listens for the same event this plugin's own
 * controls do.
 *
 * @param wrapper The field wrapper.
 * @param entities What was dropped.
 */
function deliver( wrapper: HTMLElement, entities: DroppedEntity[] ): void {
	const host = hostOf( wrapper );

	if ( ! host ) {
		return;
	}

	const accepts = acceptsOf( wrapper );

	if ( accepts.includes( 'media' ) ) {
		const media = mediaEntities( entities );

		if ( media.length ) {
			host.dispatchEvent(
				new CustomEvent( 'atcf:media-dropped', { detail: { ids: media.map( ( one ) => Number( one.ref ) ) } } )
			);

			flash( wrapper );

			return;
		}
	}

	const usable = accepts.includes( 'post' )
		? postEntities( entities )
		: entities.filter( ( one ) => accepts.includes( one.kind as Accepts ) );

	if ( usable.length && ! accepts.includes( 'text' ) ) {
		host.dispatchEvent(
			new CustomEvent( 'atcf:entities-dropped', {
				detail: {
					ids: usable.map( ( one ) => Number( one.ref ) ).filter( Boolean ),
					titles: usable.map( ( one ) => one.title ),
					urls: usable.map( ( one ) => String( ( one as { url?: string } ).url ?? '' ) ),
				},
			} )
		);

		flash( wrapper );

		return;
	}

	if ( accepts.includes( 'text' ) ) {
		const text = entities.map( ( one ) => one.title ).filter( Boolean ).join( ', ' );

		// A plain input is set directly. There is no mount to send an event to,
		// and setting `.value` without dispatching would leave every listener —
		// conditional logic, the computed field beside it — reading the old one.
		const input = wrapper.querySelector< HTMLInputElement >( 'input:not([type="hidden"]), textarea' );

		if ( input && text ) {
			input.value = text;
			input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
			input.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		}

		host.dispatchEvent( new CustomEvent( 'atcf:text-dropped', { detail: { text } } ) );
		flash( wrapper );
	}
}

/** A brief highlight, so a drop that landed says so. */
function flash( wrapper: HTMLElement ): void {
	wrapper.classList.add( 'atcf-field--dropped' );
	window.setTimeout( () => wrapper.classList.remove( 'atcf-field--dropped' ), 700 );
}

/**
 * Registers every field on the page as a drop target with the shell's manager.
 *
 * @param root Where to look.
 * @return A teardown.
 */
export function registerFieldDropTargets( root: ParentNode = document ): () => void {
	const teardowns: Array< () => void > = [];
	const manager = dragManager();

	root.querySelectorAll< HTMLElement >( '[data-atcf-accepts]' ).forEach( ( wrapper ) => {
		const accepts = acceptsOf( wrapper );

		if ( ! accepts.length ) {
			return;
		}

		teardowns.push(
			manager.registerDropTarget( {
				id: `atcf-drop-${ wrapper.dataset.atcfField ?? '' }-${ teardowns.length }`,
				element: wrapper,
				acceptLabel: t( 'dropHere', 'Drop it here' ),
				accept: ( payload: DragPayload ) => {
					const entities = isDesktopPayload( payload ) || payload.type === config().dragTypes.value
						? entitiesIn( payload )
						: [];

					return wouldAccept( accepts, entities );
				},
				onEnter: () => wrapper.classList.add( 'atcf-field--drop-target' ),
				onLeave: () => wrapper.classList.remove( 'atcf-field--drop-target' ),
				onDrop: ( session ) => {
					wrapper.classList.remove( 'atcf-field--drop-target' );
					deliver( wrapper, entitiesIn( session.payload ) );
				},
			} )
		);
	} );

	return () => teardowns.forEach( ( fn ) => fn() );
}

/* -------------------------------------------------------------------------- */
/* The cross-frame bridge                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Answers the shell's drag messages from inside an iframe window.
 *
 * A pointer that starts in the parent shell never generates an event inside a
 * child frame — that is a browser security boundary, not an oversight — so the
 * shell forwards the position and the payload as `postMessage` instead. This
 * listener turns those back into the same `deliver()` call a same-frame drop
 * makes.
 *
 * The messages are matched by `type` and the payload is read structurally.
 * `event.origin` is deliberately **not** checked against a fixed value: the
 * chromeless window is same-origin with its parent by construction (it is an
 * admin URL on the same site), and a shell that renamed its origin would be a
 * shell whose iframes had stopped working for reasons far larger than this.
 * What *is* checked is that the message came from this window's own parent.
 *
 * @return A teardown.
 */
export function listenForCrossFrameDrops(): () => void {
	if ( window.parent === window ) {
		return () => undefined;
	}

	let hovered: HTMLElement | null = null;

	const fieldAt = ( x: number, y: number ): HTMLElement | null => {
		const element = document.elementFromPoint( x, y ) as HTMLElement | null;

		return element?.closest< HTMLElement >( '[data-atcf-accepts]' ) ?? null;
	};

	const clearHover = () => {
		hovered?.classList.remove( 'atcf-field--drop-target' );
		hovered = null;
	};

	const onMessage = ( event: MessageEvent ) => {
		if ( event.source !== window.parent ) {
			return;
		}

		const data = event.data as
			| { type?: string; position?: { x: number; y: number }; payload?: Record< string, unknown > }
			| undefined;

		if ( ! data?.type || ! String( data.type ).startsWith( 'os-drag' ) && data.type !== 'os-drop' ) {
			return;
		}

		if ( data.type === 'os-drag-leave' ) {
			clearHover();

			return;
		}

		const point = data.position ?? { x: 0, y: 0 };
		const entities = entitiesIn( {
			type: String( ( data.payload as { type?: string } | undefined )?.type ?? 'shortcut' ),
			source: document.body,
			data: ( data.payload as { data?: Record< string, unknown > } | undefined )?.data ?? ( data.payload ?? {} ),
		} );

		if ( data.type === 'os-drag-over' ) {
			const field = fieldAt( point.x, point.y );

			if ( field === hovered ) {
				return;
			}

			clearHover();

			if ( field && wouldAccept( acceptsOf( field ), entities ) ) {
				hovered = field;
				field.classList.add( 'atcf-field--drop-target' );

				// Telling the parent this frame will take it is what makes the
				// shell's ghost show an accepting cursor rather than a refusing
				// one — the whole gesture reads as landing somewhere real.
				window.parent.postMessage( { type: 'os-drag-accept', accepted: true }, '*' );
			}

			return;
		}

		if ( data.type === 'os-drop' ) {
			const field = fieldAt( point.x, point.y ) ?? hovered;

			clearHover();

			if ( field && wouldAccept( acceptsOf( field ), entities ) ) {
				deliver( field, entities );
			}
		}
	};

	window.addEventListener( 'message', onMessage );

	return () => {
		window.removeEventListener( 'message', onMessage );
		clearHover();
	};
}

/* -------------------------------------------------------------------------- */
/* Files off the operating system                                              */
/* -------------------------------------------------------------------------- */

/**
 * Accepts a file dragged out of Finder or Explorer straight onto a field.
 *
 * HTML5 drag events, which is the only API the browser offers for this — and the
 * one place in this plugin where they are the right tool, because the drag
 * originates outside the page and no pointer pipeline can see it.
 *
 * @param root Where to look.
 * @return A teardown.
 */
export function listenForFileDrops( root: ParentNode = document ): () => void {
	const listeners: Array< () => void > = [];

	root.querySelectorAll< HTMLElement >( '[data-atcf-accepts~="media"]' ).forEach( ( wrapper ) => {
		const over = ( event: Event ) => {
			const transfer = ( event as DragEvent ).dataTransfer;

			if ( ! transfer?.types.includes( 'Files' ) ) {
				return;
			}

			event.preventDefault();
			wrapper.classList.add( 'atcf-field--drop-target' );
		};

		const leave = () => wrapper.classList.remove( 'atcf-field--drop-target' );

		const drop = async ( event: Event ) => {
			const transfer = ( event as DragEvent ).dataTransfer;

			if ( ! transfer?.files.length ) {
				return;
			}

			event.preventDefault();
			leave();

			const uploaded: number[] = [];

			for ( const file of Array.from( transfer.files ) ) {
				const id = await upload( file );

				if ( id ) {
					uploaded.push( id );
				}
			}

			if ( uploaded.length ) {
				hostOf( wrapper )?.dispatchEvent( new CustomEvent( 'atcf:media-dropped', { detail: { ids: uploaded } } ) );
				flash( wrapper );
			}
		};

		wrapper.addEventListener( 'dragover', over );
		wrapper.addEventListener( 'dragleave', leave );
		wrapper.addEventListener( 'drop', ( event ) => void drop( event ) );

		listeners.push( () => {
			wrapper.removeEventListener( 'dragover', over );
			wrapper.removeEventListener( 'dragleave', leave );
		} );
	} );

	return () => listeners.forEach( ( fn ) => fn() );
}

/**
 * Uploads one file to the media library.
 *
 * @param file The file.
 * @return Its attachment id, or 0.
 */
async function upload( file: File ): Promise< number > {
	const { wpRestUrl, nonce } = config();
	const body = new FormData();

	body.append( 'file', file, file.name );

	try {
		const response = await fetch( `${ wpRestUrl }media`, {
			method: 'POST',
			credentials: 'same-origin',
			// No `Content-Type`: the browser has to set it itself so it can add
			// the multipart boundary. Setting it by hand produces a body the
			// server cannot parse, and the error blames the file.
			headers: { 'X-WP-Nonce': nonce },
			body,
		} );

		if ( ! response.ok ) {
			return 0;
		}

		const json = ( await response.json() ) as { id?: number };

		return Number( json.id ?? 0 );
	} catch {
		return 0;
	}
}

/** Whether any of this is worth wiring up on this page. */
export function dropsAreAvailable(): boolean {
	return shellIsActive() || window.parent !== window || 'ondragover' in window;
}
