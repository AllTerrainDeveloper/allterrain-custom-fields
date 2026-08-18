/**
 * The Content Model.
 *
 * Every custom-fields plugin lets you build a content model and none of them
 * lets you *see* one. You get a list of field groups, each with a location rule
 * written in a sentence, and the shape of the thing — which post types point at
 * which, what is connected to what — exists only in the head of whoever built
 * it, until they leave.
 *
 * This window draws it. Post types, taxonomies and people are nodes. Every
 * relational field is an edge between two of them, labelled with the field's own
 * name and drawn with one arrowhead or two depending on whether it mirrors. It
 * is the site's data model, read straight out of what is already stored, with
 * nothing to maintain.
 *
 * And it is editable, which is the part that needs a desktop:
 *
 * - **Drag a field group onto a node** and the group is assigned to that post
 *   type. The location rule is written for you.
 * - **Drag from one node to another** and a relationship field is created
 *   joining them — bidirectionally, if you say so, in which case the mirror on
 *   the far side is created at the same time.
 * - **Click an edge** and the field it represents opens in the builder, in its
 *   own window, beside this one.
 *
 * Nodes are positioned by hand and the positions persist, because a content
 * model is a diagram somebody arranged to make sense and an auto-layout that
 * rearranges it on every load is a diagram nobody arranges twice.
 */

import { button, clear, componentsReady, el, icon, select, textField, toggle, uid } from '../ui';
import { activateFamilyTab, confirm, FAMILY_WINDOW, notify, shell, shellIsActive, whenShellReady } from '../shell';
import { buildPayload, dragManager, startDrag } from '../dnd';
import * as api from '../api';
import { NEW_TYPE_FLAG } from '../flags';
import { modelIdentity, setIdentity } from '../builder/relations';
import type { ContentModel, GroupSummary, ModelEdge, ModelNode } from '../types';

/** Where the nodes were left. */
const STORAGE_KEY = 'allterrain-fields/model-layout';

/**
 * Icons offered for a new custom post type.
 *
 * A short list with plain names rather than the full dashicon set. Two hundred
 * icons named `dashicons-editor-insertmore` is a worse decision to be handed than
 * no decision at all, and any of these can be changed later.
 */
const TYPE_ICONS = [
	{ value: 'dashicons-portfolio', label: 'Folder' },
	{ value: 'dashicons-food', label: 'Food' },
	{ value: 'dashicons-admin-home', label: 'Building' },
	{ value: 'dashicons-groups', label: 'People' },
	{ value: 'dashicons-calendar-alt', label: 'Calendar' },
	{ value: 'dashicons-cart', label: 'Shop' },
	{ value: 'dashicons-location', label: 'Place' },
	{ value: 'dashicons-book', label: 'Book' },
	{ value: 'dashicons-format-gallery', label: 'Pictures' },
	{ value: 'dashicons-hammer', label: 'Work' },
	{ value: 'dashicons-tickets-alt', label: 'Ticket' },
	{ value: 'dashicons-star-filled', label: 'Star' },
];

/**
 * A plural, guessed.
 *
 * English only and deliberately shallow — it is a *suggestion* sitting in an
 * editable field, and the cost of getting it wrong is that somebody types over
 * it. A full pluralisation library to prefill one text box would be a
 * disproportionate dependency, and would still be wrong in every other language.
 *
 * @param word The singular.
 * @return A likely plural.
 */
function plural( word: string ): string {
	const one = word.trim();

	if ( ! one ) {
		return '';
	}

	if ( /(s|x|z|ch|sh)$/i.test( one ) ) {
		return `${ one }es`;
	}

	if ( /[^aeiou]y$/i.test( one ) ) {
		return `${ one.slice( 0, -1 ) }ies`;
	}

	return `${ one }s`;
}

interface Point {
	x: number;
	y: number;
}

/** One mounted graph. */
class Model {
	private root: HTMLElement;
	private data: ContentModel | null = null;
	private positions: Record< string, Point > = {};
	private selected: ModelEdge | null = null;
	private canvas: HTMLElement | null = null;
	private svg: SVGSVGElement | null = null;

	/**
	 * Whether to draw every registered type or only the ones with something on
	 * them.
	 *
	 * Defaults to the latter, and that default is the whole point. A WooCommerce
	 * site registers twenty-one post types and taxonomies before anybody has
	 * built anything; drawing all of them gives you twenty-one identical pills
	 * and the one relationship you actually made is lost among them. The question
	 * this window answers is "what have I built", so it answers that first and
	 * offers the rest behind a button.
	 */
	private showAll = false;

	public constructor( root: HTMLElement ) {
		this.root = root;
	}

	/** Loads the model and paints it. */
	public async start(): Promise< void > {
		// Awaited, not fired and forgotten. Inside the shell this is a local
		// fetch that resolves in a frame or two, and waiting for it is what makes
		// the first paint use `<os-*>` components rather than painting plain
		// controls and leaving them — a control the user may already have typed
		// into cannot be swapped afterwards without losing the keystroke.
		//
		// With no shell it resolves immediately, so nothing is lost either way.
		await componentsReady();

		this.positions = readLayout();

		try {
			this.data = await api.getModel();
		} catch ( error ) {
			clear( this.root );
			this.root.append(
				el( 'div', {
					class: 'atcfm__error',
					children: [
						el( 'h2', { text: 'The content model could not be read.' } ),
						el( 'p', { text: error instanceof Error ? error.message : String( error ) } ),
					],
				} )
			);

			return;
		}

		this.drawBar();
		this.drawGraph();
		this.drawSide();

		// Opened from the dock's "New custom post type…" — either while this window
		// was already up, or as the reason it was opened at all.
		shell()?.subscribe?.( 'os.allterrain-fields.new-content-type', () => this.drawTypeForm() );

		try {
			if ( window.sessionStorage.getItem( NEW_TYPE_FLAG ) ) {
				window.sessionStorage.removeItem( NEW_TYPE_FLAG );
				this.drawTypeForm();
			}
		} catch {
			// Private browsing; the graph is what they get.
		}

		setIdentity( this.root, modelIdentity( this.data.groups.map( ( one ) => ( { id: one.id, key: one.key } ) ) ) );
	}

