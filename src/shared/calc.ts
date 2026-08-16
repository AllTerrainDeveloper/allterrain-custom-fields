/**
 * The formula evaluator, in the browser.
 *
 * The twin of `includes/calc.php`, and the same tokeniser and shunting-yard
 * parser over the same closed set. It exists here so a computed field's total
 * updates as you type, and there so the stored value is the server's own answer
 * rather than whatever the browser submitted.
 *
 * Both run `tests/fixtures/calc-cases.json`. A disagreement between them is a
 * number that changes when you press Save, which is the one behaviour that makes
 * people stop trusting a calculated field.
 *
 * No `eval`, no `new Function`, no exceptions. A malformed expression returns an
 * empty string, because a formula somebody is halfway through typing is
 * malformed on almost every keystroke and each of those must not throw.
 */

/**
 * Operator precedence, higher binds tighter.
 *
 * `u-` is unary minus, and its place in this table is the whole reason it is a
 * token of its own rather than a rewrite to `0 - x`. That rewrite is the obvious
 * implementation and it is wrong: `3 * -2` becomes `3 * 0 - 2`, which is `-2`.
 *
 * Sitting between `*` and `^` gives both readings people expect — it binds
 * tighter than multiplication, so `3 * -2` is `-6`, and looser than the
 * exponent, so `-2 ^ 2` is `-4`, which is what every calculator does.
 */
const PRECEDENCE: Record< string, number > = {
	'||': 1,
	'&&': 2,
	'==': 3,
	'!=': 3,
	'<': 4,
	'>': 4,
	'<=': 4,
	'>=': 4,
	'+': 5,
	'-': 5,
	'*': 6,
	'/': 6,
	'%': 6,
	'u-': 6.5,
	'^': 7,
};

/** The right-associative operators, which an equal precedence must not pop. */
const RIGHT_ASSOCIATIVE = [ '^', 'u-' ];

/**
 * The functions an expression may call.
 *
 * Nothing outside this set is reachable: an unknown name is a parse error, not a
 * lookup. There is no path from an expression to a JavaScript callable, because
 * no part of this file ever builds one.
 */
export const FUNCTIONS = [
	'min',
	'max',
	'sum',
	'avg',
	'round',
	'floor',
	'ceil',
	'abs',
	'sqrt',
	'if',
	'pow',
	'mod',
	'clamp',
	'median',
	'product',
	'pct',
	'int',
	'sign',
	'count',
];

/**
 * A value as a single number.
 *
 * A **list** — a repeater column — reads as its **total**. That is the one
 * coercion that cannot surprise anybody: `{ingredients.amount}` on its own and
 * `sum({ingredients.amount})` give the same answer, so a person who guesses
 * either way is right. Reading it as a count would make `* 2` mean two different
 * things depending on where it was written.
 *
 * Transcribed from `atcf_calc_number()`, and the fixture table is what keeps the
 * two honest.
 */
function toNumber( value: unknown ): number {
	if ( Array.isArray( value ) ) {
		return value.reduce< number >( ( total, one ) => total + toNumber( one ), 0 );
	}

	if ( 'boolean' === typeof value ) {
		return value ? 1 : 0;
	}

	const number = Number( value );

	// `Number.isNaN`, not `Number.isFinite`. An overflow — `10 ^ 400` — has to
	// stay infinite so the finite check at the end of `calc()` refuses it; mapping
	// it to 0 here would turn a formula that cannot be stored into a formula that
	// quietly stores nothing.
	return Number.isNaN( number ) ? 0 : number;
}

/**
 * Flattens a variadic function's arguments.
 *
 * `sum( {a}, {ingredients.amount}, 5 )` is a number, a column and a number, and
 * every one of them is a thing to add.
 */
function flatten( args: unknown[] ): number[] {
	return args.flatMap( ( arg ) => ( Array.isArray( arg ) ? flatten( arg ) : [ toNumber( arg ) ] ) );
}

/** The functions that take columns as well as numbers. */
const VARIADIC = [ 'min', 'max', 'sum', 'avg', 'median', 'product', 'count' ];

