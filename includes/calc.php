<?php
/**
 * The formula evaluator.
 *
 * A computed field holds an expression over its siblings — `{price} *
 * {quantity} * (1 + {vat})`. Every plugin that has grown one of these
 * implemented it with `eval()`, and every one of those is a stored program that
 * runs as PHP on every save of every post, settable by anything that can write a
 * field group: an importer, a REST call, a compromised admin session.
 *
 * So this is a tokeniser and a shunting-yard parser over a closed set. It can
 * reach numbers, the sibling fields it was given, eleven operators and nine
 * functions. It cannot call anything else, cannot name a variable that is not a
 * field, cannot assign, and cannot loop. There is no path from an expression to
 * a PHP callable, because no part of this file ever builds one.
 *
 * The twin lives in `src/shared/calc.ts` and both run
 * `tests/fixtures/calc-cases.json`, for the same reason the logic engine does:
 * the browser shows the total as you type and the server decides what is stored,
 * and a disagreement between them is a number that changes when you press Save.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Operator precedence, higher binds tighter.
 *
 * `u-` is unary minus, and its place in this table is the whole reason it is a
 * token of its own rather than a rewrite to `0 - x`. That rewrite is the obvious
 * implementation and it is wrong: `3 * -2` becomes `3 * 0 - 2`, which is `-2`.
 *
 * Sitting between `*` and `^` gives both readings people expect -- it binds
 * tighter than multiplication, so `3 * -2` is `-6`, and looser than the
 * exponent, so `-2 ^ 2` is `-4`, which is what every calculator does.
 *
 * @since 0.1.0
 */
const ATCF_CALC_PRECEDENCE = array(
	'||' => 1,
	'&&' => 2,
	'==' => 3,
	'!=' => 3,
	'<'  => 4,
	'>'  => 4,
	'<=' => 4,
	'>=' => 4,
	'+'  => 5,
	'-'  => 5,
	'*'  => 6,
	'/'  => 6,
	'%'  => 6,
	'u-' => 6.5,
	'^'  => 7,
);

/**
 * The right-associative operators, which an equal precedence must not pop.
 *
 * @since 0.1.0
 */
const ATCF_CALC_RIGHT = array( '^', 'u-' );

/**
 * The functions an expression may call, and how many arguments each takes.
 *
 * `-1` means variadic. Nothing outside this list is reachable: an unknown name
 * is a parse error, not a lookup.
 *
 * @since 0.1.0
 *
 * @return array<string,int> Name => arity.
 */
function atcf_calc_functions() {
	return array(
		'min'     => -1,
		'max'     => -1,
		'sum'     => -1,
		'avg'     => -1,
		'round'   => 2,
		'floor'   => 1,
		'ceil'    => 1,
		'abs'     => 1,
		'sqrt'    => 1,
		'if'      => 3,
		// Added after the first ten proved not to cover what people actually
		// compute on a WordPress site. Each of these replaced a formula somebody
		// would otherwise write by hand and get subtly wrong -- `pct` in
		// particular, which is `a / b * 100` guarded against a zero denominator,
		// and the unguarded version is how a price list ends up full of `INF`.
		'pow'     => 2,
		'mod'     => 2,
		'clamp'   => 3,
		'median'  => -1,
		'product' => -1,
		'pct'     => 2,
		'int'     => 1,
		'sign'    => 1,
		'count'   => -1,
	);
}

/**
 * Evaluates a formula against a set of values.
 *
 * @since 0.1.0
 *
 * @param string $formula The expression.
 * @param array  $values  Variable name => value. Names are matched exactly as
 *                        they appear between the braces.
 * @return float|string The result, or an empty string when the formula is
 *                      unusable or references something that is not there.
 */
function atcf_calc( $formula, $values = array() ) {
	$formula = trim( (string) $formula );

	if ( '' === $formula ) {
		return '';
	}

	$tokens = atcf_calc_tokenize( $formula );

	if ( null === $tokens ) {
		return '';
	}

	$rpn = atcf_calc_to_rpn( $tokens );

	if ( null === $rpn ) {
		return '';
	}

	$result = atcf_calc_eval_rpn( $rpn, is_array( $values ) ? $values : array() );

	if ( null === $result || is_nan( $result ) || is_infinite( $result ) ) {
		return '';
	}

	return $result;
}

/**
 * Splits an expression into tokens.
 *
 * @since 0.1.0
 *
 * @param string $formula The expression.
 * @return array[]|null Tokens, or null when a character has no meaning here.
 */