	/** The bar: a legend and a reset. */
	private drawBar(): void {
		const bar = this.root.querySelector< HTMLElement >( '[data-atcfm-bar]' );

		if ( ! bar ) {
			return;
		}

		clear( bar );

		const total = this.data?.nodes.length ?? 0;
		const shown = this.visibleNodes().length;
		const hidden = total - shown;

		bar.append(
			el( 'div', {
				class: 'atcfm__legend',
				children: [
					el( 'span', { class: 'atcfm__legend-item atcfm__legend-item--one', text: 'points at' } ),
					el( 'span', { class: 'atcfm__legend-item atcfm__legend-item--both', text: 'mirrors both ways' } ),
					el( 'span', { class: 'atcfm__legend-item atcfm__legend-item--tax', text: 'taxonomy' } ),
				],
			} ),
			el( 'p', {
				class: 'atcfm__hint',
				text: this.showAll
					? 'Every type registered on this site. Drag a node to move it; drag its ⊕ handle onto another to join them.'
					: 'The types that have custom fields or a relationship. Drag a node to move it; drag its ⊕ handle onto another to join them.',
			} ),
			// The primary action of this window, in its toolbar, where a primary
			// action belongs. It was buried in step 1 of a side panel — correct
			// as a *sequence*, invisible as a *button*.
			button( 'New post type', {
				variant: 'primary',
				on: { click: () => this.drawTypeForm() },
			} ),
			button( 'Tidy up', { on: { click: () => this.autoLayout() } } )
		);

		if ( hidden > 0 || this.showAll ) {
			bar.insertBefore(
				button( this.showAll ? 'Only what I’ve built' : `Show all ${ total }`, {
					class: 'atcfm__toggle',
					on: {
						click: () => {
							this.showAll = ! this.showAll;
							this.drawBar();
							this.drawGraph();
						},
					},
				} ),
				bar.lastElementChild
			);
		}
	}

	/**
	 * The nodes worth drawing.
	 *
	 * "Worth drawing" is: it carries custom fields, or something points at it, or
	 * it points at something. Everything else is a type WordPress or a plugin
	 * registered and nobody has modelled yet — real, but not part of the answer to
	 * "what have I built".
	 *
	 * @return The nodes to draw.
	 */
	private visibleNodes(): ModelNode[] {
		if ( ! this.data ) {
			return [];
		}

		if ( this.showAll ) {
			return this.data.nodes;
		}

		const joined = new Set< string >();

		this.data.edges.forEach( ( edge ) => {
			edge.from.forEach( ( one ) => joined.add( one ) );
			this.targetsOf( edge ).forEach( ( one ) => joined.add( one ) );
		} );

		const kept = this.data.nodes.filter( ( node ) => node.fields > 0 || joined.has( node.id ) );

		// A site with nothing built yet would otherwise get an empty canvas and no
		// way to tell whether that is the truth or a fault. Showing everything is
		// the honest fallback, and the bar says which of the two it is doing.
		return kept.length ? kept : this.data.nodes;
	}

	/** The graph itself. */
	private drawGraph(): void {
		const host = this.root.querySelector< HTMLElement >( '[data-atcfm-canvas]' );

		if ( ! host || ! this.data ) {
			return;
		}

		this.canvas = host;

		clear( host );

		const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );

		svg.setAttribute( 'class', 'atcfm__svg' );
		host.append( svg );
		this.svg = svg;

		const nodes = this.visibleNodes();

		nodes.forEach( ( node ) => host.append( this.nodeElement( node ) ) );

		// Positions are worked out *after* the nodes are in the document, because
		// the layout needs their real widths. A node is as wide as its label, and
		// "Product categories" is two and a half times "Tags" — a layout that
		// assumes one size overlaps every time somebody names a post type in a
		// language with long words, which was exactly what this used to do.
		this.layout( nodes, host );

		this.drawEdges();

		const observer = new ResizeObserver( () => this.drawEdges() );

		observer.observe( host );

