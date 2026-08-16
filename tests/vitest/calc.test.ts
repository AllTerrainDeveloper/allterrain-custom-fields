/**
 * The browser half of the formula parity suite.
 *
 * Every case in `tests/fixtures/calc-cases.json` runs here and again in
 * `tests/phpunit/tests/calc.php`. The browser shows the total as you type and
 * the server decides what is stored; a disagreement between them is a number
 * that changes when you press Save.
 */

import { describe, expect, it } from 'vitest';
import cases from '../fixtures/calc-cases.json';
import { calc, variables } from '../../src/shared/calc';

describe( 'the shared formula table', () => {
	cases.cases.forEach( ( item ) => {
		it( item.name, () => {
			const result = calc( item.formula, item.values );

			if ( item.result === '' ) {
				expect( result ).toBe( '' );

				return;
			}

			expect( result ).toBeCloseTo( Number( item.result ), 9 );
		} );
	} );
} );

describe( 'the variables a formula names', () => {
	cases.variables.forEach( ( item ) => {
		it( `finds ${ item.names.length } in ${ item.formula || '(nothing)' }`, () => {
			expect( variables( item.formula ) ).toEqual( item.names );
		} );
	} );
} );

describe( 'what the evaluator cannot reach', () => {
	it( 'refuses a name that is not one of the nine functions', () => {
		// The whole safety argument rests on this: there is no path from a
		// stored expression to a callable. A name the table does not hold is a
		// parse error, not a lookup.
		expect( calc( 'alert(1)' ) ).toBe( '' );
		expect( calc( 'eval(1)' ) ).toBe( '' );
		expect( calc( 'constructor' ) ).toBe( '' );
		expect( calc( 'this' ) ).toBe( '' );
	} );

	it( 'refuses assignment and property access', () => {
		expect( calc( 'a = 1' ) ).toBe( '' );
		expect( calc( '{a}.length' ) ).toBe( '' );
	} );

	it( 'never throws, whatever it is handed', () => {
		const nonsense = [ '((((', '}}}}', '\\', '1 ** 2', '{}', '{ }', '0x10', '1e10', ';;;' ];

		nonsense.forEach( ( formula ) => {
			expect( () => calc( formula ) ).not.toThrow();
		} );
	} );

	it( 'never returns a number that cannot be stored', () => {
		// Infinity and NaN both serialise into meta as strings, and every read
		// of that field afterwards is broken.
		expect( calc( '1 / 0' ) ).toBe( 0 );
		expect( calc( 'sqrt(-1)' ) ).toBe( 0 );
		expect( calc( '10 ^ 400' ) ).toBe( '' );
	} );
} );