function atcf_calc_tokenize( $formula ) {
	$tokens = array();
	$length = strlen( $formula );
	$index  = 0;

	// Whether the previous token was a value. It is what tells a leading `-`
	// (negation) from a subtracting one, which is the single most common way a
	// hand-rolled tokeniser gets `3 * -2` wrong.
	$after_value = false;

	while ( $index < $length ) {
		$char = $formula[ $index ];

		if ( ' ' === $char || "\t" === $char || "\n" === $char || "\r" === $char ) {
			++$index;
			continue;
		}

		if ( '{' === $char ) {
			$close = strpos( $formula, '}', $index );

			if ( false === $close ) {
				return null;
			}

			$tokens[]    = array(
				'type'  => 'var',
				'value' => trim( substr( $formula, $index + 1, $close - $index - 1 ) ),
			);
			$index       = $close + 1;
			$after_value = true;
			continue;
		}

		if ( ctype_digit( $char ) || ( '.' === $char && $index + 1 < $length && ctype_digit( $formula[ $index + 1 ] ) ) ) {
			$number = '';

			while ( $index < $length && ( ctype_digit( $formula[ $index ] ) || '.' === $formula[ $index ] ) ) {
				$number .= $formula[ $index ];
				++$index;
			}

			// `1.2.3` is not a number. Accepting it and letting PHP's cast take
			// the first part would turn a typo into a silently wrong total.
			if ( substr_count( $number, '.' ) > 1 ) {
				return null;
			}

			$tokens[]    = array(
				'type'  => 'num',
				'value' => (float) $number,
			);
			$after_value = true;
			continue;
		}

		if ( ctype_alpha( $char ) || '_' === $char ) {
			$name = '';

			while ( $index < $length && ( ctype_alnum( $formula[ $index ] ) || '_' === $formula[ $index ] ) ) {
				$name .= $formula[ $index ];
				++$index;
			}

			$lower = strtolower( $name );

			if ( 'true' === $lower || 'false' === $lower ) {
				$tokens[]    = array(
					'type'  => 'num',
					'value' => 'true' === $lower ? 1.0 : 0.0,
				);
				$after_value = true;
				continue;
			}

			if ( ! isset( atcf_calc_functions()[ $lower ] ) ) {
				return null;
			}

			$tokens[]    = array(
				'type'  => 'fn',
				'value' => $lower,
			);
			$after_value = false;
			continue;
		}

		if ( '(' === $char ) {
			$tokens[]    = array(
				'type'  => 'open',
				'value' => '(',
			);
			$after_value = false;
			++$index;
			continue;
		}

		if ( ')' === $char ) {
			$tokens[]    = array(
				'type'  => 'close',
				'value' => ')',
			);
			$after_value = true;
			++$index;
			continue;
		}

		if ( ',' === $char ) {
			$tokens[]    = array(
				'type'  => 'comma',
				'value' => ',',
			);
			$after_value = false;
			++$index;
			continue;
		}

		$two = substr( $formula, $index, 2 );

		if ( in_array( $two, array( '<=', '>=', '==', '!=', '&&', '||' ), true ) ) {
			$tokens[]    = array(
				'type'  => 'op',
				'value' => $two,
			);
			$after_value = false;
			$index      += 2;
			continue;
		}

		if ( in_array( $char, array( '+', '-', '*', '/', '%', '^', '<', '>' ), true ) ) {
			// A `-` with no value before it is a negation, not a subtraction.
			// `$after_value` is the only thing that can tell them apart, and
			// getting it wrong is the single most common way a hand-rolled
			// tokeniser breaks `3 * -2`.
			$tokens[]    = array(
				'type'  => 'op',
				'value' => ( '-' === $char && ! $after_value ) ? 'u-' : $char,
			);
			$after_value = false;
			++$index;
			continue;
		}

		return null;
	}

	return $tokens;
}

/**
 * Converts an infix token list into reverse Polish notation.
 *
 * @since 0.1.0
 *
 * @param array[] $tokens Tokens.
 * @return array[]|null RPN tokens, or null when the brackets do not balance.
 */
