/**
 * The relational controls.
 *
 * One control, five field types. A relationship, a post object, a page link, a
 * taxonomy and a user all ask the same question — *which of these things?* — and
 * differ only in what they search and how many answers they take. Writing five
 * near-identical pickers is how four of them end up missing the keyboard
 * handling the fifth one got.
 *
 * What is different here from every picker that came before is what a chosen
 * thing *is*. It is not a row in a list box. It is a **chip you can drag**:
 *
 * - Drag a post out of WP Explorer, off the wallpaper, or out of another post's
 *   relationship field, and drop it here. It is added.
 * - Drag a chip out of here onto an AllTerrain Work column and it becomes a
 *   task; onto another relationship field and it is copied there.
 * - Drag a chip within the list and the order changes, because a relationship
 *   field's order is meaning — "featured first" is a decision somebody made.
 * - Click a chip and the thing opens **in its own window**, beside the post you
 *   are editing, rather than navigating away from unsaved work.
 *
 * That last one is the small thing that changes how the field feels. Checking
 * what a related post actually says has always meant leaving the editor.
 */

import { clear, control, debounce, el, icon, readValue, t, uid } from './helpers';
import { buildPayload, dragManager, insertionIndex, startDrag } from '../dnd';
import { config, search } from '../api';
import { shell } from '../shell';
import { registerMount } from './mount';
import type { MountContext } from './mount';
import type { SearchResult } from '../types';

/** How each type searches, and how many answers it takes. */
interface RelationalShape {
	kind: 'post' | 'term' | 'user';
	multiple: ( context: MountContext ) => boolean;
	params: ( context: MountContext ) => Record< string, string | number >;
	max: ( context: MountContext ) => number;
	sortable: boolean;
}

const SHAPES: Record< string, RelationalShape > = {
	post_object: {
		kind: 'post',
		multiple: ( c ) => Boolean( ( c.field.settings as { multiple?: boolean } ).multiple ),
		params: ( c ) => ( { post_type: ( ( c.field.settings as { post_types?: string[] } ).post_types ?? [] ).join( ',' ) } ),
		max: () => 0,
		sortable: false,
	},
	relationship: {
		kind: 'post',
		multiple: () => true,
		params: ( c ) => ( { post_type: ( ( c.field.settings as { post_types?: string[] } ).post_types ?? [] ).join( ',' ) } ),
		max: ( c ) => Number( ( c.field.settings as { max_items?: number } ).max_items ?? 0 ),
		sortable: true,
	},
	page_link: {
		kind: 'post',
		multiple: ( c ) => Boolean( ( c.field.settings as { multiple?: boolean } ).multiple ),
		params: ( c ) => ( { post_type: ( ( c.field.settings as { post_types?: string[] } ).post_types ?? [] ).join( ',' ) } ),
		max: () => 0,
		sortable: false,
	},
	taxonomy: {
		kind: 'term',
		multiple: ( c ) => ( c.field.settings as { multiple?: boolean } ).multiple !== false,
		params: ( c ) => ( { taxonomy: String( ( c.field.settings as { taxonomy?: string } ).taxonomy ?? '' ) } ),
		max: () => 0,
		sortable: false,
	},
	user: {
		kind: 'user',
		multiple: ( c ) => Boolean( ( c.field.settings as { multiple?: boolean } ).multiple ),
		params: ( c ) => ( { roles: ( ( c.field.settings as { roles?: string[] } ).roles ?? [] ).join( ',' ) } ),
		max: () => 0,
		sortable: false,
	},
};

Object.keys( SHAPES ).forEach( ( type ) => registerMount( type, ( context ) => relational( context, SHAPES[ type ] ) ) );

/**
 * The shared relational control.
 *
 * @param context The mount.
 * @param shape   How this type behaves.
 */
