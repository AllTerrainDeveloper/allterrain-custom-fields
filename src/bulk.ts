/**
 * The bulk editor.
 *
 * One field group, one post type, every post, as a grid. Edit a cell, press Tab,
 * edit the next one. Paste a column in from a spreadsheet.
 *
 * This is the screen that does not exist anywhere else in this category, and the
 * absence is strange: the whole promise of structured content is that a field
 * means the same thing on every post, and the one thing you cannot do with that
 * is *look at the field across every post*. Filling in forty SKUs means opening
 * forty editors.
 *
 * The rules it keeps:
 *
 * - **Nothing saves until you say so.** Edits collect and a bar says how many
 *   are pending. A grid that wrote on every keystroke would be a grid where a
 *   mis-key is forty rows away by the time you notice.
 * - **Permission is per row.** A user who may edit thirty-nine of forty posts
 *   sees the fortieth greyed with a reason, and the save writes the thirty-nine.
 *   Refusing all forty over one is how people stop using a tool.
 * - **Only the fields a cell can hold.** A repeater in a cell is not a cell, so
 *   containers are not offered as columns rather than being offered and broken.
 */

import { button, clear, componentsReady, debounce, el, icon, select, uid } from './ui';
import { notify, shell, shellIsActive, whenShellReady } from './shell';
import { mountWindowTabs } from './window-tabs';
import * as api from './api';
import { normalizeChoices } from './controls/render';

/** A pending edit. */
interface Pending {
	id: number;
	field: string;
	value: unknown;
}

/** One mounted grid. */
class Bulk {
	private root: HTMLElement;
	private groups: Array< { id: number; title: string; types: string[] } > = [];
	private groupId = 0;
	private postType = '';
	private query = '';
	private page = 1;
	private pages = 1;
	private data: Awaited< ReturnType< typeof api.readValues > > | null = null;
	private pending = new Map< string, Pending >();

	public constructor( root: HTMLElement ) {
		this.root = root;
	}

	/** Loads and paints. */
	public async start(): Promise< void > {
		// Awaited, not fired and forgotten. Inside the shell this is a local
		// fetch that resolves in a frame or two, and waiting for it is what makes
		// the first paint use `<os-*>` components rather than painting plain
		// controls and leaving them — a control the user may already have typed
		// into cannot be swapped afterwards without losing the keystroke.
		//
		// With no shell it resolves immediately, so nothing is lost either way.
		await componentsReady();

		try {
			const summaries = await api.listGroups();

			this.groups = summaries.filter( ( one ) => one.active ).map( ( one ) => ( {
				id: one.id,
				title: one.title,
				types: one.types,
			} ) );
		} catch ( error ) {
			this.fail( error );

			return;
		}

		this.groupId = this.groups[ 0 ]?.id ?? 0;

		if ( ! this.groupId ) {
			this.dismissLoader();
			clear( this.root );
			this.root.append(
				el( 'div', {
					class: 'atcfk__empty',
					children: [
						icon( 'dashicons-editor-table', { class: 'atcfk__empty-icon', attrs: { size: '48' } } ),
						el( 'h2', { text: api.t( 'bulkEmptyTitle', 'Nothing to edit in bulk yet' ) } ),
						el( 'p', {
							text: api.t(
								'bulkEmptyBody',
								'The bulk editor works across every post a field group covers. Create a field group and its posts appear here as rows.'
							),
						} ),
						button( api.t( 'bulkEmptyAction', 'Open Field Groups' ), {
							variant: 'primary',
							on: { click: () => openBuilder() },
						} ),
					],
				} )
			);

			return;
		}

		await this.load();
	}

	/**
	 * Removes the template's boot spinner.
	 *
	 * A sibling of the mount root, printed by PHP so the window is never blank
	 * before the bundle runs — so no paint inside the root ever covers it, and
	 * left alone it says "Loading values…" forever over a grid that loaded.
	 */
	private dismissLoader(): void {
		this.root.closest( '[data-atcfk-root]' )?.querySelector( '[data-atcfk-bar]' )?.remove();
	}