/**
 * How many arguments each function takes; -1 is variadic.
 *
 * Transcribed from `atcf_calc_functions()`, and the fixture table is what keeps
 * the two honest — every function has a wrong-arity case in
 * `tests/fixtures/calc-cases.json`, run by both suites.
 */
export const ARITY: Record< string, number > = {
	min: -1,
	max: -1,
	sum: -1,
	avg: -1,
	round: 2,
	floor: 1,
	ceil: 1,
	abs: 1,
	sqrt: 1,
	if: 3,
	pow: 2,
	mod: 2,
	clamp: 3,
	median: -1,
	product: -1,
	pct: 2,
	int: 1,
	sign: 1,
	count: -1,
};

type TokenType = 'num' | 'var' | 'op' | 'fn' | 'open' | 'close' | 'comma';

interface Token {
	type: TokenType;
	value: string | number;
	arity?: number;
}

const isDigit = ( char: string ) => char >= '0' && char <= '9';
const isAlpha = ( char: string ) => /[a-z_]/i.test( char );
const isAlnum = ( char: string ) => /[a-z0-9_]/i.test( char );

/**
 * Splits an expression into tokens.
 *
 * @param formula The expression.
 * @return Tokens, or null when a character has no meaning here.
 */
export function tokenize( formula: string ): Token[] | null {
	const tokens: Token[] = [];
	const length = formula.length;

	let index = 0;

	// Whether the previous token was a value. It is what tells a leading `-`
	// (negation) from a subtracting one, which is the single most common way a
	// hand-rolled tokeniser gets `3 * -2` wrong.
	let afterValue = false;

	while ( index < length ) {
		const char = formula[ index ];

		if ( char === ' ' || char === '\t' || char === '\n' || char === '\r' ) {
			index++;
			continue;
		}

		if ( char === '{' ) {
			const close = formula.indexOf( '}', index );

			if ( close === -1 ) {
				return null;
			}

			tokens.push( { type: 'var', value: formula.slice( index + 1, close ).trim() } );
			index = close + 1;
			afterValue = true;
			continue;
		}

		if ( isDigit( char ) || ( char === '.' && index + 1 < length && isDigit( formula[ index + 1 ] ) ) ) {
			let number = '';

			while ( index < length && ( isDigit( formula[ index ] ) || formula[ index ] === '.' ) ) {
				number += formula[ index ];
				index++;
			}

			// `1.2.3` is not a number. Accepting it and letting the cast take the
			// first part would turn a typo into a silently wrong total.
			if ( number.split( '.' ).length > 2 ) {
				return null;
			}

			tokens.push( { type: 'num', value: Number( number ) } );
			afterValue = true;
			continue;
		}

		if ( isAlpha( char ) ) {
			let name = '';

			while ( index < length && isAlnum( formula[ index ] ) ) {
				name += formula[ index ];
				index++;
			}

			const lower = name.toLowerCase();

			if ( lower === 'true' || lower === 'false' ) {
				tokens.push( { type: 'num', value: lower === 'true' ? 1 : 0 } );
				afterValue = true;
				continue;
			}

			if ( ! FUNCTIONS.includes( lower ) ) {
				return null;
			}

			tokens.push( { type: 'fn', value: lower } );
			afterValue = false;
			continue;
		}

		if ( char === '(' ) {
			tokens.push( { type: 'open', value: '(' } );
			afterValue = false;
			index++;
			continue;
		}

		if ( char === ')' ) {
			tokens.push( { type: 'close', value: ')' } );
			afterValue = true;
			index++;
			continue;
		}

		if ( char === ',' ) {
			tokens.push( { type: 'comma', value: ',' } );
			afterValue = false;
			index++;
			continue;
		}

		const two = formula.slice( index, index + 2 );

		if ( [ '<=', '>=', '==', '!=', '&&', '||' ].includes( two ) ) {
			tokens.push( { type: 'op', value: two } );
			afterValue = false;
			index += 2;
			continue;
		}

		if ( [ '+', '-', '*', '/', '%', '^', '<', '>' ].includes( char ) ) {
			// A `-` with no value before it is a negation, not a subtraction.
			// `afterValue` is the only thing that can tell them apart, and
			// getting it wrong is the single most common way a hand-rolled
			// tokeniser breaks `3 * -2`.
			tokens.push( { type: 'op', value: char === '-' && ! afterValue ? 'u-' : char } );
			afterValue = false;
			index++;
			continue;
		}

		return null;
	}

	return tokens;
}