function relational( context: MountContext, shape: RelationalShape ): void {
	const { host, field, set } = context;
	const multiple = shape.multiple( context );
	const max = shape.max( context );

	let chosen: number[] = toIds( context.value );
	let records = new Map< number, SearchResult >();
	let open = false;

	const listId = uid( 'atcf-rel' );

	const commit = () => {
		set( multiple ? chosen : chosen[ 0 ] ?? 0 );
		drawChips();
	};

	const root = el( 'div', { class: `atcf-rel atcf-rel--${ shape.kind }` } );
	const chips = el( 'div', { class: 'atcf-rel__chips', attrs: { role: 'list' } } );
	const searchBox = control( 'os-text-field', 'input', {
		class: 'atcf-rel__search',
		attrs: {
			type: 'search',
			placeholder: t( 'search', 'Search' ),
			role: 'combobox',
			'aria-expanded': 'false',
			'aria-controls': listId,
			'aria-autocomplete': 'list',
		},
	} );
	const results = el( 'div', { class: 'atcf-rel__results', attrs: { id: listId, role: 'listbox', hidden: '' } } );

	/**
	 * Draws the chosen chips.
	 *
	 * Rebuilt wholesale rather than diffed. The list is at most a few dozen
	 * items, the whole thing is one paint, and a diffing implementation of
	 * something this small is where the reorder bugs live.
	 */
	const drawChips = () => {
		clear( chips );

		if ( ! chosen.length ) {
			chips.append( el( 'p', { class: 'atcf-rel__empty', text: t( 'empty', 'Nothing here yet.' ) } ) );

			return;
		}

		chosen.forEach( ( id ) => {
			const record = records.get( id );
			const chip = el( 'div', {
				class: 'atcf-rel__chip',
				attrs: { role: 'listitem' },
				dataset: { id: String( id ) },
				children: [
					record?.thumbnail
						? el( 'img', { class: 'atcf-rel__thumb', attrs: { src: record.thumbnail, alt: '' } } )
						: icon( iconFor( shape.kind ), { class: 'atcf-rel__icon' } ),
					el( 'span', {
						class: 'atcf-rel__label',
						text: record?.label ?? `#${ id }`,
					} ),
					record?.sub ? el( 'span', { class: 'atcf-rel__sub', text: record.sub } ) : null,
					el( 'button', {
						class: 'atcf-rel__remove',
						text: '×',
						attrs: {
							type: 'button',
							'aria-label': `${ t( 'remove', 'Remove' ) }: ${ record?.label ?? id }`,
						},
						on: {
							click: ( event ) => {
								event.stopPropagation();
								chosen = chosen.filter( ( one ) => one !== id );
								commit();
							},
						},
					} ),
				],
			} );

			// Opening in a window rather than navigating. The whole reason to
			// have a desktop: checking what a related post says should not cost
			// you the edit you were in the middle of.
			if ( record?.editUrl ) {
				chip.classList.add( 'atcf-rel__chip--openable' );
				chip.setAttribute( 'title', t( 'openInWindow', 'Open in its own window' ) );
			}

			chip.addEventListener( 'pointerdown', ( event ) => {
				startDrag( event as PointerEvent, {
					payload: buildPayload(
						config().dragTypes.value,
						chip,
						{
							kind: shape.kind === 'post' ? 'post' : shape.kind,
							id,
							ref: String( id ),
							title: record?.label ?? String( id ),
							thumbnail: record?.thumbnail,
							field: field.key,
						},
						event as PointerEvent,
						chip.cloneNode( true ) as HTMLElement
					),
					origin: event as PointerEvent,
					onClickOnly: () => record?.editUrl && openInWindow( record ),
					onCancel: () => undefined,
				} );
			} );

			chips.append( chip );
		} );
	};

	/** Fetches the labels for whatever is chosen. */
	const hydrate = async () => {
		if ( ! chosen.length ) {
			drawChips();

			return;
		}

		const { results: found } = await search( {
			kind: shape.kind,
			include: chosen.join( ',' ),
			...shape.params( context ),
		} );

		found.forEach( ( record ) => records.set( record.id, record ) );
		drawChips();
	};

	/** Draws the search results. */
	const drawResults = ( items: SearchResult[] ) => {
		clear( results );

		if ( ! items.length ) {
			results.append( el( 'p', { class: 'atcf-rel__none', text: t( 'noResults', 'Nothing matched.' ) } ) );

			return;
		}

		items.forEach( ( item ) => {
			const already = chosen.includes( item.id );

			results.append(
				el( 'button', {
					class: `atcf-rel__result${ already ? ' is-chosen' : '' }`,
					attrs: { type: 'button', role: 'option', 'aria-selected': already ? 'true' : 'false' },
					children: [
						item.thumbnail
							? el( 'img', { attrs: { src: item.thumbnail, alt: '' } } )
							: icon( iconFor( shape.kind ) ),
						el( 'span', { class: 'atcf-rel__result-label', text: item.label } ),
						el( 'span', { class: 'atcf-rel__result-sub', text: item.sub } ),
					],
					on: {
						click: () => {
							records.set( item.id, item );
							add( [ item.id ] );
							closeResults();
						},
					},
				} )
			);
		} );
	};

	const closeResults = () => {
		open = false;
		results.setAttribute( 'hidden', '' );
		searchBox.setAttribute( 'aria-expanded', 'false' );
		( searchBox as HTMLInputElement ).value = '';
	};

	const openResults = () => {
		open = true;
		results.removeAttribute( 'hidden' );
		searchBox.setAttribute( 'aria-expanded', 'true' );
	};

	const add = ( ids: number[] ) => {
		const fresh = ids.filter( ( id ) => ! chosen.includes( id ) );

		if ( ! fresh.length ) {
			return;
		}

		if ( ! multiple ) {
			chosen = [ fresh[ 0 ] ];
		} else {
			chosen = [ ...chosen, ...fresh ];

			if ( max > 0 ) {
				chosen = chosen.slice( 0, max );
			}
		}

		commit();
		void hydrate();
	};

	const run = debounce( async ( query: string ) => {
		const { results: found } = await search( { kind: shape.kind, q: query, ...shape.params( context ) } );

		found.forEach( ( record ) => records.set( record.id, record ) );
		drawResults( found );
		openResults();
	}, 220 );

	searchBox.addEventListener( 'input', () => run( readValue( searchBox ) ) );
	searchBox.addEventListener( 'focus', () => {
		if ( ! open ) {
			run( readValue( searchBox ) );
		}
	} );
	searchBox.addEventListener( 'keydown', ( event ) => {
		const key = ( event as KeyboardEvent ).key;

		if ( key === 'Escape' && open ) {
			event.stopPropagation();
			closeResults();

			return;
		}

		if ( key === 'ArrowDown' && open ) {
			event.preventDefault();
			results.querySelector< HTMLElement >( '.atcf-rel__result' )?.focus();
		}
	} );

	// Closing on a click elsewhere, not on blur. Blur fires before the click
	// that caused it reaches the result, so closing there means every choice is
	// made on a list that has already gone.
	document.addEventListener( 'pointerdown', ( event ) => {
		if ( open && ! root.contains( event.target as Node ) ) {
			closeResults();
		}
	} );

	root.append( chips, el( 'div', { class: 'atcf-rel__find', children: [ searchBox, results ] } ) );

	if ( shape.sortable ) {
		// On `root`, not on `chips`: `chips` is emptied and refilled on every
		// change, and a target whose element left the DOM is a target the shell's
		// walk-up hit-test never finds — it reaches `.os-window` and gives up.
		// Stable id, so a redraw replaces the registration rather than stacking.
		dragManager().registerDropTarget( {
			id: `allterrain-fields/relationship/${ field.key }`,
			element: root,
			accept: ( payload ) => payload.type === config().dragTypes.value,
			onDrop: ( session, point ) => {
				const id = Number( ( session.payload.data as { id?: unknown } ).id ?? 0 );

				if ( ! id ) {
					return;
				}

				const index = insertionIndex( chips, '.atcf-rel__chip', point.clientY );

				chosen = chosen.filter( ( one ) => one !== id );
				chosen.splice( Math.min( index, chosen.length ), 0, id );
				commit();
				void hydrate();
			},
		} );
	}

	// Drops from anywhere else on the desktop arrive as this event, dispatched
	// by `drops.ts` once it has decided the payload is something this field can
	// hold. The control never has to know what a wallpaper tile is.
	host.addEventListener( 'atcf:entities-dropped', ( ( event: CustomEvent< { ids: number[] } > ) => {
		add( event.detail.ids );
	} ) as EventListener );

	host.append( root );

	void hydrate();
}