	private fail( error: unknown ): void {
		this.dismissLoader();
		clear( this.root );
		this.root.append(
			el( 'div', {
				class: 'atcfk__error',
				children: [
					el( 'h2', { text: 'The bulk editor could not start.' } ),
					el( 'p', { text: error instanceof Error ? error.message : String( error ) } ),
				],
			} )
		);
	}

	/** Fetches a page of rows. */
	private async load(): Promise< void > {
		try {
			this.data = await api.readValues( {
				group: this.groupId,
				post_type: this.postType,
				q: this.query,
				page: this.page,
			} );

			this.postType = this.data.postType;
			this.pages = this.data.pages;
		} catch ( error ) {
			this.fail( error );

			return;
		}

		this.draw();
	}

	/** Paints the whole thing. */
	private draw(): void {
		this.dismissLoader();
		clear( this.root );

		this.root.append( this.controls(), this.grid(), this.footer() );
	}

	/** Group, post type, search. */
	private controls(): HTMLElement {
		const group = this.groups.find( ( one ) => one.id === this.groupId );
		const types = ( group?.types ?? [] ).filter( ( one ) => one !== '*' );

		const search = el( 'input', {
			class: 'atcfk__search',
			attrs: { type: 'search', placeholder: 'Search these posts', 'aria-label': 'Search', value: this.query },
		} ) as HTMLInputElement;

		const run = debounce( () => {
			this.query = search.value;
			this.page = 1;
			void this.load();
		}, 300 );

		search.addEventListener( 'input', run );

		return el( 'div', {
			class: 'atcfk__controls',
			children: [
				el( 'label', {
					class: 'atcfk__control',
					children: [
						el( 'span', { text: 'Field group' } ),
						select(
							String( this.groupId ),
							this.groups.map( ( one ) => ( { value: String( one.id ), label: one.title } ) ),
							( value ) => {
								this.groupId = Number( value );
								// The post type is cleared rather than kept: the
								// new group may not appear on the old type at
								// all, and a grid of a group against a type it
								// is not on is an empty grid that looks broken.
								this.postType = '';
								this.page = 1;
								void this.load();
							}
						),
					],
				} ),
				types.length > 1
					? el( 'label', {
							class: 'atcfk__control',
							children: [
								el( 'span', { text: 'Post type' } ),
								select(
									this.postType,
									types.map( ( one ) => ( { value: one, label: one } ) ),
									( value ) => {
										this.postType = value;
										this.page = 1;
										void this.load();
									}
								),
							],
					  } )
					: null,
				search,
			],
		} );
	}

	/** The grid. */
	private grid(): HTMLElement {
		if ( ! this.data ) {
			return el( 'p', { text: '' } );
		}

		const table = el( 'table', { class: 'atcfk__table' } );
		const head = el( 'tr' );

		head.append( el( 'th', { text: 'Post', attrs: { scope: 'col' } } ) );

		this.data.columns.forEach( ( column ) => {
			head.append( el( 'th', { text: column.label, attrs: { scope: 'col' } } ) );
		} );

		table.append( el( 'thead', { children: [ head ] } ) );

		const body = el( 'tbody' );

		this.data.rows.forEach( ( row ) => {
			const tr = el( 'tr', { class: row.canEdit ? '' : 'is-locked' } );

			tr.append(
				el( 'th', {
					class: 'atcfk__row-head',
					attrs: { scope: 'row' },
					children: [
						el( 'a', {
							text: row.title || '(no title)',
							attrs: { href: row.editUrl, target: '_blank', rel: 'noreferrer noopener' },
						} ),
						row.status !== 'publish' ? el( 'span', { class: 'atcfk__status', text: row.status } ) : null,
					],
				} )
			);

			this.data?.columns.forEach( ( column ) => {
				tr.append( this.cell( row.id, column, row.values[ column.key ], row.canEdit ) );
			} );

			body.append( tr );
		} );

		table.append( body );

		return table;
	}

