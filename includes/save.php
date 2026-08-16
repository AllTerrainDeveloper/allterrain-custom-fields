<?php
/**
 * Taking a submission apart.
 *
 * One function reads `$_POST['atcf']` and turns it into writes:
 * {@see atcf_save_submission()}. Everything that can be saved — a post, a term, a
 * user, an options page, a REST body, a block's attributes — goes through it, so
 * there is exactly one place that decides what a submitted value means.
 *
 * Three rules it never breaks:
 *
 * 1. **The schema decides, not the request.** The submission is walked by
 *    iterating the *fields that belong on this object* and looking each one up
 *    in the payload — never by iterating the payload. A request naming a field
 *    that is not on this screen writes nothing, which is what stops a crafted
 *    POST from setting a field an author cannot see.
 *
 * 2. **A hidden field is not cleared.** Conditional logic is re-evaluated
 *    server-side against the *submitted* values, and a field the logic hides is
 *    skipped entirely rather than written as empty. Otherwise every save of a
 *    post wipes the fields that were merely not applicable that day.
 *
 * 3. **Absent is not empty.** A key missing from the payload means "this control
 *    was not on the form", and is skipped. A key present and empty means
 *    "somebody cleared it", and is written. Collapsing the two is how a metabox
 *    that failed to render deletes a site's content.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * The nonce action every field form uses.
 *
 * @since 0.1.0
 */
const ATCF_NONCE_ACTION = 'atcf_save_fields';

/**
 * Prints the nonce and the marker that says fields were on this form.
 *
 * The marker is load-bearing. A post saved from a screen that never rendered
 * the fields — a quick edit, a bulk edit, an autosave, a REST write from another
 * plugin — has no `atcf` key at all, and without the marker the save handler
 * cannot distinguish that from a form where the user cleared everything.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_render_form_marker() {
	wp_nonce_field( ATCF_NONCE_ACTION, 'atcf_nonce' );

	echo '<input type="hidden" name="atcf_present" value="1" />';
}

/**
 * Whether the current request carries a field submission at all.
 *
 * @since 0.1.0
 *
 * @return bool True when the form marker and a valid nonce are both present.
 */
function atcf_has_submission() {
	// Nonce verified here; the payload itself is read (and sanitised per field)
	// by `atcf_save_submission()` further down the same request.
	if ( empty( $_POST['atcf_present'] ) ) {
		return false;
	}

	$nonce = isset( $_POST['atcf_nonce'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['atcf_nonce'] ) ) : '';

	return (bool) wp_verify_nonce( $nonce, ATCF_NONCE_ACTION );
}

/**
 * The raw submitted payload.
 *
 * Unslashed once, here, and never again. WordPress slashes the superglobals on
 * every request; a value that is unslashed twice loses a backslash, and a value
 * that is never unslashed gains one on every save.
 *
 * @since 0.1.0
 *
 * @return array The payload, keyed by field key.
 */
function atcf_submitted_payload() {
	// phpcs:disable WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- The nonce is checked by `atcf_has_submission()` before any caller reaches here, and every leaf value is sanitised by its own field type in `atcf_sanitize_value()`.
	if ( ! isset( $_POST['atcf'] ) || ! is_array( $_POST['atcf'] ) ) {
		return array();
	}

	return (array) wp_unslash( $_POST['atcf'] );
	// phpcs:enable WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
}

/**
 * Saves a submission onto an object.
 *
 * @since 0.1.0
 *
 * @param array $ref     Object reference.
 * @param array $payload Submitted payload, keyed by field key.
 * @param array $context Screen context; derived from the reference when absent.
 * @return array Field key => error message, empty when everything saved.
 */
function atcf_save_submission( $ref, $payload, $context = array() ) {
	if ( ! atcf_can_edit_values( (string) atcf_arr( $ref, 'type', 'post' ), atcf_arr( $ref, 'id', 0 ) ) ) {
		return array( '' => __( 'You are not allowed to edit this.', 'allterrain-fields' ) );
	}

	$context = $context ? $context : atcf_ref_context( $ref );
	$groups  = atcf_groups_for( $context );
	$values  = atcf_payload_values( $groups, $payload );
	$errors  = atcf_validate_submission( $groups, $values, $ref );

	if ( $errors ) {
		return $errors;
	}

	foreach ( $groups as $group ) {
		atcf_save_fields( $group['fields'], $ref, $payload, $values );
	}

	// After the writes, not during them: a computed field can name a sibling
	// that is later in the group than it is, and computing as we go would use
	// the value from before this save for half of them.
	atcf_recompute( $ref, $context );

	/**
	 * Fires after a whole submission is written.
	 *
	 * @since 0.1.0
	 *
	 * @param array   $ref     Object reference.
	 * @param array[] $groups  The groups that applied.
	 * @param array   $values  Field key => submitted value.
	 */
	do_action( 'atcf_submission_saved', $ref, $groups, $values );

	return array();
}

