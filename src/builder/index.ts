/**
 * The field group builder.
 *
 * A native OpenStation window, and the same code on a plain admin page. Native
 * rather than an iframe, and that is the decision the whole feel of this thing
 * rests on: rendering into the shell's own DOM is what gives the builder
 * `wp.os.dragManager`, the one pointer pipeline shared with the wallpaper's file
 * tiles and every other window. So a field can be dragged from the palette to
 * the canvas, and **from one builder window into a second one** — two field
 * groups open side by side, drag a field across, and it is copied.
 *
 * None of that is reachable from inside an iframe, which is why every other
 * plugin's builder is a page you navigate to.
 *
 * The window also carries the eye in its title bar. Press it and the group's
 * fields open beside the builder, rendered by the *real* server-side renderer
 * against a *real* post — so what you see is what an author will get. Change a
 * field, watch it change.
 *
 * Everything degrades. With no shell this is the same builder on
 * **Fields → Field Groups**, with the drag manager's fallback underneath and the
 * preview in a panel instead of a paired window.
 */

import '../controls/media';
import '../controls/relational';
import '../controls/repeater';
import '../controls/misc';

import { button, clear, componentsReady, el, icon, select, textField, toggle, uid } from '../ui';
import { confirm, notify, shell, shellIsActive, whenShellReady, windowIdOf } from '../shell';
import * as api from '../api';
import { registerCanvasTarget, renderCanvas } from './canvas';
import { renderInspector, syncInspector } from './inspector';
import type { InspectorOptions } from './inspector';
import { renderLocation } from './location';
import { renderLogicMap } from './logic-map';
import { mountFormulaWindow } from './formula-window';
import { renderPalette } from './palette';
import { groupIdentity, previewIdentity, setIdentity } from './relations';
import { open as openPreview, registerPreviewButton, titleBarWillPreview } from './preview-button';
import { boot as bootRuntime } from '../controls/index';
import type { CanvasOptions } from './canvas';
import type { BuilderConfig, Field, FieldGroup, FieldType, GroupSummary } from '../types';

/** Which pane of the builder is showing. */
type Tab = 'fields' | 'location' | 'settings';

/**
 * One mounted builder.
 *
 * A class rather than a module of functions with shared state, because two
 * builder windows can be open at once and each needs its own group, selection
 * and dirty flag. Module-level state would make the second window edit the
 * first's group — which is exactly the bug that makes cross-window drag look
 * like it worked and then lose the field.
 */
class Builder {
	private root: HTMLElement;
	private config: BuilderConfig | null = null;
	private summaries: GroupSummary[] = [];
	private group: FieldGroup | null = null;
	private selected = '';
	private dirty = false;
	private tab: Tab = 'fields';

	/**
	 * Whether the starter picker is showing over the canvas.
	 *
	 * Always true when there is no group, because a blank canvas beside a palette
	 * of forty types is where the first ten minutes with a fields plugin go. It
	 * can also be turned on deliberately from the rail, which is the only way back
	 * to it once a site has groups of its own.
	 */
	private starters = false;
	/**
	 * Which pane is showing over the canvas, in a window too narrow for columns.
	 *
	 * The palette used to be `display: none` below 1100px and the inspector a
	 * permanent overlay across the canvas — so a narrow window had no way to add
	 * a field at all, and the pane you could not dismiss was covering the one you
	 * needed. Both are drawers now, and neither is open unless it was asked for.
	 */
	private drawer: 'none' | 'palette' | 'inspector' = 'none';

	/** Torn down when the builder goes: the title-bar button, and nothing else. */
	private teardowns: Array< () => void > = [];

	/**
	 * Torn down on every canvas redraw: the drop target and the logic map.
	 *
	 * Separate from the list above, because they were the same list and redrawing
	 * the canvas therefore unregistered the eye button in the title bar — which
	 * looked like the shell dropping it, and was this.
	 */
	private canvasTeardowns: Array< () => void > = [];

	public constructor( root: HTMLElement ) {
		this.root = root;
	}

	/** Loads everything and paints. */
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
			const [ config, summaries ] = await Promise.all( [ api.getConfig(), api.listGroups() ] );

