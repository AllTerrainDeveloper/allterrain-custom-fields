/**
 * Reading a formula as tokens.
 *
 * The invariant that matters most here is the boring one: every character of the
 * input has to land in exactly one token, so redrawing the editor from tokens can
 * never change what somebody typed. A tokeniser that quietly drops a space would
 * make the box fight anybody who likes their formulas spaced out, and the
 * symptom — a caret that jumps a character to the left every few keystrokes — is
 * miserable to diagnose from a bug report.
 *
 * So it is asserted on every case below rather than in one test of its own.
 */

import { describe, expect, it } from 'vitest';
import { bracketsBalance, tokenizeFormula, unknownNames } from '../../src/builder/formula-tokens';
import type { FormulaVocabulary } from '../../src/builder/formula-tokens';

const VOCABULARY: FormulaVocabulary = {
	fields: [ 'price', 'quantity', 'floor_area', 'min_price', 'lines.amount' ],
	functions: [ 'min', 'max', 'sum', 'avg', 'round', 'floor', 'ceil', 'abs', 'sqrt', 'if', 'count' ],
};

/** Tokenises, and proves nothing was lost on the way. */
function tokens( source: string ) {
	const result = tokenizeFormula( source, VOCABULARY );

	expect( result.map( ( token ) => token.text ).join( '' ) ).toBe( source );

	return result;
}

describe( 'tokenizeFormula', () => {
	it( 'finds a field the engine can resolve', () => {
		const [ token ] = tokens( '{price}' );

		expect( token.kind ).toBe( 'field' );
		expect( token.name ).toBe( 'price' );
		expect( token.known ).toBe( true );
	} );

	it( 'marks a field nothing is called', () => {
		const [ token ] = tokens( '{floor_aera}' );

		expect( token.kind ).toBe( 'field' );
		expect( token.known ).toBe( false );
	} );

	it( 'finds a function by the bracket after it', () => {
		const [ token ] = tokens( 'round({price}, 2)' );

		expect( token.kind ).toBe( 'function' );
		expect( token.name ).toBe( 'round' );
		expect( token.known ).toBe( true );
	} );

	it( 'allows the space people leave before the bracket', () => {
		expect( tokens( 'sum ({price})' )[ 0 ].kind ).toBe( 'function' );
	} );

	it( 'marks a function the calculator does not have', () => {
		const [ token ] = tokens( 'median({price})' );

		expect( token.kind ).toBe( 'function' );
		expect( token.known ).toBe( false );
	} );

	it( 'is case-insensitive about function names, as the engine is', () => {
		expect( tokens( 'ROUND({price}, 2)' )[ 0 ].known ).toBe( true );
	} );

	it( 'does not chip a bare word that is not a call', () => {
		// The critical near-miss: `min` inside `{min_price}` is part of a field
		// name, and `min` with no bracket is just a word. Chipping either would
		// be wrong, and the second is the one a naive keyword match gets wrong.
		expect( tokens( '{min_price} * 2' ).some( ( token ) => token.kind === 'function' ) ).toBe( false );
		expect( tokens( 'min + 1' ).some( ( token ) => token.kind === 'function' ) ).toBe( false );
	} );

	it( 'leaves a half-typed field as ordinary text', () => {
		// Somebody mid-word. Turning `{pri` into a chip the moment the brace
		// opens would take the caret out of the word being written.
		expect( tokens( '{pri' ).every( ( token ) => token.kind === 'text' ) ).toBe( true );
	} );

	it( 'reads numbers, including decimals', () => {
		const found = tokens( '1.5 + 20' ).filter( ( token ) => token.kind === 'number' );

		expect( found.map( ( token ) => token.text ) ).toEqual( [ '1.5', '20' ] );
	} );

	it( 'reads every operator the calculator has', () => {
		const found = tokens( '+-*/%^' ).filter( ( token ) => token.kind === 'operator' );

		expect( found ).toHaveLength( 6 );
	} );

	it( 'keeps runs of spaces exactly as typed', () => {
		tokens( '{price}   *   {quantity}' );
	} );

	it( 'handles the empty formula', () => {
		expect( tokens( '' ) ).toEqual( [] );
	} );

	it( 'handles a formula that is only unknown nonsense', () => {
		tokens( 'wat is this' );
	} );

	it( 'reads a whole realistic formula', () => {
		const found = tokens( 'round({price} / {floor_area}, 2)' );

		expect( found.filter( ( token ) => token.kind === 'field' ).map( ( token ) => token.name ) ).toEqual( [
			'price',
			'floor_area',
		] );
		expect( found.filter( ( token ) => token.kind === 'function' ) ).toHaveLength( 1 );
		expect( found.every( ( token ) => token.known ) ).toBe( true );
	} );

	it( 'handles nested calls', () => {
		const found = tokens( 'max(sum({price}, {quantity}), 0)' );

		expect( found.filter( ( token ) => token.kind === 'function' ).map( ( token ) => token.name ) ).toEqual( [
			'max',
			'sum',
		] );
	} );

	it( 'reads a repeater column, dot and all', () => {
		// `{lines.amount}` is the Amount field in every row of the Lines
		// repeater. It has to chip like any other name, or the one form of
		// reference somebody cannot guess also looks broken when they get it
		// right.
		const [ token ] = tokens( '{lines.amount}' );

		expect( token.kind ).toBe( 'field' );
		expect( token.name ).toBe( 'lines.amount' );
		expect( token.known ).toBe( true );
	} );

	it( 'marks a column of a repeater that has no such field', () => {
		expect( tokens( '{lines.nope}' )[ 0 ].known ).toBe( false );
	} );

	it( 'reads a whole column formula', () => {
		const found = tokens( 'round(sum({lines.amount}) / count({lines.amount}), 2)' );

		expect( found.every( ( token ) => token.known ) ).toBe( true );
	} );

	it( 'does not read an empty brace as a field', () => {
		const [ token ] = tokens( '{}' );

		expect( token.kind ).toBe( 'field' );
		expect( token.known ).toBe( false );
	} );
} );

describe( 'unknownNames', () => {
	it( 'names what is wrong, so the message can be a sentence', () => {
		expect( unknownNames( tokens( '{floor_aera} + median({price})' ) ) ).toEqual( [ 'floor_aera', 'median' ] );
	} );

	it( 'says each name once, however many times it appears', () => {
		expect( unknownNames( tokens( '{nope} + {nope}' ) ) ).toEqual( [ 'nope' ] );
	} );

	it( 'is empty when everything resolves', () => {
		expect( unknownNames( tokens( 'sum({price}, {quantity})' ) ) ).toEqual( [] );
	} );
} );

describe( 'bracketsBalance', () => {
	it( 'accepts balanced brackets', () => {
		expect( bracketsBalance( 'round(max({a}, {b}), 2)' ) ).toBe( true );
	} );

	it( 'catches the one people actually leave open', () => {
		expect( bracketsBalance( 'round({price} * 1.2' ) ).toBe( false );
	} );

	it( 'catches a close with nothing open, not just a count mismatch', () => {
		// `)(` balances by count and is nonsense. Counting as it goes is what
		// separates the two.
		expect( bracketsBalance( ')(' ) ).toBe( false );
	} );

	it( 'accepts a formula with no brackets at all', () => {
		expect( bracketsBalance( '{price} * 2' ) ).toBe( true );
	} );
} );
