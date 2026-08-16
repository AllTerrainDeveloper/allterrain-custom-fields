/**
 * The media controls: image, file, gallery.
 *
 * These are the three fields that made this plugin worth building as a desktop
 * app. An Image field has always been a button that opens a modal over the thing
 * you were editing — and a modal is a bad way to pick a photo, because picking a
 * photo means comparing several, and a modal covering the page is precisely the
 * thing that stops you.
 *
 * Here there are three ways in, and the modal is the last of them:
 *
 * 1. **Drag it in.** From WP Explorer, from the wallpaper, from a folder window,
 *    from another post's gallery field. Handled in `drops.ts`, which registers
 *    the field's wrapper as a drop target because the field type declared
 *    `'accepts' => array( 'media' )` in PHP.
 * 2. **Drop a file from your computer.** The same wrapper accepts a native file
 *    drop and uploads it.
 * 3. **The button**, which opens `wp.media` — still there, because sometimes you
 *    do know exactly which file you want.
 *
 * A gallery reorders by dragging, and a photo can be dragged *out* of one onto
 * anything else on the desktop.
 */

import { button, clear, el, icon } from '../ui';
import { buildPayload, dragManager, insertionIndex, startDrag } from '../dnd';
import { config, t } from '../api';
import { registerMount } from './mount';
import type { MountContext } from './mount';

/** What the media REST route gives back per attachment, narrowed. */
interface Attachment {
	id: number;
	title: string;
	url: string;
	alt: string;
	mime: string;
	thumbnail: string;
	filename: string;
}

/** Cached lookups, so a gallery of forty photos is one request rather than forty. */
const cache = new Map< number, Attachment >();

/**
 * Loads attachment records, in one request.
 *
 * @param ids Attachment ids.
 * @return The records, in the order asked for, skipping any that have gone.
 */
async function loadAttachments( ids: number[] ): Promise< Attachment[] > {
	const missing = ids.filter( ( id ) => ! cache.has( id ) );

	if ( missing.length ) {
		const { wpRestUrl, nonce } = config();
		const url = `${ wpRestUrl }media?include=${ missing.join( ',' ) }&per_page=${ Math.min( 100, missing.length ) }&_fields=id,title,source_url,alt_text,mime_type,media_details`;

		try {
			const response = await fetch( url, {
				credentials: 'same-origin',
				headers: { 'X-WP-Nonce': nonce },
			} );

			if ( response.ok ) {
				const items = ( await response.json() ) as Array< Record< string, unknown > >;

				items.forEach( ( item ) => cache.set( Number( item.id ), toAttachment( item ) ) );
			}
		} catch {
			// Offline, or the route is filtered away. The control renders the
			// ids it has as bare chips rather than nothing at all — a value you
			// can see and remove beats a blank box that silently still holds it.
		}
	}

	return ids.map( ( id ) => cache.get( id ) ?? placeholder( id ) ).filter( Boolean );
}

function toAttachment( item: Record< string, unknown > ): Attachment {
	const details = ( item.media_details ?? {} ) as { sizes?: Record< string, { source_url?: string } > };
	const thumb = details.sizes?.thumbnail?.source_url ?? details.sizes?.medium?.source_url;

	return {
		id: Number( item.id ),
		title: String( ( item.title as { rendered?: string } )?.rendered ?? '' ),
		url: String( item.source_url ?? '' ),
		alt: String( item.alt_text ?? '' ),
		mime: String( item.mime_type ?? '' ),
		thumbnail: String( thumb ?? item.source_url ?? '' ),
		filename: String( item.source_url ?? '' ).split( '/' ).pop() ?? '',
	};
}

function placeholder( id: number ): Attachment {
	return {
		id,
		title: `#${ id }`,
		url: '',
		alt: '',
		mime: '',
		thumbnail: '',
		filename: `#${ id }`,
	};
}

/**
 * Opens the media library.
 *
 * `wp.media` is loaded by `wp_enqueue_media()` on every screen this runtime
 * reaches. When it is somehow absent — a screen where another plugin dequeued it
 * — the button says so rather than doing nothing, because a button that does
 * nothing is indistinguishable from a broken page.
 *
 * @param opts What to pick.
 * @return The chosen attachment ids.
 */