			this.config = config;
			this.summaries = summaries;
		} catch ( error ) {
			this.fail( error );

			return;
		}

		this.drawChrome();
		this.drawGroups();
		this.drawPalette();

		// A deep link — from the Content Model, a Related-menu row, a bookmark —
		// names its group in the window's params. Reading it here is what makes
		// "Open in the builder" land on the group you clicked rather than on
		// whichever happens to be first.
		const wanted = Number( windowParam( this.root, 'group' ) ) || 0;
		const first = this.summaries.find( ( one ) => wanted && one.id === wanted )
			?? this.summaries.find( ( one ) => ! one.local );

		if ( first ) {
			await this.openGroup( first.id );
		} else {
			this.drawCanvas();
			this.drawInspector();
		}

		this.teardowns.push(
			registerPreviewButton( {
				current: () =>
					this.group ? { id: this.group.id ?? 0, key: this.group.key, title: this.group.title } : null,
				isDirty: () => this.dirty,
				save: () => this.save(),
				render: () => void this.renderPreview(),
			} )
		);
	}

	/** Says what went wrong, in the window rather than in the console. */
	private fail( error: unknown ): void {
		clear( this.root );

		this.root.append(
			el( 'div', {
				class: 'atcfb__error',
				children: [
					el( 'h2', { text: 'The builder could not start.' } ),
					el( 'p', { text: error instanceof Error ? error.message : String( error ) } ),
				],
			} )
		);
	}

	/** The persistent frame: bar, panes, tabs. */
	private drawChrome(): void {
		const bar = this.root.querySelector< HTMLElement >( '[data-atcfb-bar]' );

		if ( ! bar ) {
			return;
		}

		clear( bar );

		const title = textField( '', { class: 'atcfb__title', attrs: { 'aria-label': 'Field group name' } }, ( value ) => {
			if ( this.group ) {
				this.group.title = value;
				this.markDirty();
			}
		} );

		const tabs = el( 'div', { class: 'atcfb__tabs', attrs: { role: 'tablist' } } );

		( [ 'fields', 'location', 'settings' ] as Tab[] ).forEach( ( tab ) => {
			const label = { fields: 'Fields', location: 'Where it appears', settings: 'Settings' }[ tab ];

			tabs.append(
				el( 'button', {
					class: 'atcfb__tab',
					text: label,
					attrs: { type: 'button', role: 'tab', 'aria-selected': this.tab === tab ? 'true' : 'false' },
					dataset: { tab },
					on: {
						click: () => {
							this.tab = tab;
							this.drawChrome();
							this.drawMain();
						},
					},
				} )
			);
		} );

		const status = el( 'span', { class: 'atcfb__status', attrs: { role: 'status' } } );

		bar.append(
			title,
			tabs,
			el( 'div', {
				class: 'atcfb__bar-actions',
				children: [
					status,
					// Only visible in a narrow window, where the palette and the
					// inspector are off-canvas. They are always in the DOM so the
					// container query can decide, rather than a resize listener
					// that has to be right about the timing as well as the answer.
					button( 'Add a field', {
						class: 'atcfb__drawer-toggle atcfb__drawer-toggle--palette',
						on: { click: () => this.openDrawer( 'palette' ) },
					} ),
					button( 'Field settings', {
						class: 'atcfb__drawer-toggle atcfb__drawer-toggle--inspector',
						on: { click: () => this.openDrawer( 'inspector' ) },
					} ),
					// Not drawn when the shell will put an eye in the title bar —
					// see `titleBarWillPreview()`. This is the fallback for an
					// admin page, not a second copy of the same action.
					titleBarWillPreview()
						? null
						: button( 'Preview', {
						class: 'atcfb__preview',
						on: {
							click: () =>
								void openPreview( {
									current: () =>
										this.group ? { id: this.group.id ?? 0, key: this.group.key, title: this.group.title } : null,
									isDirty: () => this.dirty,
									save: () => this.save(),
									render: () => void this.renderPreview(),
								} ),
						},
					  } ),
					button( 'Save', { class: 'atcfb__save', on: { click: () => void this.save() } } ),
				],
			} )
		);

		if ( this.group ) {
			( title as HTMLInputElement ).value = this.group.title;
		}

		this.statusNode = status;
		this.updateStatus();
	}

	/**
	 * Shows one of the off-canvas panes, or closes whichever is open.
	 *
	 * A class on the root rather than inline styles, so the container query stays
	 * the only thing that decides *whether* the panes are drawers — this decides
	 * only which one is out.
	 *
	 * @param which The pane, or `none` to close.
	 */
	private openDrawer( which: 'none' | 'palette' | 'inspector' ): void {
		this.drawer = this.drawer === which ? 'none' : which;
		this.root.dataset.atcfbDrawer = this.drawer;

		const body = this.root.querySelector< HTMLElement >( '.atcfb__body' ) ?? this.root;

		// Made on first use rather than in the PHP template: it belongs to a
		// behaviour that only exists in the browser, and a scrim in the markup
		// would be one more thing for a no-JavaScript render to show.
		if ( ! this.scrim ) {
			this.scrim = el( 'button', {
				class: 'atcfb__scrim',
				attrs: { type: 'button', 'aria-label': 'Close this panel' },
				on: { click: () => this.openDrawer( 'none' ) },
			} );

			body.append( this.scrim );
		}

		// Escape closes it, which is what everybody tries first.
		if ( 'none' !== this.drawer && ! this.escapes ) {
			this.escapes = ( event: KeyboardEvent ) => {
				if ( 'Escape' === event.key && 'none' !== this.drawer ) {
					this.openDrawer( 'none' );
				}
			};

			this.root.addEventListener( 'keydown', this.escapes );
		}
	}

	/** The press-anywhere-else target, made on first use. */
	private scrim: HTMLElement | null = null;

	/** The Escape handler, bound once. */
	private escapes: ( ( event: KeyboardEvent ) => void ) | null = null;

	private statusNode: HTMLElement | null = null;

	/** Reflects the dirty flag. */
	private updateStatus(): void {
		if ( this.statusNode ) {
			this.statusNode.textContent = this.dirty ? 'Unsaved changes' : '';
		}
	}

	/** The group list rail. */
	private drawGroups(): void {
		const host = this.root.querySelector< HTMLElement >( '[data-atcfb-groups]' );

		if ( ! host ) {
			return;
		}

		clear( host );

		host.append(
			el( 'div', {
				class: 'atcfb__groups-head',
				children: [
					el( 'h2', { text: 'Field groups' } ),
					el( 'div', {
						class: 'atcfb__groups-actions',
						children: [
							button( 'New', { on: { click: () => void this.newGroup() } } ),
							// Once a site has groups, the picker is behind an empty
							// state nobody will ever see again — and the templates
							// are the best documentation this plugin has. So there
							// is a way back to them.
							button( 'Templates', {
								on: {
									click: () => {
										this.starters = true;
										this.tab = 'fields';
										this.drawMain();
									},
								},
							} ),
						],
					} ),
				],
			} )
		);

		const list = el( 'div', { class: 'atcfb__groups-list', attrs: { role: 'list' } } );

		if ( ! this.summaries.length ) {
			list.append(
				el( 'p', { class: 'atcfb__groups-empty', text: 'None yet. Press New to make the first one.' } )
			);
		}

		this.summaries.forEach( ( summary ) => {
			const active = this.group?.key === summary.key;

			// A row rather than a button, because it holds a button of its own.
			// Deleting used to live only under Settings → Danger, three clicks
			// from the list of the things it deletes — which is why nobody found
			// it. The list is where you decide a group is finished with.
			const row = el( 'div', {
				class: `atcfb__group${ active ? ' is-active' : '' }${ summary.active ? '' : ' is-off' }`,
				attrs: { role: 'listitem' },
			} );

			const openIt = el( 'button', {
					class: 'atcfb__group-open',
					attrs: { type: 'button', 'aria-current': active ? 'true' : 'false' },
					children: [
						el( 'span', { class: 'atcfb__group-title', text: summary.title } ),
						el( 'span', {
							class: 'atcfb__group-meta',
							text: `${ summary.fields } field${ summary.fields === 1 ? '' : 's' } · ${ summary.location }`,
						} ),
						summary.local ? el( 'span', { class: 'atcfb__group-flag', text: 'in code' } ) : null,
						summary.block ? el( 'span', { class: 'atcfb__group-flag', text: 'block' } ) : null,
					],
					on: {
						click: () => {
							if ( summary.local ) {
								// A group registered in code is shown read-only.
								// Saving it would write a second copy into the
								// database and the file would win again on the
								// next request, which looks exactly like the
								// builder losing the edit.
								notify( 'That group is registered in code.', 'Edit it where it is declared.', 'info' );

								return;
							}

							void this.openGroup( summary.id );
						},
					},
				} );

			row.append( openIt );

			// A group declared in code cannot be deleted from here — the file
			// would put it back on the next request, which looks like the delete
			// having failed.
			if ( ! summary.local ) {
				row.append(
					el( 'button', {
						class: 'atcfb__group-delete',
						text: '×',
						attrs: { type: 'button', 'aria-label': `Delete ${ summary.title }`, title: `Delete ${ summary.title }` },
						on: {
							click: ( event ) => {
								event.stopPropagation();
								void this.deleteGroup( summary.id, summary.title );
							},
						},
					} )
				);
			}

			list.append( row );
		} );

		host.append( list );
	}

	/** The palette. */
	private drawPalette(): void {
		const host = this.root.querySelector< HTMLElement >( '[data-atcfb-palette]' );

		if ( ! host || ! this.config ) {
			return;
		}

		renderPalette( host, {
			types: this.config.fieldTypes,
			groups: this.config.fieldGroups,
			onAdd: ( type ) => {
				void this.addField( type.type, this.group?.fields.length ?? 0 );

				// The palette drawer has done its job; leaving it over the canvas
				// hides the card that just appeared.
				if ( 'palette' === this.drawer ) {
					this.openDrawer( 'none' );
				}
			},
		} );
	}

	/** Whichever pane the tab names. */
	private drawMain(): void {
		if ( this.tab === 'fields' ) {
			this.drawCanvas();
			this.drawInspector();

			return;
		}

		const canvas = this.root.querySelector< HTMLElement >( '[data-atcfb-canvas]' );
		const inspector = this.root.querySelector< HTMLElement >( '[data-atcfb-inspector]' );

		if ( ! canvas || ! this.group || ! this.config ) {
			return;
		}

		clear( canvas );

		if ( inspector ) {
			clear( inspector );
		}

		if ( this.tab === 'location' ) {
			const box = el( 'div', { class: 'atcfb__location' } );

			canvas.append(
				el( 'h2', { class: 'atcfb__pane-heading', text: 'Where this group appears' } ),
				box
			);

			renderLocation( box, {
				location: this.group.location,
				config: this.config,
				onChange: ( location ) => {
					if ( this.group ) {
						this.group.location = location;
						this.markDirty();
						this.drawMain();
					}
				},
			} );

			return;
		}

		this.drawSettings( canvas );
	}

	/** The group's own settings. */
	private drawSettings( host: HTMLElement ): void {
		if ( ! this.group ) {
			return;
		}

		const settings = this.group.settings;
		const box = el( 'div', { class: 'atcfb__settings' } );

		const patch = ( next: Partial< typeof settings > ) => {
			if ( this.group ) {
				this.group.settings = { ...this.group.settings, ...next };
				this.markDirty();
			}
		};

		box.append(
			toggle( settings.active, 'Switched on', ( on ) => patch( { active: on } ) ),
			el( 'label', {
				class: 'atcfb__row',
				children: [
					el( 'span', { class: 'atcfb__row-label', text: 'Description' } ),
					textField( settings.description, {}, ( value ) => patch( { description: value } ) ),
				],
			} ),
			el( 'label', {
				class: 'atcfb__row',
				children: [
					el( 'span', { class: 'atcfb__row-label', text: 'Order' } ),
					textField( String( settings.menu_order ), { attrs: { type: 'number' } }, ( value ) =>
						patch( { menu_order: Number( value ) || 0 } )
					),
				],
			} ),
			toggle( settings.show_in_rest, 'Expose in the REST API', ( on ) => patch( { show_in_rest: on } ) )
		);

		// The server normalises groups saved before this setting existed, but a
		// stale client cache can still hand us one without it.
		const frontend = settings.frontend ?? { enabled: false, placement: 'after' as const, heading: true };

		box.append(
			el( 'h3', { class: 'atcfb__settings-heading', text: 'On the front end' } ),
			el( 'p', {
				class: 'atcfb__settings-note',
				text: 'Turn this on and the group renders on the post’s own page — no template edit, no block. Themes can override it with allterrain-fields/group.php.',
			} ),
			toggle( frontend.enabled, 'Show on the front end', ( on ) => patch( { frontend: { ...frontend, enabled: on } } ) ),
			el( 'label', {
				class: 'atcfb__row',
				children: [
					el( 'span', { class: 'atcfb__row-label', text: 'Placement' } ),
					select(
						frontend.placement,
						[
							{ value: 'after', label: 'After the content' },
							{ value: 'before', label: 'Before the content' },
						],
						( value ) => patch( { frontend: { ...frontend, placement: value === 'before' ? 'before' : 'after' } } )
					),
				],
			} ),
			toggle( frontend.heading, 'Show the group title as a heading', ( on ) =>
				patch( { frontend: { ...frontend, heading: on } } )
			)
		);

		const block = settings.block;

		box.append(
			el( 'h3', { class: 'atcfb__settings-heading', text: 'As a block' } ),
			el( 'p', {
				class: 'atcfb__settings-note',
				text: 'Turn this on and the group becomes a Gutenberg block whose attributes are its fields.',
			} ),
			toggle( block.enabled, 'Register a block', ( on ) =>
				patch( {
					block: {
						...block,
						enabled: on,
						// Seeded from the title so the block has a usable name
						// the moment it is switched on. A block registered as
						// `acf/` is a block that never appears in the inserter.
						name: block.name || slug( this.group?.title ?? '' ),
						title: block.title || ( this.group?.title ?? '' ),
					},
				} )
			)
		);

		if ( block.enabled ) {
			box.append(
				el( 'label', {
					class: 'atcfb__row',
					children: [
						el( 'span', { class: 'atcfb__row-label', text: 'Block name' } ),
						textField( block.name, {}, ( value ) => patch( { block: { ...block, name: slug( value ) } } ) ),
					],
				} ),
				el( 'label', {
					class: 'atcfb__row',
					children: [
						el( 'span', { class: 'atcfb__row-label', text: 'Template file' } ),
						textField( block.template, { attrs: { placeholder: 'blocks/hero.php' } }, ( value ) =>
							patch( { block: { ...block, template: value } } )
						),
					],
				} ),
				el( 'p', {
					class: 'atcfb__row-hint',
					text: 'A file in your theme. Read its fields with atcf_block_field( \'name\' ).',
				} )
			);
		}

		box.append(
			el( 'h3', { class: 'atcfb__settings-heading', text: 'Danger' } ),
			button( 'Delete this group', {
				class: 'atcfb__delete',
				on: { click: () => void this.deleteGroup() },
			} )
		);

		host.append( el( 'h2', { class: 'atcfb__pane-heading', text: 'Settings' } ), box );
	}

	/**
	 * The starter picker.
	 *
	 * The first screen anybody sees, and the one that has to answer a question the
	 * palette cannot: *what is this for*. "Custom fields" is an abstraction with
	 * nothing in it until you have seen one, and a newcomer facing forty field
	 * types has no way to know that a repeater is how you do ingredients, or that
	 * a total can work itself out.
	 *
	 * So each card says what it *teaches*, not just what it contains. Opening
	 * Recipes and reading it is the fastest route to knowing what this plugin
	 * does — faster than any tour, because it is the real builder with a real
	 * group in it, and every field in it can be changed or thrown away.
	 *
	 * @param host The canvas pane.
	 */
	private drawStarters( host: HTMLElement ): void {
		const templates = this.config?.templates ?? [];

		const wrap = el( 'div', { class: 'atcfb__starters' } );

		wrap.append(
			el( 'div', {
				class: 'atcfb__starters-head',
				children: [
					icon( 'dashicons-index-card' ),
					el( 'h2', { text: this.group ? 'Start another group' : 'No field group yet' } ),
					el( 'p', {
						text: 'A field group is the box your fields live in, and where you say which post types get them. Open one of these to see how it is done, or start from nothing.',
					} ),
				],
			} )
		);

		if ( templates.length ) {
			const cards = el( 'div', { class: 'atcfb__starter-cards' } );

			templates.forEach( ( template ) => {
				cards.append(
					el( 'button', {
						class: 'atcfb__starter',
						attrs: { type: 'button' },
						children: [
							icon( template.icon ),
							el( 'span', { class: 'atcfb__starter-title', text: template.label } ),
							el( 'span', { class: 'atcfb__starter-text', text: template.description } ),
							el( 'span', {
								class: 'atcfb__starter-teaches',
								children: template.teaches.map( ( what ) =>
									el( 'span', { class: 'atcfb__starter-chip', text: what } )
								),
							} ),
							el( 'span', {
								class: 'atcfb__starter-meta',
								text: `${ template.fields } field${ template.fields === 1 ? '' : 's' } · yours to change`,
							} ),
						],
						on: { click: () => void this.useTemplate( template.slug, template.label ) },
					} )
				);
			} );

			wrap.append( cards );
		}

		wrap.append(
			el( 'div', {
				class: 'atcfb__starters-foot',
				children: [
					button( 'Start from nothing', {
						class: 'atcfb__empty-cta',
						on: { click: () => void this.newGroup() },
					} ),
					this.group
						? button( 'Back to “' + this.group.title + '”', {
								on: {
									click: () => {
										this.starters = false;
										this.drawMain();
									},
								},
						  } )
						: null,
				],
			} )
		);

		host.append( wrap );
	}

	/**
	 * Turns a template into a real group and opens it.
	 *
	 * The group is created server-side rather than assembled here — see
	 * `atcf_group_from_template()`. What comes back is an ordinary group with
	 * ordinary keys; nothing about it remembers it was a template, which is
	 * deliberate. A starter that stayed special would be a starter nobody dared
	 * edit.
	 *
	 * @param slug  Template slug.
	 * @param label What to call it in the notice.
	 */
	private async useTemplate( slug: string, label: string ): Promise< void > {
		if ( this.dirty && ! ( await confirm( 'There are unsaved changes. Start a new group anyway?' ) ) ) {
			return;
		}

		let created: FieldGroup;

		try {
			created = await api.createFromTemplate( slug );
		} catch ( error ) {
			notify( 'That template would not open.', error instanceof Error ? error.message : '', 'error' );

			return;
		}

		this.summaries = await api.listGroups();
		this.group = created;
		this.selected = created.fields[ 0 ]?.key ?? '';
		this.dirty = false;
		this.starters = false;
		this.tab = 'fields';

		this.drawChrome();
		this.drawGroups();
		this.drawMain();
		this.announce();

		notify( `“${ label }” is ready.`, 'It shows on Posts. Change anything you like — nothing here is fixed.', 'success' );
	}

	/** The canvas, and the logic map over it. */
	private drawCanvas(): void {
		const host = this.root.querySelector< HTMLElement >( '[data-atcfb-canvas]' );

		if ( ! host || ! this.config ) {
			return;
		}

		this.canvasTeardowns.splice( 0 ).forEach( ( fn ) => fn() );

		// No group open — which, on a site that has never had one, is where
		// everybody lands first. Saying so beats a blank pane beside a palette
		// that appears to work and silently swallows everything dropped on it.
		if ( ! this.group || this.starters ) {
			clear( host );
			this.drawStarters( host );

			return;
		}

		const types: Record< string, FieldType > = {};

		this.config.fieldTypes.forEach( ( type ) => {
			types[ type.type ] = type;
		} );

		renderCanvas( host, this.canvasOptions( types ) );

		// Registered once, against the pane rather than the card list. Both
		// halves of that matter — see `registerCanvasTarget()`.
		if ( ! this.canvasTarget ) {
			this.canvasTarget = registerCanvasTarget( host, () => this.canvasOptions() );
			this.teardowns.push( this.canvasTarget );
		}

		this.canvasTeardowns.push( renderLogicMap( host, this.group?.fields ?? [] ) );
	}

	/** The drop target's registration, kept so it is made exactly once. */
	private canvasTarget: ( () => void ) | null = null;

	/**
	 * What the canvas is showing and what to do about it.
	 *
	 * Read fresh on every drop rather than captured at registration, because the
	 * target outlives every redraw — that is the point of registering it once.
	 *
	 * @param types The field type index, rebuilt when not supplied.
	 * @return The options.
	 */
	private canvasOptions( types?: Record< string, FieldType > ): CanvasOptions {
		const index: Record< string, FieldType > = types ?? {};

		if ( ! types ) {
			( this.config?.fieldTypes ?? [] ).forEach( ( type ) => {
				index[ type.type ] = type;
			} );
		}

		return {
			fields: this.group?.fields ?? [],
			types: index,
			selected: this.selected,
			onSelect: ( key ) => {
				this.selected = key;
				this.drawCanvas();
				this.drawInspector();

				// In a narrow window the settings are behind a drawer, and a tap
				// on a card is somebody asking about that field. Opening it is
				// the difference between two taps and one.
				if ( 'palette' === this.drawer ) {
					this.openDrawer( 'inspector' );
				}
			},
			// Written straight into the field, and the canvas is **not** redrawn:
			// the caret is inside the element that would be replaced. The
			// inspector is refreshed instead, so the two panes agree.
			onLabel: ( key, value ) => {
				const field = this.group?.fields.find( ( one ) => one.key === key );

				if ( ! field ) {
					return;
				}

				field.label = value;
				this.markDirty();
				this.syncInspector();
			},
			onInstructions: ( key, value ) => {
				const field = this.group?.fields.find( ( one ) => one.key === key );

				if ( ! field ) {
					return;
				}

				field.instructions = value;
				this.markDirty();
				this.syncInspector();
			},
			// A setting rewritten in place. Like the label, the canvas is not
			// redrawn: the caret is in the element a redraw replaces.
			onSetting: ( key, setting, value ) => {
				const field = this.group?.fields.find( ( one ) => one.key === key );

				if ( ! field ) {
					return;
				}

				field.settings = { ...field.settings, [ setting ]: value };
				this.markDirty();
				this.syncInspector();
			},
			// Choices, on the other hand, change the card's *shape* — a row
			// appears or goes — so this one does redraw. Renaming an option
			// arrives here too and would move the caret, so the redraw is skipped
			// when the list is the same length as the one already drawn.
			onChoices: ( key, choices ) => {
				const field = this.group?.fields.find( ( one ) => one.key === key );

				if ( ! field ) {
					return;
				}

				const before = Array.isArray( field.settings.choices )
					? ( field.settings.choices as unknown[] ).length
					: 0;

				field.settings = { ...field.settings, choices };
				this.markDirty();

				// The inspector's own choice editor is rebuilt in place, so it
				// follows a rename typed on the card. Its row is not the one under
				// the caret — that is on the canvas — so replacing it costs
				// nothing.
				this.syncInspector();

				// A choice added or removed changes the *card's* shape, so the
				// canvas is redrawn as well. A rename changes neither.
				if ( before !== choices.length ) {
					this.drawCanvas();
				}
			},
			// Sanitised and made unique, then redrawn — by blur time the caret has
			// already gone, so a redraw costs nothing and is the only way the
			// corrected key gets on screen.
			onName: ( key, value ) => {
				this.patchField( key, { name: value } );
				this.drawCanvas();
			},
			onWidth: ( key, value ) => {
				const field = this.group?.fields.find( ( one ) => one.key === key );

				if ( ! field ) {
					return;
				}

				field.wrapper = { ...field.wrapper, width: value };
				this.markDirty();
				this.drawCanvas();
				this.drawInspector();
			},
			onEditFormula: ( key ) => {
				// Selected first, so the inspector is showing the field the
				// window is about — and so the formula that comes back has
				// somewhere to land.
				this.selected = key;
				this.drawCanvas();
				this.drawInspector();

				this.root
					.querySelector< HTMLElement >( '.atcfb__formula-expand' )
					?.click();
			},
			onMove: ( key, position ) => this.moveField( key, position ),
			onAdd: ( type, position ) => void this.addField( type, position ),
			onDrop: ( field, position ) => void this.insertField( field, position ),
			onRemove: ( key ) => this.removeField( key ),
			onDuplicate: ( key ) => this.duplicateField( key ),
		};
	}

	/** The inspector. */
	/**
	 * Pushes a field's values into the inspector's controls **without rebuilding
	 * it**.
	 *
	 * A rebuild collapses every `<details>` somebody opened and throws the scroll
	 * position away. That is survivable once; it is not survivable per keystroke,
	 * and per keystroke is what editing a label on a card used to cost — the
	 * pane jumped back to the top and folded itself shut on every character.
	 *
	 * The controls say what they edit in `data-atcfb-bind`, so this walks them
	 * rather than keeping a list of keys that would be one more thing to forget.
	 */
	private syncInspector(): void {
		const host = this.root.querySelector< HTMLElement >( '[data-atcfb-inspector]' );

		if ( ! host || ! this.config ) {
			return;
		}

		syncInspector( host, this.inspectorOptions() );
	}

	/**
	 * What the inspector needs, built once so `renderInspector()` and
	 * `syncInspector()` cannot be handed different versions of it.
	 *
	 * @return The options.
	 */
	private inspectorOptions(): InspectorOptions {
		return {
			field: this.group?.fields.find( ( one ) => one.key === this.selected ) ?? null,
			fields: this.group?.fields ?? [],
			config: this.config as BuilderConfig,
			onChange: ( patch ) => this.patchField( this.selected, patch ),
			onSettingChange: ( key, value, typing ) => {
				const field = this.group?.fields.find( ( one ) => one.key === this.selected );

				if ( field ) {
					this.patchField(
						this.selected,
						{ settings: { ...field.settings, [ key ]: value } },
						{ redrawInspector: ! typing }
					);
				}
			},
		};
	}

	private drawInspector(): void {
		const host = this.root.querySelector< HTMLElement >( '[data-atcfb-inspector]' );

		if ( ! host || ! this.config ) {
			return;
		}

		// What a rebuild would otherwise lose. Both are somebody's deliberate
		// state: which sections they opened, and where they had scrolled to.
		const scroll = host.scrollTop;
		const open = new Set(
			Array.from( host.querySelectorAll< HTMLDetailsElement >( 'details' ) )
				.filter( ( one ) => one.open )
				.map( ( one ) => one.querySelector( 'summary' )?.textContent ?? '' )
		);

		renderInspector( host, this.inspectorOptions() );

		host.querySelectorAll< HTMLDetailsElement >( 'details' ).forEach( ( one ) => {
			const title = one.querySelector( 'summary' )?.textContent ?? '';

			if ( open.size && open.has( title ) ) {
				one.open = true;
			}
		} );

		host.scrollTop = scroll;
	}

	/* ---------------------------------------------------------------------- */
	/* Mutations                                                               */
	/* ---------------------------------------------------------------------- */

	private markDirty(): void {
		this.dirty = true;
		this.updateStatus();
	}

	/** Adds a field of a type at an index. */
	private async addField( type: string, index: number ): Promise< void > {
		// Dragging a field in before there is anywhere to put it used to do
		// nothing at all — the ghost flew, the drop landed, and the field
		// vanished. Creating the group instead turns the dead end into the
		// shortest path: the first thing you tried is the thing that works.
		if ( ! this.group ) {
			await this.newGroup();
		}

		if ( ! this.group || ! this.config ) {
			return;
		}

		const definition = this.config.fieldTypes.find( ( one ) => one.type === type );
		const label = definition?.label ?? type;
		const name = this.uniqueName( slug( label ) );

		const field: Field = {
			key: `field_${ uid( '' ).replace( /\D/g, '' ) }${ Math.random().toString( 36 ).slice( 2, 8 ) }`,
			name,
			label,
			type,
			instructions: '',
			required: false,
			readonly: false,
			wrapper: { width: 100, class: '', id: '' },
			conditional: { enabled: false, action: 'show', match: 'all', rules: [] },
			settings: { ...( definition?.settings ?? {} ) },
		};

		this.group.fields.splice( Math.min( index, this.group.fields.length ), 0, field );
		this.selected = field.key;
		this.markDirty();
		this.drawCanvas();
		this.drawInspector();
	}

	/**
	 * Inserts a field that came from somewhere else.
	 *
	 * The key is minted fresh and the name is made unique, because the field is
	 * a *copy*: keeping the source's key would make conditional logic in the
	 * source group point at a field in this one, and keeping the name would make
	 * two fields on the same post write to the same meta row.
	 *
	 * @param field The field as it arrived.
	 * @param index Where to put it.
	 */
	private async insertField( field: Field, index: number ): Promise< void > {
		if ( ! this.group ) {
			await this.newGroup();
		}

		if ( ! this.group ) {
			return;
		}

		const copy: Field = {
			...field,
			key: `field_${ Math.random().toString( 36 ).slice( 2, 15 ) }`,
			name: this.uniqueName( field.name ),
			// A condition that pointed at a field in the source group cannot
			// mean anything here, and leaving it would draw a curve to a card
			// that does not exist. Dropped rather than remapped: there is no
			// correct remapping.
			conditional: { enabled: false, action: 'show', match: 'all', rules: [] },
		};

		this.group.fields.splice( Math.min( index, this.group.fields.length ), 0, copy );
		this.selected = copy.key;
		this.markDirty();
		this.drawCanvas();
		this.drawInspector();

		notify( `“${ copy.label }” copied into ${ this.group.title }.`, '', 'success' );
	}

	/** Moves a field to an index. */
	private moveField( key: string, index: number ): void {
		if ( ! this.group ) {
			return;
		}

		const from = this.group.fields.findIndex( ( one ) => one.key === key );

		if ( from === -1 ) {
			return;
		}

		const [ moved ] = this.group.fields.splice( from, 1 );

		this.group.fields.splice( Math.max( 0, Math.min( index, this.group.fields.length ) ), 0, moved );
		this.markDirty();
		this.drawCanvas();
	}

	/** Applies a patch to one field. */
	private patchField(
		key: string,
		patch: Partial< Field >,
		opts: { redrawInspector?: boolean } = {}
	): void {
		if ( ! this.group ) {
			return;
		}

		const field = this.group.fields.find( ( one ) => one.key === key );

		if ( ! field ) {
			return;
		}

		Object.assign( field, patch );

		if ( patch.name !== undefined ) {
			field.name = this.uniqueName( slug( patch.name ), key );
		}

		this.markDirty();
		this.drawCanvas();

		// The inspector is redrawn after a change that could alter what it shows —
		// a condition gaining a rule, a setting that gates another control.
		//
		// It is **not** redrawn while somebody is typing, and that exception used
		// to be missing: every settings change redrew, and a settings change is
		// what a keystroke in the formula box or any text setting produces. So
		// the pane was rebuilt on every character, the element under the caret
		// was thrown away, and the box appeared to lose focus as you typed. The
		// comment here claimed the opposite was happening, which is why it went
		// unnoticed for so long — see `settingControl()` for which kinds count.
		if ( patch.conditional || ( patch.settings && false !== opts.redrawInspector ) ) {
			this.drawInspector();
		}
	}

	/** Removes a field, and any condition that pointed at it. */
	private removeField( key: string ): void {
		if ( ! this.group ) {
			return;
		}

		this.group.fields = this.group.fields.filter( ( one ) => one.key !== key );

		// Conditions pointing at the removed field are left in place and drawn
		// in red rather than silently deleted. A group with a broken rule is
		// genuinely stuck and the author needs to see it; quietly repairing it
		// would change what the group does without saying so.
		this.selected = '';
		this.markDirty();
		this.drawCanvas();
		this.drawInspector();
	}

	/** Duplicates a field. */
	private duplicateField( key: string ): void {
		const field = this.group?.fields.find( ( one ) => one.key === key );

		if ( ! field || ! this.group ) {
			return;
		}

		void this.insertField( field, this.group.fields.findIndex( ( one ) => one.key === key ) + 1 );
	}

	/** A field name no sibling is using. */
	private uniqueName( name: string, ignore = '' ): string {
		const taken = new Set(
			( this.group?.fields ?? [] ).filter( ( one ) => one.key !== ignore ).map( ( one ) => one.name )
		);

		if ( ! taken.has( name ) ) {
			return name || 'field';
		}

		let suffix = 2;

		while ( taken.has( `${ name }_${ suffix }` ) ) {
			suffix += 1;
		}

		return `${ name }_${ suffix }`;
	}

	/* ---------------------------------------------------------------------- */
	/* Persistence                                                             */
	/* ---------------------------------------------------------------------- */

	/** Opens a group by id. */
	private async openGroup( id: number ): Promise< void > {
		if ( this.dirty && ! ( await confirm( 'There are unsaved changes. Open another group anyway?' ) ) ) {
			return;
		}

		try {
			this.group = await api.getGroup( id );
			this.selected = this.group.fields[ 0 ]?.key ?? '';
			this.dirty = false;
			this.starters = false;
			this.tab = 'fields';
		} catch ( error ) {
			notify( 'That group would not open.', error instanceof Error ? error.message : '', 'error' );

			return;
		}

		this.drawChrome();
		this.drawGroups();
		this.drawMain();
		this.announce();
	}

	/** Creates a group. */
	private async newGroup(): Promise< void > {
		const created = await api.saveGroup( {
			version: 1,
			key: '',
			title: 'New field group',
			fields: [],
			location: [],
			settings: {
				active: true,
				description: '',
				position: 'normal',
				style: 'default',
				label_placement: 'top',
				instruction_placement: 'label',
				menu_order: 0,
				hide_on_screen: [],
				show_in_rest: true,
				block: {
					enabled: false,
					name: '',
					title: '',
					description: '',
					icon: 'block-default',
					category: 'widgets',
					keywords: [],
					template: '',
					align: '',
				},
				frontend: {
					enabled: false,
					placement: 'after',
					heading: true,
				},
			},
		} );

		this.summaries = await api.listGroups();
		this.group = created;
		this.selected = '';
		this.dirty = false;
		this.starters = false;

		this.drawChrome();
		this.drawGroups();
		this.drawMain();
		this.announce();

		// Focus and select the name. A group called "New field group" that
		// nobody renames is a group nobody can find in six months, and the moment
		// to fix that is the second it exists.
		const title = this.root.querySelector< HTMLInputElement >( '.atcfb__title' );

		title?.focus();
		title?.select();
	}

	/** Saves the open group. */
	public async save(): Promise< void > {
		if ( ! this.group ) {
			return;
		}

		try {
			this.group = await api.saveGroup( this.group );
			this.dirty = false;
			this.summaries = await api.listGroups();

			this.drawGroups();
			this.updateStatus();
			this.announce();

			notify( 'Saved.', '', 'success' );

			// The preview window, if one is open, is refreshed rather than left
			// showing the version from before the save. That is the behaviour
			// that makes the pairing worth having: change, save, watch.
			void this.renderPreview( true );
		} catch ( error ) {
			notify( 'That would not save.', error instanceof Error ? error.message : '', 'error' );
		}
	}

	/** Deletes the open group. */
	private async deleteGroup( id?: number, title?: string ): Promise< void > {
		const target = id ?? this.group?.id ?? 0;
		const name = title ?? this.group?.title ?? '';

		if ( ! target ) {
			return;
		}

		const yes = await confirm(
			`Delete “${ name }”? It goes to the trash, and the values already stored on your posts are left exactly where they are — so restoring the group brings everything back.`,
			{ title: 'Delete this field group?', confirmLabel: 'Delete', danger: true }
		);

		if ( ! yes ) {
			return;
		}

		try {
			await api.deleteGroup( target );
		} catch ( error ) {
			// Saying so, rather than leaving a row that looks deleted and is not.
			notify( 'That group would not delete.', error instanceof Error ? error.message : '', 'error' );

			return;
		}

		// Only clear the open group when it is the one that went.
		if ( this.group?.id === target ) {
			this.group = null;
			this.dirty = false;
			this.selected = '';
		}

		this.summaries = await api.listGroups();

		notify( `“${ name }” deleted.`, 'Your posts keep their values.', 'success' );

		this.drawChrome();
		this.drawGroups();
		this.drawMain();
	}

	/** Tells the shell what this window is showing. */
	private announce(): void {
		if ( ! this.group ) {
			setIdentity( this.root, null );

			return;
		}

		const summary = this.summaries.find( ( one ) => one.key === this.group?.key );

		setIdentity(
			this.root,
			groupIdentity(
				{
					id: this.group.id ?? 0,
					key: this.group.key,
					title: this.group.title,
					types: summary?.types ?? [],
				},
				this.config?.adminUrl ?? ''
			)
		);
	}

	/**
	 * Renders the preview into the preview window, or into a panel without one.
	 *
	 * @param onlyIfOpen Skip when no preview window is showing, so a save does
	 *                   not open one the user never asked for.
	 */
	public async renderPreview( onlyIfOpen = false ): Promise< void > {
		if ( ! this.group?.id ) {
			return;
		}

		const host = document.querySelector< HTMLElement >( '[data-atcfp-body]' );

		if ( ! host ) {
			if ( onlyIfOpen ) {
				return;
			}

			return;
		}

		const titleNode = document.querySelector< HTMLElement >( '[data-atcfp-title]' );
		const sampleNode = document.querySelector< HTMLElement >( '[data-atcfp-sample]' );

		try {
			const result = await api.preview( this.group.id );

			clear( host );

			// The markup comes from this site's own REST route, rendered by the
			// same PHP the post editor runs, and is inserted as HTML because
			// that is what it is. It is not user input arriving from elsewhere:
			// every string inside it was escaped by the renderer that produced
			// it.
			host.innerHTML = result.markup;

			if ( titleNode ) {
				titleNode.textContent = result.title;
			}

			if ( sampleNode ) {
				sampleNode.textContent = result.sample ? `Against post #${ result.sample }` : 'No sample post';
			}

			// The real runtime, mounted on the real markup. A preview drawn by a
			// second, simplified renderer is a preview that is wrong exactly
			// where it matters.
			bootRuntime( host );

			const previewRoot = host.closest< HTMLElement >( '[data-atcfp-root]' );

			if ( previewRoot ) {
				setIdentity( previewRoot, previewIdentity( { id: this.group.id, key: this.group.key, title: this.group.title } ) );
			}
		} catch ( error ) {
			clear( host );
			host.append( el( 'p', { class: 'atcfp__error', text: error instanceof Error ? error.message : String( error ) } ) );
		}
	}
}