function atcf_calc_to_rpn( $tokens ) {
	$output = array();
	$stack  = array();
	$arity  = array();

	foreach ( $tokens as $token ) {
		switch ( $token['type'] ) {
			case 'num':
			case 'var':
				$output[] = $token;
				break;

			case 'fn':
				$stack[] = $token;
				$arity[] = 1;
				break;

			case 'comma':
				while ( $stack && 'open' !== end( $stack )['type'] ) {
					$output[] = array_pop( $stack );
				}

				if ( ! $stack ) {
					return null;
				}

				if ( $arity ) {
					++$arity[ count( $arity ) - 1 ];
				}
				break;

			case 'op':
				$precedence = ATCF_CALC_PRECEDENCE[ $token['value'] ];

				while ( $stack ) {
					$top = end( $stack );

					if ( 'op' !== $top['type'] ) {
						break;
					}

					$top_precedence = ATCF_CALC_PRECEDENCE[ $top['value'] ];

					// `^` and unary minus are right-associative, so an equal
					// precedence does not pop them: `2^3^2` is 2^9, not 8^2,
					// and `--3` is 3.
					if (
						$top_precedence > $precedence
						|| ( $top_precedence === $precedence && ! in_array( $token['value'], ATCF_CALC_RIGHT, true ) )
					) {
						$output[] = array_pop( $stack );
						continue;
					}

					break;
				}

				$stack[] = $token;
				break;

			case 'open':
				$stack[] = $token;
				break;

			case 'close':
				while ( $stack && 'open' !== end( $stack )['type'] ) {
					$output[] = array_pop( $stack );
				}

				if ( ! $stack ) {
					return null;
				}

				array_pop( $stack );

				if ( $stack && 'fn' === end( $stack )['type'] ) {
					$fn          = array_pop( $stack );
					$fn['arity'] = $arity ? array_pop( $arity ) : 1;

					// How many arguments the function actually declares. Checked
					// here, at the closing bracket, where the count is known and
					// a refusal is still cheap.
					//
					// Nothing checked this before, and the failure was silent
					// rather than loud: `round( {n} )` with a missing second
					// argument, or `if( {a}, {b} )` with no else branch, both
					// evaluated to *something* — a number, stored, indistinguishable
					// from a right answer. A formula with the wrong number of
					// arguments is not a formula, and the honest response is the
					// same empty string every other malformed expression gets.
					$declared = (int) atcf_calc_functions()[ $fn['value'] ];

					if ( $declared >= 0 && (int) $fn['arity'] !== $declared ) {
						// `round` is the exception worth allowing: the places
						// argument is genuinely optional and every spreadsheet
						// treats it that way.
						if ( ! ( 'round' === $fn['value'] && 1 === (int) $fn['arity'] ) ) {
							return null;
						}
					}

					$output[] = $fn;
				}
				break;
		}
	}

	while ( $stack ) {
		$top = array_pop( $stack );

		if ( 'open' === $top['type'] ) {
			return null;
		}

		$output[] = $top;
	}

	return $output;
}

/**
 * A value as a single number.
 *
 * A **list** — a repeater column — reads as its **total**. That is the one
 * coercion that cannot surprise anybody: `{ingredients.amount}` on its own and
 * `sum({ingredients.amount})` give the same answer, so a person who guesses
 * either way is right. Reading it as a count would make `* 2` mean two different
 * things depending on where you wrote it.
 *
 * Everything non-numeric is 0, including a date, an image and a missing field.
 * Not an error: a formula is malformed on almost every keystroke while somebody
 * is writing it, and refusing to evaluate a half-typed one is a preview that is
 * blank exactly when it is being watched.
 *
 * @since 0.1.0
 *
 * @param mixed $value Whatever the field holds.
 * @return float The number it counts as.
 */
function atcf_calc_number( $value ) {
	if ( is_array( $value ) ) {
		$total = 0.0;

		foreach ( $value as $one ) {
			$total += atcf_calc_number( $one );
		}

		return $total;
	}

	if ( is_bool( $value ) ) {
		return (float) $value;
	}

	return is_numeric( $value ) ? (float) $value : 0.0;
}

/**
 * Flattens a variadic function's arguments.
 *
 * `sum( {a}, {ingredients.amount}, 5 )` is a number, a column and a number, and
 * every one of them is a thing to add.
 *
 * @since 0.1.0
 *
 * @param array $args The arguments, some of which may be lists.
 * @return float[] Every number in them, in order.
 */
function atcf_calc_flatten( $args ) {
	$out = array();

	foreach ( (array) $args as $arg ) {
		if ( is_array( $arg ) ) {
			foreach ( atcf_calc_flatten( $arg ) as $one ) {
				$out[] = $one;
			}

			continue;
		}

		$out[] = atcf_calc_number( $arg );
	}

	return $out;
}

