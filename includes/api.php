<?php
/**
 * The template API.
 *
 * Nine functions a theme author ever needs, and one rule behind all of them: the
 * second argument is *anything that identifies an object*. A post id, a
 * `WP_Post`, a `WP_Term`, a `WP_User`, the string `option`, `term_12`, `user_3`,
 * or nothing at all for the post in the current loop.
 *
 * That flexibility is not a nicety. A theme's template partial does not know
 * whether it is being included from a single post, a term archive or an options
 * panel, and making it find out is how `get_field( 'x' )` returns nothing in a
 * widget and everybody blames the plugin.
 *
 * The row functions — `atcf_have_rows()` / `atcf_the_row()` / `atcf_get_sub_field()`
 * — mirror `have_posts()` deliberately, and the loop they drive is the same
 * shape. Somebody who has written a WordPress loop has already written a
 * repeater loop.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Turns anything that identifies an object into a reference.
 *
 * @since 0.1.0
 *
 * @param mixed $selector Post id, object, `option`, `term_12`, `user_3`, or
 *                        false for the current post.
 * @return array `array( 'type' => string, 'id' => int|string )`.
 */
function atcf_resolve_ref( $selector = false ) {
	if ( false === $selector || null === $selector || '' === $selector ) {
		return array(
			'type' => 'post',
			'id'   => (int) get_the_ID(),
		);
	}

	if ( is_array( $selector ) && isset( $selector['type'] ) ) {
		return array(
			'type' => (string) $selector['type'],
			'id'   => atcf_arr( $selector, 'id', 0 ),
		);
	}

	if ( $selector instanceof WP_Post ) {
		return array(
			'type' => 'post',
			'id'   => (int) $selector->ID,
		);
	}

	if ( $selector instanceof WP_Term ) {
		return array(
			'type' => 'term',
			'id'   => (int) $selector->term_id,
		);
	}

	if ( $selector instanceof WP_User ) {
		return array(
			'type' => 'user',
			'id'   => (int) $selector->ID,
		);
	}

	if ( is_numeric( $selector ) ) {
		return array(
			'type' => 'post',
			'id'   => (int) $selector,
		);
	}

	$selector = (string) $selector;

	if ( 'option' === $selector || 'options' === $selector ) {
		return array(
			'type' => 'option',
			'id'   => 'options',
		);
	}

	// `term_12`, `user_3`, `taxonomy_category` — the prefixed forms ACF accepts,
	// which exist in a great deal of published template code.
	if ( preg_match( '/^(term|user|option|post)_(.+)$/', $selector, $matches ) ) {
		return array(
			'type' => $matches[1],
			'id'   => is_numeric( $matches[2] ) ? (int) $matches[2] : $matches[2],
		);
	}

	// Anything else is read as an options page slug, which is what a bare string
	// almost always is.
	return array(
		'type' => 'option',
		'id'   => sanitize_key( $selector ),
	);
}

/**
 * Finds the field a selector names, on a given object.
 *
 * Names are looked up against the groups that apply to *that object*, so two
 * post types can each have a `subtitle` of a different type and both read
 * correctly. A key (`field_abc123`) skips the location lookup entirely, which is
 * why the key form is the one to reach for in a function that runs everywhere.
 *
 * @since 0.1.0
 *
 * @param string $selector Field name or key.
 * @param array  $ref      Object reference.
 * @return array|null The canonical field, or null.
 */
function atcf_locate_field( $selector, $ref ) {
	$selector = (string) $selector;

	if ( 0 === strpos( $selector, 'field_' ) ) {
		return atcf_get_field_by_key( $selector );
	}

	foreach ( atcf_groups_for( atcf_ref_context( $ref ) ) as $group ) {
		foreach ( atcf_flatten_fields( $group['fields'] ) as $field ) {
			if ( $field['name'] === $selector ) {
				return $field;
			}
		}
	}

	// Not on this object's groups. A field can still be read from an object it
	// does not "belong" to — a value written before a location rule changed, or
	// a group deliberately excluded from a screen but still holding data — so
	// the whole site is searched before giving up.
	foreach ( atcf_get_groups( true ) as $group ) {
		foreach ( atcf_flatten_fields( $group['fields'] ) as $field ) {
			if ( $field['name'] === $selector ) {
				return $field;
			}
		}
	}

	return null;
}

/**
 * The location context an object reference implies.
 *
 * @since 0.1.0
 *
 * @param array $ref Object reference.
 * @return array Screen context.
 */