/**
 * Writes a list of fields, skipping the ones logic hides.
 *
 * @since 0.1.0
 *
 * @param array[] $fields  Canonical fields.
 * @param array   $ref     Object reference.
 * @param array   $payload The payload at this level.
 * @param array   $values  Flattened values, for evaluating conditions.
 * @param string  $path    Meta key prefix.
 * @return void
 */
function atcf_save_fields( $fields, $ref, $payload, $values, $path = '' ) {
	foreach ( (array) $fields as $field ) {
		$key = $field['key'];

		if ( ! array_key_exists( $key, (array) $payload ) ) {
			continue;
		}

		if ( ! atcf_logic_visible( (array) $field['conditional'], $values ) ) {
			continue;
		}

		if ( $field['readonly'] && 'computed' !== (string) $field['type'] ) {
			// A read-only field's control is disabled, so anything arriving
			// under its key came from somewhere that was not the form. The
			// exception is `computed`, whose value is *always* recalculated
			// rather than trusted — see below.
			continue;
		}

		$value = $payload[ $key ];

		if ( 'computed' === (string) $field['type'] ) {
			$value = atcf_compute_field( $field, $values );
		}

		atcf_save_value( $field, $ref, atcf_unwrap_submitted( $value, $field, $values ), $path );
		atcf_sync_relationships( $field, $ref, $value );
	}
}

/**
 * Turns one submitted value into the shape the store expects.
 *
 * Two conversions live here and nowhere else.
 *
 * The `__json` fallback is what a mount point submits when its JavaScript never
 * ran, and it holds the value the field already had — so a relationship field on
 * a page where the bundle failed saves what it had rather than being wiped.
 *
 * The `__empty` marker is what a checkbox group submits when every box is
 * unticked, because an all-unchecked group otherwise sends nothing at all.
 *
 * @since 0.1.0
 *
 * @param mixed $value  The submitted value.
 * @param array $field  Canonical field.
 * @param array $values Flattened values, for containers to recurse with.
 * @return mixed The value to store.
 */
function atcf_unwrap_submitted( $value, $field, $values = array() ) {
	if ( is_array( $value ) && array_key_exists( '__json', $value ) ) {
		$decoded = json_decode( (string) $value['__json'], true );

		return JSON_ERROR_NONE === json_last_error() ? $decoded : null;
	}

	if ( is_array( $value ) ) {
		$value = array_values( array_filter( $value, static fn( $one ) => '__empty' !== $one ) );
	}

	$type = (string) $field['type'];

	if ( 'repeater' === $type ) {
		return atcf_unwrap_rows( $value, atcf_field_sub_fields( $field ), $values );
	}

	if ( 'flexible_content' === $type ) {
		return atcf_unwrap_flexible_rows( $value, $field, $values );
	}

	if ( 'group' === $type || 'clone' === $type ) {
		$subs = 'clone' === $type ? atcf_resolve_clone_fields( $field ) : atcf_field_sub_fields( $field );

		return atcf_unwrap_row( $value, $subs, $values );
	}

	return $value;
}

/**
 * Unwraps a list of container rows.
 *
 * @since 0.1.0
 *
 * @param mixed   $value  Submitted rows.
 * @param array[] $subs   Sub-field definitions.
 * @param array   $values Flattened values.
 * @return array[] Rows keyed by sub-field name.
 */
function atcf_unwrap_rows( $value, $subs, $values ) {
	$rows = array();

	foreach ( (array) $value as $row ) {
		$rows[] = atcf_unwrap_row( $row, $subs, $values );
	}

	return $rows;
}