/** Opens a record in its own window, or a tab when there is no shell. */
function openInWindow( record: SearchResult ): void {
	const os = shell();
	const url = record.editUrl ?? '';

	if ( ! url ) {
		return;
	}

	if ( os?.windowManager?.open ) {
		os.windowManager.open( {
			id: `atcf-related-${ record.id }`,
			url,
			title: record.label,
			icon: 'dashicons-admin-post',
		} );

		return;
	}

	window.open( url, '_blank', 'noopener' );
}

/** The icon for a kind of thing. */
function iconFor( kind: string ): string {
	if ( kind === 'user' ) {
		return 'dashicons-admin-users';
	}

	if ( kind === 'term' ) {
		return 'dashicons-tag';
	}

	return 'dashicons-admin-post';
}

/** Coerces a stored value into a flat list of ids. */
function toIds( value: unknown ): number[] {
	if ( Array.isArray( value ) ) {
		return value.map( ( one ) => Number( ( one as { id?: unknown } )?.id ?? one ) ).filter( ( id ) => id > 0 );
	}

	const single = Number( value ?? 0 );

	return single > 0 ? [ single ] : [];
}

/**
 * The link control.
 *
 * Three inputs and nothing clever, because a link genuinely is three things: a
 * URL, the words that go in the anchor, and whether it opens elsewhere. A post
 * dropped on it fills the first two.
 */
