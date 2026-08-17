<?php
/**
 * Where values live.
 *
 * A value is an ordinary meta row keyed by the field's **name**, with a
 * companion row keyed `_name` holding the field's key. Two rows per value looks
 * wasteful until you need the second one, and you always do: the value row says
 * `42` and nothing else on earth says whether that is a post id, an attachment
 * id or the number forty-two. The reference row is how a read knows which field
 * type to hand it to.
 *
 * This is the flat storage convention WordPress developers already know, kept
 * deliberately and exactly. Its value has nothing to do with any UI:
 *
 *   - `get_post_meta( $id, 'hero_title', true )` works with no plugin loaded.
 *   - `meta_query` finds posts by field value, with no join table.
 *   - Every export tool, WP-CLI command, migration script and REST meta route
 *     that already exists keeps working.
 *   - A site can move *off* this plugin without a data migration.
 *
 * The nesting is the same convention. A repeater's own row holds its row count;
 * each row's sub-values are `team_0_name`, `team_1_name`. Flexible content adds
 * a list of layout names in place of the count. A group has no count at all —
 * its sub-values are simply `address_city`.
 *
 * That layout is what makes a repeater with forty rows forty small rows rather
 * than one 400KB serialized blob where changing one name rewrites all of it.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Reads one raw meta row.
 *
 * @since 0.1.0
 *
 * @param array  $ref Object reference: `array( 'type' => 'post', 'id' => 12 )`.
 * @param string $key Meta key.
 * @return mixed The stored value, or null when the row does not exist.
 */
function atcf_read_raw( $ref, $key ) {
	$type = (string) atcf_arr( $ref, 'type', 'post' );
	$id   = atcf_arr( $ref, 'id', 0 );

	switch ( $type ) {
		case 'post':
			$rows = get_post_meta( (int) $id, $key, false );
			break;

		case 'term':
			$rows = get_term_meta( (int) $id, $key, false );
			break;

		case 'user':
			$rows = get_user_meta( (int) $id, $key, false );
			break;

		case 'option':
			$name  = atcf_option_name( $ref, $key );
			$value = get_option( $name, null );

			return null === $value ? null : $value;

		default:
			return null;
	}

	// `get_*_meta( …, false )` rather than `true`, because `true` cannot tell
	// "the row holds an empty string" from "there is no row". Those are
	// genuinely different: the first is somebody clearing a field, the second is
	// a field that has never been touched and should fall back to its default.
	return $rows ? $rows[0] : null;
}

/**
 * Writes one raw meta row.
 *
 * @since 0.1.0
 *
 * @param array  $ref   Object reference.
 * @param string $key   Meta key.
 * @param mixed  $value Value to store.
 * @return void
 */
function atcf_write_raw( $ref, $key, $value ) {
	$type = (string) atcf_arr( $ref, 'type', 'post' );
	$id   = (int) atcf_arr( $ref, 'id', 0 );

	// `wp_slash()` on the way in, because every `update_*_meta()` runs
	// `wp_unslash()` on what it is given. A value containing a backslash — a
	// Windows path, a regular expression, a LaTeX fragment — loses one on every
	// save without it, so saving five times eats five backslashes.
	$value = wp_slash( $value );

	switch ( $type ) {
		case 'post':
			update_post_meta( $id, $key, $value );
			break;

		case 'term':
			update_term_meta( $id, $key, $value );
			break;

		case 'user':
			update_user_meta( $id, $key, $value );
			break;

		case 'option':
			// Autoloaded, because an options page's whole purpose is values read
			// on front-end requests — a site header's logo and phone number
			// should not be four extra queries on every page view.
			update_option( atcf_option_name( $ref, $key ), $value, true );
			break;
	}
}

/**
 * Deletes one raw meta row.
 *
 * @since 0.1.0
 *
 * @param array  $ref Object reference.
 * @param string $key Meta key.
 * @return void
 */
function atcf_delete_raw( $ref, $key ) {
	$type = (string) atcf_arr( $ref, 'type', 'post' );
	$id   = (int) atcf_arr( $ref, 'id', 0 );

	switch ( $type ) {
		case 'post':
			delete_post_meta( $id, $key );
			break;

		case 'term':
			delete_term_meta( $id, $key );
			break;

		case 'user':
			delete_user_meta( $id, $key );
			break;

		case 'option':
			delete_option( atcf_option_name( $ref, $key ) );
			break;
	}
}

