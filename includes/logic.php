<?php
/**
 * Conditional logic.
 *
 * This engine exists twice — here and in `src/shared/logic.ts` — and that is
 * deliberate rather than an oversight waiting to be refactored away. The browser
 * has to hide a field the instant the field it depends on changes, and the
 * server has to decide what was actually required when the save arrives. Neither
 * can do the other's job: a client-only engine trusts the browser about what was
 * required, and a server-only one makes you save to find out a field was
 * irrelevant.
 *
 * Two implementations of one rule table is exactly how somebody gets shown a
 * form they cannot submit, with an error about a field they cannot see. So the
 * two are not tested separately. `tests/fixtures/logic-cases.json` holds one
 * table and both suites run it; a case added to one language is a case added to
 * both, and a change that breaks the parity fails in both.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Every operator, and what it is called.
 *
 * Shipped to the browser so the builder's dropdown cannot list an operator the
 * evaluator does not know — which is the drift this table exists to prevent.
 *
 * @since 0.1.0
 *
 * @return array<string,string> Operator => translated label.
 */
function atcf_logic_operators() {
	/**
	 * Filters the conditional-logic operators.
	 *
	 * Adding one here without teaching `atcf_logic_test()` about it produces a
	 * rule that always fails, so a plugin adding an operator must filter both.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string,string> $operators Operator => label.
	 */
	return (array) apply_filters(
		'atcf_logic_operators',
		array(
			'is'            => __( 'is', 'allterrain-fields' ),
			'is_not'        => __( 'is not', 'allterrain-fields' ),
			'contains'      => __( 'contains', 'allterrain-fields' ),
			'not_contains'  => __( 'does not contain', 'allterrain-fields' ),
			'starts_with'   => __( 'starts with', 'allterrain-fields' ),
			'ends_with'     => __( 'ends with', 'allterrain-fields' ),
			'greater'       => __( 'is greater than', 'allterrain-fields' ),
			'greater_equal' => __( 'is at least', 'allterrain-fields' ),
			'less'          => __( 'is less than', 'allterrain-fields' ),
			'less_equal'    => __( 'is at most', 'allterrain-fields' ),
			'empty'         => __( 'is empty', 'allterrain-fields' ),
			'not_empty'     => __( 'has any value', 'allterrain-fields' ),
			'in'            => __( 'is one of', 'allterrain-fields' ),
			'not_in'        => __( 'is none of', 'allterrain-fields' ),
		)
	);
}

/**
 * Coerces an operator to one the evaluator knows.
 *
 * An unknown operator becomes `is` rather than being dropped, because dropping
 * the rule turns a condition into "always true" — a field that was meant to be
 * hidden appears, which is the failure mode that leaks a draft-only field onto a
 * screen somebody else is looking at.
 *
 * @since 0.1.0
 *
 * @param string $operator Raw operator.
 * @return string A known operator.
 */
function atcf_normalize_operator( $operator ) {
	$operator = (string) $operator;

	// The symbolic spellings other plugins' exports use, mapped onto ours. An import that
	// silently rewrote every `!=` into `is` would invert half the logic in the
	// file, which is worse than refusing the import.
	$aliases = array(
		'=='         => 'is',
		'!='         => 'is_not',
		'>'          => 'greater',
		'<'          => 'less',
		'>='         => 'greater_equal',
		'<='         => 'less_equal',
		'==empty'    => 'empty',
		'!=empty'    => 'not_empty',
		'==contains' => 'contains',
		'!=contains' => 'not_contains',
		'==pattern'  => 'contains',
	);

	if ( isset( $aliases[ $operator ] ) ) {
		$operator = $aliases[ $operator ];
	}

	return array_key_exists( $operator, atcf_logic_operators() ) ? $operator : 'is';
}