		// Dropping a field group tile on the wallpaper of the graph does
		// nothing; the nodes are the targets. Registering the canvas as a
		// refusing target is what makes that refusal *visible*, because the
		// shell's claimant rule means a target that says no still swallows the
		// drop rather than letting it fall through to whatever is behind.
		dragManager().registerDropTarget( {
			id: `atcfm-canvas-${ uid( 'c' ) }`,
			element: host,
			accept: () => false,
			onDrop: () => undefined,
		} );
	}

	/**
	 * Places every node that has not been placed by hand.
	 *
	 * This replaced a circle, and the circle is worth describing because the
	 * reasoning behind it was not wrong — evenly spaced points do minimise
	 * crossings on a graph nobody has arranged. What it ignored is that nodes have
	 * *width*. Twenty-one of them on a circle whose radius is bounded by the
	 * window height gives about fifty pixels of arc each, and the labels are three
	 * times that, so every node sat on top of its neighbours and the one edge in
	 * the graph was drawn underneath the pile. The diagram was unreadable, and it
	 * was unreadable in a way that looked like a bug in the data rather than in
	 * the arrangement.
	 *
	 * What is here instead is deliberately dull and always legible:
	 *
	 * 1. Anything joined by an edge is laid out in **columns by distance** from
	 *    the most connected node in its group — so an arrow reads left to right,
	 *    which is the direction people expect a "points at" to run.
	 * 2. Everything unconnected is packed into a **grid** underneath, in reading
	 *    order.
	 * 3. Both use measured widths and a fixed gutter, so nothing ever overlaps.
	 *
	 * Hand-placed nodes are never moved. A content model is a diagram somebody
	 * arranged to make sense of it, and a layout that rearranges it on every load
	 * is a diagram nobody arranges twice.
	 *
	 * @param nodes The nodes on the canvas.
	 * @param host  The canvas.
	 */
	private layout( nodes: ModelNode[], host: HTMLElement ): void {
		const GAP_X = 60;
		const GAP_Y = 26;
		const MARGIN = 40;

		const width = host.clientWidth || 900;
		const box: Record< string, { w: number; h: number } > = {};

		nodes.forEach( ( node ) => {
			const element = host.querySelector< HTMLElement >( `[data-node="${ CSS.escape( node.id ) }"]` );

			box[ node.id ] = {
				w: element?.offsetWidth || 170,
				h: element?.offsetHeight || 44,
			};
		} );

		const place = ( node: ModelNode, x: number, y: number ) => {
			this.positions[ node.id ] = { x: Math.round( x ), y: Math.round( y ) };

			const element = host.querySelector< HTMLElement >( `[data-node="${ CSS.escape( node.id ) }"]` );

			if ( element ) {
				element.style.left = `${ Math.round( x ) }px`;
				element.style.top = `${ Math.round( y ) }px`;
			}
		};

		const onCanvas = new Set( nodes.map( ( node ) => node.id ) );
		const links: Record< string, Set< string > > = {};

		nodes.forEach( ( node ) => {
			links[ node.id ] = new Set();
		} );

		( this.data?.edges ?? [] ).forEach( ( edge ) => {
			edge.from.forEach( ( from ) => {
				this.targetsOf( edge ).forEach( ( to ) => {
					if ( from === to || ! onCanvas.has( from ) || ! onCanvas.has( to ) ) {
						return;
					}

					links[ from ].add( to );
					links[ to ].add( from );
				} );
			} );
		} );

		const joined = nodes.filter( ( node ) => links[ node.id ].size > 0 );
		const loose = nodes.filter( ( node ) => links[ node.id ].size === 0 );
		const done = new Set< string >();
		const byId: Record< string, ModelNode > = {};

		nodes.forEach( ( node ) => {
			byId[ node.id ] = node;
		} );

		let y = MARGIN;

		// One connected group at a time, stacked down the canvas.
		joined.forEach( ( start ) => {
			if ( done.has( start.id ) ) {
				return;
			}

			// Columns by breadth-first distance from the busiest node in the
			// group, which puts the hub on the left and what it points at beside
			// it — the shape somebody drawing this on paper would produce.
			const group: string[] = [];
			const queue = [ start.id ];

			done.add( start.id );

			while ( queue.length ) {
				const id = queue.shift() as string;

				group.push( id );

				links[ id ].forEach( ( next ) => {
					if ( ! done.has( next ) ) {
						done.add( next );
						queue.push( next );
					}
				} );
			}

			const root = group.slice().sort( ( a, b ) => links[ b ].size - links[ a ].size )[ 0 ];
			const rank: Record< string, number > = { [ root ]: 0 };
			const walk = [ root ];

			while ( walk.length ) {
				const id = walk.shift() as string;

				links[ id ].forEach( ( next ) => {
					if ( undefined === rank[ next ] ) {
						rank[ next ] = rank[ id ] + 1;
						walk.push( next );
					}
				} );
			}

			const columns: string[][] = [];

			group.forEach( ( id ) => {
				const depth = rank[ id ] ?? 0;

				columns[ depth ] = columns[ depth ] ?? [];
				columns[ depth ].push( id );
			} );

			let x = MARGIN;
			let tallest = 0;

			columns.forEach( ( column ) => {
				const height = column.reduce( ( sum, id ) => sum + box[ id ].h + GAP_Y, -GAP_Y );
				const widest = column.reduce( ( most, id ) => Math.max( most, box[ id ].w ), 0 );

				let top = y + Math.max( 0, ( columnsHeight( columns, box, GAP_Y ) - height ) / 2 );

				column.forEach( ( id ) => {
					place( byId[ id ], x + ( widest - box[ id ].w ) / 2, top );
					top += box[ id ].h + GAP_Y;
				} );

				x += widest + GAP_X;
				tallest = Math.max( tallest, height );
			} );

			y += tallest + GAP_Y * 2;
		} );

		// Then everything nothing points at, in a plain grid. Reading order, so a
		// person looking for "Products" scans it the way they would scan a list.
		let x = MARGIN;

		loose.forEach( ( node ) => {
			if ( x > MARGIN && x + box[ node.id ].w > width - MARGIN ) {
				x = MARGIN;
				y += box[ node.id ].h + GAP_Y;
			}

			place( node, x, y );
			x += box[ node.id ].w + GAP_X / 2;
		} );
	}

	/** Re-runs the layout over everything and saves it. */
	private autoLayout(): void {
		if ( ! this.data || ! this.canvas ) {
			return;
		}

		this.positions = {};
		writeLayout( this.positions );
		this.drawGraph();
		writeLayout( this.positions );
	}

	/** One node. */
	private nodeElement( node: ModelNode ): HTMLElement {
		const at = this.positions[ node.id ] ?? { x: 40, y: 40 };

		// What a node says, in order of what somebody came here to find out:
		// its name, how many custom fields it has, and which group put them
		// there. The number of *posts* is the least interesting fact about a
		// content model and it used to be the only number on the node — "Posts
		// 966" reads as a statistic, not as a schema.
		const summary = node.fields
			? `${ node.fields } field${ 1 === node.fields ? '' : 's' }`
			: 'No fields yet';

		const actions = el( 'div', { class: 'atcfm__node-actions' } );

		const element = el( 'div', {
			class: `atcfm__node atcfm__node--${ node.kind }${ node.fields ? ' is-built' : '' }`,
			attrs: {
				tabindex: '0',
				role: 'group',
				'aria-label': `${ node.label }: ${ summary }, ${ node.count } item${ 1 === node.count ? '' : 's' }`,
			},
			dataset: { node: node.id },
			style: { left: `${ at.x }px`, top: `${ at.y }px` } as Partial< CSSStyleDeclaration >,
			children: [
				el( 'div', {
					class: 'atcfm__node-head',
					children: [
						icon( node.icon, { class: 'atcfm__node-icon' } ),
						el( 'span', { class: 'atcfm__node-label', text: node.label } ),
						el( 'span', {
							class: 'atcfm__node-count',
							text: String( node.count ),
							attrs: { title: `${ node.count } ${ node.label.toLowerCase() } on this site` },
						} ),
						actions,
					],
				} ),
				// The body of a class-diagram box: what one of these actually
				// holds, by meta key and type. The meta key rather than the
				// label, because the meta key is what a theme writes in
				// `get_post_meta()` — which is the question somebody squints at a
				// content model to answer.
				node.list.length
					? el( 'div', {
							class: 'atcfm__node-list',
							children: node.list.map( ( field ) =>
								el( 'div', {
									class: `atcfm__node-field${ field.sub ? ' is-sub' : '' }`,
									attrs: { title: `${ field.label } — ${ field.type }` },
									children: [
										el( 'span', { class: 'atcfm__node-field-name', text: field.name } ),
										el( 'span', { class: 'atcfm__node-field-type', text: field.type } ),
									],
								} )
							),
					  } )
					: null,
				node.fields > node.list.length
					? el( 'span', {
							class: 'atcfm__node-more',
							text: `and ${ node.fields - node.list.length } more`,
					  } )
					: null,
				el( 'span', {
					class: 'atcfm__node-fields',
					text: node.groups.length ? `${ summary } · ${ node.groups.map( ( one ) => one.title ).join( ', ' ) }` : summary,
				} ),
			],
		} );

		const handle = el( 'button', {
			class: 'atcfm__node-handle',
			text: '⊕',
			attrs: {
				type: 'button',
				title: `Drag this onto another box to link ${ node.label } to it`,
				'aria-label': `Join ${ node.label } to something`,
			},
		} );

		actions.append( handle );

		// A type this plugin made can be removed again from where it is drawn.
		// Nothing WordPress or another plugin registered gets this button — the
		// definition is in somebody else's code and a delete here would do
		// nothing but look broken.
		if ( node.own ) {
			actions.append(
				el( 'button', {
					class: 'atcfm__node-remove',
					text: '×',
					attrs: {
						type: 'button',
						title: `Remove ${ node.label }`,
						'aria-label': `Remove the ${ node.label } content type`,
					},
					on: {
						click: ( event ) => {
							event.stopPropagation();
							void this.removeType( node );
						},
					},
				} )
			);
		}

		// Moving the node. Pointer events with capture, so the drag survives the
		// pointer leaving the element — which it does immediately, because the
		// element moves out from under it.
		element.addEventListener( 'pointerdown', ( event ) => {
			if ( ( event.target as HTMLElement ).closest( '.atcfm__node-actions' ) ) {
				return;
			}

			event.preventDefault();
			element.setPointerCapture( event.pointerId );

			const rect = element.getBoundingClientRect();
			const canvasRect = this.canvas?.getBoundingClientRect() ?? rect;
			const offsetX = event.clientX - rect.left;
			const offsetY = event.clientY - rect.top;

			const onMove = ( move: PointerEvent ) => {
				const x = Math.max( 0, move.clientX - canvasRect.left - offsetX );
				const y = Math.max( 0, move.clientY - canvasRect.top - offsetY );

				this.positions[ node.id ] = { x: Math.round( x ), y: Math.round( y ) };
				element.style.left = `${ x }px`;
				element.style.top = `${ y }px`;
				this.drawEdges();
			};

			const onUp = () => {
				element.removeEventListener( 'pointermove', onMove );
				element.removeEventListener( 'pointerup', onUp );
				writeLayout( this.positions );
			};

			element.addEventListener( 'pointermove', onMove );
			element.addEventListener( 'pointerup', onUp );
		} );

		// Joining two nodes. A rubber-band line follows the pointer, and
		// releasing over another node opens the "what shall this be called"
		// panel rather than creating a field silently — a relationship is a
		// structural change and it deserves a name before it exists.
		handle.addEventListener( 'pointerdown', ( event ) => {
			event.preventDefault();
			event.stopPropagation();
			handle.setPointerCapture( event.pointerId );

			const line = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );

			line.setAttribute( 'class', 'atcfm__edge atcfm__edge--drawing' );
			this.svg?.append( line );

			const onMove = ( move: PointerEvent ) => {
				const canvasRect = this.canvas?.getBoundingClientRect();

				if ( ! canvasRect ) {
					return;
				}

				const towards = {
					x: move.clientX - canvasRect.left,
					y: move.clientY - canvasRect.top,
				};
				const from = this.edgeOf( this.boxOf( node.id ), towards );

				line.setAttribute( 'd', `M ${ from.x } ${ from.y } L ${ towards.x } ${ towards.y }` );
			};

			const onUp = ( up: PointerEvent ) => {
				handle.removeEventListener( 'pointermove', onMove );
				handle.removeEventListener( 'pointerup', onUp );
				line.remove();

				const dropped = document.elementFromPoint( up.clientX, up.clientY ) as HTMLElement | null;
				const target = dropped?.closest< HTMLElement >( '[data-node]' );

				if ( target && target.dataset.node && target.dataset.node !== node.id ) {
					void this.proposeRelationship( node.id, target.dataset.node );
				}
			};

			handle.addEventListener( 'pointermove', onMove );
			handle.addEventListener( 'pointerup', onUp );
		} );

		// A field group tile dropped on a node is assigned to it.
		dragManager().registerDropTarget( {
			id: `atcfm-node-${ node.id }`,
			element,
			accept: ( payload ) => payload.type === api.config().dragTypes.group && node.kind === 'post_type',
			onEnter: () => element.classList.add( 'is-drop-target' ),
			onLeave: () => element.classList.remove( 'is-drop-target' ),
			onDrop: ( session ) => {
				element.classList.remove( 'is-drop-target' );

				const id = Number( ( session.payload.data as { id?: unknown } ).id ?? 0 );

				if ( id ) {
					void this.assignGroup( id, node.id );
				}
			},
		} );

		return element;
	}

	/**
	 * Removes a content type made here.
	 *
	 * The confirmation leads with what *survives*, because the fear is the other
	 * thing. Somebody removing a type they named wrongly a minute ago should not
	 * have to guess whether the forty entries under it are about to go with it —
	 * they are not, and saying so is the difference between a button people use
	 * and a button people avoid.
	 *
	 * @param node The node to remove.
	 */
	private async removeType( node: ModelNode ): Promise< void > {
		const kept = node.count
			? `The ${ node.count } ${ node.count === 1 ? 'entry' : 'entries' } already stored stay exactly where they are — remake it with the same name and they all come back.`
			: 'Nothing is stored under it yet, so there is nothing to lose.';

		const yes = await confirm( `Remove “${ node.label }”? ${ kept }`, {
			title: `Remove ${ node.label }?`,
			confirmLabel: 'Remove',
			danger: true,
		} );

		if ( ! yes ) {
			return;
		}

		try {
			await api.deleteContentType( node.own );
			this.data = await api.getModel();
		} catch ( error ) {
			notify( 'That would not delete.', error instanceof Error ? error.message : '', 'error' );

			return;
		}

		delete this.positions[ node.id ];

		this.drawBar();
		this.drawGraph();
		this.drawSide();

		notify( `“${ node.label }” removed.`, node.count ? 'Its entries are untouched.' : '', 'success' );
	}

	/** Where an edge attaches to a node — its centre. */
	private anchorOf( id: string ): Point {
		const box = this.boxOf( id );

		return { x: box.x, y: box.y };
	}

	/**
	 * A node's centre and half-extent, in canvas coordinates.
	 *
	 * The half-extent is what lets an edge stop at the *border* of a box rather
	 * than running to its middle and disappearing underneath it — see
	 * {@link edgeOf}.
	 *
	 * @param id The node id.
	 * @return Centre and half-size.
	 */
	private boxOf( id: string ): { x: number; y: number; hw: number; hh: number } {
		const element = this.canvas?.querySelector< HTMLElement >( `[data-node="${ CSS.escape( id ) }"]` );

		if ( ! element || ! this.canvas ) {
			return { x: 0, y: 0, hw: 0, hh: 0 };
		}

		const rect = element.getBoundingClientRect();
		const canvasRect = this.canvas.getBoundingClientRect();

		return {
			x: rect.left - canvasRect.left + rect.width / 2,
			y: rect.top - canvasRect.top + rect.height / 2,
			hw: rect.width / 2,
			hh: rect.height / 2,
		};
	}

	/**
	 * Where a line leaving a box crosses its border.
	 *
	 * Edges used to be drawn centre to centre, which put both endpoints
	 * underneath the boxes they joined. On a pill that was survivable — the line
	 * vanished for twenty pixels and came back. On a card listing ten fields the
	 * arrowhead lands somewhere in the middle of the field list, and the diagram
	 * reads as a line drawn *through* a box rather than *to* it.
	 *
	 * The maths is the standard ray-to-rectangle clip: walk out from the centre
	 * along the direction of travel until whichever of the two half-extents is
	 * reached first. A few pixels of clearance are left so the arrowhead sits
	 * beside the border rather than on it.
	 *
	 * @param box     The node's centre and half-size.
	 * @param towards The point the line is heading for.
	 * @param gap     Clearance, in pixels.
	 * @return The point on the border.
	 */
	private edgeOf( box: { x: number; y: number; hw: number; hh: number }, towards: Point, gap = 6 ): Point {
		const dx = towards.x - box.x;
		const dy = towards.y - box.y;

		if ( ! dx && ! dy ) {
			return { x: box.x, y: box.y };
		}

		// How far along the direction the border is, on each axis. The smaller of
		// the two is the side the line actually leaves through.
		const scale = Math.min(
			box.hw / ( Math.abs( dx ) || Number.EPSILON ),
			box.hh / ( Math.abs( dy ) || Number.EPSILON )
		);

		const length = Math.hypot( dx, dy ) || 1;

		return {
			x: box.x + dx * scale + ( dx / length ) * gap,
			y: box.y + dy * scale + ( dy / length ) * gap,
		};
	}

	/** Draws every edge. */
	private drawEdges(): void {
		if ( ! this.svg || ! this.data || ! this.canvas ) {
			return;
		}

		const svg = this.svg;

		while ( svg.firstChild ) {
			svg.removeChild( svg.firstChild );
		}

		svg.setAttribute( 'width', String( this.canvas.clientWidth ) );
		svg.setAttribute( 'height', String( this.canvas.clientHeight ) );

		// One marker definition, referenced by every edge. Defining an arrowhead
		// per edge is what makes a graph with sixty edges take a second to
		// repaint on every node move.
		const defs = document.createElementNS( 'http://www.w3.org/2000/svg', 'defs' );

		defs.innerHTML =
			'<marker id="atcfm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>';
		svg.append( defs );

		const seen = new Map< string, number >();

		// A mirrored relationship is **one** edge, not two.
		//
		// The two halves describe the same join from opposite ends, and drawing
		// both puts two curves in exactly the same place with their labels
		// stacked on top of each other — which reads as a rendering fault rather
		// than as a two-way relationship. The surviving half is drawn with an
		// arrowhead at each end, which is what actually says "both ways".
		const drawn = new Set< string >();
		const edges = this.data.edges.filter( ( edge ) => {
			if ( ! edge.bidirectional || ! edge.mirror ) {
				return true;
			}

			if ( drawn.has( edge.field ) ) {
				return false;
			}

			drawn.add( edge.mirror );

			return true;
		} );

		edges.forEach( ( edge ) => {
			this.targetsOf( edge ).forEach( ( target ) => {
				edge.from.forEach( ( source ) => {
					const from = source === '*' ? null : this.anchorOf( source );
					const to = target === '*' ? null : this.anchorOf( target );

					if ( ! from || ! to || ( from.x === 0 && from.y === 0 ) || ( to.x === 0 && to.y === 0 ) ) {
						return;
					}

					// Two fields joining the same pair get different bows, so a
					// model with "Related products" and "Bundled with" between
					// the same two types shows two curves rather than one drawn
					// twice.
					const pair = [ source, target ].sort().join( '|' );
					const nth = ( seen.get( pair ) ?? 0 ) + 1;

					seen.set( pair, nth );

					const path = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );

					// A field pointing at its own type — "Related articles" on
					// Posts, which is one of the most common relationships anybody
					// models. Both anchors are the same point, so the ordinary
					// quadratic collapses to nothing and the edge silently does
					// not exist. A loop above the node is the drawing every graph
					// tool uses for this, and it is four numbers.
					if ( source === target ) {
						const loop = 42;
						const box = this.boxOf( source );
						const top = box.y - box.hh - 2;

						path.setAttribute(
							'd',
							`M ${ box.x - 18 } ${ top } C ${ box.x - loop } ${ top - loop * 1.4 }, ${ box.x + loop } ${ top - loop * 1.4 }, ${ box.x + 18 } ${ top }`
						);
						path.setAttribute(
							'class',
							`atcfm__edge atcfm__edge--${ edge.kind }${ edge.bidirectional ? ' atcfm__edge--both' : '' }`
						);
						path.setAttribute( 'marker-end', 'url(#atcfm-arrow)' );
						path.addEventListener( 'click', () => this.selectEdge( edge ) );

						svg.append( path );

						const selfLabel = document.createElementNS( 'http://www.w3.org/2000/svg', 'text' );

						selfLabel.setAttribute( 'class', 'atcfm__edge-label' );
						selfLabel.setAttribute( 'x', String( box.x ) );
						selfLabel.setAttribute( 'y', String( top - loop - 6 ) );
						selfLabel.textContent = edge.label;
						selfLabel.addEventListener( 'click', () => this.selectEdge( edge ) );

						svg.append( selfLabel );

						return;
					}

					const midX = ( from.x + to.x ) / 2;
					const midY = ( from.y + to.y ) / 2;
					const dx = to.x - from.x;
					const dy = to.y - from.y;
					const length = Math.hypot( dx, dy ) || 1;

					// Which side the curve bows to has to depend on the *pair*,
					// not on which end this edge happens to start from. The
					// perpendicular flips when the edge is drawn the other way
					// round, so a naive sign flip cancels out and two fields
					// joining the same pair land on top of each other — the
					// exact overlap this fan-out exists to prevent.
					const orientation = source <= target ? 1 : -1;
					const bow = orientation * ( nth % 2 === 0 ? -1 : 1 ) * Math.ceil( nth / 2 ) * 34;
					const controlX = midX + ( -dy / length ) * bow;
					const controlY = midY + ( dx / length ) * bow;

					// Both ends are clipped to the border of their own box, along
					// the direction the curve actually leaves in — which is
					// towards the control point, not towards the far centre. On a
					// bowed edge those are different directions, and clipping
					// against the wrong one puts the arrowhead beside the corner
					// it should be touching.
					const start = this.edgeOf( this.boxOf( source ), { x: controlX, y: controlY } );
					const end = this.edgeOf( this.boxOf( target ), { x: controlX, y: controlY }, 10 );

					path.setAttribute( 'd', `M ${ start.x } ${ start.y } Q ${ controlX } ${ controlY } ${ end.x } ${ end.y }` );
					path.setAttribute(
						'class',
						`atcfm__edge atcfm__edge--${ edge.kind }${ edge.bidirectional ? ' atcfm__edge--both' : '' }`
					);
					path.setAttribute( 'marker-end', 'url(#atcfm-arrow)' );

					if ( edge.bidirectional ) {
						path.setAttribute( 'marker-start', 'url(#atcfm-arrow)' );
					}

					path.addEventListener( 'click', () => this.selectEdge( edge ) );

					svg.append( path );

					const label = document.createElementNS( 'http://www.w3.org/2000/svg', 'text' );

					label.setAttribute( 'class', 'atcfm__edge-label' );
					label.setAttribute( 'x', String( controlX ) );
					label.setAttribute( 'y', String( controlY ) );
					label.textContent = edge.label;
					label.addEventListener( 'click', () => this.selectEdge( edge ) );

					svg.append( label );
				} );
			} );
		} );
	}

	/** The node ids an edge points at. */
	private targetsOf( edge: ModelEdge ): string[] {
		if ( edge.kind === 'user' ) {
			return [ 'user' ];
		}

		return edge.to;
	}

	/** Shows an edge in the side panel. */
	private selectEdge( edge: ModelEdge ): void {
		this.selected = edge;
		this.drawSide();
	}

	/** The side panel: the field groups, and whatever edge is selected. */
	private drawSide(): void {
		const host = this.root.querySelector< HTMLElement >( '[data-atcfm-side]' );

		if ( ! host || ! this.data ) {
			return;
		}

		clear( host );

		if ( this.selected ) {
			const edge = this.selected;

			host.append(
				el( 'div', {
					class: 'atcfm__detail',
					children: [
						el( 'h2', { text: edge.label } ),
						el( 'dl', {
							class: 'atcfm__detail-list',
							children: [
								el( 'dt', { text: 'Field' } ),
								el( 'dd', { text: `${ edge.name } (${ edge.type })` } ),
								el( 'dt', { text: 'In' } ),
								el( 'dd', { text: edge.group_title } ),
								el( 'dt', { text: 'From' } ),
								el( 'dd', { text: edge.from.join( ', ' ) } ),
								el( 'dt', { text: 'To' } ),
								el( 'dd', { text: edge.to.join( ', ' ) } ),
								el( 'dt', { text: 'Mirrored' } ),
								el( 'dd', { text: edge.bidirectional ? 'Yes, both ways' : 'No, one way' } ),
							],
						} ),
						button( 'Open in the builder', {
							on: { click: () => openBuilder( edge.group_id ) },
						} ),
						button( 'Clear selection', {
							on: {
								click: () => {
									this.selected = null;
									this.drawSide();
								},
							},
						} ),
					],
				} )
			);

			return;
		}

		// Read top to bottom this panel is the two steps in order: make a place to
		// put things, then say what those things have. That order is the whole
		// mental model, and it was missing — the window could only ever draw the
		// post types somebody else had already registered, so "what have I built"
		// had no answer that involved building anything.
		host.append(
			el( 'div', {
				class: 'atcfm__explain',
				children: [
					el( 'h2', { text: 'What this shows' } ),
					el( 'p', {
						text: 'Every box is a post type, a taxonomy or the people on your site. A line between two boxes means one points at the other.',
					} ),
					el( 'p', {
						text: 'A box lights up when it has custom fields on it. That is the part you build.',
					} ),
				],
			} )
		);

		host.append(
			el( 'div', {
				class: 'atcfm__step',
				children: [
					el( 'span', { class: 'atcfm__step-number', text: '1' } ),
					el( 'div', {
						class: 'atcfm__step-body',
						children: [
							el( 'h3', { text: 'Create a custom post type' } ),
							el( 'p', {
								// The real name, with the explanation kept. Calling
								// it "a kind of thing" was meant to be welcoming and
								// was really just vague — it left somebody unable to
								// search for their own problem, because every answer
								// on the web says "custom post type".
								text: 'A post type is a kind of content your site holds. Posts and Pages are the two WordPress ships with; Recipes, Properties or Staff are ones you add.',
							} ),
							button( 'New post type', {
								class: 'atcfm__new-type',
								variant: 'primary',
								on: { click: () => this.drawTypeForm() },
							} ),
						],
					} ),
				],
			} )
		);

		host.append(
			el( 'div', {
				class: 'atcfm__step',
				children: [
					el( 'span', { class: 'atcfm__step-number', text: '2' } ),
					el( 'div', {
						class: 'atcfm__step-body',
						children: [
							el( 'h3', { text: 'Say what it holds' } ),
							el( 'p', {
								text: this.data.groups.length
									? 'Drag one of these onto a box to put its fields there. Click it to open the builder.'
									: 'A field group is a set of fields. There are none yet — open Fields → Field Groups and start from a template.',
							} ),
						],
					} ),
				],
			} )
		);

		const list = el( 'div', { class: 'atcfm__groups', attrs: { role: 'list' } } );

		this.data.groups.forEach( ( group ) => list.append( this.groupTile( group ) ) );

		host.append( list );
	}

	/**
	 * The form for making a custom post type.
	 *
	 * Two required words and four switches. `register_post_type()` takes forty
	 * arguments and asking about them is how a person making their first content
	 * type decides this is not for them — the slug, the seventeen labels, the
	 * archive rules and the capability mapping are all worked out from the two
	 * words on the server.
	 *
	 * Every switch is phrased as a question about the content, not about the
	 * `register_post_type()` argument behind it: "Visitors can see these on the
	 * site" rather than `public`. Somebody who has never registered a post type
	 * has no idea what `public` means and every idea what the question means.
	 *
	 * The *name* of the thing, though, is the real one. Calling a post type "a
	 * kind of thing" was meant to be welcoming and was really just vague — it
	 * leaves somebody unable to search for their own problem, because every
	 * answer on the web says "custom post type".
	 */
	private drawTypeForm(): void {
		const host = this.root.querySelector< HTMLElement >( '[data-atcfm-side]' );

		if ( ! host ) {
			return;
		}

		clear( host );

		const draft = {
			singular: '',
			plural: '',
			icon: 'dashicons-portfolio',
			public: true,
			hierarchical: false,
			thumbnail: true,
			editor: true,
		};

		const singular = textField( '', { attrs: { placeholder: 'Recipe' } }, ( value ) => {
			draft.singular = value;

			// The plural is guessed and stays guessed until somebody types over
			// it. Asking for both up front doubles the form for a word most
			// people would have let us guess.
			if ( ! touched ) {
				draft.plural = plural( value );
				( pluralField as HTMLInputElement ).value = draft.plural;
			}
		} );

		let touched = false;

		const pluralField = textField( '', { attrs: { placeholder: 'Recipes' } }, ( value ) => {
			touched = true;
			draft.plural = value;
		} );

		const message = el( 'p', { class: 'atcfm__form-error' } );

		host.append(
			el( 'div', {
				class: 'atcfm__form',
				children: [
					el( 'h2', { text: 'New custom post type' } ),
					el( 'p', {
						class: 'atcfm__form-lead',
						text: 'It gets its own menu item, its own list, and its own place to add fields. Nothing here is permanent — you can remove it later and whatever you stored stays put.',
					} ),

					el( 'div', {
						class: 'atcfm__form-row',
						children: [
							el( 'label', { class: 'atcfm__form-label', text: 'What is one of them called?' } ),
							singular,
							el( 'p', { class: 'atcfm__form-hint', text: 'Singular. “Recipe”, not “Recipes”.' } ),
						],
					} ),

					el( 'div', {
						class: 'atcfm__form-row',
						children: [
							el( 'label', { class: 'atcfm__form-label', text: 'And more than one?' } ),
							pluralField,
							el( 'p', { class: 'atcfm__form-hint', text: 'This is what the menu will say.' } ),
						],
					} ),

					el( 'div', {
						class: 'atcfm__form-row',
						children: [
							el( 'label', { class: 'atcfm__form-label', text: 'Icon' } ),
							select(
								draft.icon,
								TYPE_ICONS,
								( value ) => {
									draft.icon = value;
								}
							),
						],
					} ),

					// One bordered list, not four loose switches. Stacked bare they
					// ran together as a single block of grey text and there was
					// nothing to say which sentence belonged to which switch.
					el( 'div', {
						class: 'atcfm__switches',
						children: [
					// `description` rather than a paragraph underneath. The kit's
					// switch renders a second line under its own label, keyed to
					// the same control — so the sentence explaining what *off*
					// means is part of the thing it explains rather than a
					// sibling that happens to sit below it.
					toggle(
						true,
						'Visitors can see these on the site',
						( on ) => {
							draft.public = on;
						},
						{
							block: true,
							description: 'Off means they exist in the admin only — useful for internal records.',
						}
					),

					toggle(
						true,
						'They have a main body of text',
						( on ) => {
							draft.editor = on;
						},
						{
							block: true,
							description: 'Off if this is only fields — a staff record, a product spec.',
						}
					),

					toggle(
						true,
						'They have a main image',
						( on ) => {
							draft.thumbnail = on;
						},
						{ block: true }
					),

					toggle(
						false,
						'They nest inside each other',
						( on ) => {
							draft.hierarchical = on;
						},
						{ block: true, description: 'Like pages, where one can sit under another.' }
					),
						],
					} ),

					message,

					el( 'div', {
						class: 'atcfm__form-actions',
						children: [
							button( 'Create it', {
								variant: 'primary',
								class: 'atcfm__form-go',
								on: { click: () => void this.createType( draft, message ) },
							} ),
							button( 'Cancel', { on: { click: () => this.drawSide() } } ),
						],
					} ),
				],
			} )
		);
	}

	/**
	 * Creates the type, then redraws the graph with it on.
	 *
	 * The server registers it inside the same request, so the model that comes
	 * back already contains the new node — there is no reload, and the thing you
	 * just named is on the canvas before you have finished reading the notice.
	 *
	 * @param draft   What the form collected.
	 * @param message Where to put a refusal.
	 */
	private async createType( draft: Record< string, unknown >, message: HTMLElement ): Promise< void > {
		message.textContent = '';

		if ( ! String( draft.singular ?? '' ).trim() ) {
			message.textContent = 'It needs a name first — what is one of them called?';

			return;
		}

		let created;

		try {
			created = await api.createContentType( draft );
		} catch ( error ) {
			message.textContent = error instanceof Error ? error.message : String( error );

			return;
		}

		try {
			this.data = await api.getModel();
		} catch {
			// The type exists either way; only the picture is stale.
		}

		this.drawBar();
		this.drawGraph();
		this.drawSide();

		notify(
			`${ created.plural } is ready.`,
			'It is in the admin menu now. Put a field group on it to say what one holds.',
			'success'
		);
	}

	/** A draggable field group tile. */
	private groupTile( group: GroupSummary ): HTMLElement {
		const tile = el( 'div', {
			class: `atcfm__group${ group.active ? '' : ' is-off' }`,
			attrs: { role: 'listitem', tabindex: '0' },
			children: [
				icon( 'dashicons-index-card' ),
				el( 'span', { class: 'atcfm__group-title', text: group.title } ),
				el( 'span', { class: 'atcfm__group-meta', text: `${ group.fields } · ${ group.location }` } ),
			],
		} );

		tile.addEventListener( 'pointerdown', ( event ) => {
			const ghost = el( 'div', { class: 'atcf-drag-ghost atcf-drag-ghost--group', text: group.title } );

			startDrag( event, {
				payload: buildPayload(
					api.config().dragTypes.group,
					tile,
					{ id: group.id, key: group.key, title: group.title },
					event,
					ghost
				),
				origin: event,
				onClickOnly: () => openBuilder( group.id ),
				onCancel: () => undefined,
			} );
		} );

		return tile;
	}

	/**
	 * Adds a location rule putting a group on a post type.
	 *
	 * Appended as a new OR clause rather than merged into an existing one. "Also
	 * show this on Products" is an *or*, and folding it into an existing AND
	 * clause would produce "Pages that are also Products", which matches nothing
	 * — and looks, from the outside, exactly like the drop having failed.
	 *
	 * @param id       The group's post id.
	 * @param postType The node's slug.
	 */
	private async assignGroup( id: number, postType: string ): Promise< void > {
		try {
			const group = await api.getGroup( id );

			const already = group.location.some( ( clause ) =>
				clause.some( ( rule ) => rule.param === 'post_type' && rule.operator === '==' && rule.value === postType )
			);

			if ( already ) {
				notify( `“${ group.title }” is already on ${ postType }.`, '', 'info' );

				return;
			}

			group.location = [ ...group.location, [ { param: 'post_type', operator: '==', value: postType } ] ];

			await api.saveGroup( group );

			notify( `“${ group.title }” now appears on ${ postType }.`, '', 'success' );

			this.data = await api.getModel();
			this.drawGraph();
			this.drawSide();
		} catch ( error ) {
			notify( 'That could not be assigned.', error instanceof Error ? error.message : '', 'error' );
		}
	}

	/**
	 * Offers to create a relationship field joining two nodes.
	 *
	 * The panel asks three things and no more: which group the field goes in,
	 * what it is called, and whether it mirrors. Everything else is derivable —
	 * the target post types are the node you dropped on, the field type is a
	 * relationship, the name is a slug of the label.
	 *
	 * @param from The node the drag started on.
	 * @param to   The node it ended on.
	 */
	private async proposeRelationship( from: string, to: string ): Promise< void > {
		if ( ! this.data ) {
			return;
		}

		const host = this.root.querySelector< HTMLElement >( '[data-atcfm-side]' );

		if ( ! host ) {
			return;
		}

		const fromNode = this.data.nodes.find( ( one ) => one.id === from );
		const toNode = this.data.nodes.find( ( one ) => one.id === to );

		if ( ! fromNode || ! toNode || fromNode.kind !== 'post_type' ) {
			notify( 'A relationship has to start from a post type.', '', 'info' );

			return;
		}

		const candidates = this.data.groups.filter(
			( group ) => ! group.local && ( group.types.includes( from ) || group.types.includes( '*' ) )
		);

		clear( host );

		let label = `Related ${ toNode.label.toLowerCase() }`;
		let groupId = candidates[ 0 ]?.id ?? 0;
		let mirrored = false;

		const labelInput = textField( label, {}, ( value ) => {
			label = value;
		} );

		host.append(
			el( 'div', {
				class: 'atcfm__propose',
				children: [
					el( 'h2', { text: `Join ${ fromNode.label } to ${ toNode.label }` } ),
					el( 'p', {
						class: 'atcfm__propose-note',
						text: 'This adds a relationship field. Nothing is written until you press Create.',
					} ),
					el( 'label', { class: 'atcfm__row', children: [ el( 'span', { text: 'Called' } ), labelInput ] } ),
					candidates.length
						? el( 'label', {
								class: 'atcfm__row',
								children: [
									el( 'span', { text: 'In the group' } ),
									select(
										String( groupId ),
										candidates.map( ( group ) => ( { value: String( group.id ), label: group.title } ) ),
										( value ) => {
											groupId = Number( value );
										}
									),
								],
						  } )
						: el( 'p', {
								class: 'atcfm__propose-warning',
								text: `No field group appears on ${ fromNode.label } yet. Make one first, or drag an existing group onto that node.`,
						  } ),
					el( 'label', {
						class: 'atcfm__row atcfm__row--check',
						children: [
							( () => {
								const box = el( 'input', { attrs: { type: 'checkbox' } } ) as HTMLInputElement;

								box.addEventListener( 'change', () => {
									mirrored = box.checked;
								} );

								return box;
							} )(),
							el( 'span', { text: `Also add the other side on ${ toNode.label }` } ),
						],
					} ),
					el( 'div', {
						class: 'atcfm__propose-actions',
						children: [
							button( 'Create', {
								attrs: { disabled: candidates.length ? null : true },
								on: { click: () => void this.createRelationship( groupId, label, to, mirrored, from ) },
							} ),
							button( 'Cancel', { on: { click: () => this.drawSide() } } ),
						],
					} ),
				],
			} )
		);
	}

	/**
	 * Writes the relationship field, and its mirror when asked.
	 *
	 * The mirror is created in a group that appears on the *target* type, and
	 * the two fields name each other's keys. That is a two-step save with a
	 * dependency in both directions — the first field does not know its mirror's
	 * key yet — so the first is saved, its key read back, the second created,
	 * and the first patched. Doing it in one pass is what makes half-formed
	 * mirrors, which are worse than none: the far side points home and home
	 * points nowhere.
	 *
	 * @param groupId  Which group takes the field.
	 * @param label    What it is called.
	 * @param target   The node it points at.
	 * @param mirrored Whether to create the far side.
	 * @param source   The node it starts from.
	 */
	private async createRelationship(
		groupId: number,
		label: string,
		target: string,
		mirrored: boolean,
		source: string
	): Promise< void > {
		try {
			const group = await api.getGroup( groupId );
			const isTaxonomy = target.startsWith( 'taxonomy:' );
			const isUser = target === 'user';

			const field = {
				key: '',
				name: slug( label ),
				label,
				type: isUser ? 'user' : isTaxonomy ? 'taxonomy' : 'relationship',
				instructions: '',
				required: false,
				readonly: false,
				wrapper: { width: 100, class: '', id: '' },
				conditional: { enabled: false, action: 'show' as const, match: 'all' as const, rules: [] },
				settings: isTaxonomy
					? { taxonomy: target.replace( 'taxonomy:', '' ), multiple: true }
					: isUser
					? { multiple: true }
					: { post_types: [ target ], bidirectional: false, mirror: '' },
			};

			group.fields.push( field as never );

			const saved = await api.saveGroup( group );
			const created = saved.fields[ saved.fields.length - 1 ];

			if ( ! mirrored || isTaxonomy || isUser ) {
				await this.refresh( `“${ label }” added to ${ group.title }.` );

				return;
			}

			const targetGroup = this.data?.groups.find(
				( one ) => ! one.local && ( one.types.includes( target ) || one.types.includes( '*' ) )
			);

			if ( ! targetGroup ) {
				await this.refresh(
					`“${ label }” added, but nothing on ${ target } could hold the other side — no field group appears there yet.`
				);

				return;
			}

			const far = await api.getGroup( targetGroup.id );

			far.fields.push( {
				key: '',
				name: slug( `Related ${ source }` ),
				label: `Related ${ source }`,
				type: 'relationship',
				instructions: '',
				required: false,
				readonly: false,
				wrapper: { width: 100, class: '', id: '' },
				conditional: { enabled: false, action: 'show', match: 'all', rules: [] },
				settings: { post_types: [ source ], bidirectional: true, mirror: created.key },
			} as never );

			const farSaved = await api.saveGroup( far );
			const farField = farSaved.fields[ farSaved.fields.length - 1 ];

			// Now the first field knows its mirror's key, which it could not
			// until the second existed.
			const home = await api.getGroup( groupId );
			const homeField = home.fields.find( ( one ) => one.key === created.key );

			if ( homeField ) {
				homeField.settings = { ...homeField.settings, bidirectional: true, mirror: farField.key };
				await api.saveGroup( home );
			}

			await this.refresh( `“${ label }” added, mirrored on ${ target }.` );
		} catch ( error ) {
			notify( 'That relationship could not be created.', error instanceof Error ? error.message : '', 'error' );
		}
	}

	/** Reloads the model and redraws. */
	private async refresh( message: string ): Promise< void > {
		notify( message, '', 'success' );

		this.data = await api.getModel();
		this.selected = null;

		this.drawGraph();
		this.drawSide();
	}
}