/**
 * The option name a key stores under for a given options page.
 *
 * The default page prefixes with `options`, the spelling migrating sites already hold —
 * so a site migrating in finds its option values already where this plugin
 * looks. A named page prefixes with its own slug, so two pages can both have a
 * `title` field without one overwriting the other.
 *
 * @since 0.1.0
 *
 * @param array  $ref Object reference. Its `id` is the page slug.
 * @param string $key Field name.
 * @return string The option name.
 */
function atcf_option_name( $ref, $key ) {
	$slug = (string) atcf_arr( $ref, 'id', 'options' );
	$slug = '' === $slug || 'options' === $slug ? 'options' : sanitize_key( $slug );

	return $slug . '_' . $key;
}

/**
 * The key of the field that wrote a value, if this plugin wrote it.
 *
 * @since 0.1.0
 *
 * @param array  $ref  Object reference.
 * @param string $name Field name, fully pathed.
 * @return string The field key, or an empty string.
 */
function atcf_read_reference( $ref, $name ) {
	return (string) atcf_read_raw( $ref, '_' . $name );
}

/**
 * Loads one field's value.
 *
 * `$path` is what makes this one function serve every level of nesting. At the
 * top it is empty and the key is the field's name; inside a repeater row it is
 * `team_0_` and the key becomes `team_0_name`. Nothing below this function knows
 * how deep it is.
 *
 * @since 0.1.0
 *
 * @param array  $field     Canonical field.
 * @param array  $ref       Object reference.
 * @param string $path      Meta key prefix.
 * @param bool   $formatted Whether to run the type's formatter.
 * @return mixed The value.
 */
function atcf_load_value( $field, $ref, $path = '', $formatted = true ) {
	$type = (string) atcf_arr( $field, 'type', 'text' );
	$name = $path . (string) atcf_arr( $field, 'name', '' );

	if ( 'none' === (string) atcf_arr( (array) atcf_get_field_type( $type ), 'value', 'string' ) ) {
		return null;
	}

	if ( 'repeater' === $type ) {
		$value = atcf_load_repeater( $field, $ref, $path, $formatted );
	} elseif ( 'flexible_content' === $type ) {
		$value = atcf_load_flexible( $field, $ref, $path, $formatted );
	} elseif ( 'group' === $type ) {
		$value = atcf_load_group_value( $field, $ref, $path, $formatted );
	} elseif ( 'clone' === $type ) {
		$value = atcf_load_clone( $field, $ref, $path, $formatted );
	} else {
		$value = atcf_read_raw( $ref, $name );

		if ( null === $value ) {
			// The default only applies to a field that has never been written.
			// Applying it to a stored empty string would make clearing a field
			// impossible: every save would put the default straight back.
			$value = atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'default_value', '' );
		}

		$value = atcf_maybe_unserialize_value( $value, $field );
	}

	if ( $formatted ) {
		$value = atcf_format_value( $value, $field, $ref );
	}

	/**
	 * Filters a loaded field value.
	 *
	 * @since 0.1.0
	 *
	 * @param mixed  $value     The value.
	 * @param array  $field     Canonical field.
	 * @param array  $ref       Object reference.
	 * @param bool   $formatted Whether the type's formatter has run.
	 */
	return apply_filters( 'atcf_load_value', $value, $field, $ref, $formatted );
}

/**
 * Runs a field type's formatter, if it has one.
 *
 * @since 0.1.0
 *
 * @param mixed $value The raw value.
 * @param array $field Canonical field.
 * @param array $ref   Object reference.
 * @return mixed The formatted value.
 */
function atcf_format_value( $value, $field, $ref = array() ) {
	$definition = atcf_get_field_type( (string) atcf_arr( $field, 'type', '' ) );

	if ( ! $definition || ! $definition['format'] || ! is_callable( $definition['format'] ) ) {
		return $value;
	}

	return call_user_func( $definition['format'], $value, $field, $ref );
}