/**
 * Unwraps one container row from key-addressed to name-addressed.
 *
 * The form submits by key and the store writes by name. Translating here rather
 * than in the store is what keeps the store readable from a template author's
 * point of view — everything below this line talks about `team_0_name`, and
 * nothing below it has ever heard of `field_a1b2c3`.
 *
 * @since 0.1.0
 *
 * @param mixed   $row    One submitted row.
 * @param array[] $subs   Sub-field definitions.
 * @param array   $values Flattened values.
 * @return array The row, keyed by sub-field name.
 */
function atcf_unwrap_row( $row, $subs, $values ) {
	$row   = is_array( $row ) ? $row : array();
	$clean = array();

	foreach ( (array) $subs as $sub ) {
		if ( ! array_key_exists( $sub['key'], $row ) ) {
			continue;
		}

		if ( ! atcf_logic_visible( (array) $sub['conditional'], $values ) ) {
			continue;
		}

		$clean[ $sub['name'] ] = atcf_unwrap_submitted( $row[ $sub['key'] ], $sub, $values );
	}

	return $clean;
}

/**
 * Unwraps flexible-content rows, keeping each row's layout.
 *
 * @since 0.1.0
 *
 * @param mixed $value  Submitted rows.
 * @param array $field  The flexible content field.
 * @param array $values Flattened values.
 * @return array[] Rows.
 */
function atcf_unwrap_flexible_rows( $value, $field, $values ) {
	$rows = array();

	foreach ( (array) $value as $row ) {
		$row    = is_array( $row ) ? $row : array();
		$name   = (string) atcf_arr( $row, 'acf_fc_layout', atcf_arr( $row, '__layout', '' ) );
		$layout = atcf_flexible_layout( $field, $name );

		if ( ! $layout ) {
			continue;
		}

		$clean                  = atcf_unwrap_row( $row, (array) atcf_arr( $layout, 'sub_fields', array() ), $values );
		$clean['acf_fc_layout'] = $name;

		$rows[] = $clean;
	}

	return $rows;
}

/**
 * Flattens a payload into field key => value, for the logic engine.
 *
 * Only top-level fields and group sub-fields. A repeater's rows are not
 * flattened: a condition that pointed inside a repeater would have to say
 * *which row*, and no rule syntax here can express that — so the honest answer
 * is that a rule may not depend on one.
 *
 * @since 0.1.0
 *
 * @param array[] $groups  The groups that applied.
 * @param array   $payload The submitted payload.
 * @return array Field key => value.
 */
function atcf_payload_values( $groups, $payload ) {
	$values = array();

	foreach ( (array) $groups as $group ) {
		foreach ( (array) $group['fields'] as $field ) {
			if ( ! array_key_exists( $field['key'], (array) $payload ) ) {
				continue;
			}

			$raw = $payload[ $field['key'] ];

			if ( is_array( $raw ) && array_key_exists( '__json', $raw ) ) {
				$decoded = json_decode( (string) $raw['__json'], true );
				$raw     = JSON_ERROR_NONE === json_last_error() ? $decoded : null;
			}

			$values[ $field['key'] ] = $raw;

			if ( 'group' === (string) $field['type'] && is_array( $raw ) ) {
				foreach ( atcf_field_sub_fields( $field ) as $sub ) {
					if ( array_key_exists( $sub['key'], $raw ) ) {
						$values[ $sub['key'] ] = $raw[ $sub['key'] ];
					}
				}
			}
		}
	}

	return $values;
}

/**
 * Works out a computed field's value.
 *
 * Always recalculated, never trusted. The browser shows a live total and it is a
 * *display*; storing whatever the browser submitted would make the total
 * settable by anybody who can open devtools, which for a field feeding a price
 * is the whole game.
 *
 * @since 0.1.0
 *
 * @param array $field  The computed field.
 * @param array $values Field key => submitted value.
 * @return string|float The result.
 */