/**
 * Converts an infix token list into reverse Polish notation.
 *
 * @param tokens Tokens.
 * @return RPN tokens, or null when the brackets do not balance.
 */
export function toRpn( tokens: Token[] ): Token[] | null {
	const output: Token[] = [];
	const stack: Token[] = [];
	const arity: number[] = [];

	for ( const token of tokens ) {
		if ( token.type === 'num' || token.type === 'var' ) {
			output.push( token );
			continue;
		}

		if ( token.type === 'fn' ) {
			stack.push( token );
			arity.push( 1 );
			continue;
		}

		if ( token.type === 'comma' ) {
			while ( stack.length && stack[ stack.length - 1 ].type !== 'open' ) {
				output.push( stack.pop() as Token );
			}

			if ( ! stack.length ) {
				return null;
			}

			if ( arity.length ) {
				arity[ arity.length - 1 ]++;
			}

			continue;
		}

		if ( token.type === 'op' ) {
			const precedence = PRECEDENCE[ token.value as string ];

			while ( stack.length ) {
				const top = stack[ stack.length - 1 ];

				if ( top.type !== 'op' ) {
					break;
				}

				const topPrecedence = PRECEDENCE[ top.value as string ];

				// `^` and unary minus are right-associative, so an equal
				// precedence does not pop them: `2^3^2` is 2^9, not 8^2, and
				// `--3` is 3.
				if (
					topPrecedence > precedence ||
					( topPrecedence === precedence && ! RIGHT_ASSOCIATIVE.includes( token.value as string ) )
				) {
					output.push( stack.pop() as Token );
					continue;
				}

				break;
			}

			stack.push( token );
			continue;
		}

		if ( token.type === 'open' ) {
			stack.push( token );
			continue;
		}

		if ( token.type === 'close' ) {
			while ( stack.length && stack[ stack.length - 1 ].type !== 'open' ) {
				output.push( stack.pop() as Token );
			}

			if ( ! stack.length ) {
				return null;
			}

			stack.pop();

			if ( stack.length && stack[ stack.length - 1 ].type === 'fn' ) {
				const fn = stack.pop() as Token;

				fn.arity = arity.length ? ( arity.pop() as number ) : 1;

				// The same argument-count check `atcf_calc_parse()` makes, for
				// the same reason: a call with the wrong number of arguments used
				// to evaluate to a number rather than being refused, and a wrong
				// number that looks like a right number is the worst thing a
				// calculator can produce.
				const declared = ARITY[ fn.value as string ];

				if (
					declared !== undefined &&
					declared >= 0 &&
					fn.arity !== declared &&
					! ( 'round' === fn.value && 1 === fn.arity )
				) {
					return null;
				}
				output.push( fn );
			}
		}
	}

	while ( stack.length ) {
		const top = stack.pop() as Token;

		if ( top.type === 'open' ) {
			return null;
		}

		output.push( top );
	}

	return output;
}

/** Applies a binary operator. */
function apply( operator: string, left: number, right: number ): number {
	switch ( operator ) {
		case '+':
			return left + right;

		case '-':
			return left - right;

		case '*':
			return left * right;

		case '/':
			// Division by zero is zero, not an error and not Infinity. A quantity
			// nobody has filled in should not blank the whole total, and Infinity
			// serialises into meta as the string `INF`.
			return right === 0 ? 0 : left / right;

		case '%':
			return right === 0 ? 0 : left % right;

		case '^':
			return left ** right;

		case '<':
			return left < right ? 1 : 0;

		case '>':
			return left > right ? 1 : 0;

		case '<=':
			return left <= right ? 1 : 0;

		case '>=':
			return left >= right ? 1 : 0;

		case '==':
			return Math.abs( left - right ) < 0.000001 ? 1 : 0;

		case '!=':
			return Math.abs( left - right ) < 0.000001 ? 0 : 1;

		case '&&':
			return left !== 0 && right !== 0 ? 1 : 0;

		case '||':
			return left !== 0 || right !== 0 ? 1 : 0;

		default:
			return 0;
	}
}