/**
 * Restores a value that was stored as a serialized array.
 *
 * Only for the types that store one. Calling `maybe_unserialize()` on every
 * value would happily inflate a *string a person typed* that happens to look
 * like serialized data — which is both a data-integrity bug and, historically,
 * the shape of a PHP object-injection vulnerability.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @param array $field Canonical field.
 * @return mixed The value.
 */
function atcf_maybe_unserialize_value( $value, $field ) {
	$holds = (string) atcf_arr( (array) atcf_get_field_type( (string) atcf_arr( $field, 'type', '' ) ), 'value', 'string' );

	if ( ! in_array( $holds, array( 'ids', 'array', 'object' ), true ) ) {
		return $value;
	}

	if ( is_string( $value ) && is_serialized( $value ) ) {
		// `false` for the second argument: never unserialize an object. The only
		// shapes this plugin stores are arrays and scalars, so an object in the
		// stream is either corruption or an attack, and neither should be
		// instantiated.
		$restored = @unserialize( $value, array( 'allowed_classes' => false ) ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged

		return false === $restored && 'b:0;' !== $value ? array() : $restored;
	}

	if ( null === $value || '' === $value ) {
		return 'object' === $holds ? array() : array();
	}

	return $value;
}

/**
 * Loads a repeater's rows.
 *
 * @since 0.1.0
 *
 * @param array  $field     Canonical field.
 * @param array  $ref       Object reference.
 * @param string $path      Meta key prefix.
 * @param bool   $formatted Whether to format sub-values.
 * @return array[] Rows.
 */
function atcf_load_repeater( $field, $ref, $path, $formatted ) {
	$name  = $path . (string) atcf_arr( $field, 'name', '' );
	$count = (int) atcf_read_raw( $ref, $name );
	$subs  = (array) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'sub_fields', array() );
	$rows  = array();

	for ( $index = 0; $index < $count; $index++ ) {
		$row = array();

		foreach ( $subs as $sub ) {
			$row[ (string) atcf_arr( $sub, 'name', '' ) ] = atcf_load_value( $sub, $ref, $name . '_' . $index . '_', $formatted );
		}

		$rows[] = $row;
	}

	return $rows;
}

/**
 * Loads flexible content's rows.
 *
 * The row's own layout decides which sub-fields are read, so a layout that has
 * since been deleted from the group yields a row carrying only its layout name —
 * which is what a template's `switch` will fall through, rather than a fatal.
 *
 * @since 0.1.0
 *
 * @param array  $field     Canonical field.
 * @param array  $ref       Object reference.
 * @param string $path      Meta key prefix.
 * @param bool   $formatted Whether to format sub-values.
 * @return array[] Rows.
 */
function atcf_load_flexible( $field, $ref, $path, $formatted ) {
	$name    = $path . (string) atcf_arr( $field, 'name', '' );
	$layouts = atcf_maybe_unserialize_value( atcf_read_raw( $ref, $name ), array( 'type' => 'flexible_content' ) );
	$rows    = array();

	foreach ( (array) $layouts as $index => $layout_name ) {
		$layout = atcf_flexible_layout( $field, (string) $layout_name );
		$row    = array( 'atcf_layout' => (string) $layout_name );

		foreach ( (array) atcf_arr( (array) $layout, 'sub_fields', array() ) as $sub ) {
			$row[ (string) atcf_arr( $sub, 'name', '' ) ] = atcf_load_value( $sub, $ref, $name . '_' . $index . '_', $formatted );
		}

		$rows[] = $row;
	}

	return $rows;
}

/**
 * Loads a group's sub-values.
 *
 * @since 0.1.0
 *
 * @param array  $field     Canonical field.
 * @param array  $ref       Object reference.
 * @param string $path      Meta key prefix.
 * @param bool   $formatted Whether to format sub-values.
 * @return array The group.
 */
function atcf_load_group_value( $field, $ref, $path, $formatted ) {
	$name  = $path . (string) atcf_arr( $field, 'name', '' ) . '_';
	$value = array();

	foreach ( (array) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'sub_fields', array() ) as $sub ) {
		$value[ (string) atcf_arr( $sub, 'name', '' ) ] = atcf_load_value( $sub, $ref, $name, $formatted );
	}

	return $value;
}

