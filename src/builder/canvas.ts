/**
 * The canvas — the fields in the group, in order.
 *
 * A card per field. Cards drag to reorder, drag into a container to nest, and —
 * the part that needs a desktop — drag **into a second builder window** to be
 * copied into another field group. Two windows side by side, drag a field from
 * one to the other: that is the gesture, and it is not reachable from a browser
 * tab because there is no second tab to drop into.
 *
 * Every card also states what it is joined to. A field with a condition says so
 * on its face, and `logic-map.ts` draws a curve from the field that controls it
 * — because a group where three fields depend on the first one *has* a
 * structure, and a flat list is not showing it.
 *
 * Keyboard parity throughout: Alt+↑/↓ moves a card, Enter selects it, Delete
 * removes it. Dragging is never the only way to do anything.
 */

import { button, clear, el, icon, uid } from '../ui';
import { editable, renderFieldPreview } from './field-preview';
import { renderWidthPicker } from './width-picker';
import { buildPayload, dragManager, insertionIndex, startDrag } from '../dnd';
import { config } from '../api';
import { variables } from '../shared/calc';
import type { Field, FieldType } from '../types';

/** What the canvas needs. */
export interface CanvasOptions {
	fields: Field[];
	types: Record< string, FieldType >;
	selected: string;
	onSelect: ( key: string ) => void;
	onMove: ( key: string, index: number ) => void;
	onAdd: ( type: string, index: number, parent?: string ) => void;
	onDrop: ( field: Field, index: number ) => void;
	onRemove: ( key: string ) => void;
	onDuplicate: ( key: string ) => void;
	/** Opens the formula editor for a computed field, straight from its card. */
	onEditFormula?: ( key: string ) => void;
	/** A label was rewritten on the card itself. */
	onLabel?: ( key: string, value: string ) => void;
	/** A hint was rewritten on the card itself. */
	onInstructions?: ( key: string, value: string ) => void;
	/** A setting was rewritten on the card — a placeholder, a button's wording. */
	onSetting?: ( key: string, setting: string, value: unknown ) => void;
	/** The choices changed shape on the card. Redraws. */
	onChoices?: ( key: string, choices: Array< { value: string; label: string } > ) => void;
	/** The meta key was rewritten on the card. Corrected and redrawn. */
	onName?: ( key: string, value: string ) => void;
	/** A width was chosen on the card. */
	onWidth?: ( key: string, value: number ) => void;
}

/**
 * Draws the canvas.
 *
 * Rebuilt wholesale on every change rather than diffed. A field group is tens of
 * cards, the whole rebuild is one paint, and a diffing implementation of
 * something this size is where the reorder bugs live — the class of bug where
 * the DOM and the array disagree about which card is which and every subsequent
 * move is wrong.
 *
 * It draws and nothing else. The drop target is registered separately and
 * **once**, by {@see registerCanvasTarget()} — see the note there for why.
 *
 * @param host What to fill.
 * @param opts The fields and what to do with them.
 */
export function renderCanvas( host: HTMLElement, opts: CanvasOptions ): void {
	clear( host );

	const list = el( 'div', { class: 'atcfb__cards', attrs: { role: 'list' } } );

	if ( ! opts.fields.length ) {
		list.append(
			el( 'div', {
				class: 'atcfb__empty',
				children: [
					icon( 'dashicons-plus-alt2' ),
					el( 'p', { text: 'Drag a field from the palette, or press one to add it here.' } ),
				],
			} )
		);
	}

	opts.fields.forEach( ( field, index ) => {
		list.append( card( field, index, opts ) );
	} );

	host.append( list );
}

