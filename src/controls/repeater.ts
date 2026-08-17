/**
 * The containers: repeater, flexible content, group, clone.
 *
 * These are the four fields every other plugin in this category put behind a
 * paywall, and a repeater is a list — the second data structure anyone learns.
 * There was never a technical reason.
 *
 * Two things here are worth reading for.
 *
 * **Rows drag with the shell's pointer pipeline**, not with HTML5 drag. That is
 * what makes a row draggable between two windows: lift the third row of a
 * repeater in one post's editor, drop it into the same repeater in another
 * post's editor, and it is copied. HTML5 drag cannot cross a frame boundary and
 * has no programmatic cancel; the shell's manager does both.
 *
 * **Nothing here submits a form input.** A container owns a JSON value and
 * writes the whole thing through `set()`. That is why a repeater can add,
 * remove, reorder and nest without ever renaming an input — the bug that makes
 * hand-rolled repeaters lose row four when you delete row two.
 *
 * Keyboard parity is not optional: Alt+↑ and Alt+↓ move a row, so dragging is
 * never the only way to do anything.
 */

import { button, clear, el, icon, t, uid } from './helpers';
import { buildPayload, dragManager, insertionIndex, startDrag } from '../dnd';
import { config } from '../api';
import { registerMount } from './mount';
import { addLabel, renderField } from './render';
import type { MountContext } from './mount';
import type { Field } from '../types';
import type { RenderedField } from './render';

/** A flexible-content layout, as PHP ships it. */
interface Layout {
	key: string;
	name: string;
	label: string;
	display: string;
	min: number;
	max: number;
	sub_fields: Field[];
}

/** Reads the sub-field definitions PHP attached to the mount. */
function subsOf( host: HTMLElement ): Field[] {
	return parse< Field[] >( host.closest< HTMLElement >( '.atcf-mount' )?.dataset.atcfSubs, [] );
}

/** Reads the layout definitions PHP attached to the mount. */
function layoutsOf( host: HTMLElement ): Layout[] {
	return parse< Layout[] >( host.closest< HTMLElement >( '.atcf-mount' )?.dataset.atcfSubs, [] );
}

function parse< T >( raw: string | undefined, fallback: T ): T {
	if ( ! raw ) {
		return fallback;
	}

	try {
		return JSON.parse( raw ) as T;
	} catch {
		return fallback;
	}
}

registerMount( 'repeater', ( context ) => repeater( context, subsOf( context.host ) ) );

registerMount( 'group', ( context ) => single( context, subsOf( context.host ) ) );

registerMount( 'clone', ( context ) => single( context, subsOf( context.host ) ) );

registerMount( 'flexible_content', ( context ) => flexible( context, layoutsOf( context.host ) ) );

/**
 * A group or a clone: one row, no chrome.
 *
 * Rendered as a plain nested field list rather than as a one-row repeater,
 * because a group is not a list of one — it is a set of fields that belong
 * together, and giving it a row handle and a remove button would offer two
 * actions that mean nothing.
 *
 * @param context The mount.
 * @param subs    Its sub-fields.
 */
function single( context: MountContext, subs: Field[] ): () => void {
	const values = ( context.value ?? {} ) as Record< string, unknown >;
	const box = el( 'div', { class: 'atcf-group' } );
	const rendered: RenderedField[] = [];

	subs.forEach( ( sub ) => {
		const field = renderField( sub, values[ sub.key ], ( value ) => {
			values[ sub.key ] = value;
			context.set( { ...values } );
			relayout();
		} );

		rendered.push( field );
		box.append( field.element );
	} );

	const relayout = () => rendered.forEach( ( one ) => one.applyLogic( values ) );

	context.host.append( box );
	relayout();

	return () => rendered.forEach( ( one ) => one.destroy() );
}

/**
 * The repeater.
 *
 * @param context The mount.
 * @param subs    Its sub-fields.
 */