/**
 * Loads a clone's fields.
 *
 * A clone is a pointer, so this resolves the keys it points at *now* rather than
 * whatever they were when the clone was made — which is the entire point of
 * cloning instead of copying.
 *
 * `prefix_name` decides whether the cloned fields store under their own names
 * (seamless, so `address_city` stays `address_city` wherever it is cloned) or
 * under the clone's (`billing_address_city`). Seamless is the default because
 * the common case is one canonical definition reused, and the values should land
 * in one canonical place.
 *
 * @since 0.1.0
 *
 * @param array  $field     Canonical field.
 * @param array  $ref       Object reference.
 * @param string $path      Meta key prefix.
 * @param bool   $formatted Whether to format sub-values.
 * @return array The cloned values.
 */
function atcf_load_clone( $field, $ref, $path, $formatted ) {
	$settings = (array) atcf_arr( $field, 'settings', array() );
	$prefix   = (bool) atcf_arr( $settings, 'prefix_name', false )
		? $path . (string) atcf_arr( $field, 'name', '' ) . '_'
		: $path;

	$value = array();

	foreach ( atcf_resolve_clone_fields( $field ) as $sub ) {
		$value[ (string) atcf_arr( $sub, 'name', '' ) ] = atcf_load_value( $sub, $ref, $prefix, $formatted );
	}

	return $value;
}

/**
 * The fields a clone currently points at.
 *
 * A key that names a whole *group* expands to that group's fields, which is the
 * form people reach for — "clone the SEO group into every post type".
 *
 * Guarded against cycles: a clone whose source contains a clone of itself would
 * otherwise recurse until the stack ran out, and a content model is exactly the
 * kind of thing somebody builds that shape into by accident.
 *
 * @since 0.1.0
 *
 * @param array    $field Canonical clone field.
 * @param string[] $seen  Keys already expanded on this path.
 * @return array[] The resolved fields.
 */
function atcf_resolve_clone_fields( $field, $seen = array() ) {
	$keys   = (array) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'clone_source', array() );
	$seen[] = (string) atcf_arr( $field, 'key', '' );
	$fields = array();

	foreach ( $keys as $key ) {
		if ( in_array( (string) $key, $seen, true ) ) {
			continue;
		}

		if ( 0 === strpos( (string) $key, 'group_' ) ) {
			foreach ( atcf_get_groups( true ) as $group ) {
				if ( $group['key'] === $key ) {
					$fields = array_merge( $fields, $group['fields'] );
				}
			}

			continue;
		}

		$target = atcf_get_field_by_key( (string) $key );

		if ( ! $target ) {
			continue;
		}

		if ( 'clone' === (string) atcf_arr( $target, 'type', '' ) ) {
			$fields = array_merge( $fields, atcf_resolve_clone_fields( $target, $seen ) );

			continue;
		}

		$fields[] = $target;
	}

	return $fields;
}

/**
 * Writes one field's value.
 *
 * @since 0.1.0
 *
 * @param array  $field Canonical field.
 * @param array  $ref   Object reference.
 * @param mixed  $value The value.
 * @param string $path  Meta key prefix.
 * @return void
 */
function atcf_save_value( $field, $ref, $value, $path = '' ) {
	$type = (string) atcf_arr( $field, 'type', 'text' );
	$name = $path . (string) atcf_arr( $field, 'name', '' );

	if ( 'none' === (string) atcf_arr( (array) atcf_get_field_type( $type ), 'value', 'string' ) ) {
		return;
	}

	/**
	 * Filters a value on its way to storage.
	 *
	 * Runs before sanitisation, so a filter here sees exactly what was
	 * submitted — which is what a filter wanting to normalise a legacy format
	 * needs.
	 *
	 * @since 0.1.0
	 *
	 * @param mixed  $value The value.
	 * @param array  $field Canonical field.
	 * @param array  $ref   Object reference.
	 * @param string $path  Meta key prefix.
	 */
	$value = apply_filters( 'atcf_pre_save_value', $value, $field, $ref, $path );

	if ( 'repeater' === $type ) {
		atcf_save_repeater( $field, $ref, $value, $path );
	} elseif ( 'flexible_content' === $type ) {
		atcf_save_flexible( $field, $ref, $value, $path );
	} elseif ( 'group' === $type ) {
		atcf_save_group_value( $field, $ref, $value, $path );
	} elseif ( 'clone' === $type ) {
		atcf_save_clone( $field, $ref, $value, $path );
	} else {
		atcf_write_raw( $ref, $name, atcf_sanitize_value( $value, $field ) );
	}

	// The reference row is written for containers too. It is what lets a reader
	// with only the meta key in hand — the bulk editor, an export, a
	// `meta_query` result — find the field that owns it.
	atcf_write_raw( $ref, '_' . $name, (string) atcf_arr( $field, 'key', '' ) );

	/**
	 * Fires after a field value is written.
	 *
	 * @since 0.1.0
	 *
	 * @param mixed  $value The value as submitted.
	 * @param array  $field Canonical field.
	 * @param array  $ref   Object reference.
	 * @param string $path  Meta key prefix.
	 */
	do_action( 'atcf_saved_value', $value, $field, $ref, $path );
}

