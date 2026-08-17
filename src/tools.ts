/**
 * Import, export, and the JSON sync.
 *
 * Three jobs that are the same job: moving a content model between places.
 *
 * **Export** writes a JSON file. **Import** reads one, matching on the group's
 * key so re-importing an updated file *updates* the groups rather than
 * duplicating them — which is what makes a file usable as a deployment
 * mechanism rather than as a one-way door.
 *
 * **The sync** is the same thing against a directory in the theme. Every save
 * writes a file there automatically, because a file that lags the database is
 * worse than no file. Reading is not automatic, and that asymmetry is
 * deliberate: a file that silently overwrote the database on every page load
 * would make the builder appear to lose changes on any site where the file is
 * stale — which, on a shared host with a checked-in JSON directory, is
 * most of them. So this window shows the difference and asks.
 */

import { button, clear, componentsReady, el } from './ui';
import { confirm, notify, shellIsActive, whenShellReady } from './shell';
import * as api from './api';
import type { GroupSummary, JsonDiff } from './types';

/** One mounted tools window. */
class Tools {
	private root: HTMLElement;
	private groups: GroupSummary[] = [];
	private diff: JsonDiff | null = null;
	private chosen = new Set< number >();
	private acf: api.AcfSources | null = null;
	private acfChosen = new Set< string >();
	private metabox: api.MetaboxSources | null = null;
	private metaboxChosen = new Set< string >();

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
			this.groups = await api.listGroups();
		} catch ( error ) {
			clear( this.root );
			this.root.append( el( 'p', { class: 'atcft__error', text: error instanceof Error ? error.message : String( error ) } ) );

			return;
		}

		// The sync is optional — a site with no writable theme directory has no
		// diff to show — so a failure here is not a failure of the window.
		try {
			this.diff = await api.jsonDiff();
		} catch {
			this.diff = null;
		}

		// So is the ACF probe: a site with nothing to migrate just gets the
		// paste box.
		try {
			this.acf = await api.acfSources();
		} catch {
			this.acf = null;
		}

		// So is the Meta Box probe: a site with nothing to migrate just gets
		// the paste box.
		try {
			this.metabox = await api.metaboxSources();
		} catch {
			this.metabox = null;
		}

		this.draw();
	}

	/** Paints. */
	private draw(): void {
		clear( this.root );

		this.root.append( this.exportPane(), this.importPane(), this.acfPane(), this.metaboxPane(), this.syncPane() );
	}

	/** Export. */
	private exportPane(): HTMLElement {
		const list = el( 'div', { class: 'atcft__list', attrs: { role: 'group', 'aria-label': 'Field groups to export' } } );

		this.groups.forEach( ( group ) => {
			const box = el( 'input', { attrs: { type: 'checkbox', value: String( group.id ) } } ) as HTMLInputElement;

			box.checked = this.chosen.has( group.id );
			box.addEventListener( 'change', () => {
				if ( box.checked ) {
					this.chosen.add( group.id );
				} else {
					this.chosen.delete( group.id );
				}
			} );

			list.append(
				el( 'label', {
					class: 'atcft__item',
					children: [
						box,
						el( 'span', { class: 'atcft__item-title', text: group.title } ),
						el( 'span', { class: 'atcft__item-meta', text: `${ group.fields } fields` } ),
					],
				} )
			);
		} );

		return el( 'section', {
			class: 'atcft__pane',
			children: [
				el( 'h2', { text: 'Export' } ),
				el( 'p', {
					class: 'atcft__note',
					text: 'A JSON file holding the whole definition. Post IDs are stripped, because they mean nothing on the site you import into.',
				} ),
				list,
				el( 'div', {
					class: 'atcft__actions',
					children: [
						button( 'Download', { on: { click: () => void this.download() } } ),
						button( 'Copy to clipboard', { on: { click: () => void this.copy() } } ),
					],
				} ),
			],
		} );
	}

	/** Downloads the chosen groups. */
	private async download(): Promise< void > {
		try {
			const groups = await api.exportGroups( Array.from( this.chosen ) );
			const blob = new Blob( [ JSON.stringify( groups, null, 2 ) ], { type: 'application/json' } );
			const url = URL.createObjectURL( blob );
			const link = el( 'a', { attrs: { href: url, download: 'allterrain-fields.json' } } );

			document.body.append( link );
			link.click();
			link.remove();

			// Revoked on the next tick rather than immediately: some browsers
			// have not started the download by the time `click()` returns, and
			// revoking first cancels it silently.
			window.setTimeout( () => URL.revokeObjectURL( url ), 1000 );
		} catch ( error ) {
			notify( 'That would not export.', error instanceof Error ? error.message : '', 'error' );
		}
	}

	/** Copies the chosen groups. */
	private async copy(): Promise< void > {
		try {
			const groups = await api.exportGroups( Array.from( this.chosen ) );

			await navigator.clipboard.writeText( JSON.stringify( groups, null, 2 ) );

			notify( 'Copied.', '', 'success' );
		} catch {
			// Clipboard access is refused outside a user gesture in some
			// browsers and blocked entirely by some policies. Saying so beats a
			// button that appears to do nothing.
			notify( 'The clipboard is not available here.', 'Use Download instead.', 'error' );
		}
	}

	/** Import. */
	private importPane(): HTMLElement {
		const area = el( 'textarea', {
			class: 'atcft__paste',
			attrs: { rows: 6, spellcheck: 'false', placeholder: 'Paste an export here, or choose a file.' },
		} ) as HTMLTextAreaElement;

		const file = el( 'input', { attrs: { type: 'file', accept: 'application/json,.json' } } ) as HTMLInputElement;

		file.addEventListener( 'change', async () => {
			const chosen = file.files?.[ 0 ];

			if ( chosen ) {
				area.value = await chosen.text();
			}
		} );

		return el( 'section', {
			class: 'atcft__pane',
			children: [
				el( 'h2', { text: 'Import' } ),
				el( 'p', {
					class: 'atcft__note',
					text: 'Groups are matched on their key, so importing an updated file updates them rather than making copies.',
				} ),
				file,
				area,
				button( 'Import', { on: { click: () => void this.doImport( area.value ) } } ),
			],
		} );
	}

	/** Imports pasted or uploaded JSON. */
	private async doImport( raw: string ): Promise< void > {
		if ( ! raw.trim() ) {
			return;
		}

		let parsed: unknown;

		try {
			parsed = JSON.parse( raw );
		} catch {
			notify( 'That is not valid JSON.', '', 'error' );

			return;
		}

		const groups = Array.isArray( parsed ) ? parsed : [ parsed ];

		const yes = await confirm(
			`Import ${ groups.length } field group${ groups.length === 1 ? '' : 's' }? Any with a matching key will be replaced.`,
			{ title: 'Import field groups?', confirmLabel: 'Import' }
		);

		if ( ! yes ) {
			return;
		}

		try {
			const result = await api.importGroups( groups );
			const updated = result.imported.filter( ( one ) => one.updated ).length;

			notify(
				`${ result.imported.length } imported.`,
				updated ? `${ updated } replaced an existing group.` : '',
				'success'
			);

			this.groups = await api.listGroups();
			this.diff = await api.jsonDiff().catch( () => null );
			this.draw();
		} catch ( error ) {
			notify( 'That would not import.', error instanceof Error ? error.message : '', 'error' );
		}
	}

	/** Import from ACF. */
	private acfPane(): HTMLElement {
		const children: Array< Node | null > = [
			el( 'h2', { text: 'Import from ACF' } ),
			el( 'p', {
				class: 'atcft__note',
				text:
					'Values are already stored the way ACF stores them, so only the field groups move — ' +
					'nothing is rewritten in the database. Importing again updates rather than duplicates.',
			} ),
		];

		// Whatever the site itself holds — the running ACF plugin, or the rows
		// it left behind in the database when it was deactivated.
		if ( this.acf && this.acf.groups.length ) {
			const list = el( 'div', { class: 'atcft__list', attrs: { role: 'group', 'aria-label': 'ACF field groups found on this site' } } );

			this.acf.groups.forEach( ( group ) => {
				const box = el( 'input', { attrs: { type: 'checkbox', value: group.key } } ) as HTMLInputElement;

				box.checked = this.acfChosen.has( group.key );
				box.addEventListener( 'change', () => {
					if ( box.checked ) {
						this.acfChosen.add( group.key );
					} else {
						this.acfChosen.delete( group.key );
					}
				} );

				list.append(
					el( 'label', {
						class: 'atcft__item',
						children: [
							box,
							el( 'span', { class: 'atcft__item-title', text: group.title } ),
							el( 'span', {
								class: 'atcft__item-meta',
								text:
									`${ group.fields } fields · ` +
									( group.source === 'plugin' ? 'from the running ACF' : 'left in the database' ) +
									( group.exists ? ' · already here, will be updated' : '' ),
							} ),
						],
					} )
				);
			} );

			children.push(
				el( 'p', {
					class: 'atcft__note',
					text: this.acf.active
						? 'ACF is active on this site. These are the groups it reports, PHP- and JSON-registered ones included.'
						: 'ACF is not active, but its field groups are still in the database.',
				} ),
				list,
				el( 'div', {
					class: 'atcft__actions',
					children: [
						button( this.acfChosen.size ? `Import ${ this.acfChosen.size } selected` : 'Import all of them', {
							on: { click: () => void this.doAcfImport( { keys: Array.from( this.acfChosen ) } ) },
						} ),
					],
				} )
			);
		}

		// And the file form, for a JSON export carried over from another site.
		const area = el( 'textarea', {
			class: 'atcft__paste',
			attrs: { rows: 6, spellcheck: 'false', placeholder: 'Paste an ACF export (acf-export-*.json) here, or choose the file.' },
		} ) as HTMLTextAreaElement;

		const file = el( 'input', { attrs: { type: 'file', accept: 'application/json,.json' } } ) as HTMLInputElement;

		file.addEventListener( 'change', async () => {
			const chosen = file.files?.[ 0 ];

			if ( chosen ) {
				area.value = await chosen.text();
			}
		} );

		children.push(
			file,
			area,
			button( 'Import the export', {
				on: {
					click: () => {
						if ( ! area.value.trim() ) {
							return;
						}

						let parsed: unknown;

						try {
							parsed = JSON.parse( area.value );
						} catch {
							notify( 'That is not valid JSON.', '', 'error' );

							return;
						}

						void this.doAcfImport( { groups: Array.isArray( parsed ) ? parsed : [ parsed ] } );
					},
				},
			} )
		);

		return el( 'section', { class: 'atcft__pane', children } );
	}

	/** Runs an ACF import and reports what crossed and what could not. */
	private async doAcfImport( body: { groups?: unknown[]; keys?: string[] } ): Promise< void > {
		const count = body.groups?.length ?? ( body.keys?.length || this.acf?.groups.length || 0 );

		const yes = await confirm(
			`Import ${ count } field group${ count === 1 ? '' : 's' } from ACF? Any with a matching key will be updated.`,
			{ title: 'Import from ACF?', confirmLabel: 'Import' }
		);

		if ( ! yes ) {
			return;
		}

		try {
			const result = await api.importAcf( body );
			const warnings = result.imported.flatMap( ( group ) =>
				group.warnings.map( ( warning ) => `${ group.title }: ${ warning }` )
			);

			notify(
				`${ result.imported.length } imported from ACF.`,
				warnings.length
					? `${ warnings.length } thing${ warnings.length === 1 ? '' : 's' } would not convert — details below.`
					: 'Everything converted cleanly.',
				warnings.length ? 'error' : 'success'
			);

			// The warnings belong on screen, not in a toast that fades: each one
			// names a rule or a field somebody will otherwise hunt for.
			warnings.forEach( ( warning ) => notify( 'Did not convert', warning, 'error' ) );

			this.acfChosen.clear();
			this.groups = await api.listGroups();
			this.acf = await api.acfSources().catch( () => null );
			this.diff = await api.jsonDiff().catch( () => null );
			this.draw();
		} catch ( error ) {
			notify( 'That would not import.', error instanceof Error ? error.message : '', 'error' );
		}
	}

	/** Import from Meta Box. */
	private metaboxPane(): HTMLElement {
		const children: Array< Node | null > = [
			el( 'h2', { text: 'Import from Meta Box' } ),
			el( 'p', {
				class: 'atcft__note',
				text:
					'Simple fields store one plain meta row under both plugins, so their values are already ' +
					'in place. Groups and cloneable fields are the exception — Meta Box serialises those — ' +
					'and every one is called out during the import. Importing again updates rather than duplicates.',
			} ),
		];

		// Whatever the site itself holds — the running Meta Box, or the
		// Builder posts it left behind.
		if ( this.metabox && this.metabox.boxes.length ) {
			const list = el( 'div', { class: 'atcft__list', attrs: { role: 'group', 'aria-label': 'Meta Box field groups found on this site' } } );

			this.metabox.boxes.forEach( ( box ) => {
				const check = el( 'input', { attrs: { type: 'checkbox', value: box.id } } ) as HTMLInputElement;

				check.checked = this.metaboxChosen.has( box.id );
				check.addEventListener( 'change', () => {
					if ( check.checked ) {
						this.metaboxChosen.add( box.id );
					} else {
						this.metaboxChosen.delete( box.id );
					}
				} );

				list.append(
					el( 'label', {
						class: 'atcft__item',
						children: [
							check,
							el( 'span', { class: 'atcft__item-title', text: box.title } ),
							el( 'span', {
								class: 'atcft__item-meta',
								text:
									`${ box.fields } fields · ` +
									( box.source === 'plugin' ? 'from the running Meta Box' : 'left in the database' ) +
									( box.exists ? ' · already here, will be updated' : '' ),
							} ),
						],
					} )
				);
			} );

			children.push(
				el( 'p', {
					class: 'atcft__note',
					text: this.metabox.active
						? 'Meta Box is active on this site. These are the boxes it registers, code and Builder alike.'
						: 'Meta Box is not active, but its Builder definitions are still in the database.',
				} ),
				list,
				el( 'div', {
					class: 'atcft__actions',
					children: [
						button( this.metaboxChosen.size ? `Import ${ this.metaboxChosen.size } selected` : 'Import all of them', {
							on: { click: () => void this.doMetaboxImport( { ids: Array.from( this.metaboxChosen ) } ) },
						} ),
					],
				} )
			);
		}

		// And the file form, for a Builder export carried over from another site.
		const area = el( 'textarea', {
			class: 'atcft__paste',
			attrs: { rows: 6, spellcheck: 'false', placeholder: 'Paste a Meta Box Builder export here, or choose the file.' },
		} ) as HTMLTextAreaElement;

		const file = el( 'input', { attrs: { type: 'file', accept: 'application/json,.json' } } ) as HTMLInputElement;

		file.addEventListener( 'change', async () => {
			const chosen = file.files?.[ 0 ];

			if ( chosen ) {
				area.value = await chosen.text();
			}
		} );

		children.push(
			file,
			area,
			button( 'Import the export', {
				on: {
					click: () => {
						if ( ! area.value.trim() ) {
							return;
						}

						let parsed: unknown;

						try {
							parsed = JSON.parse( area.value );
						} catch {
							notify( 'That is not valid JSON.', '', 'error' );

							return;
						}

						void this.doMetaboxImport( { boxes: Array.isArray( parsed ) ? parsed : [ parsed ] } );
					},
				},
			} )
		);

		return el( 'section', { class: 'atcft__pane', children } );
	}

	/** Runs a Meta Box import and reports what crossed and what could not. */
	private async doMetaboxImport( body: { boxes?: unknown[]; ids?: string[] } ): Promise< void > {
		const count = body.boxes?.length ?? ( body.ids?.length || this.metabox?.boxes.length || 0 );

		const yes = await confirm(
			`Import ${ count } field group${ count === 1 ? '' : 's' } from Meta Box? Any imported before will be updated.`,
			{ title: 'Import from Meta Box?', confirmLabel: 'Import' }
		);

		if ( ! yes ) {
			return;
		}

		try {
			const result = await api.importMetabox( body );
			const warnings = result.imported.flatMap( ( group ) =>
				group.warnings.map( ( warning ) => `${ group.title }: ${ warning }` )
			);

			notify(
				`${ result.imported.length } imported from Meta Box.`,
				warnings.length
					? `${ warnings.length } thing${ warnings.length === 1 ? '' : 's' } to know about — details below.`
					: 'Everything converted cleanly.',
				warnings.length ? 'error' : 'success'
			);

			// The warnings belong on screen, not in a toast that fades: each
			// one names a field somebody will otherwise hunt for.
			warnings.forEach( ( warning ) => notify( 'Worth knowing', warning, 'error' ) );

			this.metaboxChosen.clear();
			this.groups = await api.listGroups();
			this.metabox = await api.metaboxSources().catch( () => null );
			this.diff = await api.jsonDiff().catch( () => null );
			this.draw();
		} catch ( error ) {
			notify( 'That would not import.', error instanceof Error ? error.message : '', 'error' );
		}
	}

	/** The JSON sync. */
	private syncPane(): HTMLElement {
		if ( ! this.diff ) {
			return el( 'section', {
				class: 'atcft__pane',
				children: [
					el( 'h2', { text: 'Sync with the theme' } ),
					el( 'p', { class: 'atcft__note', text: 'The sync is not available on this site.' } ),
				],
			} );
		}

		const diff = this.diff;
		const rows: Array< Node | null > = [];

		const section = ( title: string, items: Array< { key: string; title: string } >, empty: string ) => {
			if ( ! items.length ) {
				return el( 'p', { class: 'atcft__note', text: empty } );
			}

			return el( 'div', {
				class: 'atcft__diff',
				children: [
					el( 'h3', { text: title } ),
					el( 'ul', {
						children: items.map( ( item ) => el( 'li', { text: item.title } ) ),
					} ),
				],
			} );
		};

		rows.push(
			el( 'p', {
				class: 'atcft__path',
				text: diff.dir + ( diff.writable ? '' : ' — not writable, so nothing is being written' ),
			} )
		);

		rows.push( section( 'On disk but not here', diff.new, 'Nothing on disk is missing from this site.' ) );
		rows.push( section( 'Different on disk', diff.modified, 'Nothing on disk differs from this site.' ) );
		rows.push( section( 'Here but not on disk', diff.unsynced, 'Everything here has a file.' ) );

		const pending = diff.new.length + diff.modified.length;

		rows.push(
			button( pending ? `Import ${ pending } from disk` : 'Nothing to import', {
				class: 'atcft__sync',
				attrs: { disabled: pending ? null : true },
				on: { click: () => void this.doSync() },
			} )
		);

		return el( 'section', {
			class: 'atcft__pane',
			children: [
				el( 'h2', { text: 'Sync with the theme' } ),
				el( 'p', {
					class: 'atcft__note',
					text: 'Every save writes a JSON file into the theme. Reading them back is deliberate rather than automatic, so a stale file cannot quietly undo an edit.',
				} ),
				...rows,
			],
		} );
	}

	/** Imports the differing files. */
	private async doSync(): Promise< void > {
		try {
			const result = await api.jsonSync();

			notify( `${ result.imported.length } group(s) imported from disk.`, '', 'success' );

			this.groups = await api.listGroups();
			this.diff = await api.jsonDiff();
			this.draw();
		} catch ( error ) {
			notify( 'The sync would not run.', error instanceof Error ? error.message : '', 'error' );
		}
	}
}

/* -------------------------------------------------------------------------- */
/* Mounting                                                                    */
/* -------------------------------------------------------------------------- */

function mount( body: HTMLElement ): void {
	const root = body.querySelector< HTMLElement >( '[data-atcft-body]' ) ?? body;

	if ( root.dataset.atcftMounted === '1' ) {
		return;
	}

	root.dataset.atcftMounted = '1';

	void new Tools( root ).start();
}

const globals = window as unknown as {
	openStationNativeWindows?: Record< string, ( body: HTMLElement ) => void >;
};

globals.openStationNativeWindows = globals.openStationNativeWindows ?? {};
globals.openStationNativeWindows[ 'allterrain-fields-tools' ] = ( body: HTMLElement ) => mount( body );

if ( typeof document !== 'undefined' ) {
	whenShellReady( () => {
		document.querySelectorAll< HTMLElement >( '[data-atcft-root]' ).forEach( ( root ) => {
			if ( ! shellIsActive() || ! root.closest( '.os-window' ) ) {
				mount( root );
			}
		} );
	} );
}
