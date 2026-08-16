<?php
/**
 * Validation.
 *
 * The rule that shapes this file: **a field the user cannot see is never
 * required of them.** Conditional logic is re-run here against the submitted
 * values, and a hidden field is skipped before anything else is asked about it.
 * The alternative is a post that refuses to save because of a field that is not
 * on the screen — the single most reported bug in every custom-fields plugin
 * that has ever shipped conditional logic and server validation separately.
 *
 * Errors are keyed by field key, so the browser can put each message under the
 * control it belongs to and move focus to the first one. A single "something was
 * wrong" string at the top of a forty-field screen is not an error message, it
 * is a scavenger hunt.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Validates a whole submission.
 *
 * @since 0.1.0
 *
 * @param array[] $groups The groups that applied.
 * @param array   $values Field key => submitted value.
 * @param array   $ref    Object reference.
 * @return array Field key => message. Empty when everything passed.
 */
function atcf_validate_submission( $groups, $values, $ref = array() ) {
	$errors = array();

	foreach ( (array) $groups as $group ) {
		foreach ( atcf_visible_fields( (array) $group['fields'], $values ) as $field ) {
			$errors = array_merge( $errors, atcf_validate_field( $field, atcf_arr( $values, $field['key'], null ), $ref, $values ) );
		}
	}

	/**
	 * Filters the validation errors for a submission.
	 *
	 * @since 0.1.0
	 *
	 * @param array   $errors Field key => message.
	 * @param array[] $groups The groups that applied.
	 * @param array   $values Field key => submitted value.
	 * @param array   $ref    Object reference.
	 */
	return (array) apply_filters( 'atcf_validation_errors', $errors, $groups, $values, $ref );
}

/**
 * Validates one field, recursing into containers.
 *
 * @since 0.1.0
 *
 * @param array $field  Canonical field.
 * @param mixed $value  Its submitted value.
 * @param array $ref    Object reference.
 * @param array $values Every submitted value, for conditions inside containers.
 * @return array Field key => message.
 */
function atcf_validate_field( $field, $value, $ref = array(), $values = array() ) {
	$errors   = array();
	$type     = (string) $field['type'];
	$settings = (array) $field['settings'];

	if ( 'none' === (string) atcf_arr( (array) atcf_get_field_type( $type ), 'value', 'string' ) ) {
		return $errors;
	}

	if ( $field['required'] && atcf_logic_is_empty( atcf_validation_scalar( $value ) ) ) {
		$errors[ $field['key'] ] = sprintf(
			/* translators: %s: field label. */
			__( '%s is required.', 'allterrain-fields' ),
			$field['label']
		);

		// One message per field. Telling somebody a required field is empty and
		// also that its value is not a valid email is two sentences about one
		// blank box.
		return $errors;
	}

	if ( atcf_logic_is_empty( atcf_validation_scalar( $value ) ) ) {
		return $errors;
	}

	switch ( $type ) {
		case 'email':
			if ( ! is_email( (string) $value ) ) {
				$errors[ $field['key'] ] = __( 'That is not an email address.', 'allterrain-fields' );
			}
			break;

		case 'url':
			// `esc_url_raw()` rather than `FILTER_VALIDATE_URL`, because it is
			// the same function the sanitiser uses — a value the validator
			// accepts and the sanitiser then empties is worse than either.
			if ( '' === esc_url_raw( (string) $value ) ) {
				$errors[ $field['key'] ] = __( 'That is not a web address.', 'allterrain-fields' );
			}
			break;

		case 'number':
		case 'range':
			$error = atcf_validate_number( $value, $settings );

			if ( '' !== $error ) {
				$errors[ $field['key'] ] = $error;
			}
			break;

		case 'gallery':
		case 'relationship':
			$error = atcf_validate_count( $value, $settings );

			if ( '' !== $error ) {
				$errors[ $field['key'] ] = $error;
			}
			break;

		case 'repeater':
			$error = atcf_validate_count( $value, $settings );

			if ( '' !== $error ) {
				$errors[ $field['key'] ] = $error;
			}

			$errors = array_merge( $errors, atcf_validate_rows( $value, atcf_field_sub_fields( $field ), $ref, $values ) );
			break;

		case 'flexible_content':
			$error = atcf_validate_count( $value, $settings );

			if ( '' !== $error ) {
				$errors[ $field['key'] ] = $error;
			}
			break;

		case 'group':
			$errors = array_merge( $errors, atcf_validate_rows( array( $value ), atcf_field_sub_fields( $field ), $ref, $values ) );
			break;

		case 'json':
			if ( is_string( $value ) && '' !== trim( $value ) ) {
				json_decode( $value );

				if ( JSON_ERROR_NONE !== json_last_error() ) {
					$errors[ $field['key'] ] = __( 'That is not valid JSON.', 'allterrain-fields' );
				}
			}
			break;
	}

	if ( '' !== (string) atcf_arr( $settings, 'pattern', '' ) && is_scalar( $value ) ) {
		// The pattern is delimited here rather than stored with delimiters,
		// because the same string is put in the control's `pattern` attribute
		// where HTML expects it undelimited. `#` as the delimiter with `D` so
		// `$` cannot match before a trailing newline — which is how a pattern
		// anchored to the end lets a value with a newline in it through.
		$pattern = '#^(?:' . str_replace( '#', '\#', (string) $settings['pattern'] ) . ')$#D';

		if ( ! preg_match( $pattern, (string) $value ) ) {
			$errors[ $field['key'] ] = __( 'That is not in the expected format.', 'allterrain-fields' );
		}
	}

	if ( atcf_arr( $settings, 'unique', false ) && is_scalar( $value ) && '' !== (string) $value ) {
		if ( ! atcf_value_is_unique( $field, (string) $value, $ref ) ) {
			$errors[ $field['key'] ] = __( 'Something else already has that value.', 'allterrain-fields' );
		}
	}

	/**
	 * Filters one field's validation errors.
	 *
	 * The seam for a site rule the built-ins cannot express — "this SKU must
	 * start with the supplier's code" — without touching the plugin.
	 *
	 * @since 0.1.0
	 *
	 * @param array $errors Field key => message.
	 * @param array $field  Canonical field.
	 * @param mixed $value  The submitted value.
	 * @param array $ref    Object reference.
	 */
	return (array) apply_filters( 'atcf_validate_field', $errors, $field, $value, $ref );
}