/** Calls one of the ten permitted functions. */
function call( name: string, raw: unknown[] ): number {
	// The variadic ones take columns as well as numbers. Everything else wants a
	// single number per argument, and a list given to one reads as its total.
	const args = VARIADIC.includes( name ) ? flatten( raw ) : raw.map( toNumber );

	switch ( name ) {
		case 'min':
			return args.length ? Math.min( ...args ) : 0;

		case 'max':
			return args.length ? Math.max( ...args ) : 0;

		case 'sum':
			return args.reduce( ( total, one ) => total + one, 0 );

		case 'avg':
			return args.length ? args.reduce( ( total, one ) => total + one, 0 ) / args.length : 0;

		case 'round': {
			if ( ! args.length ) {
				return 0;
			}

			const precision = args.length > 1 ? Math.trunc( args[ 1 ] ) : 0;
			const factor = 10 ** precision;

			// Two corrections, and both exist because the PHP twin has to agree.
			//
			// `toPrecision( 15 )` first. `1.005 * 100` is `100.49999999999999`
			// in binary floating point, so a naïve round gives `1.00` where PHP
			// gives `1.01` — PHP pre-rounds to fifteen significant digits before
			// deciding, and this is the same correction. Without it a price
			// field shows one total and stores another.
			const scaled = Number( ( args[ 0 ] * factor ).toPrecision( 15 ) );

			// Then half **away from zero**, which is what PHP's `round()` does
			// and what `Math.round` does not: `Math.round( -2.5 )` is `-2`, and
			// PHP gives `-3`.
			const rounded = scaled < 0 ? -Math.round( -scaled ) : Math.round( scaled );

			return rounded / factor;
		}

		case 'floor':
			return args.length ? Math.floor( args[ 0 ] ) : 0;

		case 'ceil':
			return args.length ? Math.ceil( args[ 0 ] ) : 0;

		case 'abs':
			return args.length ? Math.abs( args[ 0 ] ) : 0;

		case 'sqrt':
			// Negative roots are zero rather than NaN, for the same reason
			// division by zero is: a NaN reaching meta storage is the string
			// `NAN`, and every subsequent read of that field is broken.
			return args.length && args[ 0 ] >= 0 ? Math.sqrt( args[ 0 ] ) : 0;

		case 'if':
			return args[ 0 ] !== 0 ? args[ 1 ] : args[ 2 ];

		case 'pow': {
			const result = args[ 0 ] ** args[ 1 ];

			return Number.isFinite( result ) ? result : 0;
		}

		case 'mod':
			// JavaScript's `%` is already a float remainder, which is what PHP
			// needs `fmod` for. The guard is the shared part: a modulo by zero is
			// NaN here and NAN there, and either reaching meta storage breaks
			// every later read of the field.
			return args[ 1 ] === 0 ? 0 : args[ 0 ] % args[ 1 ];

		case 'clamp': {
			// Bounds the wrong way round are swapped, matching `atcf_calc_call()`.
			const low = Math.min( args[ 1 ], args[ 2 ] );
			const high = Math.max( args[ 1 ], args[ 2 ] );

			return Math.min( high, Math.max( low, args[ 0 ] ) );
		}

		case 'median': {
			if ( ! args.length ) {
				return 0;
			}

			// A copy: `sort` is in place, and the argument array is the caller's.
			const sorted = args.slice().sort( ( a, b ) => a - b );
			const middle = Math.floor( sorted.length / 2 );

			return sorted.length % 2 === 0
				? ( sorted[ middle - 1 ] + sorted[ middle ] ) / 2
				: sorted[ middle ];
		}

		case 'product': {
			const product = args.reduce( ( carry, one ) => carry * one, 1 );

			return Number.isFinite( product ) ? product : 0;
		}

		case 'pct':
			return args[ 1 ] === 0 ? 0 : ( args[ 0 ] / args[ 1 ] ) * 100;

		case 'int':
			// `Math.trunc`, not `Math.floor` — toward zero, so it agrees with
			// PHP's `(int)` cast on negatives. `floor( -2.5 )` is -3 and `(int)
			// -2.5` is -2, and a divergence there would show up as one engine
			// disagreeing with the other on exactly the rows nobody checks.
			return Math.trunc( args[ 0 ] );

		case 'sign':
			return args[ 0 ] > 0 ? 1 : args[ 0 ] < 0 ? -1 : 0;

		case 'count':
			// How many, not how much.
			return args.length;

		default:
			return 0;
	}
}