/**
 * Registers the canvas as a drop target. Once, for the life of the builder.
 *
 * Two things here are load-bearing, and both were originally wrong.
 *
 * **The target is the scrollable pane, not the card list.** OpenStation's
 * registry hit-tests by walking up from `elementFromPoint` looking for a
 * registered element — and it *stops at `.os-window`* if it has not found one,
 * so that a drop over a window never falls through to the wallpaper. The card
 * list is only as tall as its cards, so once the group had a single field,
 * dropping anywhere in the empty space below it hit the pane instead, the walk
 * reached the window boundary, and the drop was discarded without a sound. The
 * first drop of a session worked, and no drop after it ever did.
 *
 * **It is registered once, not on every redraw.** The canvas is rebuilt
 * wholesale whenever anything changes, and re-registering a target whose element
 * has just been replaced means unregistering and re-adding inside the manager's
 * own commit path. Registering the stable pane and reading the current state
 * through `getOptions()` removes that churn entirely.
 *
 * @param host       The scrollable canvas pane. Must outlive the cards.
 * @param getOptions Reads the live options at drop time, not at registration.
 * @return A teardown.
 */
export function registerCanvasTarget( host: HTMLElement, getOptions: () => CanvasOptions ): () => void {
	return dragManager().registerDropTarget( {
		// Stable, so the shell's registry replaces in place rather than
		// accumulating one dead entry per redraw.
		id: 'allterrain-fields/canvas',
		element: host,
		accept: ( payload ) => payload.type === config().dragTypes.field,
		onEnter: () => host.classList.add( 'is-drop-target' ),
		onLeave: () => host.classList.remove( 'is-drop-target' ),
		onDrop: ( session, point ) => {
			host.classList.remove( 'is-drop-target' );

			const opts = getOptions();
			const list = host.querySelector< HTMLElement >( '.atcfb__cards' ) ?? host;
			const data = session.payload.data as { kind?: string; type?: string; field?: Field; key?: string };
			const index = insertionIndex( list, '.atcfb__card', point.clientY );

			if ( data.kind === 'new' && data.type ) {
				opts.onAdd( data.type, index );

				return;
			}

			// A card from *this* canvas moves; a card from another window is
			// copied, because the field is still in the group it came from and
			// removing it there is not something a drop into a different
			// document gets to do.
			if ( data.kind === 'existing' && data.key && isOwn( list, data.key ) ) {
				opts.onMove( data.key, index );

				return;
			}

			if ( data.field ) {
				opts.onDrop( data.field, index );
			}
		},
	} );
}

/** Whether a field key belongs to the canvas currently drawn. */
function isOwn( list: HTMLElement, key: string ): boolean {
	return Boolean( list.querySelector( `[data-atcf-card="${ CSS.escape( key ) }"]` ) );
}

/**
 * One field card.
 *
 * @param field The field.
 * @param index Where it currently sits.
 * @param opts  The canvas options.
 * @return The element.
 */
