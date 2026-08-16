/**
 * Reading a formula as a sequence of things, rather than as a string.
 *
 * A formula box that is only a textarea makes the author hold two facts in their
 * head that the screen already knows: whether `{floor_area}` is a field that
 * exists, and whether `avg` is a function this engine has. Both are knowable at
 * the moment they are typed, and neither was being said — the first sign that
 * `{floor_aera}` was a typo used to be an empty column on a post list, weeks
 * later.
 *
 * So the box tokenises. A name the engine will resolve is drawn as a chip; a name
 * it will not is drawn as a chip that is visibly wrong. Nothing is corrected and
 * nothing is refused — the text stays exactly what was typed, because a formula
 * editor that rewrites what you typed is a formula editor you cannot trust with
 * a half-finished thought.
 *
 * ## Why the string stays the source of truth
 *
 * The editor is a `contenteditable`, and the tempting design is to hold the token
 * list as state and rebuild the string from it. That inverts the reliable
 * direction: browsers let a paste, a drag, a spell-check correction or an
 * autocomplete write into a `contenteditable` without any input a listener can
 * intercept, so a token list that is not re-derived from the text drifts from
 * what is on screen. Here the text is read back, tokenised, and redrawn — so
 * however the characters arrived, the chips describe them.
 *
 * ## What this file deliberately is not
 *
 * Not a parser. It never decides whether a formula is *valid*, only what its
 * pieces are — `atcf_evaluate_formula()` and `src/shared/calc.ts` do validity,
 * they agree with each other because they are tested from one fixture table, and
 * a third opinion here that drifted from both would be worse than no opinion.
 * A formula this file is perfectly happy with can still be nonsense.
 */

/** One piece of a formula. */
export interface FormulaToken {
	kind: 'field' | 'function' | 'number' | 'operator' | 'text';
	/** Exactly the characters this token occupies, so joining them restores the source. */
	text: string;
	/**
	 * The bare name, for a field or a function — `{floor_area}` gives `floor_area`.
	 * Empty for everything else.
	 */
	name: string;
	/** Whether the engine will resolve this name. Always true for non-names. */
	known: boolean;
}

/** What the engine can resolve. */
export interface FormulaVocabulary {
	/** Field names, as they appear between braces. */
	fields: string[];
	/** Function names the calculator implements. */
	functions: string[];
}

/**
 * Splits a formula into tokens.
 *
 * Every character of the input lands in exactly one token, so
 * `tokens.map( t => t.text ).join( '' ) === source`. That is not a nicety: it is
 * what lets the editor redraw from tokens without ever changing what the author
 * typed, and it is asserted in the tests.
 *
 * @param source     The formula.
 * @param vocabulary What the engine can resolve.
 * @return The tokens, in order.
 */
export function tokenizeFormula( source: string, vocabulary: FormulaVocabulary ): FormulaToken[] {
	const fields = new Set( vocabulary.fields );
	const functions = new Set( vocabulary.functions.map( ( one ) => one.toLowerCase() ) );
	const tokens: FormulaToken[] = [];

	let index = 0;
	let pending = '';

	/** Flushes whatever ordinary text has accumulated. */
	const flush = () => {
		if ( pending ) {
			tokens.push( { kind: 'text', text: pending, name: '', known: true } );
			pending = '';
		}
	};

	while ( index < source.length ) {
		const rest = source.slice( index );

		// A field reference. Matched even when unterminated is *not* attempted:
		// `{pri` while somebody is still typing is ordinary text, and turning it
		// into a chip the moment the brace opens makes the caret jump out of the
		// word being written.
		const field = /^\{([^{}]*)\}/.exec( rest );

		if ( field ) {
			flush();
			tokens.push( {
				kind: 'field',
				text: field[ 0 ],
				name: field[ 1 ],
				known: fields.has( field[ 1 ] ),
			} );
			index += field[ 0 ].length;

			continue;
		}

		// A function call: a name with an opening bracket after it, allowing the
		// spaces people leave there. The bracket is what makes it a call — `min`
		// on its own is a word, and chipping it would be wrong in
		// `{min_price} * 2`.
		const call = /^([A-Za-z_][A-Za-z0-9_]*)(\s*)\(/.exec( rest );

		if ( call ) {
			flush();
			tokens.push( {
				kind: 'function',
				text: call[ 1 ],
				name: call[ 1 ],
				known: functions.has( call[ 1 ].toLowerCase() ),
			} );
			index += call[ 1 ].length;

			// The spaces and the bracket are ordinary text; they belong to the
			// expression, not to the name.
			continue;
		}

		const number = /^\d+(\.\d+)?/.exec( rest );

		if ( number ) {
			flush();
			tokens.push( { kind: 'number', text: number[ 0 ], name: '', known: true } );
			index += number[ 0 ].length;

			continue;
		}

		if ( '+-*/%^'.includes( rest[ 0 ] ) ) {
			flush();
			tokens.push( { kind: 'operator', text: rest[ 0 ], name: '', known: true } );
			index += 1;

			continue;
		}

		pending += rest[ 0 ];
		index += 1;
	}

	flush();

	return tokens;
}

/**
 * The names a formula mentions that the engine cannot resolve.
 *
 * What the editor puts under the box in words, because a chip drawn in red says
 * *something* is wrong and a sentence says *what*.
 *
 * @param tokens Tokenised formula.
 * @return Unknown field names first, then unknown functions. No duplicates.
 */
export function unknownNames( tokens: FormulaToken[] ): string[] {
	const out: string[] = [];

	tokens.forEach( ( token ) => {
		if ( token.known || ! token.name || out.includes( token.name ) ) {
			return;
		}

		out.push( token.name );
	} );

	return out;
}

/**
 * Whether every bracket in a formula is closed.
 *
 * The one structural check worth making here, because it is the mistake people
 * actually make — `round({price} * 1.2` — and because it costs a counter. A
 * negative count means a bracket closed that was never opened, which is just as
 * broken and is why this counts rather than compares totals.
 *
 * @param source The formula.
 * @return True when the brackets balance.
 */
export function bracketsBalance( source: string ): boolean {
	let depth = 0;

	for ( const character of source ) {
		if ( '(' === character ) {
			depth += 1;
		} else if ( ')' === character ) {
			depth -= 1;

			if ( depth < 0 ) {
				return false;
			}
		}
	}

	return 0 === depth;
}