function atcf_ref_context( $ref ) {
	switch ( (string) atcf_arr( $ref, 'type', 'post' ) ) {
		case 'term':
			return atcf_term_context( (int) atcf_arr( $ref, 'id', 0 ) );

		case 'user':
			return atcf_user_context( (int) atcf_arr( $ref, 'id', 0 ) );

		case 'option':
			return atcf_options_context( (string) atcf_arr( $ref, 'id', 'options' ) );
	}

	return atcf_post_context( (int) atcf_arr( $ref, 'id', 0 ) );
}

/**
 * Reads a field's value.
 *
 * @since 0.1.0
 *
 * @param string $selector  Field name or key.
 * @param mixed  $object    Anything {@see atcf_resolve_ref()} accepts.
 * @param bool   $formatted Whether to run the type's formatter. `false` gives
 *                          the raw stored value, which is what you want when
 *                          writing it back or comparing it to a stored id.
 * @return mixed The value, or null when there is no such field.
 */
function atcf_get_field( $selector, $object = false, $formatted = true ) {
	// Inside a row loop, an unqualified name means the sub-field. That is the
	// behaviour every repeater loop in the wild depends on, and it is why
	// `atcf_get_sub_field()` exists as an explicit form rather than as the only
	// form.
	$row = atcf_current_row();

	if ( $row && ! is_numeric( $object ) && false === $object ) {
		$sub = atcf_get_sub_field( $selector );

		if ( null !== $sub ) {
			return $sub;
		}
	}

	$ref   = atcf_resolve_ref( $object );
	$field = atcf_locate_field( $selector, $ref );

	if ( ! $field ) {
		return null;
	}

	return atcf_load_value( $field, $ref, '', $formatted );
}

/**
 * Echoes a field's value, escaped.
 *
 * Escaped by default, which is the difference between a template helper and a
 * cross-site-scripting hole. A rich-text field is passed through `wp_kses_post()`
 * rather than `esc_html()`, because escaping it would print its markup as text —
 * and it was already sanitised to the same ceiling on the way in.
 *
 * @since 0.1.0
 *
 * @param string $selector Field name or key.
 * @param mixed  $object   Anything {@see atcf_resolve_ref()} accepts.
 * @return void
 */
function atcf_the_field( $selector, $object = false ) {
	$value = atcf_get_field( $selector, $object );

	if ( is_array( $value ) || is_object( $value ) || null === $value ) {
		return;
	}

	$ref   = atcf_resolve_ref( $object );
	$field = atcf_locate_field( $selector, $ref );
	$type  = $field ? (string) $field['type'] : '';

	if ( in_array( $type, array( 'wysiwyg', 'oembed', 'textarea', 'message' ), true ) ) {
		echo wp_kses_post( (string) $value );

		return;
	}

	echo esc_html( (string) $value );
}

/**
 * Every field on an object, keyed by name.
 *
 * @since 0.1.0
 *
 * @param mixed $object    Anything {@see atcf_resolve_ref()} accepts.
 * @param bool  $formatted Whether to run the type formatters.
 * @return array Name => value.
 */
function atcf_get_fields( $object = false, $formatted = true ) {
	$ref    = atcf_resolve_ref( $object );
	$values = array();

	foreach ( atcf_groups_for( atcf_ref_context( $ref ) ) as $group ) {
		foreach ( $group['fields'] as $field ) {
			if ( 'none' === (string) atcf_arr( (array) atcf_get_field_type( $field['type'] ), 'value', 'string' ) ) {
				continue;
			}

			$values[ $field['name'] ] = atcf_load_value( $field, $ref, '', $formatted );
		}
	}

	return $values;
}

/**
 * A field's whole definition, with its value attached.
 *
 * What a template needs to render a field generically — the label to print
 * beside it, the choices to look a value up in, the type to switch on.
 *
 * @since 0.1.0
 *
 * @param string $selector Field name or key.
 * @param mixed  $object   Anything {@see atcf_resolve_ref()} accepts.
 * @return array|null The field with a `value` key, or null.
 */
function atcf_get_field_object( $selector, $object = false ) {
	$ref   = atcf_resolve_ref( $object );
	$field = atcf_locate_field( $selector, $ref );

	if ( ! $field ) {
		return null;
	}

	$field['value'] = atcf_load_value( $field, $ref, '', true );
	$field['raw']   = atcf_load_value( $field, $ref, '', false );

	return $field;
}