registerMount( 'link', ( context: MountContext ) => {
	const { host, set } = context;
	const value = ( context.value ?? {} ) as { url?: string; title?: string; target?: string };

	const current = {
		url: String( value.url ?? '' ),
		title: String( value.title ?? '' ),
		target: String( value.target ?? '' ),
	};

	const push = () => set( current.url === '' ? '' : { ...current } );

	const urlInput = control( 'os-text-field', 'input', {
		class: 'atcf-link__url',
		attrs: { type: 'url', placeholder: 'https://', 'aria-label': 'URL' },
	} );
	const titleInput = control( 'os-text-field', 'input', {
		class: 'atcf-link__title',
		// Its own string, not the borrowed "Add" that used to sit here — a
		// placeholder is the only name an optional input gets, and "Add" names
		// a button, not a box for the words a link shows.
		attrs: { type: 'text', placeholder: t( 'linkText', 'Link text' ), 'aria-label': 'Link text' },
	} );
	const targetInput = el( 'input', { attrs: { type: 'checkbox' } } ) as HTMLInputElement;

	( urlInput as HTMLInputElement ).value = current.url;
	( titleInput as HTMLInputElement ).value = current.title;
	targetInput.checked = current.target === '_blank';

	urlInput.addEventListener( 'input', () => {
		current.url = readValue( urlInput );
		push();
	} );
	titleInput.addEventListener( 'input', () => {
		current.title = readValue( titleInput );
		push();
	} );
	targetInput.addEventListener( 'change', () => {
		current.target = targetInput.checked ? '_blank' : '';
		push();
	} );

	host.addEventListener( 'atcf:entities-dropped', ( ( event: CustomEvent< { ids: number[]; titles: string[]; urls: string[] } > ) => {
		const [ url ] = event.detail.urls ?? [];
		const [ title ] = event.detail.titles ?? [];

		if ( url ) {
			current.url = url;
			( urlInput as HTMLInputElement ).value = url;
		}

		if ( title && current.title === '' ) {
			current.title = title;
			( titleInput as HTMLInputElement ).value = title;
		}

		push();
	} ) as EventListener );

	host.append(
		el( 'div', {
			class: 'atcf-link',
			children: [
				urlInput,
				titleInput,
				el( 'label', {
					class: 'atcf-link__target',
					children: [ targetInput, el( 'span', { text: 'Opens in a new tab' } ) ],
				} ),
			],
		} )
	);
} );

/** Exposed so the builder's live preview can mount the real control. */
export { relational };
