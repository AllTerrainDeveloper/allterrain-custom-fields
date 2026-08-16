/**
 * The Field Inspector widget.
 *
 * A card on the wallpaper that shows the custom fields of **whatever window has
 * focus**, editable, live.
 *
 * This is the piece of the plugin that only exists because the desktop does. In
 * a browser tab there is one focus and it is the page, so "the fields of the
 * thing you are looking at" is a sentence with no meaning. On a desktop with
 * four windows open it is the most useful sentence there is: a post editor in
 * one window, a Media window beside it, and a small panel on the wallpaper that
 * always shows the fields of whichever you last touched — and lets you change
 * one without the editor being the thing you are looking at.
 *
 * It works by reading the shell's own content identity for the focused window.
 * The shell already knows what every window is showing; this asks.
 *
 * Writes go straight through to the object, one field at a time, and are
 * announced so the editor's own copy of the field can refresh. There is no Save
 * button, because there is nothing to batch: each control commits when it is
 * done with.
 */

import './controls/media';
import './controls/relational';
import './controls/repeater';
import './controls/misc';

import { clear, componentsReady, el, icon } from './ui';
import { notify, shell } from './shell';
import { config } from './api';
import { renderField } from './controls/render';
import type { ContentRef, Field } from './types';

/** What the object route gives back. */
interface ObjectFields {
	label: string;
	fields: Array< Field & { group: string } >;
	values: Record< string, unknown >;
}

/** One mounted widget. */
class Inspector {
	private root: HTMLElement;
	private ref: { type: string; id: number | string } | null = null;
	private token = 0;

	public constructor( root: HTMLElement ) {
		this.root = root;
	}

	/** Starts watching for focus changes. */
	public start(): void {
		void componentsReady();

		this.draw( null );

		// `os-window-focused` is the shell's own event and fires for every
		// window including iframes, which is what makes this work over a post
		// editor. Polling the relations API instead would miss the moment and
		// would cost a lookup a second forever.
		document.addEventListener( 'os-window-focused', ( event ) => {
			const id = ( event as CustomEvent< { windowId?: string } > ).detail?.windowId;

			if ( id ) {
				void this.follow( id );
			}
		} );

		// The identity of an *already focused* window can change without the
		// focus changing — somebody navigates the editor to another post. The
		// shell announces that separately.
		document.addEventListener( 'os-window-content-changed', ( event ) => {
			const id = ( event as CustomEvent< { windowId?: string } > ).detail?.windowId;

			if ( id ) {
				void this.follow( id );
			}
		} );
	}

	/** Points the inspector at whatever a window is showing. */
	private async follow( windowId: string ): Promise< void > {
		const identity = shell()?.relations?.get?.( windowId );
		const ref = refOf( identity );

		if ( ! ref ) {
			// A window showing no single object — a list table, the desktop
			// itself, this plugin's own builder. The panel says so rather than
			// keeping the last thing it saw, which would be a panel that
			// silently lies about what it is showing.
			this.ref = null;
			this.draw( null );

			return;
		}

		if ( this.ref && this.ref.type === ref.type && this.ref.id === ref.id ) {
			return;
		}

		this.ref = ref;

		const mine = ++this.token;

		try {
			const { restUrl, nonce } = config();
			const response = await fetch( `${ restUrl }object?type=${ encodeURIComponent( ref.type ) }&id=${ encodeURIComponent( String( ref.id ) ) }`, {
				credentials: 'same-origin',
				headers: { 'X-WP-Nonce': nonce },
			} );

			// A slower earlier request must not overwrite a faster later one.
			// Focus moves quickly and this is exactly the shape of race that
			// makes a panel show the previous window's fields.
			if ( mine !== this.token ) {
				return;
			}

			if ( ! response.ok ) {
				this.draw( null );

				return;
			}

			this.draw( ( await response.json() ) as ObjectFields );
		} catch {
			if ( mine === this.token ) {
				this.draw( null );
			}
		}
	}

	/** Paints. */
	private draw( data: ObjectFields | null ): void {
		clear( this.root );

		if ( ! data ) {
			this.root.append(
				el( 'div', {
					class: 'atcfw__empty',
					children: [
						icon( 'dashicons-index-card' ),
						el( 'p', { text: 'Focus a window showing a post, a term or a person and its fields appear here.' } ),
					],
				} )
			);

			return;
		}

		if ( ! data.fields.length ) {
			this.root.append(
				el( 'div', {
					class: 'atcfw__empty',
					children: [
						el( 'p', { text: `“${ data.label }” has no custom fields.` } ),
					],
				} )
			);

			return;
		}

		this.root.append( el( 'h2', { class: 'atcfw__title', text: data.label } ) );

		const list = el( 'div', { class: 'atcfw__fields atcf-fields' } );

		data.fields.forEach( ( field ) => {
			const rendered = renderField( field, data.values[ field.key ], ( value ) => void this.write( field, value ) );

			list.append( rendered.element );
		} );

		this.root.append( list );
	}

	/** Writes one field. */
	private async write( field: Field, value: unknown ): Promise< void > {
		if ( ! this.ref ) {
			return;
		}

		try {
			const { restUrl, nonce } = config();
			const response = await fetch( `${ restUrl }object`, {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
				body: JSON.stringify( { ...this.ref, field: field.key, value } ),
			} );

			if ( ! response.ok ) {
				const body = ( await response.json().catch( () => null ) ) as { message?: string } | null;

				notify( 'That would not save.', body?.message ?? '', 'error' );

				return;
			}

			// Broadcast rather than a direct call: the editor showing the same
			// post is in another window, possibly in an iframe, and the shell's
			// bus is the only thing that reaches both.
			shell()?.broadcast?.( 'os.allterrain-fields.changed', {
				source: 'field-inspector',
				action: 'updated',
				ids: [ this.ref.id ],
				field: field.key,
			} );
		} catch ( error ) {
			notify( 'That would not save.', error instanceof Error ? error.message : '', 'error' );
		}
	}
}

/** Turns a shell identity into something the object route understands. */
function refOf( identity: ContentRef | undefined ): { type: string; id: number | string } | null {
	if ( ! identity ) {
		return null;
	}

	const type = String( identity.type );

	if ( [ 'post', 'page', 'media' ].includes( type ) ) {
		return { type: 'post', id: Number( identity.id ) };
	}

	if ( type === 'user' ) {
		return { type: 'user', id: Number( identity.id ) };
	}

	if ( type === 'term' || type.startsWith( 'term/' ) ) {
		return { type: 'term', id: Number( identity.id ) };
	}

	return null;
}

/**
 * The shell's widget render callback.
 *
 * A widget publishes its renderer on `window.openStationWidgets[ id ]` and the
 * shell calls it with the card's body.
 */
const globals = window as unknown as {
	openStationWidgets?: Record< string, ( body: HTMLElement ) => void >;
};

globals.openStationWidgets = globals.openStationWidgets ?? {};

globals.openStationWidgets[ 'allterrain-fields/inspector' ] = ( body: HTMLElement ) => {
	if ( body.dataset.atcfwMounted === '1' ) {
		return;
	}

	body.dataset.atcfwMounted = '1';
	body.classList.add( 'atcfw' );

	new Inspector( body ).start();
};