/**
 * Runs a field type's sanitiser.
 *
 * A type with none gets `sanitize_text_field()`, never nothing. An unsanitised
 * default would mean a plugin registering a type and forgetting the callback had
 * built an unfiltered write into every screen its field appears on.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @param array $field Canonical field.
 * @return mixed Clean value.
 */
function atcf_sanitize_value( $value, $field ) {
	$definition = atcf_get_field_type( (string) atcf_arr( $field, 'type', '' ) );

	if ( $definition && $definition['sanitize'] && is_callable( $definition['sanitize'] ) ) {
		return call_user_func( $definition['sanitize'], $value, $field );
	}

	if ( is_array( $value ) ) {
		return array_map( 'sanitize_text_field', array_filter( $value, 'is_scalar' ) );
	}

	return sanitize_text_field( is_scalar( $value ) ? (string) $value : '' );
}

/**
 * Writes a repeater's rows.
 *
 * Rows past the new count are deleted rather than left behind. A repeater cut
 * from five rows to two that left rows three to five in the database would
 * resurrect all three the moment somebody added a row back.
 *
 * @since 0.1.0
 *
 * @param array  $field Canonical field.
 * @param array  $ref   Object reference.
 * @param mixed  $value Submitted rows.
 * @param string $path  Meta key prefix.
 * @return void
 */
function atcf_save_repeater( $field, $ref, $value, $path ) {
	$name  = $path . (string) atcf_arr( $field, 'name', '' );
	$subs  = (array) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'sub_fields', array() );
	$rows  = is_array( $value ) ? array_values( $value ) : array();
	$was   = (int) atcf_read_raw( $ref, $name );
	$max   = (int) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'max_items', 0 );
	$count = $max > 0 ? min( count( $rows ), $max ) : count( $rows );

	for ( $index = 0; $index < $count; $index++ ) {
		$row = is_array( $rows[ $index ] ) ? $rows[ $index ] : array();

		foreach ( $subs as $sub ) {
			$key = (string) atcf_arr( $sub, 'name', '' );

			atcf_save_value( $sub, $ref, atcf_arr( $row, $key, null ), $name . '_' . $index . '_' );
		}
	}

	for ( $index = $count; $index < $was; $index++ ) {
		atcf_delete_row( $subs, $ref, $name . '_' . $index . '_' );
	}

	atcf_write_raw( $ref, $name, $count );
}

/**
 * Writes flexible content's rows.
 *
 * @since 0.1.0
 *
 * @param array  $field Canonical field.
 * @param array  $ref   Object reference.
 * @param mixed  $value Submitted rows.
 * @param string $path  Meta key prefix.
 * @return void
 */