/** Evaluates an RPN token list. */
function evalRpn( rpn: Token[], values: Record< string, unknown > ): number | null {
	// `unknown`, not `number`: a repeater column stays a list on the stack until
	// something asks it for a number. See `toNumber()`.
	const stack: unknown[] = [];

	for ( const token of rpn ) {
		if ( token.type === 'num' ) {
			stack.push( Number( token.value ) );
			continue;
		}

		if ( token.type === 'var' ) {
			const raw = values[ token.value as string ];

			// A list stays a list. `{ingredients.amount}` is every amount in a
			// repeater, and the whole point of exposing it is that `sum()` can be
			// given the column rather than six named fields.
			//
			// An unset or non-numeric sibling reads as zero rather than aborting.
			// A price field nobody has filled in yet is worth nothing, and a total
			// that blanks itself because one of six inputs is empty is a total
			// nobody trusts.
			stack.push( Array.isArray( raw ) ? raw.slice() : toNumber( raw ) );

			continue;
		}

		if ( token.type === 'op' ) {
			if ( token.value === 'u-' ) {
				if ( ! stack.length ) {
					return null;
				}

				stack.push( -toNumber( stack.pop() ) );
				continue;
			}

			if ( stack.length < 2 ) {
				return null;
			}

			const right = toNumber( stack.pop() );
			const left = toNumber( stack.pop() );

			stack.push( apply( token.value as string, left, right ) );
			continue;
		}

		if ( token.type === 'fn' ) {
			const arity = token.arity ?? 1;

			if ( stack.length < arity ) {
				return null;
			}

			stack.push( call( token.value as string, stack.splice( stack.length - arity, arity ) ) );
			continue;
		}

		return null;
	}

	// A formula that is only a column — `{ingredients.amount}` — evaluates to the
	// column's total, which is what `toNumber()` says a list is worth.
	return stack.length === 1 ? toNumber( stack[ 0 ] ) : null;
}

/**
 * Evaluates a formula against a set of values.
 *
 * @param formula The expression.
 * @param values  Variable name => value, matched exactly as written between the
 *                braces.
 * @return The result, or an empty string when the formula is unusable.
 */
export function calc( formula: string, values: Record< string, unknown > = {} ): number | '' {
	const trimmed = String( formula ?? '' ).trim();

	if ( trimmed === '' ) {
		return '';
	}

	const tokens = tokenize( trimmed );

	if ( ! tokens ) {
		return '';
	}

	const rpn = toRpn( tokens );

	if ( ! rpn ) {
		return '';
	}

	const result = evalRpn( rpn, values );

	if ( result === null || Number.isNaN( result ) || ! Number.isFinite( result ) ) {
		return '';
	}

	return result;
}

/**
 * Every variable name an expression reads.
 *
 * The builder uses it to draw the same arrows the conditional-logic map draws —
 * a computed field is as much an edge in a group's structure as a condition is,
 * and it was previously the only one nothing visualised.
 *
 * @param formula The expression.
 * @return Variable names, in first-seen order, without duplicates.
 */
export function variables( formula: string ): string[] {
	const tokens = tokenize( String( formula ?? '' ) ) ?? [];
	const names: string[] = [];

	for ( const token of tokens ) {
		if ( token.type === 'var' && ! names.includes( token.value as string ) ) {
			names.push( token.value as string );
		}
	}

	return names;
}