function openLibrary( opts: { multiple: boolean; mime: string; title: string; selected: number[] } ): Promise< number[] > {
	return new Promise( ( resolve ) => {
		const media = ( window as unknown as { wp?: { media?: MediaApi } } ).wp?.media;

		if ( ! media ) {
			resolve( [] );

			return;
		}

		const frame = media( {
			title: opts.title,
			multiple: opts.multiple ? 'add' : false,
			library: opts.mime ? { type: opts.mime.split( ',' ).map( ( one ) => one.trim() ) } : {},
			button: { text: t( 'add', 'Add' ) },
		} );

		frame.on( 'open', () => {
			// Pre-selecting what is already chosen is what makes the modal a way
			// to *edit* a gallery rather than only to replace one.
			const selection = frame.state()?.get( 'selection' );

			if ( ! selection?.add || ! media.attachment ) {
				return;
			}

			opts.selected.forEach( ( id ) => {
				const attachment = media.attachment?.( id );

				if ( attachment ) {
					attachment.fetch();
					selection.add?.( attachment );
				}
			} );
		} );

		frame.on( 'select', () => {
			const selection = frame.state()?.get( 'selection' );
			const ids: number[] = [];

			selection?.each?.( ( model: { toJSON: () => Record< string, unknown > } ) => {
				const json = model.toJSON();

				cache.set( Number( json.id ), {
					id: Number( json.id ),
					title: String( json.title ?? '' ),
					url: String( json.url ?? '' ),
					alt: String( json.alt ?? '' ),
					mime: String( json.mime ?? '' ),
					thumbnail: String(
						( json.sizes as { thumbnail?: { url?: string } } | undefined )?.thumbnail?.url ?? json.url ?? ''
					),
					filename: String( json.filename ?? '' ),
				} );

				ids.push( Number( json.id ) );
			} );

			resolve( ids );
		} );

		frame.open();
	} );
}

/**
 * `wp.media`, narrowed to what this file touches.
 *
 * Declared structurally rather than typed from `@types/wordpress__media-utils`,
 * because the global `wp.media` is a Backbone view whose published types
 * describe the *package* rather than the global — and the global is what
 * `wp_enqueue_media()` puts on the page.
 */
interface MediaApi {
	( args: unknown ): MediaFrame;
	attachment?: ( id: number ) => { fetch: () => void } | null;
}

interface MediaSelection {
	add?: ( model: unknown ) => void;
	each?: ( cb: ( model: { toJSON: () => Record< string, unknown > } ) => void ) => void;
}

interface MediaFrame {
	on: ( event: string, cb: () => void ) => void;
	open: () => void;
	state: () => { get: ( key: string ) => MediaSelection } | undefined;
}

/** The image control. */
registerMount( 'image', ( context ) => singleMedia( context, true ) );

/** The file control. */
registerMount( 'file', ( context ) => singleMedia( context, false ) );

/**
 * One attachment, shown as a preview with a Replace and a Remove.
 *
 * @param context The mount.
 * @param isImage Whether to show a picture or a filename.
 */