/**
 * What the shell says this window is showing.
 *
 * Params rather than a module variable, because they persist with the session:
 * a window reopened after a reload comes back on the same field group instead of
 * on whichever the list happens to start with.
 *
 * @param element Anything inside the window.
 * @param key     Which param.
 * @return The value, or an empty string outside a window.
 */
function windowParam( element: HTMLElement, key: string ): string {
	const id = windowIdOf( element );
	const params = id ? shell()?.getWindowParams?.( id ) : undefined;

	return params && params[ key ] !== undefined ? String( params[ key ] ) : '';
}

/** A slug from a label. */
function slug( value: string ): string {
	return value
		.toLowerCase()
		.replace( /[^a-z0-9_]+/g, '_' )
		.replace( /_+/g, '_' )
		.replace( /^_|_$/g, '' );
}

/* -------------------------------------------------------------------------- */
/* Mounting                                                                    */
/* -------------------------------------------------------------------------- */

/** Every builder mounted in this document, so the preview can reach one. */
const mounted: Builder[] = [];

/**
 * Mounts a builder into a body.
 *
 * @param body The window body or the admin page wrapper.
 */
function mount( body: HTMLElement ): void {
	const root = body.querySelector< HTMLElement >( '[data-atcfb-root]' ) ?? body;

	if ( root.dataset.atcfbMounted === '1' ) {
		return;
	}

	root.dataset.atcfbMounted = '1';

	const builder = new Builder( root );

	mounted.push( builder );

	void builder.start();
}

