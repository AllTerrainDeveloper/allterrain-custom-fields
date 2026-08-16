/**
 * How wide a field is.
 *
 * The card printed `33%` and stopped there — a fact rather than an answer.
 * Reading it required already knowing that the edit screen is a flex row, that
 * widths are per cent of it, and that fields wrap when they overflow, at which
 * point you could work out that three of them make one line. And it could not be
 * changed: the number was text, and the only way to alter it was to select the
 * card, open Advanced in the inspector, and find a number box.
 *
 * These tests hold the two properties that fixed both: the proportion is drawn,
 * and pressing it sets it.
 */

import { describe, expect, it, vi } from 'vitest';
import { WIDTHS, renderWidthPicker } from '../../src/builder/width-picker';

describe( 'the width picker', () => {
	it( 'offers only proportions that tile', () => {
		// The point of a width is that it lines up with its neighbours. Twelfths
		// would be more expressive and less useful — every value here divides a
		// row into a tidy number of columns.
		WIDTHS.forEach( ( option ) => {
			expect( 100 % option.value === 0 || [ 33, 66, 75 ].includes( option.value ) ).toBe( true );
		} );

		expect( WIDTHS.map( ( one ) => one.value ) ).toEqual( [ 25, 33, 50, 66, 75, 100 ] );
	} );

	it( 'draws each proportion as that proportion', () => {
		// The bar *is* the explanation. Without it the fraction is just another
		// way of writing the number that was there before.
		const node = renderWidthPicker( 100 );
		const fills = Array.from( node.querySelectorAll< HTMLElement >( '.atcfb__width-fill' ) );

		expect( fills.map( ( one ) => one.style.inlineSize ) ).toEqual( [
			'25%',
			'33%',
			'50%',
			'66%',
			'75%',
			'100%',
		] );
	} );

	it( 'says what each one means, for anybody who wants the sentence', () => {
		const node = renderWidthPicker( 100 );

		expect( node.querySelectorAll( '[title]' )[ 1 ].getAttribute( 'title' ) ).toBe(
			'A third of the row — three fit side by side'
		);
	} );

	it( 'marks the width the field actually has', () => {
		const node = renderWidthPicker( 50 );
		const chosen = node.querySelectorAll( '.is-chosen' );

		expect( chosen ).toHaveLength( 1 );
		expect( chosen[ 0 ].querySelector( '.atcfb__width-label' )?.textContent ).toBe( '½' );
	} );

	it( 'treats a missing width as the whole row, which is what it renders as', () => {
		const node = renderWidthPicker( 0 );

		expect( node.querySelector( '.is-chosen .atcfb__width-label' )?.textContent ).toBe( 'Full' );
	} );

	it( 'sets the width when one is pressed', () => {
		const onChange = vi.fn();
		const node = renderWidthPicker( 100, onChange );

		node.querySelectorAll< HTMLElement >( '.atcfb__width-option' )[ 1 ].click();

		expect( onChange ).toHaveBeenCalledWith( 33 );
	} );

	it( 'keeps the press off the card underneath', () => {
		// The card is a click target that selects the field. Choosing a width
		// should not also be a selection.
		const node = renderWidthPicker( 100, () => undefined );
		const seen = vi.fn();

		node.addEventListener( 'click', seen );
		node.querySelectorAll< HTMLElement >( '.atcfb__width-option' )[ 0 ].click();

		expect( seen ).not.toHaveBeenCalled();
	} );

	it( 'shows a hand-set width rather than rounding it to the nearest', () => {
		// A picker that quietly said "a third" for a field that is really 37%
		// would be worse than the number it replaced.
		const node = renderWidthPicker( 37 );

		expect( node.querySelectorAll( '.is-chosen' ) ).toHaveLength( 0 );
		expect( node.querySelector( '.atcfb__width-custom' )?.textContent ).toBe( '37%' );
	} );

	it( 'is a readout, not a control, when nothing is listening', () => {
		const node = renderWidthPicker( 50 );

		expect( node.querySelector( 'button' ) ).toBe( null );
		expect( node.getAttribute( 'role' ) ).toBe( 'group' );
	} );

	it( 'is a radio group when it can be changed', () => {
		// Six mutually exclusive choices. `radiogroup` is what tells a screen
		// reader that, and what makes the arrow keys work.
		const node = renderWidthPicker( 50, () => undefined );

		expect( node.getAttribute( 'role' ) ).toBe( 'radiogroup' );
		expect( node.querySelectorAll( '[role="radio"]' ) ).toHaveLength( 6 );
		expect( node.querySelectorAll( '[aria-checked="true"]' ) ).toHaveLength( 1 );
	} );
} );