/**
 * Evaluates an RPN token list.
 *
 * @since 0.1.0
 *
 * @param array[] $rpn    RPN tokens.
 * @param array   $values Variable name => value.
 * @return float|null The result, or null when the expression is malformed.
 */
function atcf_calc_eval_rpn( $rpn, $values ) {
	$stack = array();

	foreach ( $rpn as $token ) {
		if ( 'num' === $token['type'] ) {
			$stack[] = (float) $token['value'];
			continue;
		}

		if ( 'var' === $token['type'] ) {
			$raw = array_key_exists( $token['value'], $values ) ? $values[ $token['value'] ] : 0;

			// An unset or non-numeric sibling reads as zero rather than
			// aborting. A price field nobody has filled in yet is worth nothing,
			// and a total that blanks itself because one of six inputs is empty
			// is a total nobody trusts.
			// A list stays a list on the stack. `{ingredients.amount}` is every
			// amount in a repeater, and the whole point of exposing it is that
			// `sum()` can be given the column rather than six named fields.
			$stack[] = is_array( $raw ) ? array_values( $raw ) : atcf_calc_number( $raw );
			continue;
		}

		if ( 'op' === $token['type'] ) {
			if ( 'u-' === $token['value'] ) {
				if ( ! $stack ) {
					return null;
				}

				$stack[] = -atcf_calc_number( array_pop( $stack ) );

				continue;
			}

			if ( count( $stack ) < 2 ) {
				return null;
			}

			$right = array_pop( $stack );
			$left  = array_pop( $stack );

			$stack[] = atcf_calc_apply(
				$token['value'],
				atcf_calc_number( $left ),
				atcf_calc_number( $right )
			);
			continue;
		}

		if ( 'fn' === $token['type'] ) {
			$arity = (int) atcf_arr( $token, 'arity', 1 );

			if ( count( $stack ) < $arity ) {
				return null;
			}

			$args    = $arity > 0 ? array_splice( $stack, -$arity ) : array();
			$stack[] = atcf_calc_call( $token['value'], $args );
			continue;
		}

		return null;
	}

	// A formula that is only a column — `{ingredients.amount}` — evaluates to the
	// column's total, which is what `atcf_calc_number()` says a list is worth.
	return 1 === count( $stack ) ? atcf_calc_number( $stack[0] ) : null;
}

/**
 * Applies a binary operator.
 *
 * @since 0.1.0
 *
 * @param string $operator The operator.
 * @param float  $left     Left operand.
 * @param float  $right    Right operand.
 * @return float The result.
 */
function atcf_calc_apply( $operator, $left, $right ) {
	switch ( $operator ) {
		case '+':
			return $left + $right;

		case '-':
			return $left - $right;

		case '*':
			return $left * $right;

		case '/':
			// Division by zero is zero, not an error and not INF. A quantity
			// field nobody has filled in should not blank the whole total, and
			// INF serialises into meta as the string `INF`.
			return 0.0 === (float) $right ? 0.0 : $left / $right;

		case '%':
			return 0.0 === (float) $right ? 0.0 : fmod( $left, $right );

		case '^':
			return (float) ( $left ** $right );

		case '<':
			return $left < $right ? 1.0 : 0.0;

		case '>':
			return $left > $right ? 1.0 : 0.0;

		case '<=':
			return $left <= $right ? 1.0 : 0.0;

		case '>=':
			return $left >= $right ? 1.0 : 0.0;

		case '==':
			return abs( $left - $right ) < 0.000001 ? 1.0 : 0.0;

		case '!=':
			return abs( $left - $right ) < 0.000001 ? 0.0 : 1.0;

		case '&&':
			return ( 0.0 !== (float) $left && 0.0 !== (float) $right ) ? 1.0 : 0.0;

		case '||':
			return ( 0.0 !== (float) $left || 0.0 !== (float) $right ) ? 1.0 : 0.0;
	}

	return 0.0;
}

/**
 * Calls one of the nine permitted functions.
 *
 * @since 0.1.0
 *
 * @param string  $name Function name, already known to be in the table.
 * @param float[] $args Its arguments.
 * @return float The result.
 */