/**
 * Writes a field's value.
 *
 * @since 0.1.0
 *
 * @param string $selector Field name or key.
 * @param mixed  $value    The value.
 * @param mixed  $object   Anything {@see atcf_resolve_ref()} accepts.
 * @return bool True when it was written.
 */
function atcf_update_field( $selector, $value, $object = false ) {
	$ref   = atcf_resolve_ref( $object );
	$field = atcf_locate_field( $selector, $ref );

	if ( ! $field ) {
		return false;
	}

	atcf_save_value( $field, $ref, $value );
	atcf_sync_relationships( $field, $ref, $value );

	// Any computed field naming this one is now out of date. Recomputing here
	// rather than only on a form submission is what makes a total correct after
	// a WP-CLI import, a REST write or a theme's own `atcf_update_field()` —
	// which is to say, correct rather than correct-once-somebody-opens-the-editor.
	atcf_recompute( $ref );

	return true;
}

/**
 * Deletes a field's value.
 *
 * @since 0.1.0
 *
 * @param string $selector Field name or key.
 * @param mixed  $object   Anything {@see atcf_resolve_ref()} accepts.
 * @return bool True when something was deleted.
 */
function atcf_delete_field( $selector, $object = false ) {
	$ref   = atcf_resolve_ref( $object );
	$field = atcf_locate_field( $selector, $ref );

	if ( ! $field ) {
		return false;
	}

	// Routed through the same row deleter the store uses, so a repeater takes
	// every one of its rows with it rather than leaving orphans nothing can see.
	atcf_delete_row( array( $field ), $ref, '' );

	return true;
}

/**
 * The stack of open row loops.
 *
 * A stack rather than a single value, because repeaters nest and the inner loop
 * has to hand control back to the outer one intact when it finishes.
 *
 * Returned **by reference** so `atcf_the_row()` can advance the top loop's
 * index in place. The alternative — copying the stack out, mutating the copy and
 * writing it back — is what this was first written as, and it is a bug generator:
 * anything that pushes a loop between the read and the write loses it.
 *
 * @since 0.1.0
 *
 * @return array[] The stack, by reference.
 */
function &atcf_row_stack() {
	static $stack = array();

	return $stack;
}

/**
 * Pushes a loop onto the row stack.
 *
 * @since 0.1.0
 *
 * @param array $loop The loop.
 * @return void
 */
function atcf_push_row( $loop ) {
	$stack   = &atcf_row_stack();
	$stack[] = $loop;
}

/**
 * Pops the top loop off the row stack.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_pop_row() {
	$stack = &atcf_row_stack();

	array_pop( $stack );
}

/**
 * The row loop currently running, if any.
 *
 * @since 0.1.0
 *
 * @return array|null The top of the stack.
 */
function atcf_current_row() {
	$stack = atcf_row_stack();

	return $stack ? $stack[ count( $stack ) - 1 ] : null;
}

/**
 * Opens — or advances — a loop over a repeater, flexible content or a group.
 *
 * Shaped exactly like `have_posts()`: call it in a `while`, call
 * `atcf_the_row()` inside, and read sub-fields with `atcf_get_sub_field()`.
 *
 * @since 0.1.0
 *
 * @param string $selector Field name or key.
 * @param mixed  $object   Anything {@see atcf_resolve_ref()} accepts.
 * @return bool True while there are rows left.
 */
function atcf_have_rows( $selector, $object = false ) {
	$stack   = atcf_row_stack();
	$current = $stack ? $stack[ count( $stack ) - 1 ] : null;

	// Already looping this exact field: this is the `while` coming round again.
	if ( $current && $selector === $current['selector'] && atcf_resolve_ref( $object ) === $current['ref'] ) {
		if ( $current['index'] + 1 < count( $current['rows'] ) ) {
			return true;
		}

		atcf_pop_row();

		return false;
	}

	$ref   = atcf_resolve_ref( $object );
	$field = atcf_locate_field( $selector, $ref );

	if ( ! $field ) {
		return false;
	}

	$rows = atcf_load_value( $field, $ref, atcf_sub_path(), true );

	if ( 'group' === (string) $field['type'] ) {
		// A group is one row. Looping it is how a template treats a group and a
		// single-row repeater interchangeably, which is worth supporting because
		// people change one into the other constantly.
		$rows = array( $rows );
	}

	if ( ! is_array( $rows ) || ! $rows ) {
		return false;
	}

	atcf_push_row(
		array(
			'selector' => $selector,
			'ref'      => $ref,
			'field'    => $field,
			'rows'     => array_values( $rows ),
			'index'    => -1,
		)
	);

	return true;
}

