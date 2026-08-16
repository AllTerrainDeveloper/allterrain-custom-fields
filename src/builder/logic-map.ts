/**
 * The logic map — curves drawn from a field to the fields it controls.
 *
 * A badge tells you a field has a condition and nothing about what it is. The
 * chips on each card fixed half of that: they say what the condition *is*. This
 * fixes the other half, which is what the group's *shape* is.
 *
 * A group where three questions depend on the first one has a structure. A flat
 * list is not showing it, and neither is a badge. A curve from the controller to
 * each of the three, labelled with the answer that triggers it, turns *"what
 * does this field affect?"* from a search into a glance.
 *
 * Hovering a card dims every curve it does not touch, which is the whole
 * interaction — nothing is clickable here, because the cards underneath already
 * are and a second click target on top of them would only steal the first.
 *
 * Formula edges are drawn too, dashed. A computed field reading `{price}` is as
 * much a dependency as a condition is, and it was previously the only one
 * nothing visualised at all.
 */

import { variables } from '../shared/calc';
import type { Field } from '../types';

/**
 * How much room the canvas leaves for the curves, in pixels.
 *
 * Kept in step with `padding-inline-start` on `.atcfb__canvas`. Two numbers that
 * have to agree, which is one more than ideal — but the alternative is reading a
 * computed style on every redraw, and this one redraws on every scroll.
 */
const GUTTER = 56;

/** One curve to draw. */
interface Edge {
	from: string;
	to: string;
	label: string;
	kind: 'condition' | 'formula';
}

/**
 * Draws the map over a canvas.
 *
 * The SVG is positioned over the card list and is `pointer-events: none`
 * throughout, so it never intercepts a click meant for a card underneath.
 *
 * @param canvas The element holding the cards.
 * @param fields The fields on it.
 * @return A teardown.
 */
export function renderLogicMap( canvas: HTMLElement, fields: Field[] ): () => void {
	canvas.querySelector( '.atcfb__map' )?.remove();

	const edges = edgesOf( fields );

	if ( ! edges.length ) {
		return () => undefined;
	}

	const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );

	svg.setAttribute( 'class', 'atcfb__map' );
	svg.setAttribute( 'aria-hidden', 'true' );

	canvas.style.position = canvas.style.position || 'relative';
	canvas.append( svg );

	const draw = () => {
		while ( svg.firstChild ) {
			svg.removeChild( svg.firstChild );
		}

		const bounds = canvas.getBoundingClientRect();

		svg.setAttribute( 'width', String( bounds.width ) );
		svg.setAttribute( 'height', String( canvas.scrollHeight ) );
		svg.setAttribute( 'viewBox', `0 0 ${ bounds.width } ${ canvas.scrollHeight }` );

		edges.forEach( ( edge ) => {
			const from = cardOf( canvas, edge.from );
			const to = cardOf( canvas, edge.to );

			if ( ! from || ! to ) {
				return;
			}

			const a = from.getBoundingClientRect();
			const b = to.getBoundingClientRect();

			// Coordinates relative to the canvas, including its scroll. Using
			// viewport coordinates directly puts every curve in the wrong place
			// the moment the list is scrolled — which is always, because a group
			// with enough fields to need this map is a group that scrolls.
			//
			// `GUTTER` is the canvas's own left padding, in `builder.css`. The
			// curves live entirely inside it: anchored just left of the cards and
			// bowing no further than the padding allows. Bowing past it draws a
			// squiggle hanging outside the pane, which reads as a rendering bug
			// rather than as a relationship.
			const x1 = GUTTER - 8;
			const y1 = a.top - bounds.top + canvas.scrollTop + a.height / 2;
			const x2 = GUTTER - 8;
			const y2 = b.top - bounds.top + canvas.scrollTop + b.height / 2;

			// A leftward bow whose depth grows with the distance between the two
			// cards, so adjacent fields get a shallow tick and distant ones get a
			// curve that is visibly going somewhere — capped so it stays home.
			const bow = Math.min( GUTTER - 18, 12 + Math.abs( y2 - y1 ) * 0.10 );

			const path = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );

			path.setAttribute( 'd', `M ${ x1 } ${ y1 } C ${ x1 - bow } ${ y1 }, ${ x2 - bow } ${ y2 }, ${ x2 } ${ y2 }` );
			path.setAttribute( 'class', `atcfb__edge atcfb__edge--${ edge.kind }` );
			path.dataset.from = edge.from;
			path.dataset.to = edge.to;

			svg.append( path );

			// A label only when the two cards are far enough apart to have room
			// for one. Squeezing text between two adjacent curves produces an
			// overlap that is harder to read than no label at all.
			if ( edge.label && Math.abs( y2 - y1 ) > 44 ) {
				const text = document.createElementNS( 'http://www.w3.org/2000/svg', 'text' );

				text.setAttribute( 'class', 'atcfb__edge-label' );
				// Centred in the gutter, not hung off the bow. A label positioned
				// relative to the curve's own depth escapes the pane as soon as
				// the text is longer than the bow is deep — and the answers people
				// write into a rule are things like "No, back-ordered".
				text.setAttribute( 'x', String( GUTTER / 2 ) );
				text.setAttribute( 'y', String( ( y1 + y2 ) / 2 ) );
				text.textContent = shorten( edge.label );
				text.dataset.from = edge.from;
				text.dataset.to = edge.to;

				svg.append( text );
			}
		} );
	};

	const highlight = ( key: string | null ) => {
		svg.classList.toggle( 'is-focused', Boolean( key ) );

		svg.querySelectorAll< SVGElement >( '[data-from]' ).forEach( ( node ) => {
			const touches = ! key || node.dataset.from === key || node.dataset.to === key;

			node.classList.toggle( 'is-dim', ! touches );
		} );
	};

	const onOver = ( event: Event ) => {
		const card = ( event.target as HTMLElement | null )?.closest< HTMLElement >( '[data-atcf-card]' );

		highlight( card?.dataset.atcfCard ?? null );
	};

	const onOut = ( event: Event ) => {
		if ( ! canvas.contains( ( event as MouseEvent ).relatedTarget as Node | null ) ) {
			highlight( null );
		}
	};

	canvas.addEventListener( 'pointerover', onOver );
	canvas.addEventListener( 'pointerout', onOut );

	// Redrawn on resize *and* on scroll: the curves are absolutely positioned
	// against the canvas, and both change where the cards are.
	const observer = new ResizeObserver( draw );

	observer.observe( canvas );
	canvas.addEventListener( 'scroll', draw, { passive: true } );

	draw();

	return () => {
		observer.disconnect();
		canvas.removeEventListener( 'pointerover', onOver );
		canvas.removeEventListener( 'pointerout', onOut );
		canvas.removeEventListener( 'scroll', draw );
		svg.remove();
	};
}