function atcf_compute_field( $field, $values ) {
	$settings = (array) $field['settings'];
	$formula  = (string) atcf_arr( $settings, 'formula', '' );
	$vars     = array();

	// The formula names siblings by *name*, because that is what the person
	// writing it sees on screen. Keys are accepted too, for a formula written by
	// a tool rather than a person.
	foreach ( (array) $values as $key => $value ) {
		$sibling = atcf_get_field_by_key( (string) $key );

		$vars[ (string) $key ] = $value;

		if ( $sibling ) {
			$vars[ $sibling['name'] ] = $value;
		}
	}

	// Repeater and group columns, as lists.
	//
	// This is the answer to the question everybody asks first — "what can `sum`
	// sum?" — and until now the answer was "only fields you can name one at a
	// time", which makes a repeater the one shape a formula could not reach.
	// `{ingredients.amount}` is every amount in the list, and `sum()` takes it.
	foreach ( (array) $values as $key => $value ) {
		$sibling = atcf_get_field_by_key( (string) $key );

		if ( ! $sibling || ! is_array( $value ) || ! atcf_type_has_sub_fields( $sibling['type'] ) ) {
			continue;
		}

		foreach ( atcf_column_values( $value ) as $column => $numbers ) {
			$vars[ $sibling['name'] . '.' . $column ] = $numbers;
			$vars[ (string) $key . '.' . $column ]    = $numbers;
		}
	}

	$result = atcf_calc( $formula, $vars );

	if ( '' === $result ) {
		return '';
	}

	$decimals = (int) atcf_arr( $settings, 'decimals', 2 );

	return round( (float) $result, max( 0, min( 10, $decimals ) ) );
}

/**
 * Recalculates every computed field on an object.
 *
 * A computed field's value is a function of its siblings, so it has to be
 * rewritten whenever any of them changes — and a form submission is only one of
 * the ways that happens. `atcf_update_field()` from a theme, a REST write, the
 * bulk editor, an import, a WP-CLI script and an AI agent's ability call are all
 * equally legitimate, and a total that is only correct after somebody opens the
 * editor and presses Save is a total nobody can rely on.
 *
 * So this runs after every write path rather than inside one of them.
 *
 * Values are read *back out of storage* rather than taken from whatever was
 * submitted, which is what makes the answer the same no matter which of the
 * siblings was the one that changed.
 *
 * @since 0.1.0
 *
 * @param array $ref     Object reference.
 * @param array $context Screen context; derived from the reference when absent.
 * @return int How many computed fields were written.
 */
function atcf_recompute( $ref, $context = array() ) {
	// One pass per object per request. Writing a computed field is itself a
	// write, and a write that triggered another recompute would loop forever on
	// a group with two computed fields referring to each other.
	static $running = array();

	$signature = (string) atcf_arr( $ref, 'type', 'post' ) . ':' . (string) atcf_arr( $ref, 'id', 0 );

	if ( isset( $running[ $signature ] ) ) {
		return 0;
	}

	$running[ $signature ] = true;

	$context = $context ? $context : atcf_ref_context( $ref );
	$written = 0;

	foreach ( atcf_groups_for( $context ) as $group ) {
		$computed = array();
		$values   = array();

		foreach ( $group['fields'] as $field ) {
			if ( 'computed' === (string) $field['type'] ) {
				$computed[] = $field;

				continue;
			}

			if ( 'none' === (string) atcf_arr( (array) atcf_get_field_type( $field['type'] ), 'value', 'string' ) ) {
				continue;
			}

			$values[ $field['key'] ] = atcf_load_value( $field, $ref, '', false );
		}

		foreach ( $computed as $field ) {
			atcf_save_value( $field, $ref, atcf_compute_field( $field, $values ) );

			++$written;
		}
	}

	unset( $running[ $signature ] );

	return $written;
}

/**
 * A container's rows, turned into one list per sub-field.
 *
 * `[ [ amount => 200, item => flour ], [ amount => 3, item => eggs ] ]` becomes
 * `[ amount => [ 200, 3 ], item => [ flour, eggs ] ]`.
 *
 * The values are left as they are rather than cast here — the calculator decides
 * what a non-number is worth, and it has to make that decision the same way for
 * a column as for a plain field or the two disagree.
 *
 * A group is a single row and is handled by the same code, so `{address.postcode}`
 * works and is a one-element list, which reads as that one value.
 *
 * @since 0.1.0
 *
 * @param array $rows The container's value.
 * @return array<string,array> Sub-field name => its values, in row order.
 */
function atcf_column_values( $rows ) {
	$columns = array();

	// A group arrives as one row rather than a list of them.
	$list = isset( $rows[0] ) && is_array( $rows[0] ) ? $rows : array( $rows );

	foreach ( $list as $row ) {
		if ( ! is_array( $row ) ) {
			continue;
		}

		foreach ( $row as $name => $value ) {
			if ( is_array( $value ) ) {
				continue;
			}

			$columns[ (string) $name ][] = $value;
		}
	}

	return $columns;
}
