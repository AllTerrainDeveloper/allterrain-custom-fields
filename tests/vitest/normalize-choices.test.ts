/**
 * The choices normaliser reads every dialect that exists.
 *
 * It serves two masters: choice fields, whose entries say `value`, and table
 * columns, which a hand-written registration spells `key` — the same spelling
 * the PHP sanitiser reads. The day it only understood one of them, the two
 * renderers disagreed about whether a table had columns at all: the control
 * said "no columns yet" over a field that declared two.
 */

import { describe, expect, it } from 'vitest';
import { normalizeChoices } from '../../src/controls/render';

describe( 'normalizeChoices', () => {
	it( 'reads the builder dialect: value/label objects', () => {
		expect(
			normalizeChoices( [
				{ value: 'spec', label: 'Spec' },
				{ value: 'value', label: 'Value' },
			] )
		).toEqual( [
			{ value: 'spec', label: 'Spec' },
			{ value: 'value', label: 'Value' },
		] );
	} );

	it( 'reads the hand-written dialect: key/label objects', () => {
		expect(
			normalizeChoices( [
				{ key: 'spec', label: 'Spec' },
				{ key: 'value', label: 'Value' },
			] )
		).toEqual( [
			{ value: 'spec', label: 'Spec' },
			{ value: 'value', label: 'Value' },
		] );
	} );

	it( 'reads plain strings, maps, and one-per-line text', () => {
		expect( normalizeChoices( [ 'spec', 'value' ] ) ).toEqual( [
			{ value: 'spec', label: 'spec' },
			{ value: 'value', label: 'value' },
		] );

		expect( normalizeChoices( { yes: 'Yes', no: 'No' } ) ).toEqual( [
			{ value: 'yes', label: 'Yes' },
			{ value: 'no', label: 'No' },
		] );

		expect( normalizeChoices( 'a : Apple\nb : Banana' ) ).toEqual( [
			{ value: 'a', label: 'Apple' },
			{ value: 'b', label: 'Banana' },
		] );
	} );

	it( 'drops entries with no usable value', () => {
		expect( normalizeChoices( [ { label: 'Orphan' }, { value: '', label: 'Blank' } ] ) ).toEqual( [] );
	} );
} );