/**
 * The shell's render callback contract.
 *
 * A native window's script publishes a render callback on
 * `window.openStationNativeWindows[ id ]`, and the shell calls it with the
 * cloned body once the window opens. Published for both windows this bundle
 * serves.
 */
interface NativeWindows {
	[ id: string ]: ( body: HTMLElement ) => void;
}

const globals = window as unknown as { openStationNativeWindows?: NativeWindows };

globals.openStationNativeWindows = globals.openStationNativeWindows ?? {};

globals.openStationNativeWindows[ 'allterrain-fields' ] = ( body: HTMLElement ) => mount( body );

globals.openStationNativeWindows[ 'allterrain-fields-formula' ] = ( body: HTMLElement ) => {
	const root = body.querySelector< HTMLElement >( '[data-atcf-formula-root]' ) ?? body;

	mountFormulaWindow( root );
};

globals.openStationNativeWindows[ 'allterrain-fields-preview' ] = ( body: HTMLElement ) => {
	// The preview window has no state of its own: it is a surface the builder
	// draws into. Asking the builder to render on mount is what makes reopening
	// a closed preview show the current group rather than an empty panel.
	const root = body.querySelector< HTMLElement >( '[data-atcfp-root]' ) ?? body;

	root.dataset.atcfpMounted = '1';

	mounted.forEach( ( builder ) => void builder.renderPreview() );
};

/**
 * Also boots on a plain admin page, where there is no shell to call back.
 *
 * `whenShellReady()` resolves immediately when nothing is installed, so this one
 * path serves both — rather than a `shellIsActive()` branch that has to be right
 * about the timing as well as the answer.
 */
if ( typeof document !== 'undefined' ) {
	whenShellReady( () => {
		document.querySelectorAll< HTMLElement >( '[data-atcfb-root]' ).forEach( ( root ) => {
			// Inside the shell a builder window's body is mounted by the render
			// callback above. A root already in the document at boot is the
			// admin page's, which nothing else will mount.
			if ( ! shellIsActive() || ! root.closest( '.os-window' ) ) {
				mount( root );
			}
		} );
	} );
}

/** Exported for the tools window, which reuses the group list. */
export { Builder };

/** Kept reachable so the icon helper is not tree-shaken out of the bundle. */
export { icon };
