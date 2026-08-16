/**
 * The field palette.
 *
 * A list of every registered field type, grouped, each one draggable onto the
 * canvas — and each one also a `<button>` that adds it where a drag would have.
 *
 * That second half is not a fallback. Dragging is never the only way to do
 * anything here: somebody using a keyboard, a screen reader, a trackpad they
 * find hard to hold a drag on, or a touch screen where a long-press means
 * something else, all reach the same feature by pressing Enter. A builder where
 * the primary gesture is the only gesture is a builder half the people who need
 * it cannot use.
 *
 * The palette is built from `/config`, which is built from the PHP registry. A
 * plugin that registers a field type appears here with no further work, which is
 * the whole point of having a registry rather than a list.
 */

import { clear, el, icon, uid } from '../ui';
import { buildPayload, startDrag } from '../dnd';
import { config } from '../api';
import type { FieldType } from '../types';

/** What the palette needs to know. */
export interface PaletteOptions {
	types: FieldType[];
	groups: Record< string, string >;
	/** Called when a type is chosen without a drag. */
	onAdd: ( type: FieldType ) => void;
}

/**
 * Draws the palette into a host.
 *
 * @param host What to fill.
 * @param opts The types and what to do with them.
 * @return A function that filters the list by a search term.
 */
export function renderPalette( host: HTMLElement, opts: PaletteOptions ): ( query: string ) => void {
	clear( host );

	const searchId = uid( 'atcf-palette-search' );
	const search = el( 'input', {
		class: 'atcfb__palette-search',
		attrs: { type: 'search', id: searchId, placeholder: 'Search fields', 'aria-label': 'Search field types' },
	} ) as HTMLInputElement;

	const list = el( 'div', { class: 'atcfb__palette-list' } );

	host.append( search, list );

	const draw = ( query: string ) => {
		clear( list );

		const needle = query.trim().toLowerCase();
		const matching = opts.types.filter(
			( type ) =>
				! needle ||
				type.label.toLowerCase().includes( needle ) ||
				type.type.includes( needle ) ||
				type.description.toLowerCase().includes( needle )
		);

		if ( ! matching.length ) {
			list.append( el( 'p', { class: 'atcfb__palette-empty', text: 'Nothing matched.' } ) );

			return;
		}

		// Grouped in the order PHP declared, and a group with nothing left in it
		// after a search simply does not appear — a heading over an empty list
		// reads as a broken filter.
		Object.entries( opts.groups ).forEach( ( [ slug, label ] ) => {
			const inGroup = matching.filter( ( type ) => type.group === slug );

			if ( ! inGroup.length ) {
				return;
			}

			const section = el( 'div', { class: 'atcfb__palette-group' } );

			section.append( el( 'h3', { class: 'atcfb__palette-heading', text: label } ) );

			inGroup.forEach( ( type ) => section.append( paletteItem( type, opts.onAdd ) ) );

			list.append( section );
		} );

		// Types whose group nothing declared. Shown rather than hidden: a plugin
		// that typos its group name should see its field type in an "Other"
		// heading, not lose it silently.
		const ungrouped = matching.filter( ( type ) => ! ( type.group in opts.groups ) );

		if ( ungrouped.length ) {
			const section = el( 'div', { class: 'atcfb__palette-group' } );

			section.append( el( 'h3', { class: 'atcfb__palette-heading', text: 'Other' } ) );
			ungrouped.forEach( ( type ) => section.append( paletteItem( type, opts.onAdd ) ) );
			list.append( section );
		}
	};

	search.addEventListener( 'input', () => draw( search.value ) );

	draw( '' );

	return draw;
}

/**
 * One palette entry.
 *
 * A `<button>`, so it is focusable, activates on Enter and Space, and announces
 * itself as something that does a thing. The drag is layered on top of that
 * rather than replacing it.
 *
 * @param type  The field type.
 * @param onAdd What to do when it is chosen.
 * @return The element.
 */
function paletteItem( type: FieldType, onAdd: ( type: FieldType ) => void ): HTMLElement {
	const item = el( 'button', {
		class: 'atcfb__palette-item',
		attrs: { type: 'button', title: type.description, 'data-atcf-palette-type': type.type },
		children: [
			icon( type.icon, { class: 'atcfb__palette-icon' } ),
			el( 'span', { class: 'atcfb__palette-label', text: type.label } ),
		],
	} );

	item.addEventListener( 'pointerdown', ( event ) => {
		const ghost = el( 'div', {
			class: 'atcf-drag-ghost atcf-drag-ghost--field',
			children: [ icon( type.icon ), el( 'span', { text: type.label } ) ],
		} );

		startDrag( event, {
			payload: buildPayload(
				config().dragTypes.field,
				item,
				{ kind: 'new', type: type.type, label: type.label, icon: type.icon },
				event,
				ghost
			),
			origin: event,
			// A press that never travelled far enough to be a drag is a click,
			// and the click adds the field. Handling it here rather than with a
			// `click` listener is what stops a completed drag *also* adding one.
			onClickOnly: () => onAdd( type ),
			onCancel: () => undefined,
		} );
	} );

	// Keyboard activation, which never goes through the pointer path at all.
	item.addEventListener( 'keydown', ( event ) => {
		if ( event.key === 'Enter' || event.key === ' ' ) {
			event.preventDefault();
			onAdd( type );
		}
	} );

	return item;
}