function card( field: Field, index: number, opts: CanvasOptions ): HTMLElement {
	const type = opts.types[ field.type ];
	const selected = opts.selected === field.key;
	const cardId = uid( 'atcf-card' );

	const element = el( 'div', {
		class: `atcfb__card${ selected ? ' is-selected' : '' }${ field.required ? ' is-required' : '' }`,
		attrs: {
			role: 'listitem',
			tabindex: '0',
			id: cardId,
			'aria-current': selected ? 'true' : 'false',
		},
		dataset: { atcfCard: field.key, index: String( index ) },
	} );

	element.append(
		el( 'div', {
			class: 'atcfb__card-main',
			children: [
				icon( type?.icon ?? 'dashicons-editor-code', { class: 'atcfb__card-icon' } ),
				// The type, and nothing else. The label used to be here *and* in
				// the preview below, which is the same words twice — and put the
				// one thing you rewrite most often in the row you cannot type
				// into. It lives in the preview now, editable where it sits.
				el( 'div', {
					class: 'atcfb__card-text',
					children: [
						el( 'span', { class: 'atcfb__card-type', text: type?.label ?? field.type } ),
						// The meta key, editable. It is the string a theme writes in
						// `get_post_meta()`, so it is the one piece of a field a
						// developer changes on purpose — and it was the only text on
						// the card that could not be touched.
						//
						// Corrected on blur rather than per keystroke: typing
						// "Price per" and watching every space become an underscore
						// under the caret is a control that fights you.
						el( 'code', {
							class: 'atcfb__card-name',
							children: [
								editable(
									field.name,
									'meta_key',
									undefined,
									opts.onName && ( ( value ) => opts.onName?.( field.key, value ) )
								),
							],
						} ),
					],
				} ),
				el( 'div', {
					class: 'atcfb__card-actions',
					children: [
						button( 'Duplicate', {
							class: 'atcfb__card-action',
							on: {
								click: ( event ) => {
									event.stopPropagation();
									opts.onDuplicate( field.key );
								},
							},
						} ),
						button( 'Delete', {
							class: 'atcfb__card-action atcfb__card-action--danger',
							on: {
								click: ( event ) => {
									event.stopPropagation();
									opts.onRemove( field.key );
								},
							},
						} ),
					],
				} ),
			],
		} )
	);

	// The field, as it will look — and as somewhere to edit it. The header above
	// says what this *is*: its type and its meta key, the two facts a preview
	// cannot show.
	element.append(
		renderFieldPreview( field, type, {
			onLabel: opts.onLabel && ( ( value ) => opts.onLabel?.( field.key, value ) ),
			onInstructions:
				opts.onInstructions && ( ( value ) => opts.onInstructions?.( field.key, value ) ),
			onSetting: opts.onSetting && ( ( key, value ) => opts.onSetting?.( field.key, key, value ) ),
			onChoices: opts.onChoices && ( ( choices ) => opts.onChoices?.( field.key, choices ) ),
		} )
	);

	// The condition, stated on the card's face rather than hidden behind a
	// badge. `LOGIC` tells you a field has a condition and nothing about what it
	// is; to find out you had to select the field, scroll the inspector and read
	// three dropdowns — and even then you learned about that one field, not
	// about the shape of the group.
	if ( field.conditional?.enabled && field.conditional.rules.length ) {
		element.append( conditionChips( field, opts ) );
	}

	// A computed field's formula names other fields, which makes it an edge in
	// the group's structure exactly as a condition is — and it was previously
	// the only one nothing visualised.
	if ( field.type === 'computed' ) {
		const names = variables( String( ( field.settings as { formula?: string } ).formula ?? '' ) );

		const row = el( 'div', {
			class: 'atcfb__card-condition atcfb__card-condition--formula',
			children: [
				el( 'span', { class: 'atcfb__chip atcfb__chip--kind', text: 'WORKED OUT FROM' } ),
				...( names.length
					? names.map( ( name ) => el( 'span', { class: 'atcfb__chip', text: name } ) )
					: [ el( 'span', { class: 'atcfb__chip atcfb__chip--empty', text: 'nothing yet' } ) ] ),
			],
		} );

		// Straight to the formula from the card.
		//
		// A computed field is the only field whose *definition* is a thing you
		// edit rather than a setting you pick, and getting to it meant selecting
		// the card, finding the Formula row in the inspector, then pressing
		// Editor. Three steps to reach the one thing the field is made of.
		if ( opts.onEditFormula ) {
			row.append(
				button( 'Edit formula', {
					class: 'atcfb__card-formula',
					variant: 'primary',
					on: {
						click: ( event ) => {
							event.stopPropagation();
							opts.onEditFormula?.( field.key );
						},
					},
				} )
			);
		}

		element.append( row );
	}

	// How wide, drawn as a width rather than printed as a number. See
	// `width-picker.ts` — `33%` is a fact, not an answer.
	element.append(
		renderWidthPicker(
			field.wrapper?.width ?? 100,
			opts.onWidth && ( ( value ) => opts.onWidth?.( field.key, value ) )
		)
	);

	element.addEventListener( 'click', () => opts.onSelect( field.key ) );

	element.addEventListener( 'keydown', ( event ) => {
		const key = ( event as KeyboardEvent ).key;

		if ( key === 'Enter' || key === ' ' ) {
			event.preventDefault();
			opts.onSelect( field.key );

			return;
		}

		if ( ( event as KeyboardEvent ).altKey && key === 'ArrowUp' ) {
			event.preventDefault();
			opts.onMove( field.key, Math.max( 0, index - 1 ) );

			return;
		}

		if ( ( event as KeyboardEvent ).altKey && key === 'ArrowDown' ) {
			event.preventDefault();
			opts.onMove( field.key, index + 1 );

			return;
		}

		if ( key === 'Delete' || key === 'Backspace' ) {
			event.preventDefault();
			opts.onRemove( field.key );
		}
	} );

	element.addEventListener( 'pointerdown', ( event ) => {
		const ghost = el( 'div', {
			class: 'atcf-drag-ghost atcf-drag-ghost--field',
			children: [
				icon( type?.icon ?? 'dashicons-editor-code' ),
				el( 'span', { text: field.label || field.name } ),
			],
		} );

		startDrag( event, {
			payload: buildPayload(
				config().dragTypes.field,
				element,
				// The whole field travels, not just its key. That is what lets a
				// card dropped into a *second builder window* be reconstructed
				// there — the receiving window has never heard of this field and
				// cannot look it up.
				{ kind: 'existing', key: field.key, type: field.type, field },
				event,
				ghost
			),
			origin: event,
			onClickOnly: () => opts.onSelect( field.key ),
			onCancel: () => undefined,
		} );
	} );

	return element;
}