/**
 * Whether a conditional block says its field should be visible.
 *
 * Returns true for a block that is switched off or has no rules, because "no
 * condition" means "always shown" — the field existing is itself the decision.
 *
 * @since 0.1.0
 *
 * @param array $conditional Canonical conditional block.
 * @param array $values      Field **key** => current value.
 * @return bool True when the field should render.
 */
function atcf_logic_visible( $conditional, $values ) {
	$conditional = is_array( $conditional ) ? $conditional : array();
	$rules       = (array) atcf_arr( $conditional, 'rules', array() );

	if ( ! atcf_arr( $conditional, 'enabled', false ) || ! $rules ) {
		return true;
	}

	$match   = 'any' === (string) atcf_arr( $conditional, 'match', 'all' ) ? 'any' : 'all';
	$matched = 'all' === $match;

	foreach ( $rules as $rule ) {
		$result = atcf_logic_test(
			atcf_arr( (array) $values, (string) atcf_arr( (array) $rule, 'field', '' ), null ),
			(string) atcf_arr( (array) $rule, 'operator', 'is' ),
			atcf_arr( (array) $rule, 'value', '' )
		);

		if ( 'all' === $match ) {
			$matched = $matched && $result;

			// No early return. The loop is over at most a handful of rules and
			// running all of them keeps this function's cost independent of the
			// data, which is what makes it safe to call inside a render loop.
		} else {
			$matched = $matched || $result;
		}
	}

	return 'hide' === (string) atcf_arr( $conditional, 'action', 'show' ) ? ! $matched : $matched;
}

/**
 * Evaluates one rule.
 *
 * Everything is compared as a string unless both sides are numeric, which is the
 * only rule that makes `10 > 9` and `"draft" is "draft"` both behave the way
 * somebody typing them expects. PHP's own loose comparison would make `"abc" ==
 * 0` true on old versions and `"10" > "9"` false as strings, and both of those
 * have shipped as bugs in every plugin that leaned on it.
 *
 * @since 0.1.0
 *
 * @param mixed  $value    The field's current value.
 * @param string $operator Operator.
 * @param mixed  $expected What the rule compares against.
 * @return bool The result.
 */
function atcf_logic_test( $value, $operator, $expected ) {
	$operator = atcf_normalize_operator( $operator );
	$empty    = atcf_logic_is_empty( $value );

	if ( 'empty' === $operator ) {
		return $empty;
	}

	if ( 'not_empty' === $operator ) {
		return ! $empty;
	}

	// A multi-value field satisfies a rule when *any* of its values does. That
	// is the only reading that makes "Tags contains news" mean what it says.
	if ( is_array( $value ) ) {
		if ( in_array( $operator, array( 'is_not', 'not_contains', 'not_in' ), true ) ) {
			// Negations invert the quantifier too: "is not news" is false the
			// moment one of the values *is* news.
			foreach ( $value as $one ) {
				if ( ! atcf_logic_test( $one, $operator, $expected ) ) {
					return false;
				}
			}

			return true;
		}

		foreach ( $value as $one ) {
			if ( atcf_logic_test( $one, $operator, $expected ) ) {
				return true;
			}
		}

		return false;
	}

	if ( in_array( $operator, array( 'in', 'not_in' ), true ) ) {
		$list = is_array( $expected )
			? array_map( 'atcf_logic_stringify', $expected )
			: array_map( 'trim', explode( ',', atcf_logic_stringify( $expected ) ) );

		$found = in_array( atcf_logic_stringify( $value ), $list, true );

		return 'in' === $operator ? $found : ! $found;
	}

	$left  = atcf_logic_stringify( $value );
	$right = atcf_logic_stringify( is_array( $expected ) ? reset( $expected ) : $expected );

	switch ( $operator ) {
		case 'is':
			return atcf_logic_equal( $left, $right );

		case 'is_not':
			return ! atcf_logic_equal( $left, $right );

		case 'contains':
			return '' !== $right && false !== stripos( $left, $right );

		case 'not_contains':
			return '' === $right || false === stripos( $left, $right );

		case 'starts_with':
			return '' !== $right && 0 === stripos( $left, $right );

		case 'ends_with':
			return '' !== $right && substr( strtolower( $left ), -strlen( $right ) ) === strtolower( $right );

		case 'greater':
		case 'greater_equal':
		case 'less':
		case 'less_equal':
			if ( ! is_numeric( $left ) || ! is_numeric( $right ) ) {
				return false;
			}

			$a = $left + 0;
			$b = $right + 0;

			if ( 'greater' === $operator ) {
				return $a > $b;
			}

			if ( 'greater_equal' === $operator ) {
				return $a >= $b;
			}

			if ( 'less' === $operator ) {
				return $a < $b;
			}

			return $a <= $b;
	}

	return false;
}