/**
 * Validates each row of a container.
 *
 * @since 0.1.0
 *
 * @param mixed   $rows   Submitted rows.
 * @param array[] $subs   Sub-field definitions.
 * @param array   $ref    Object reference.
 * @param array   $values Every submitted value.
 * @return array Field key => message.
 */
function atcf_validate_rows( $rows, $subs, $ref, $values ) {
	$errors = array();

	foreach ( (array) $rows as $index => $row ) {
		if ( ! is_array( $row ) ) {
			continue;
		}

		foreach ( atcf_visible_fields( (array) $subs, $values ) as $sub ) {
			if ( ! array_key_exists( $sub['key'], $row ) ) {
				continue;
			}

			foreach ( atcf_validate_field( $sub, $row[ $sub['key'] ], $ref, $values ) as $message ) {
				// Keyed per row, so the browser can point at the third row's
				// email rather than at "the email field" when there are nine of
				// them on screen.
				$errors[ $sub['key'] . '[' . (int) $index . ']' ] = $message;
			}
		}
	}

	return $errors;
}

/**
 * Checks a number against its declared range.
 *
 * @since 0.1.0
 *
 * @param mixed $value    Submitted value.
 * @param array $settings Field settings.
 * @return string A message, or an empty string.
 */
function atcf_validate_number( $value, $settings ) {
	if ( ! is_numeric( $value ) ) {
		return __( 'That is not a number.', 'allterrain-fields' );
	}

	$number = $value + 0;
	$min    = atcf_arr( $settings, 'min', '' );
	$max    = atcf_arr( $settings, 'max', '' );

	if ( '' !== $min && is_numeric( $min ) && $number < $min + 0 ) {
		/* translators: %s: the smallest allowed number. */
		return sprintf( __( 'That has to be %s or more.', 'allterrain-fields' ), $min );
	}

	if ( '' !== $max && is_numeric( $max ) && $number > $max + 0 ) {
		/* translators: %s: the largest allowed number. */
		return sprintf( __( 'That has to be %s or less.', 'allterrain-fields' ), $max );
	}

	return '';
}

/**
 * Checks a list against its declared length.
 *
 * @since 0.1.0
 *
 * @param mixed $value    Submitted value.
 * @param array $settings Field settings.
 * @return string A message, or an empty string.
 */
function atcf_validate_count( $value, $settings ) {
	$count = is_array( $value ) ? count( $value ) : 0;
	$min   = (int) atcf_arr( $settings, 'min_items', 0 );
	$max   = (int) atcf_arr( $settings, 'max_items', 0 );

	if ( $min > 0 && $count < $min ) {
		return sprintf(
			/* translators: %s: the fewest allowed items. */
			_n( 'Add at least %s item.', 'Add at least %s items.', $min, 'allterrain-fields' ),
			number_format_i18n( $min )
		);
	}

	if ( $max > 0 && $count > $max ) {
		return sprintf(
			/* translators: %s: the most allowed items. */
			_n( 'Keep this to %s item.', 'Keep this to %s items.', $max, 'allterrain-fields' ),
			number_format_i18n( $max )
		);
	}

	return '';
}

/**
 * Whether no other object already holds this value in this field.
 *
 * A direct meta query rather than a `WP_Query`, because the question is about a
 * meta row and routing it through the post query machinery would apply the
 * current post type, status and language filters — all of which make "unique
 * across the site" quietly mean "unique among the posts this query happened to
 * consider".
 *
 * @since 0.1.0
 *
 * @param array  $field Canonical field.
 * @param string $value The value.
 * @param array  $ref   The object being saved, which is excluded from the check.
 * @return bool True when nothing else holds it.
 */
function atcf_value_is_unique( $field, $value, $ref ) {
	global $wpdb;

	$type = (string) atcf_arr( $ref, 'type', 'post' );
	$id   = (int) atcf_arr( $ref, 'id', 0 );

	if ( 'post' !== $type ) {
		// Uniqueness across terms, users or options is a coherent idea and is
		// simply not built. Answering "yes, unique" is the honest degrade: the
		// alternative is refusing a save on a check that never ran.
		return true;
	}

	$found = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value = %s AND post_id != %d LIMIT 1",
			$field['name'],
			$value,
			$id
		)
	);

	return null === $found;
}

/**
 * Reduces a value to something the emptiness check can read.
 *
 * A mount point's value arrives wrapped, and a container's arrives as rows.
 * Neither is a scalar, and asking `atcf_logic_is_empty()` about the wrapper
 * would say "not empty" for a relationship field holding nothing at all.
 *
 * @since 0.1.0
 *
 * @param mixed $value The submitted value.
 * @return mixed Something comparable.
 */
function atcf_validation_scalar( $value ) {
	if ( is_array( $value ) && array_key_exists( '__json', $value ) ) {
		$decoded = json_decode( (string) $value['__json'], true );

		return JSON_ERROR_NONE === json_last_error() ? $decoded : null;
	}

	if ( is_array( $value ) ) {
		return array_values( array_filter( $value, static fn( $one ) => '__empty' !== $one ) );
	}

	return $value;
}
