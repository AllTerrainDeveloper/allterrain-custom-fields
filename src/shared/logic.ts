/**
 * Conditional logic, in the browser.
 *
 * The twin of `includes/logic.php`. Two implementations of one rule table, and
 * that is deliberate: the browser has to hide a field the instant the field it
 * depends on changes, and the server has to decide what was actually required
 * when the save arrives. Neither can do the other's job.
 *
 * They are not tested separately. `tests/fixtures/logic-cases.json` holds one
 * case table and both suites run it, so a case added to one language is a case
 * added to both and a change that breaks the parity fails in both.
 *
 * Every decision in here mirrors a comment in the PHP twin. If you change one,
 * change both, and add the case that would have caught you.
 */

import type { Conditional, LogicOperator, LogicRule } from '../types';

/**
 * Anything a field can hold, as far as a rule is concerned.
 *
 * `unknown` rather than a union of the shapes this plugin's own field types
 * produce, because a rule can point at a field registered by another plugin
 * entirely and there is no useful upper bound on what that holds. Every function
 * below narrows at runtime, which is what has to happen anyway — a union here
 * would only move the cast to the call site.
 */
export type LogicValue = unknown;

/** Field key => current value. */
export type LogicValues = Record< string, LogicValue >;

/** The spellings an import might use, mapped onto ours. */
const ALIASES: Record< string, LogicOperator > = {
	'==': 'is',
	'!=': 'is_not',
	'>': 'greater',
	'<': 'less',
	'>=': 'greater_equal',
	'<=': 'less_equal',
	'==empty': 'empty',
	'!=empty': 'not_empty',
	'==contains': 'contains',
	'!=contains': 'not_contains',
	'==pattern': 'contains',
};

const KNOWN: LogicOperator[] = [
	'is',
	'is_not',
	'contains',
	'not_contains',
	'starts_with',
	'ends_with',
	'greater',
	'greater_equal',
	'less',
	'less_equal',
	'empty',
	'not_empty',
	'in',
	'not_in',
];

/**
 * Coerces an operator to one the evaluator knows.
 *
 * An unknown operator becomes `is` rather than being dropped, because dropping
 * the rule turns a condition into "always true" — the field that was meant to be
 * hidden appears, which is the failure mode that leaks a field onto a screen it
 * was deliberately kept off.
 *
 * @param operator Raw operator.
 * @return A known operator.
 */
export function normalizeOperator( operator: string ): LogicOperator {
	const mapped = ALIASES[ operator ] ?? ( operator as LogicOperator );

	return KNOWN.includes( mapped ) ? mapped : 'is';
}

/**
 * Whether a value counts as empty.
 *
 * `'0'` does not. A switch that is off, a number that is zero and a choice whose
 * value happens to be `0` are all *set*, and treating them as empty is how a
 * "show this when the count is zero" rule stops working.
 *
 * @param value The value.
 * @return True when nothing is there.
 */
export function isEmpty( value: LogicValue ): boolean {
	if ( value === null || value === undefined || value === false ) {
		return true;
	}

	if ( Array.isArray( value ) ) {
		return value.every( ( one ) => isEmpty( one as LogicValue ) );
	}

	if ( typeof value === 'object' ) {
		return Object.keys( value ).length === 0;
	}

	return String( value ).trim() === '';
}

/**
 * Flattens a value to the string the comparators work on.
 *
 * @param value The value.
 * @return Its comparable form.
 */
export function stringify( value: LogicValue ): string {
	if ( typeof value === 'boolean' ) {
		return value ? '1' : '0';
	}

	if ( value === null || value === undefined ) {
		return '';
	}

	if ( Array.isArray( value ) ) {
		return '';
	}

	if ( typeof value === 'object' ) {
		// A relational control holds `{ id, label }` objects while it is being
		// edited and bare ids once saved. The id is the only half comparable to
		// anything somebody typed into a rule.
		const id = ( value as { id?: unknown } ).id;

		return id === undefined ? '' : String( id );
	}

	return String( value ).trim();
}

