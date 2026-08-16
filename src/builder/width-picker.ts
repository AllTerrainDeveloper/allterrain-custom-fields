/**
 * How wide a field is, said in a way somebody can answer.
 *
 * The card used to print `33%` in the corner and stop there. That is a fact, not
 * an answer — a person looking at it has to know that the edit screen is a
 * twelve-hundred-pixel flex row, that widths are per cent of it, that fields
 * wrap when they overflow, and therefore that three 33% fields make one line. It
 * also could not be changed: the number was text, and the only way to alter it
 * was to select the card, open **Advanced** in the inspector, and find a number
 * box.
 *
 * So the width is drawn as **the width**. Six proportions, each a bar of that
 * proportion, with the fraction under it. Pressing one sets it. What a field
 * will do on the row is legible at a glance without knowing anything about how
 * the row works, which is the whole difference between a control and a readout.
 *
 * ## Why these six
 *
 * They are the ones that tile. Twelfths would be more expressive and less
 * useful: the point of a width is that it lines up with its neighbours, and a
 * list where every value divides into a row is a list where every choice
 * produces a tidy result. A field that genuinely needs 37% can still have it —
 * the inspector's number box is still there, and a value that matches none of
 * these lights none of them and is shown as it is.
 */

import { el } from '../ui';

/** The proportions offered, in order. */
export const WIDTHS: Array< { value: number; label: string; title: string } > = [
	{ value: 25, label: '¼', title: 'A quarter of the row — four fit side by side' },
	{ value: 33, label: '⅓', title: 'A third of the row — three fit side by side' },
	{ value: 50, label: '½', title: 'Half the row — two fit side by side' },
	{ value: 66, label: '⅔', title: 'Two thirds of the row' },
	{ value: 75, label: '¾', title: 'Three quarters of the row' },
	{ value: 100, label: 'Full', title: 'The whole row to itself' },
];

/**
 * Draws the picker.
 *
 * @param width    The field's current width, as a percentage.
 * @param onChange Called with the chosen width; absent makes it a readout.
 * @return The element.
 */
export function renderWidthPicker( width: number, onChange?: ( value: number ) => void ): HTMLElement {
	const current = width || 100;

	const wrap = el( 'div', {
		class: 'atcfb__width',
		attrs: { role: onChange ? 'radiogroup' : 'group', 'aria-label': 'How wide this field is' },
	} );

	wrap.append( el( 'span', { class: 'atcfb__width-legend', text: 'Width' } ) );

	WIDTHS.forEach( ( option ) => {
		const chosen = option.value === current;

		const button = el( onChange ? 'button' : 'span', {
			class: `atcfb__width-option${ chosen ? ' is-chosen' : '' }`,
			attrs: {
				...( onChange
					? { type: 'button', role: 'radio', 'aria-checked': chosen ? 'true' : 'false' }
					: {} ),
				title: option.title,
			},
			children: [
				// The bar *is* the explanation. A row-wide track with the field's
				// share filled in says "three of these fit" without the sentence.
				el( 'span', {
					class: 'atcfb__width-bar',
					children: [
						el( 'span', {
							class: 'atcfb__width-fill',
							style: { inlineSize: `${ option.value }%` } as Record< string, string >,
						} ),
					],
				} ),
				el( 'span', { class: 'atcfb__width-label', text: option.label } ),
			],
		} );

		if ( onChange ) {
			button.addEventListener( 'click', ( event ) => {
				event.stopPropagation();
				onChange( option.value );
			} );
		}

		wrap.append( button );
	} );

	// A width somebody set by hand that matches none of the six. Shown rather
	// than silently rounded to the nearest — the number is what the field will
	// actually be, and a picker that lied about it would be worse than a number.
	if ( ! WIDTHS.some( ( one ) => one.value === current ) ) {
		wrap.append( el( 'span', { class: 'atcfb__width-custom', text: `${ current }%` } ) );
	}

	return wrap;
}