function repeater( context: MountContext, subs: Field[] ): () => void {
	const settings = context.field.settings as { min_items?: number; max_items?: number; layout?: string };
	const min = Number( settings.min_items ?? 0 );
	const max = Number( settings.max_items ?? 0 );

	let rows: Array< Record< string, unknown > > = Array.isArray( context.value )
		? ( context.value as Array< Record< string, unknown > > )
		: [];

	const list = el( 'div', { class: `atcf-rows atcf-rows--${ settings.layout ?? 'block' }` } );
	const foot = el( 'div', { class: 'atcf-rows__foot' } );
	const teardowns: Array< () => void > = [];

	const commit = () => {
		context.set( rows.map( ( row ) => ( { ...row } ) ) );
		draw();
	};

	const blankRow = (): Record< string, unknown > => {
		const row: Record< string, unknown > = {};

		subs.forEach( ( sub ) => {
			row[ sub.key ] = ( sub.settings as { default_value?: unknown } ).default_value ?? '';
		} );

		return row;
	};

	const move = ( from: number, to: number ) => {
		if ( to < 0 || to >= rows.length || from === to ) {
			return;
		}

		const [ moved ] = rows.splice( from, 1 );

		rows.splice( to, 0, moved );
		commit();
	};

	const draw = () => {
		teardowns.splice( 0 ).forEach( ( fn ) => fn() );
		clear( list );
		clear( foot );

		rows.forEach( ( row, index ) => {
			list.append( drawRow( row, index ) );
		} );

		if ( ! rows.length ) {
			list.append( el( 'p', { class: 'atcf-rows__empty', text: t( 'empty', 'Nothing here yet.' ) } ) );
		}

		if ( ! max || rows.length < max ) {
			foot.append(
				button( addLabel( context.field.settings as Record< string, unknown > ), {
					class: 'atcf-rows__add',
					on: {
						click: () => {
							rows.push( blankRow() );
							commit();
						},
					},
				} )
			);
		}

		if ( max ) {
			foot.append(
				el( 'span', {
					class: 'atcf-rows__count',
					text: t( 'rowsRemaining', '%d left' ).replace( '%d', String( Math.max( 0, max - rows.length ) ) ),
				} )
			);
		}
	};

	const drawRow = ( row: Record< string, unknown >, index: number ): HTMLElement => {
		const rowId = uid( 'atcf-row' );
		const body = el( 'div', { class: 'atcf-row__body' } );
		const rendered: RenderedField[] = [];

		subs.forEach( ( sub ) => {
			const field = renderField( sub, row[ sub.key ], ( value ) => {
				row[ sub.key ] = value;
				context.set( rows.map( ( one ) => ( { ...one } ) ) );
				rendered.forEach( ( one ) => one.applyLogic( row ) );
			} );

			rendered.push( field );
			body.append( field.element );
		} );

		rendered.forEach( ( one ) => one.applyLogic( row ) );
		teardowns.push( () => rendered.forEach( ( one ) => one.destroy() ) );

		const handle = el( 'button', {
			class: 'atcf-row__handle',
			attrs: {
				type: 'button',
				'aria-label': `${ t( 'moveUp', 'Move up' ) } / ${ t( 'moveDown', 'Move down' ) }`,
				'aria-describedby': rowId,
			},
			children: [ icon( 'dashicons-menu' ) ],
		} );

		// Keyboard parity. Alt is used rather than a bare arrow so the handle
		// still scrolls the page when somebody is simply reading with the
		// keyboard, which a bare arrow would swallow.
		handle.addEventListener( 'keydown', ( event ) => {
			const key = ( event as KeyboardEvent ).key;

			if ( ! ( event as KeyboardEvent ).altKey ) {
				return;
			}

			if ( key === 'ArrowUp' ) {
				event.preventDefault();
				move( index, index - 1 );
			}

			if ( key === 'ArrowDown' ) {
				event.preventDefault();
				move( index, index + 1 );
			}
		} );

		const element = el( 'div', {
			class: 'atcf-row',
			attrs: { id: rowId },
			dataset: { index: String( index ) },
			children: [
				el( 'div', {
					class: 'atcf-row__bar',
					children: [
						handle,
						el( 'span', { class: 'atcf-row__number', text: String( index + 1 ) } ),
						el( 'button', {
							class: 'atcf-row__remove',
							text: '×',
							attrs: {
								type: 'button',
								'aria-label': t( 'remove', 'Remove' ),
								disabled: rows.length <= min ? true : null,
							},
							on: {
								click: () => {
									rows.splice( index, 1 );
									commit();
								},
							},
						} ),
					],
				} ),
				body,
			],
		} );

		handle.addEventListener( 'pointerdown', ( event ) => {
			const ghost = el( 'div', { class: 'atcf-drag-ghost atcf-drag-ghost--row', text: `${ index + 1 }` } );

			startDrag( event as PointerEvent, {
				payload: buildPayload(
					config().dragTypes.value,
					element,
					{ kind: 'repeater-row', field: context.field.key, index, row: { ...row } },
					event as PointerEvent,
					ghost
				),
				origin: event as PointerEvent,
				onCancel: () => undefined,
			} );
		} );

		return element;
	};

	// On the mount host rather than on `list`, and with a stable id. `list` is
	// emptied and refilled on every change, so a target bound to it stops being
	// in the DOM the first time a row is added — and the shell's hit-test, which
	// walks up from the pointer and stops at `.os-window`, then finds nothing.
	//
	// Nesting still resolves correctly: the registry picks the *deepest*
	// registered ancestor, so a repeater inside a repeater claims its own drops.
	dragManager().registerDropTarget( {
		id: `allterrain-fields/repeater/${ context.field.key }`,
		element: context.host,
		accept: ( payload ) =>
			payload.type === config().dragTypes.value &&
			( payload.data as { kind?: string } ).kind === 'repeater-row',
		onDrop: ( session, point ) => {
			const data = session.payload.data as { field?: string; index?: number; row?: Record< string, unknown > };
			const target = insertionIndex( list, '.atcf-row', point.clientY );

			// From this repeater: a move. From another one — another window,
			// another post — a copy, because the row is still in the field it
			// came from and removing it there is not something a drop into a
			// different document should be able to do.
			if ( data.field === context.field.key && typeof data.index === 'number' ) {
				move( data.index, Math.min( target, rows.length - 1 ) );

				return;
			}

			if ( max && rows.length >= max ) {
				return;
			}

			rows.splice( Math.min( target, rows.length ), 0, { ...( data.row ?? {} ) } );
			commit();
		},
	} );

	// Seeded to the minimum on first render, so a repeater that requires two
	// rows opens with two rather than with a validation error nobody triggered.
	while ( rows.length < min ) {
		rows.push( blankRow() );
	}

	context.host.append( list, foot );
	draw();

	return () => teardowns.splice( 0 ).forEach( ( fn ) => fn() );
}