/** Opens a field group in the builder window, or the admin page without one. */
/**
 * How tall the tallest column in a group is.
 *
 * Used to centre the short columns against it, so a hub with one thing beside it
 * draws as a level pair rather than as two nodes at different heights joined by a
 * diagonal.
 *
 * @param columns Node ids per column.
 * @param box     Measured sizes.
 * @param gap     Vertical gutter.
 * @return The height of the tallest column, in pixels.
 */
function columnsHeight( columns: string[][], box: Record< string, { w: number; h: number } >, gap: number ): number {
	return columns.reduce( ( most, column ) => {
		const height = column.reduce( ( sum, id ) => sum + box[ id ].h + gap, -gap );

		return Math.max( most, height );
	}, 0 );
}

function openBuilder( id: number ): void {
	void confirm;

	const os = ( window as unknown as { wp?: { os?: { openWindow?: ( id: string ) => boolean } } } ).wp?.os;

	if ( os?.openWindow ) {
		os.openWindow( 'allterrain-fields' );

		// The builder opens on its own first group; telling it which one to show
		// is a broadcast rather than an argument, because the window may already
		// be open with something else in it.
		document.dispatchEvent( new CustomEvent( 'atcf:open-group', { detail: { id } } ) );

		return;
	}

	window.location.href = `${ api.config().adminUrl }admin.php?page=allterrain-fields&group=${ id }`;
}