/**
 * Trims a label to what fits in the gutter.
 *
 * The curve's job is to show *structure* — that this field controls that one.
 * The card's own chips already carry the answer in full, so a truncated label
 * here loses nothing: it is a reminder of which of several rules this line is,
 * not the rule itself.
 *
 * @param label The rule's value.
 * @return At most nine characters.
 */
function shorten( label: string ): string {
	return label.length > 9 ? `${ label.slice( 0, 8 ) }…` : label;
}

/** Every dependency between fields in a group. */
function edgesOf( fields: Field[] ): Edge[] {
	const byName = new Map( fields.map( ( field ) => [ field.name, field.key ] ) );
	const edges: Edge[] = [];

	fields.forEach( ( field ) => {
		if ( field.conditional?.enabled ) {
			field.conditional.rules.forEach( ( rule ) => {
				if ( ! rule.field ) {
					return;
				}

				edges.push( {
					from: rule.field,
					to: field.key,
					// The answer that triggers it, which is the whole reason the
					// curve is labelled — "shown when Attending" says more than
					// an unlabelled line ever could.
					label: Array.isArray( rule.value ) ? rule.value.join( ', ' ) : String( rule.value ?? '' ),
					kind: 'condition',
				} );
			} );
		}

		if ( field.type === 'computed' ) {
			variables( String( ( field.settings as { formula?: string } ).formula ?? '' ) ).forEach( ( name ) => {
				const key = byName.get( name );

				if ( key ) {
					edges.push( { from: key, to: field.key, label: '', kind: 'formula' } );
				}
			} );
		}
	} );

	return edges;
}

/** The card element for a field key. */
function cardOf( canvas: HTMLElement, key: string ): HTMLElement | null {
	return canvas.querySelector< HTMLElement >( `[data-atcf-card="${ CSS.escape( key ) }"]` );
}