/**
 * Whether two scalars are equal for logic purposes.
 *
 * Numeric on both sides compares as numbers, so `1` matches `1.0` and `01`.
 * Otherwise it is a case-insensitive string match, because the values being
 * compared are things a person typed into two different boxes months apart.
 *
 * @since 0.1.0
 *
 * @param string $left  One side.
 * @param string $right The other.
 * @return bool True when equal.
 */
function atcf_logic_equal( $left, $right ) {
	if ( is_numeric( $left ) && is_numeric( $right ) ) {
		return abs( ( $left + 0 ) - ( $right + 0 ) ) < 0.000001;
	}

	return 0 === strcasecmp( $left, $right );
}

/**
 * Whether a value counts as empty.
 *
 * `'0'` does not. A switch that is off, a number that is zero and a choice whose
 * value happens to be `0` are all *set*, and treating them as empty is how a
 * "show this when the count is zero" rule stops working.
 *
 * @since 0.1.0
 *
 * @param mixed $value The value.
 * @return bool True when nothing is there.
 */
function atcf_logic_is_empty( $value ) {
	if ( null === $value || false === $value ) {
		return true;
	}

	if ( is_array( $value ) ) {
		return 0 === count( array_filter( $value, static fn( $one ) => ! atcf_logic_is_empty( $one ) ) );
	}

	return '' === trim( (string) $value );
}

/**
 * Flattens a value to the string the comparators work on.
 *
 * @since 0.1.0
 *
 * @param mixed $value The value.
 * @return string Its comparable form.
 */
function atcf_logic_stringify( $value ) {
	if ( is_bool( $value ) ) {
		return $value ? '1' : '0';
	}

	if ( is_array( $value ) ) {
		// Reached only for a nested array — a repeater row inside a rule's
		// value. Its id is the only part comparable to anything a person typed.
		return isset( $value['id'] ) ? (string) $value['id'] : '';
	}

	if ( is_object( $value ) ) {
		if ( $value instanceof WP_Post ) {
			return (string) $value->ID;
		}

		if ( $value instanceof WP_Term ) {
			return (string) $value->term_id;
		}

		if ( $value instanceof WP_User ) {
			return (string) $value->ID;
		}

		return '';
	}

	return null === $value ? '' : trim( (string) $value );
}

/**
 * Filters a field list down to the ones a set of values makes visible.
 *
 * Recursive, because a hidden group hides everything inside it — and a required
 * field inside a hidden group must not be validated, which is the bug this
 * function exists to make impossible to write.
 *
 * @since 0.1.0
 *
 * @param array[] $fields Canonical fields.
 * @param array   $values Field key => value.
 * @return array[] The visible ones.
 */
function atcf_visible_fields( $fields, $values ) {
	$visible = array();

	foreach ( (array) $fields as $field ) {
		if ( ! atcf_logic_visible( atcf_arr( $field, 'conditional', array() ), $values ) ) {
			continue;
		}

		if ( 'group' === (string) atcf_arr( $field, 'type', '' ) ) {
			$field['settings']['sub_fields'] = atcf_visible_fields(
				(array) atcf_arr( (array) $field['settings'], 'sub_fields', array() ),
				$values
			);
		}

		$visible[] = $field;
	}

	return $visible;
}