function singleMedia( context: MountContext, isImage: boolean ): void {
	const { host, field, set } = context;
	const settings = field.settings as { mime_types?: string; preview_size?: string };

	let current = Number( context.value ?? 0 ) || 0;

	const draw = async () => {
		clear( host );

		const frame = el( 'div', { class: `atcf-media atcf-media--${ isImage ? 'image' : 'file' }` } );

		if ( ! current ) {
			frame.append(
				el( 'div', {
					class: 'atcf-media__empty',
					children: [
						icon( isImage ? 'dashicons-format-image' : 'dashicons-media-default' ),
						el( 'p', { text: t( 'dropHere', 'Drop it here' ) } ),
						button( isImage ? t( 'selectImage', 'Choose an image' ) : t( 'selectFile', 'Choose a file' ), {
							class: 'atcf-media__pick',
							on: { click: () => void pick() },
						} ),
					],
				} )
			);

			host.append( frame );

			return;
		}

		const [ attachment ] = await loadAttachments( [ current ] );

		const preview = isImage && attachment.thumbnail
			? el( 'img', {
					class: 'atcf-media__image',
					attrs: { src: attachment.thumbnail, alt: attachment.alt || attachment.title, loading: 'lazy' },
			  } )
			: el( 'div', {
					class: 'atcf-media__file',
					children: [ icon( 'dashicons-media-default' ), el( 'span', { text: attachment.filename || attachment.title } ) ],
			  } );

		frame.append(
			el( 'div', {
				class: 'atcf-media__preview',
				children: [
					preview,
					el( 'div', {
						class: 'atcf-media__actions',
						children: [
							button( t( 'edit', 'Edit' ), { on: { click: () => void pick() } } ),
							button( t( 'remove', 'Remove' ), {
								class: 'atcf-media__remove',
								on: {
									click: () => {
										current = 0;
										set( 0 );
										void draw();
									},
								},
							} ),
						],
					} ),
				],
			} )
		);

		// The preview is draggable out. A photo already chosen on one post is
		// routinely the photo you want on the next one, and the desktop is the
		// only place that gesture has ever been possible.
		makeDraggable( preview, attachment );

		host.append( frame );
	};

	const pick = async () => {
		const ids = await openLibrary( {
			multiple: false,
			mime: settings.mime_types ?? ( isImage ? 'image' : '' ),
			title: isImage ? t( 'selectImage', 'Choose an image' ) : t( 'selectFile', 'Choose a file' ),
			selected: current ? [ current ] : [],
		} );

		if ( ids.length ) {
			current = ids[ 0 ];
			set( current );
			void draw();
		}
	};

	// The wrapper answers drops by setting the value through here, so a dragged
	// photo and a picked one take exactly the same path.
	host.addEventListener( 'atcf:media-dropped', ( ( event: CustomEvent< { ids: number[] } > ) => {
		const [ first ] = event.detail.ids;

		if ( first ) {
			current = first;
			set( current );
			void draw();
		}
	} ) as EventListener );

	void draw();
}