	/** One editable cell. */
	private cell(
		id: number,
		column: { key: string; label: string; type: string; settings: Record< string, unknown > },
		value: unknown,
		canEdit: boolean
	): HTMLElement {
		const cellId = `${ id }:${ column.key }`;
		const td = el( 'td', { class: 'atcfk__cell' } );

		if ( ! canEdit ) {
			td.append(
				el( 'span', {
					class: 'atcfk__locked',
					text: summarise( value ),
					attrs: { title: 'You cannot edit this post.' },
				} )
			);

			return td;
		}

		// Choice fields get a dropdown, switches get a checkbox, everything else
		// gets a text box. A relationship in a cell would need the whole picker,
		// which is not a cell — those columns exist and are read-only here, and
		// the row heading links to the editor that can change them.
		if ( [ 'select', 'radio', 'button_group' ].includes( column.type ) ) {
			const choices = [ { value: '', label: '—' } ].concat( normalizeChoices( column.settings.choices ) );

			td.append(
				select( String( value ?? '' ), choices, ( next ) => this.stage( cellId, { id, field: column.key, value: next } ) )
			);

			return td;
		}

		if ( column.type === 'true_false' ) {
			const box = el( 'input', { attrs: { type: 'checkbox' } } ) as HTMLInputElement;

			box.checked = String( value ?? '' ) === '1';
			box.addEventListener( 'change', () =>
				this.stage( cellId, { id, field: column.key, value: box.checked ? '1' : '0' } )
			);

			td.append( box );

			return td;
		}

		if ( [ 'relationship', 'post_object', 'gallery', 'image', 'file', 'user', 'taxonomy', 'link', 'repeater', 'flexible_content', 'group' ].includes( column.type ) ) {
			td.append(
				el( 'span', {
					class: 'atcfk__readonly',
					text: summarise( value ),
					attrs: { title: 'Edit this one in the post itself.' },
				} )
			);

			return td;
		}

		const input = el( 'input', {
			class: 'atcfk__input',
			attrs: {
				type: [ 'number', 'range', 'computed' ].includes( column.type ) ? 'number' : 'text',
				value: String( value ?? '' ),
				'aria-label': `${ column.label }`,
			},
		} ) as HTMLInputElement;

		input.addEventListener( 'change', () => this.stage( cellId, { id, field: column.key, value: input.value } ) );

		// Pasting a column from a spreadsheet. Multi-line clipboard text fills
		// this cell and the ones below it, which is the gesture people try
		// immediately and which nothing in wp-admin has ever supported.
		input.addEventListener( 'paste', ( event ) => {
			const text = ( event as ClipboardEvent ).clipboardData?.getData( 'text/plain' ) ?? '';
			const lines = text.split( /\r?\n/ ).filter( ( one, index ) => index === 0 || one !== '' );

			if ( lines.length < 2 ) {
				return;
			}

			event.preventDefault();
			this.fillDown( column.key, id, lines );
		} );

		td.append( input );

		return td;
	}

	/**
	 * Fills a pasted column down from a starting row.
	 *
	 * @param field  Which column.
	 * @param fromId Which row it starts on.
	 * @param lines  The pasted values.
	 */
	private fillDown( field: string, fromId: number, lines: string[] ): void {
		if ( ! this.data ) {
			return;
		}

		const start = this.data.rows.findIndex( ( row ) => row.id === fromId );

		lines.forEach( ( line, offset ) => {
			const row = this.data?.rows[ start + offset ];

			if ( ! row?.canEdit ) {
				return;
			}

			row.values[ field ] = line;
			this.stage( `${ row.id }:${ field }`, { id: row.id, field, value: line } );
		} );

		this.draw();
	}

	/** Records an edit without writing it. */
	private stage( cellId: string, edit: Pending ): void {
		this.pending.set( cellId, edit );
		this.updateFooter();
	}

	private footerNode: HTMLElement | null = null;

	/** The bar: paging, pending count, save. */
	private footer(): HTMLElement {
		const node = el( 'div', { class: 'atcfk__footer' } );

		this.footerNode = node;
		this.updateFooter();

		return node;
	}