/** Whether both sides parse as numbers. */
function bothNumeric( left: string, right: string ): boolean {
	return left.trim() !== '' && right.trim() !== '' && ! Number.isNaN( Number( left ) ) && ! Number.isNaN( Number( right ) );
}

/**
 * Whether two scalars are equal for logic purposes.
 *
 * Numeric on both sides compares as numbers, so `1` matches `1.0` and `01`.
 * Otherwise it is a case-insensitive string match, because the values being
 * compared are things a person typed into two different boxes months apart.
 *
 * @param left  One side.
 * @param right The other.
 * @return True when equal.
 */
export function equal( left: string, right: string ): boolean {
	if ( bothNumeric( left, right ) ) {
		return Math.abs( Number( left ) - Number( right ) ) < 0.000001;
	}

	return left.toLowerCase() === right.toLowerCase();
}

/**
 * Evaluates one rule.
 *
 * @param value    The field's current value.
 * @param operator Operator.
 * @param expected What the rule compares against.
 * @return The result.
 */
export function test( value: LogicValue, operator: string, expected: LogicValue ): boolean {
	const op = normalizeOperator( operator );

	if ( op === 'empty' ) {
		return isEmpty( value );
	}

	if ( op === 'not_empty' ) {
		return ! isEmpty( value );
	}

	// A multi-value field satisfies a rule when *any* of its values does. That is
	// the only reading that makes "Tags contains news" mean what it says.
	if ( Array.isArray( value ) ) {
		if ( [ 'is_not', 'not_contains', 'not_in' ].includes( op ) ) {
			// Negations invert the quantifier too: "is not news" is false the
			// moment one of the values *is* news.
			return value.every( ( one ) => test( one as LogicValue, op, expected ) );
		}

		return value.some( ( one ) => test( one as LogicValue, op, expected ) );
	}

	if ( op === 'in' || op === 'not_in' ) {
		const list = Array.isArray( expected )
			? expected.map( ( one ) => stringify( one as LogicValue ) )
			: stringify( expected )
					.split( ',' )
					.map( ( one ) => one.trim() );

		const found = list.includes( stringify( value ) );

		return op === 'in' ? found : ! found;
	}

	const left = stringify( value );
	const right = stringify( Array.isArray( expected ) ? ( expected[ 0 ] as LogicValue ) : expected );

	switch ( op ) {
		case 'is':
			return equal( left, right );

		case 'is_not':
			return ! equal( left, right );

		case 'contains':
			return right !== '' && left.toLowerCase().includes( right.toLowerCase() );

		case 'not_contains':
			return right === '' || ! left.toLowerCase().includes( right.toLowerCase() );

		case 'starts_with':
			return right !== '' && left.toLowerCase().startsWith( right.toLowerCase() );

		case 'ends_with':
			return right !== '' && left.toLowerCase().endsWith( right.toLowerCase() );

		case 'greater':
		case 'greater_equal':
		case 'less':
		case 'less_equal': {
			if ( ! bothNumeric( left, right ) ) {
				return false;
			}

			const a = Number( left );
			const b = Number( right );

			if ( op === 'greater' ) {
				return a > b;
			}

			if ( op === 'greater_equal' ) {
				return a >= b;
			}

			if ( op === 'less' ) {
				return a < b;
			}

			return a <= b;
		}

		default:
			return false;
	}
}

/**
 * Whether a conditional block says its field should be visible.
 *
 * Returns true for a block that is switched off or has no rules, because "no
 * condition" means "always shown" — the field existing is itself the decision.
 *
 * @param conditional The block.
 * @param values      Field key => current value.
 * @return True when the field should render.
 */
export function visible( conditional: Conditional | undefined, values: LogicValues ): boolean {
	const rules: LogicRule[] = conditional?.rules ?? [];

	if ( ! conditional?.enabled || rules.length === 0 ) {
		return true;
	}

	const match = conditional.match === 'any' ? 'any' : 'all';
	const results = rules.map( ( rule ) => test( values[ rule.field ], rule.operator, rule.value ) );
	const matched = match === 'all' ? results.every( Boolean ) : results.some( Boolean );

	return conditional.action === 'hide' ? ! matched : matched;
}