/** The gallery control. */
registerMount( 'gallery', ( context ) => {
	const { host, field, set } = context;
	const settings = field.settings as { mime_types?: string; max_items?: number };
	const max = Number( settings.max_items ?? 0 );

	let ids: number[] = Array.isArray( context.value ) ? ( context.value as unknown[] ).map( Number ).filter( Boolean ) : [];

	const commit = () => {
		set( ids );
		void draw();
	};

	const draw = async () => {
		clear( host );

		const grid = el( 'div', { class: 'atcf-gallery' } );
		const items = await loadAttachments( ids );

		items.forEach( ( attachment, index ) => {
			const tile = el( 'div', {
				class: 'atcf-gallery__item',
				dataset: { index: String( index ) },
				children: [
					attachment.thumbnail
						? el( 'img', {
								attrs: { src: attachment.thumbnail, alt: attachment.alt || attachment.title, loading: 'lazy' },
						  } )
						: el( 'span', { class: 'atcf-gallery__name', text: attachment.filename } ),
					el( 'button', {
						class: 'atcf-gallery__remove',
						text: '×',
						attrs: { type: 'button', 'aria-label': `${ t( 'remove', 'Remove' ) }: ${ attachment.title }` },
						on: {
							click: ( event ) => {
								event.stopPropagation();
								ids = ids.filter( ( one ) => one !== attachment.id );
								commit();
							},
						},
					} ),
				],
			} );

			makeDraggable( tile, attachment, () => {
				// Reordering within the gallery. The same lift serves both, and
				// which one it was is decided by where it landed — dropping on
				// this gallery reorders, dropping anywhere else copies.
			} );

			tile.addEventListener( 'pointerdown', ( event ) => {
				startDrag( event as PointerEvent, {
					payload: buildPayload(
						config().dragTypes.value,
						tile,
						{ kind: 'attachment', id: attachment.id, title: attachment.title, thumbnail: attachment.thumbnail },
						event as PointerEvent,
						tile.cloneNode( true ) as HTMLElement
					),
					origin: event as PointerEvent,
					onCancel: () => undefined,
				} );
			} );

			grid.append( tile );
		} );

		if ( ! max || ids.length < max ) {
			grid.append(
				el( 'button', {
					class: 'atcf-gallery__add',
					attrs: { type: 'button' },
					children: [ icon( 'dashicons-plus-alt2' ), el( 'span', { text: t( 'add', 'Add' ) } ) ],
					on: { click: () => void pick() },
				} )
			);
		}

		host.append( grid );
	};

	// Registered once, on the mount host rather than on the grid.
	//
	// The grid is rebuilt on every change, and OpenStation's registry hit-tests
	// by walking up from `elementFromPoint` — stopping at `.os-window` if it
	// finds nothing registered. A target on an element that has just been
	// replaced is a target that is not in the DOM, so the walk sails past it to
	// the window boundary and the drop vanishes. The host outlives every redraw.
	//
	// The id is stable for the same reason: the registry replaces in place on a
	// repeat registration, so one gallery never leaves a trail of dead entries.
	dragManager().registerDropTarget( {
		id: `allterrain-fields/gallery/${ field.key }`,
		element: host,
		accept: ( payload ) => payload.type === config().dragTypes.value,
		onDrop: ( session, point ) => {
			const id = Number( ( session.payload.data as { id?: unknown } ).id ?? 0 );
			const grid = host.querySelector< HTMLElement >( '.atcf-gallery' );

			if ( ! id || ! grid ) {
				return;
			}

			const target = insertionIndex( grid, '.atcf-gallery__item', point.clientY );

			ids = ids.filter( ( one ) => one !== id );
			ids.splice( Math.min( target, ids.length ), 0, id );
			commit();
		},
	} );

	const pick = async () => {
		const chosen = await openLibrary( {
			multiple: true,
			mime: settings.mime_types ?? 'image',
			title: t( 'selectImages', 'Choose images' ),
			selected: ids,
		} );

		if ( chosen.length ) {
			ids = max > 0 ? chosen.slice( 0, max ) : chosen;
			commit();
		}
	};

	host.addEventListener( 'atcf:media-dropped', ( ( event: CustomEvent< { ids: number[] } > ) => {
		const added = event.detail.ids.filter( ( id ) => ! ids.includes( id ) );

		if ( ! added.length ) {
			return;
		}

		ids = max > 0 ? [ ...ids, ...added ].slice( 0, max ) : [ ...ids, ...added ];
		commit();
	} ) as EventListener );

	void draw();
} );

/**
 * Makes a preview draggable onto the rest of the desktop.
 *
 * The payload is `allterrain-fields/value` and carries the whole attachment, so
 * whatever catches it can render something immediately rather than fetching
 * mid-gesture.
 *
 * @param element    What to lift.
 * @param attachment What it represents.
 * @param onClick    What a press that never became a drag should do.
 */
function makeDraggable( element: HTMLElement, attachment: Attachment, onClick?: () => void ): void {
	element.addEventListener( 'pointerdown', ( event ) => {
		const ghost = el( 'div', {
			class: 'atcf-drag-ghost atcf-drag-ghost--media',
			children: [
				attachment.thumbnail
					? el( 'img', { attrs: { src: attachment.thumbnail, alt: '' } } )
					: icon( 'dashicons-media-default' ),
			],
		} );

		startDrag( event, {
			payload: buildPayload(
				config().dragTypes.value,
				element,
				{
					kind: 'attachment',
					id: attachment.id,
					title: attachment.title,
					url: attachment.url,
					thumbnail: attachment.thumbnail,
					// The shell's own shape as well as ours, so a target written
					// against WP Explorer's `shortcut` payload accepts this
					// without knowing anything about this plugin.
					ref: String( attachment.id ),
				},
				event,
				ghost
			),
			origin: event,
			onClickOnly: onClick,
			onCancel: () => undefined,
		} );
	} );
}
