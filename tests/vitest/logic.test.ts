/**
 * The browser half of the conditional-logic parity suite.
 *
 * Every case in `tests/fixtures/logic-cases.json` runs here and again in
 * `tests/phpunit/tests/logic.php`. The point is not that the engine is tested
 * twice; it is that the two engines are tested against **one table**, so they
 * cannot drift. A case added in either language is a case both have to pass.
 */

import { describe, expect, it } from 'vitest';
import cases from '../fixtures/logic-cases.json';
import { isEmpty, normalizeOperator, stringify, test as evaluate, visible } from '../../src/shared/logic';
import type { Conditional } from '../../src/types';

describe( 'the shared rule table', () => {
	cases.rules.forEach( ( item ) => {
		it( item.name, () => {
			expect( evaluate( item.value, item.operator, item.expected ) ).toBe( item.result );
		} );
	} );
} );

describe( 'the shared visibility table', () => {
	cases.visibility.forEach( ( item ) => {
		it( item.name, () => {
			expect( visible( item.conditional as Conditional, item.values ) ).toBe( item.visible );
		} );
	} );
} );

describe( 'emptiness', () => {
	it( 'treats zero as set, in every spelling', () => {
		expect( isEmpty( '0' ) ).toBe( false );
		expect( isEmpty( 0 ) ).toBe( false );
		expect( isEmpty( [ '0' ] ) ).toBe( false );
	} );

	it( 'treats an array of empties as empty', () => {
		expect( isEmpty( [ '', null ] ) ).toBe( true );
	} );

	it( 'treats false as empty', () => {
		// A switch that was never touched and a switch that is off are not the
		// same thing to a store, but to a rule asking "has this been answered"
		// a boolean false is a no.
		expect( isEmpty( false ) ).toBe( true );
	} );
} );

describe( 'stringify', () => {
	it( 'reads an id out of an object', () => {
		expect( stringify( { id: 42 } ) ).toBe( '42' );
	} );

	it( 'gives an array nothing comparable, so the caller has to iterate it', () => {
		expect( stringify( [ 1, 2 ] ) ).toBe( '' );
	} );
} );

describe( 'operator normalisation', () => {
	it( 'falls back to is rather than dropping the rule', () => {
		// Dropping it would turn a condition into "always true", and the field
		// that was meant to be hidden would appear.
		expect( normalizeOperator( 'nonsense' ) ).toBe( 'is' );
	} );

	it( 'maps the spellings an ACF export uses', () => {
		expect( normalizeOperator( '==' ) ).toBe( 'is' );
		expect( normalizeOperator( '!=' ) ).toBe( 'is_not' );
		expect( normalizeOperator( '>=' ) ).toBe( 'greater_equal' );
	} );
} );