function atcf_calc_call( $name, $args ) {
	// The variadic ones take columns as well as numbers. Everything else wants a
	// single number per argument, and a list given to one reads as its total.
	if ( in_array( $name, array( 'min', 'max', 'sum', 'avg', 'median', 'product', 'count' ), true ) ) {
		$args = atcf_calc_flatten( $args );
	} else {
		$args = array_map( 'atcf_calc_number', (array) $args );
	}

	$args = array_map( 'floatval', $args );

	switch ( $name ) {
		case 'min':
			return $args ? (float) min( $args ) : 0.0;

		case 'max':
			return $args ? (float) max( $args ) : 0.0;

		case 'sum':
			return (float) array_sum( $args );

		case 'avg':
			return $args ? array_sum( $args ) / count( $args ) : 0.0;

		case 'round':
			$precision = count( $args ) > 1 ? (int) $args[1] : 0;

			return $args ? (float) round( $args[0], $precision ) : 0.0;

		case 'floor':
			return $args ? (float) floor( $args[0] ) : 0.0;

		case 'ceil':
			return $args ? (float) ceil( $args[0] ) : 0.0;

		case 'abs':
			return $args ? (float) abs( $args[0] ) : 0.0;

		case 'sqrt':
			// Negative roots are zero rather than NAN, for the same reason
			// division by zero is: a NAN reaching meta storage is the string
			// `NAN`, and every subsequent read of that field is broken.
			return $args && $args[0] >= 0 ? (float) sqrt( $args[0] ) : 0.0;

		case 'if':
			return 0.0 !== (float) $args[0] ? (float) $args[1] : (float) $args[2];

		case 'pow':
			// `^` already does this; `pow` exists because that is the name
			// people reach for, and a function they have to be told about is a
			// function they do not use.
			$result = $args[0] ** $args[1];

			return is_finite( $result ) ? (float) $result : 0.0;

		case 'mod':
			// `fmod`, not `%`. PHP's `%` casts both sides to int, so
			// `mod( 7.5, 2 )` would be 1 rather than 1.5 -- and a modulo that
			// silently truncates is worse than no modulo.
			return 0.0 === (float) $args[1] ? 0.0 : (float) fmod( $args[0], $args[1] );

		case 'clamp':
			// Bounds given the wrong way round are swapped rather than refused.
			// `clamp( $n, {max}, {min} )` is a mistake somebody makes once, and
			// returning the lower bound forever is a very quiet way to punish it.
			$low  = min( (float) $args[1], (float) $args[2] );
			$high = max( (float) $args[1], (float) $args[2] );

			return (float) min( $high, max( $low, (float) $args[0] ) );

		case 'median':
			if ( ! $args ) {
				return 0.0;
			}

			sort( $args );
			$middle = intdiv( count( $args ), 2 );

			return 0 === count( $args ) % 2
				? ( (float) $args[ $middle - 1 ] + (float) $args[ $middle ] ) / 2
				: (float) $args[ $middle ];

		case 'product':
			// Empty is 1, the multiplicative identity -- the same reasoning that
			// makes `sum()` of nothing 0. It is also what stops
			// `product() * {price}` zeroing a price.
			$product = 1.0;

			foreach ( $args as $one ) {
				$product *= (float) $one;
			}

			return is_finite( $product ) ? $product : 0.0;

		case 'pct':
			// Guarded, and that guard is the whole reason this exists rather
			// than being left as `a / b * 100`. The unguarded version divides by
			// zero the first time somebody has a product with no list price.
			return 0.0 === (float) $args[1] ? 0.0 : (float) $args[0] / (float) $args[1] * 100;

		case 'int':
			// Toward zero, which is what "drop the decimals" means to everybody
			// who is not thinking about negative numbers. `floor( -2.5 )` is -3.
			return (float) ( (int) $args[0] );

		case 'sign':
			return $args[0] > 0 ? 1.0 : ( $args[0] < 0 ? -1.0 : 0.0 );

		case 'count':
			// How many, not how much. The companion to giving a repeater column
			// to `sum()`: `avg()` already divides by this, and a per-row figure
			// like "cost each" needs it by name.
			return (float) count( $args );
	}

	return 0.0;
}

/**
 * Every variable name an expression reads.
 *
 * The builder uses it to draw the same arrows the conditional-logic map draws —
 * a computed field is as much an edge in the form's structure as a condition is,
 * and it was previously the only one nothing visualised.
 *
 * @since 0.1.0
 *
 * @param string $formula The expression.
 * @return string[] Variable names, in first-seen order, without duplicates.
 */
function atcf_calc_variables( $formula ) {
	$tokens = atcf_calc_tokenize( (string) $formula );
	$names  = array();

	foreach ( (array) $tokens as $token ) {
		if ( 'var' === $token['type'] && ! in_array( $token['value'], $names, true ) ) {
			$names[] = $token['value'];
		}
	}

	return $names;
}