/**
 * A field's condition, drawn as separated parts rather than as a sentence.
 *
 * Both the question and the answer are text somebody typed, so the question ends
 * in a question mark and the answer contains a comma — the punctuation a
 * sentence would rely on for structure is *inside the content*. Chips remove the
 * parsing.
 *
 * The question chip is a button that selects that field, and a rule pointing at
 * a deleted field is drawn in red, because that group is genuinely stuck and it
 * was previously invisible.
 *
 * @param field The field with the condition.
 * @param opts  The canvas options.
 * @return The element.
 */
function conditionChips( field: Field, opts: CanvasOptions ): HTMLElement {
	const row = el( 'div', { class: 'atcfb__card-condition' } );

	row.append(
		el( 'span', {
			class: 'atcfb__chip atcfb__chip--kind',
			text: field.conditional.action === 'hide' ? 'HIDDEN WHEN' : 'SHOWN WHEN',
		} )
	);

	field.conditional.rules.forEach( ( rule, index ) => {
		const controller = opts.fields.find( ( one ) => one.key === rule.field );

		if ( index > 0 ) {
			row.append(
				el( 'span', {
					class: 'atcfb__chip atcfb__chip--join',
					text: field.conditional.match === 'any' ? 'or' : 'and',
				} )
			);
		}

		row.append(
			el( 'button', {
				class: `atcfb__chip atcfb__chip--field${ controller ? '' : ' atcfb__chip--broken' }`,
				attrs: { type: 'button' },
				text: controller ? controller.label || controller.name : 'a field that has been deleted',
				on: {
					click: ( event ) => {
						event.stopPropagation();

						if ( controller ) {
							opts.onSelect( controller.key );
						}
					},
				},
			} )
		);

		row.append( el( 'span', { class: 'atcfb__chip atcfb__chip--op', text: humanOperator( rule.operator ) } ) );

		if ( ! [ 'empty', 'not_empty' ].includes( rule.operator ) ) {
			row.append(
				el( 'span', {
					class: 'atcfb__chip atcfb__chip--value',
					text: Array.isArray( rule.value ) ? rule.value.join( ', ' ) : String( rule.value ),
				} )
			);
		}
	} );

	return row;
}

/** A rule operator in words. */
function humanOperator( operator: string ): string {
	const words: Record< string, string > = {
		is: 'is',
		is_not: 'is not',
		contains: 'contains',
		not_contains: 'does not contain',
		starts_with: 'starts with',
		ends_with: 'ends with',
		greater: 'is more than',
		greater_equal: 'is at least',
		less: 'is less than',
		less_equal: 'is at most',
		empty: 'is empty',
		not_empty: 'has any value',
		in: 'is one of',
		not_in: 'is none of',
	};

	return words[ operator ] ?? operator;
}