/**
 * Flexible content.
 *
 * A repeater whose rows can each be a different shape. The only real difference
 * is that adding a row asks *which* shape first — so the Add button is a menu,
 * and a row remembers its layout under the `atcf_layout` key, the same key
 * every template loop and `get_row_layout()` switches on.
 *
 * @param context The mount.
 * @param layouts The layouts it offers.
 */
function flexible( context: MountContext, layouts: Layout[] ): () => void {
	const settings = context.field.settings as { max_items?: number };
	const max = Number( settings.max_items ?? 0 );

	let rows: Array< Record< string, unknown > > = Array.isArray( context.value )
		? ( context.value as Array< Record< string, unknown > > )
		: [];

	const list = el( 'div', { class: 'atcf-rows atcf-rows--flexible' } );
	const foot = el( 'div', { class: 'atcf-rows__foot' } );
	const teardowns: Array< () => void > = [];

	const layoutFor = ( name: string ) => layouts.find( ( one ) => one.name === name );

	const commit = () => {
		context.set( rows.map( ( row ) => ( { ...row } ) ) );
		draw();
	};

	const draw = () => {
		teardowns.splice( 0 ).forEach( ( fn ) => fn() );
		clear( list );
		clear( foot );

		rows.forEach( ( row, index ) => {
			const layout = layoutFor( String( row.atcf_layout ?? '' ) );

			if ( ! layout ) {
				// A row naming a layout that has since been deleted. Kept and
				// labelled rather than dropped: deleting somebody's content
				// because their content model changed is not a decision a render
				// pass gets to make.
				list.append(
					el( 'div', {
						class: 'atcf-row atcf-row--orphan',
						children: [
							el( 'p', { text: `${ String( row.atcf_layout ?? '?' ) } — this block no longer exists` } ),
							button( t( 'remove', 'Remove' ), {
								on: {
									click: () => {
										rows.splice( index, 1 );
										commit();
									},
								},
							} ),
						],
					} )
				);

				return;
			}

			const body = el( 'div', { class: 'atcf-row__body' } );
			const rendered: RenderedField[] = [];

			layout.sub_fields.forEach( ( sub ) => {
				const field = renderField( sub, row[ sub.key ], ( value ) => {
					row[ sub.key ] = value;
					context.set( rows.map( ( one ) => ( { ...one } ) ) );
					rendered.forEach( ( one ) => one.applyLogic( row ) );
				} );

				rendered.push( field );
				body.append( field.element );
			} );

			rendered.forEach( ( one ) => one.applyLogic( row ) );
			teardowns.push( () => rendered.forEach( ( one ) => one.destroy() ) );

			list.append(
				el( 'div', {
					class: 'atcf-row',
					dataset: { index: String( index ) },
					children: [
						el( 'div', {
							class: 'atcf-row__bar',
							children: [
								el( 'span', { class: 'atcf-row__layout', text: layout.label } ),
								el( 'button', {
									class: 'atcf-row__move',
									text: '↑',
									attrs: { type: 'button', 'aria-label': t( 'moveUp', 'Move up' ) },
									on: {
										click: () => {
											if ( index > 0 ) {
												const [ moved ] = rows.splice( index, 1 );

												rows.splice( index - 1, 0, moved );
												commit();
											}
										},
									},
								} ),
								el( 'button', {
									class: 'atcf-row__move',
									text: '↓',
									attrs: { type: 'button', 'aria-label': t( 'moveDown', 'Move down' ) },
									on: {
										click: () => {
											if ( index < rows.length - 1 ) {
												const [ moved ] = rows.splice( index, 1 );

												rows.splice( index + 1, 0, moved );
												commit();
											}
										},
									},
								} ),
								el( 'button', {
									class: 'atcf-row__remove',
									text: '×',
									attrs: { type: 'button', 'aria-label': t( 'remove', 'Remove' ) },
									on: {
										click: () => {
											rows.splice( index, 1 );
											commit();
										},
									},
								} ),
							],
						} ),
						body,
					],
				} )
			);
		} );

		if ( ! rows.length ) {
			list.append( el( 'p', { class: 'atcf-rows__empty', text: t( 'empty', 'Nothing here yet.' ) } ) );
		}

		if ( max && rows.length >= max ) {
			return;
		}

		const menu = el( 'div', { class: 'atcf-layouts' } );

		layouts.forEach( ( layout ) => {
			const used = rows.filter( ( row ) => row.atcf_layout === layout.name ).length;

			menu.append(
				button( layout.label, {
					class: 'atcf-layouts__add',
					attrs: { disabled: layout.max > 0 && used >= layout.max ? true : null },
					on: {
						click: () => {
							const row: Record< string, unknown > = { atcf_layout: layout.name };

							layout.sub_fields.forEach( ( sub ) => {
								row[ sub.key ] = ( sub.settings as { default_value?: unknown } ).default_value ?? '';
							} );

							rows.push( row );
							commit();
						},
					},
				} )
			);
		} );

		foot.append( el( 'p', { class: 'atcf-layouts__label', text: t( 'chooseLayout', 'Choose a block' ) } ), menu );
	};

	context.host.append( list, foot );
	draw();

	return () => teardowns.splice( 0 ).forEach( ( fn ) => fn() );
}