function atcf_save_flexible( $field, $ref, $value, $path ) {
	$name    = $path . (string) atcf_arr( $field, 'name', '' );
	$rows    = is_array( $value ) ? array_values( $value ) : array();
	$was     = (array) atcf_maybe_unserialize_value( atcf_read_raw( $ref, $name ), array( 'type' => 'flexible_content' ) );
	$written = array();

	foreach ( $rows as $index => $row ) {
		$row         = is_array( $row ) ? $row : array();
		$layout_name = (string) atcf_arr( $row, 'atcf_layout', atcf_arr( $row, 'layout', '' ) );
		$layout      = atcf_flexible_layout( $field, $layout_name );

		if ( ! $layout ) {
			continue;
		}

		foreach ( (array) atcf_arr( $layout, 'sub_fields', array() ) as $sub ) {
			$key = (string) atcf_arr( $sub, 'name', '' );

			atcf_save_value( $sub, $ref, atcf_arr( $row, $key, null ), $name . '_' . count( $written ) . '_' );
		}

		$written[] = $layout_name;
	}

	$before = count( $was );

	for ( $index = count( $written ); $index < $before; $index++ ) {
		$layout = atcf_flexible_layout( $field, (string) $was[ $index ] );

		atcf_delete_row( (array) atcf_arr( (array) $layout, 'sub_fields', array() ), $ref, $name . '_' . $index . '_' );
	}

	atcf_write_raw( $ref, $name, $written );
}

/**
 * Writes a group's sub-values.
 *
 * @since 0.1.0
 *
 * @param array  $field Canonical field.
 * @param array  $ref   Object reference.
 * @param mixed  $value Submitted sub-values.
 * @param string $path  Meta key prefix.
 * @return void
 */
function atcf_save_group_value( $field, $ref, $value, $path ) {
	$name  = $path . (string) atcf_arr( $field, 'name', '' ) . '_';
	$value = is_array( $value ) ? $value : array();

	foreach ( (array) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'sub_fields', array() ) as $sub ) {
		atcf_save_value( $sub, $ref, atcf_arr( $value, (string) atcf_arr( $sub, 'name', '' ), null ), $name );
	}
}

/**
 * Writes a clone's values.
 *
 * @since 0.1.0
 *
 * @param array  $field Canonical field.
 * @param array  $ref   Object reference.
 * @param mixed  $value Submitted values.
 * @param string $path  Meta key prefix.
 * @return void
 */
function atcf_save_clone( $field, $ref, $value, $path ) {
	$settings = (array) atcf_arr( $field, 'settings', array() );
	$prefix   = (bool) atcf_arr( $settings, 'prefix_name', false )
		? $path . (string) atcf_arr( $field, 'name', '' ) . '_'
		: $path;

	$value = is_array( $value ) ? $value : array();

	foreach ( atcf_resolve_clone_fields( $field ) as $sub ) {
		atcf_save_value( $sub, $ref, atcf_arr( $value, (string) atcf_arr( $sub, 'name', '' ), null ), $prefix );
	}
}

/**
 * Deletes every meta row belonging to one container row.
 *
 * Recursive, because a repeater inside a repeater leaves its own rows behind
 * otherwise — and those are invisible from every screen, so nobody ever finds
 * them until a `wp_postmeta` table has grown by a million rows.
 *
 * @since 0.1.0
 *
 * @param array[] $fields Sub-fields of the row.
 * @param array   $ref    Object reference.
 * @param string  $path   The row's meta key prefix.
 * @return void
 */
function atcf_delete_row( $fields, $ref, $path ) {
	foreach ( (array) $fields as $field ) {
		$name = $path . (string) atcf_arr( $field, 'name', '' );
		$type = (string) atcf_arr( $field, 'type', '' );

		if ( 'repeater' === $type ) {
			$count = (int) atcf_read_raw( $ref, $name );

			for ( $index = 0; $index < $count; $index++ ) {
				atcf_delete_row( atcf_field_sub_fields( $field ), $ref, $name . '_' . $index . '_' );
			}
		} elseif ( 'flexible_content' === $type ) {
			$layouts = (array) atcf_maybe_unserialize_value( atcf_read_raw( $ref, $name ), array( 'type' => 'flexible_content' ) );

			foreach ( $layouts as $index => $layout_name ) {
				$layout = atcf_flexible_layout( $field, (string) $layout_name );

				atcf_delete_row( (array) atcf_arr( (array) $layout, 'sub_fields', array() ), $ref, $name . '_' . $index . '_' );
			}
		} elseif ( 'group' === $type ) {
			atcf_delete_row( atcf_field_sub_fields( $field ), $ref, $name . '_' );
		}

		atcf_delete_raw( $ref, $name );
		atcf_delete_raw( $ref, '_' . $name );
	}
}