/**
 * Advances to the next row.
 *
 * @since 0.1.0
 *
 * @return array The row.
 */
function atcf_the_row() {
	$stack = &atcf_row_stack();

	if ( ! $stack ) {
		return array();
	}

	$top = count( $stack ) - 1;

	++$stack[ $top ]['index'];

	$row = isset( $stack[ $top ]['rows'][ $stack[ $top ]['index'] ] )
		? $stack[ $top ]['rows'][ $stack[ $top ]['index'] ]
		: array();

	return is_array( $row ) ? $row : array();
}

/**
 * The meta-key prefix the current row loop is inside.
 *
 * @since 0.1.0
 *
 * @return string The prefix, or an empty string at the top level.
 */
function atcf_sub_path() {
	$path = '';

	foreach ( atcf_row_stack() as $loop ) {
		$name = (string) atcf_arr( $loop['field'], 'name', '' );

		$path .= 'group' === (string) $loop['field']['type']
			? $name . '_'
			: $name . '_' . max( 0, (int) $loop['index'] ) . '_';
	}

	return $path;
}

/**
 * Reads a sub-field inside the current row.
 *
 * @since 0.1.0
 *
 * @param string $selector Sub-field name or key.
 * @param bool   $formatted Whether to run the type's formatter.
 * @return mixed The value, or null outside a row loop.
 */
function atcf_get_sub_field( $selector, $formatted = true ) {
	$loop = atcf_current_row();

	if ( ! $loop ) {
		return null;
	}

	$row = $loop['rows'][ $loop['index'] ] ?? array();

	if ( ! $formatted ) {
		// Re-read rather than reach into the loop's cache: the cache holds
		// formatted values, and asking for raw after asking for formatted must
		// not silently give the formatted one.
		$field = atcf_find_sub_field( $loop['field'], $selector, (array) $row );

		return $field ? atcf_load_value( $field, $loop['ref'], atcf_sub_path(), false ) : null;
	}

	if ( is_array( $row ) && array_key_exists( $selector, $row ) ) {
		return $row[ $selector ];
	}

	$field = atcf_find_sub_field( $loop['field'], $selector, (array) $row );

	return $field ? atcf_load_value( $field, $loop['ref'], atcf_sub_path(), true ) : null;
}

/**
 * Echoes a sub-field, escaped.
 *
 * @since 0.1.0
 *
 * @param string $selector Sub-field name or key.
 * @return void
 */
function atcf_the_sub_field( $selector ) {
	$value = atcf_get_sub_field( $selector );

	if ( is_scalar( $value ) ) {
		echo esc_html( (string) $value );
	}
}

/**
 * Locates a sub-field definition inside a container.
 *
 * @since 0.1.0
 *
 * @param array  $container The container field.
 * @param string $selector  Sub-field name or key.
 * @param array  $row       The current row, which names its layout for flexible
 *                          content.
 * @return array|null The sub-field, or null.
 */
function atcf_find_sub_field( $container, $selector, $row = array() ) {
	$fields = array();

	if ( 'flexible_content' === (string) atcf_arr( $container, 'type', '' ) ) {
		$layout = atcf_flexible_layout( $container, (string) atcf_arr( $row, 'acf_fc_layout', '' ) );
		$fields = (array) atcf_arr( (array) $layout, 'sub_fields', array() );
	} else {
		$fields = atcf_field_sub_fields( $container );
	}

	foreach ( $fields as $field ) {
		if ( $field['name'] === $selector || $field['key'] === $selector ) {
			return $field;
		}
	}

	return null;
}

/**
 * How many rows a repeater or flexible-content field holds.
 *
 * A count without loading every row's values, which is what a template printing
 * "3 team members" wants and what `count( atcf_get_field( … ) )` makes expensive.
 *
 * @since 0.1.0
 *
 * @param string $selector Field name or key.
 * @param mixed  $object   Anything {@see atcf_resolve_ref()} accepts.
 * @return int The row count.
 */
function atcf_count_rows( $selector, $object = false ) {
	$ref   = atcf_resolve_ref( $object );
	$field = atcf_locate_field( $selector, $ref );

	if ( ! $field ) {
		return 0;
	}

	$stored = atcf_read_raw( $ref, atcf_sub_path() . $field['name'] );

	if ( 'flexible_content' === (string) $field['type'] ) {
		return count( (array) atcf_maybe_unserialize_value( $stored, $field ) );
	}

	return max( 0, (int) $stored );
}