/** A slug from a label. */
function slug( value: string ): string {
	return value
		.toLowerCase()
		.replace( /[^a-z0-9_]+/g, '_' )
		.replace( /_+/g, '_' )
		.replace( /^_|_$/g, '' );
}

/** Reads the saved layout. */
function readLayout(): Record< string, Point > {
	try {
		return JSON.parse( window.localStorage.getItem( STORAGE_KEY ) ?? '{}' ) as Record< string, Point >;
	} catch {
		// A quota error, a disabled store, private browsing. The graph simply
		// lays itself out again, which is a worse experience and not a broken
		// one.
		return {};
	}
}

/** Saves the layout. */
function writeLayout( positions: Record< string, Point > ): void {
	try {
		window.localStorage.setItem( STORAGE_KEY, JSON.stringify( positions ) );
	} catch {
		// See above.
	}
}

/* -------------------------------------------------------------------------- */
/* Mounting                                                                    */
/* -------------------------------------------------------------------------- */

function mount( body: HTMLElement ): void {
	const root = body.querySelector< HTMLElement >( '[data-atcfm-root]' ) ?? body;

	if ( root.dataset.atcfmMounted === '1' ) {
		return;
	}

	root.dataset.atcfmMounted = '1';

	void new Model( root ).start();
}

const globals = window as unknown as {
	openStationNativeWindows?: Record< string, ( body: HTMLElement ) => void >;
};

globals.openStationNativeWindows = globals.openStationNativeWindows ?? {};

// The model pane rides in the family window as a tab; chain, never own — see
// the same block in `tools.ts`.
{
	const prev = globals.openStationNativeWindows[ FAMILY_WINDOW ];

	globals.openStationNativeWindows[ FAMILY_WINDOW ] = ( body: HTMLElement ) => {
		prev?.( body );
		mount( body );

		if ( shell()?.getWindowParams?.( FAMILY_WINDOW )?.tab === 'model' ) {
			activateFamilyTab( 'model' );
		}
	};
}

if ( typeof document !== 'undefined' ) {
	whenShellReady( () => {
		document.querySelectorAll< HTMLElement >( '[data-atcfm-root]' ).forEach( ( root ) => {
			if ( ! shellIsActive() || ! root.closest( '.os-window' ) ) {
				mount( root );
			}
		} );
	} );
}