	/** Redraws the bar. */
	private updateFooter(): void {
		const node = this.footerNode;

		if ( ! node ) {
			return;
		}

		clear( node );

		node.append(
			el( 'span', {
				class: 'atcfk__pending',
				attrs: { role: 'status' },
				text: this.pending.size
					? `${ this.pending.size } change${ this.pending.size === 1 ? '' : 's' } waiting`
					: `${ this.data?.total ?? 0 } post${ this.data?.total === 1 ? '' : 's' }`,
			} ),
			button( 'Save changes', {
				class: 'atcfk__save',
				attrs: { disabled: this.pending.size ? null : true },
				on: { click: () => void this.save() },
			} )
		);

		if ( this.pages > 1 ) {
			node.append(
				button( 'Previous', {
					attrs: { disabled: this.page <= 1 ? true : null },
					on: {
						click: () => {
							this.page -= 1;
							void this.load();
						},
					},
				} ),
				el( 'span', { class: 'atcfk__page', text: `${ this.page } / ${ this.pages }` } ),
				button( 'Next', {
					attrs: { disabled: this.page >= this.pages ? true : null },
					on: {
						click: () => {
							this.page += 1;
							void this.load();
						},
					},
				} )
			);
		}
	}

	/** Writes every pending edit. */
	private async save(): Promise< void > {
		if ( ! this.pending.size ) {
			return;
		}

		try {
			const result = await api.writeValues( Array.from( this.pending.values() ) );

			this.pending.clear();

			notify(
				`${ result.written } change${ result.written === 1 ? '' : 's' } saved.`,
				result.refused.length ? `${ result.refused.length } post(s) you cannot edit were skipped.` : '',
				'success'
			);

			await this.load();
		} catch ( error ) {
			notify( 'Those changes would not save.', error instanceof Error ? error.message : '', 'error' );
		}
	}
}

/**
 * A cell's value, as one line.
 *
 * A list becomes a count and an object becomes a dash, because a cell showing
 * `7,8,11` for a relationship is showing internal ids to somebody who asked what
 * is in the field — and `[object Object]`, which is what `String()` gives a
 * group, is worse than either.
 *
 * @param value The stored value.
 * @return Something readable.
 */
function summarise( value: unknown ): string {
	if ( Array.isArray( value ) ) {
		return value.length ? `${ value.length } item${ value.length === 1 ? '' : 's' }` : '—';
	}

	if ( value && typeof value === 'object' ) {
		return '—';
	}

	return value === '' || value === null || value === undefined ? '—' : String( value );
}

/* -------------------------------------------------------------------------- */
/* Mounting                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Opens the Field Groups surface, however this page can reach it.
 *
 * Inside the shell that is the builder window; on the plain admin page it is
 * the builder page itself.
 */
function openBuilder(): void {
	if ( shellIsActive() && shell()?.openWindow?.( 'allterrain-fields' ) ) {
		return;
	}

	window.location.href = api.config().adminUrl + 'admin.php?page=allterrain-fields';
}

function mount( body: HTMLElement ): void {
	const root = body.querySelector< HTMLElement >( '[data-atcfk-body]' ) ?? body;

	if ( root.dataset.atcfkMounted === '1' ) {
		return;
	}

	root.dataset.atcfkMounted = '1';

	void new Bulk( root ).start();
	mountWindowTabs( 'allterrain-fields-bulk', body );
}

const globals = window as unknown as {
	openStationNativeWindows?: Record< string, ( body: HTMLElement ) => void >;
};

globals.openStationNativeWindows = globals.openStationNativeWindows ?? {};
globals.openStationNativeWindows[ 'allterrain-fields-bulk' ] = ( body: HTMLElement ) => mount( body );

if ( typeof document !== 'undefined' ) {
	whenShellReady( () => {
		document.querySelectorAll< HTMLElement >( '[data-atcfk-root]' ).forEach( ( root ) => {
			if ( ! shellIsActive() || ! root.closest( '.os-window' ) ) {
				mount( root );
			}
		} );
	} );
}

/** Kept reachable so the id helper is not tree-shaken away. */
export { uid };
