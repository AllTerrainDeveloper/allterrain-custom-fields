<?php
/**
 * The advanced types.
 *
 * Dates, colour, icon, location, table, JSON — and `computed`, which is the one
 * worth explaining.
 *
 * A computed field holds a value nobody types. It holds an expression over the
 * other fields beside it — `{price} * {quantity}`, `{width} * {height} / 144` —
 * evaluated as you edit and again on save. Every custom-fields plugin has
 * eventually grown one of these, and every one of them implemented it with
 * `eval()`, which means the expression somebody with `manage_options` typed into
 * a field group runs as PHP on every save of every post forever.
 *
 * This one is a shunting-yard parser over a fixed token set. It cannot call a
 * function it was not given, cannot reach a variable that is not a sibling
 * field, and cannot loop. That is not paranoia about the site administrator: it
 * is that a stored expression is a stored *program*, and a stored program that
 * an importer, a REST write or a compromised admin session can set is a remote
 * code execution waiting for its moment.
 *
 * The parser exists twice — here and in `src/shared/calc.ts` — because the
 * browser has to show the total as you type and the server has to decide what
 * gets stored. Both run one shared case table in `tests/fixtures/calc-cases.json`.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'atcf_register_advanced_types', 6 );

/**
 * Registers the advanced field types.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_advanced_types() {
	atcf_register_field_type(
		'date_picker',
		array(
			'label'       => __( 'Date', 'allterrain-fields' ),
			'description' => __( 'A day, stored sortably.', 'allterrain-fields' ),
			'group'       => 'advanced',
			'icon'        => 'dashicons-calendar-alt',
			'value'       => 'string',
			'settings'    => array(
				'display_format' => 'j F Y',
				'return_date'    => 'Y-m-d',
				'first_day'      => 1,
				'min'            => '',
				'max'            => '',
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_date',
			'format'      => 'atcf_format_date',
			'control'     => 'atcf_control_date',
		)
	);

	atcf_register_field_type(
		'date_time_picker',
		array(
			'label'       => __( 'Date and time', 'allterrain-fields' ),
			'description' => __( 'A moment, stored sortably.', 'allterrain-fields' ),
			'group'       => 'advanced',
			'icon'        => 'dashicons-clock',
			'value'       => 'string',
			'settings'    => array(
				'display_format' => 'j F Y, g:i a',
				'return_date'    => 'Y-m-d H:i:s',
				'first_day'      => 1,
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_datetime',
			'format'      => 'atcf_format_date',
			'control'     => 'atcf_control_datetime',
		)
	);

	atcf_register_field_type(
		'time_picker',
		array(
			'label'       => __( 'Time', 'allterrain-fields' ),
			'description' => __( 'A time of day.', 'allterrain-fields' ),
			'group'       => 'advanced',
			'icon'        => 'dashicons-clock',
			'value'       => 'string',
			'settings'    => array(
				'display_format' => 'g:i a',
				'return_date'    => 'H:i:s',
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_time',
			'format'      => 'atcf_format_date',
			'control'     => 'atcf_control_time',
		)
	);

	atcf_register_field_type(
		'color_picker',
		array(
			'label'       => __( 'Colour', 'allterrain-fields' ),
			'description' => __( 'A colour, with the site palette as swatches.', 'allterrain-fields' ),
			'group'       => 'advanced',
			'icon'        => 'dashicons-art',
			'value'       => 'string',
			'settings'    => array(
				'default_value' => '',
				'return_format' => 'string',
				'opacity'       => false,
				'palette'       => array(),
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			// A colour lifted anywhere in the shell — a swatch in a theme editor,
			// a picked pixel in an image tool — arrives as a `text` payload that
			// happens to be a hex triple, and landing it here is the obvious
			// gesture.
			'accepts'     => array( 'text' ),
			'sanitize'    => 'atcf_sanitize_color',
			'format'      => 'atcf_format_color',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'icon',
		array(
			'label'       => __( 'Icon', 'allterrain-fields' ),
			'description' => __( 'A Dashicon, picked by looking at them.', 'allterrain-fields' ),
			'group'       => 'advanced',
			'icon'        => 'dashicons-star-filled',
			'value'       => 'string',
			'settings'    => array(
				'default_value' => '',
				'allow_null'    => true,
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_icon',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'location',
		array(
			'label'       => __( 'Location', 'allterrain-fields' ),
			'description' => __( 'An address with coordinates. No third-party map key required.', 'allterrain-fields' ),
			'group'       => 'advanced',
			'icon'        => 'dashicons-location',
			'value'       => 'object',
			'settings'    => array(
				'zoom'          => 12,
				'return_format' => 'array',
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper' ),
			'accepts'     => array( 'text' ),
			'sanitize'    => 'atcf_sanitize_location',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'table',
		array(
			'label'       => __( 'Table', 'allterrain-fields' ),
			'description' => __( 'A grid of plain cells, with named columns.', 'allterrain-fields' ),
			'group'       => 'advanced',
			'icon'        => 'dashicons-editor-table',
			'value'       => 'array',
			'settings'    => array(
				'columns'   => array(),
				'min_items' => 0,
				'max_items' => 0,
				'header'    => true,
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_table',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'json',
		array(
			'label'       => __( 'JSON', 'allterrain-fields' ),
			'description' => __( 'Structured data, validated as you type.', 'allterrain-fields' ),
			'group'       => 'advanced',
			'icon'        => 'dashicons-media-code',
			'value'       => 'object',
			'settings'    => array(
				'rows' => 8,
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_json',
			'format'      => 'atcf_format_json',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'computed',
		array(
			'label'       => __( 'Computed', 'allterrain-fields' ),
			'description' => __( 'A number worked out from the fields beside it. Nobody types into it.', 'allterrain-fields' ),
			'group'       => 'advanced',
			'icon'        => 'dashicons-calculator',
			'value'       => 'number',
			'settings'    => array(
				'formula'  => '',
				'decimals' => 2,
				'prepend'  => '',
				'append'   => '',
				'store'    => true,
			),
			// No `required` and no `default`: a field the user cannot type into
			// cannot be required of them, and a default it would overwrite on
			// the first save is a default that never existed.
			'supports'    => array( 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_number',
			'format'      => 'atcf_format_number',
			'mount'       => true,
		)
	);
}

/**
 * Stores a date as `Y-m-d`, whatever it arrived as.
 *
 * Sortable storage is not a detail: `meta_query` with `type => DATE` and every
 * "posts between these dates" query on the internet assumes it. A field storing
 * `3 March 2026` is a field nobody can order by.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return string `Y-m-d`, or an empty string.
 */
function atcf_sanitize_date( $value ) {
	return atcf_normalize_datetime( $value, 'Y-m-d' );
}

/**
 * Stores a date and time as `Y-m-d H:i:s`.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return string `Y-m-d H:i:s`, or an empty string.
 */
function atcf_sanitize_datetime( $value ) {
	return atcf_normalize_datetime( $value, 'Y-m-d H:i:s' );
}

/**
 * Stores a time as `H:i:s`.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return string `H:i:s`, or an empty string.
 */
function atcf_sanitize_time( $value ) {
	return atcf_normalize_datetime( $value, 'H:i:s' );
}

/**
 * Parses whatever arrived into a canonical string.
 *
 * `strtotime()` rather than a format list, because the value can come from an
 * `<input type="date">` (ISO), an import (anything), a drag payload, or a person
 * typing. Anything it cannot read stores as empty rather than as `1970-01-01`,
 * which is what a naive `(int)` cast produces and which then quietly sorts to
 * the top of every archive.
 *
 * @since 0.1.0
 *
 * @param mixed  $value  Raw value.
 * @param string $format Target format.
 * @return string The formatted value, or an empty string.
 */
function atcf_normalize_datetime( $value, $format ) {
	if ( ! is_scalar( $value ) || '' === (string) $value ) {
		return '';
	}

	$value = trim( (string) $value );

	// A bare time has no date for `strtotime()` to anchor on, and on the last
	// day of a month "31" as a time reads as a date. Anchoring it explicitly is
	// cheaper than discovering that once a month.
	if ( 'H:i:s' === $format && preg_match( '/^\d{1,2}:\d{2}(:\d{2})?$/', $value ) ) {
		$value = '1970-01-01 ' . $value;
	}

	$stamp = strtotime( $value );

	return false === $stamp ? '' : gmdate( $format, $stamp );
}

/**
 * Formats a stored date for a template.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @param array $field The field definition.
 * @return string The value in the field's return format.
 */
function atcf_format_date( $value, $field = array() ) {
	if ( ! is_scalar( $value ) || '' === (string) $value ) {
		return '';
	}

	$format = (string) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'return_date', '' );

	if ( '' === $format ) {
		return (string) $value;
	}

	$stamp = strtotime( (string) $value );

	return false === $stamp ? '' : wp_date( $format, $stamp );
}

/**
 * Sanitises a colour.
 *
 * Hex with or without alpha. Anything else stores empty — a colour field's value
 * ends up in a `style` attribute, and a value that is not a colour there is
 * either broken CSS or, with the right punctuation, an escape from it.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return string A `#rgb`, `#rrggbb` or `#rrggbbaa` string, or empty.
 */
function atcf_sanitize_color( $value ) {
	$value = trim( (string) ( is_scalar( $value ) ? $value : '' ) );

	if ( '' === $value ) {
		return '';
	}

	if ( preg_match( '/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $value, $matches ) ) {
		return '#' . strtolower( $matches[1] );
	}

	return '';
}

/**
 * Formats a colour, optionally as its components.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @param array $field The field definition.
 * @return string|array The hex string, or `array( r, g, b, a )`.
 */
function atcf_format_color( $value, $field = array() ) {
	$hex    = (string) $value;
	$format = (string) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'return_format', 'string' );

	if ( 'string' === $format || '' === $hex ) {
		return $hex;
	}

	$raw = ltrim( $hex, '#' );

	if ( 3 === strlen( $raw ) ) {
		$raw = $raw[0] . $raw[0] . $raw[1] . $raw[1] . $raw[2] . $raw[2];
	}

	return array(
		'red'   => (int) hexdec( substr( $raw, 0, 2 ) ),
		'green' => (int) hexdec( substr( $raw, 2, 2 ) ),
		'blue'  => (int) hexdec( substr( $raw, 4, 2 ) ),
		'alpha' => 8 === strlen( $raw ) ? round( hexdec( substr( $raw, 6, 2 ) ) / 255, 2 ) : 1,
	);
}

/**
 * Sanitises a Dashicons class.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return string The class, or an empty string.
 */
function atcf_sanitize_icon( $value ) {
	$value = sanitize_html_class( (string) ( is_scalar( $value ) ? $value : '' ) );

	return 0 === strpos( $value, 'dashicons-' ) ? $value : '';
}

/**
 * Sanitises a location.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return array|string The location, or an empty string when there is no point.
 */
function atcf_sanitize_location( $value ) {
	if ( ! is_array( $value ) ) {
		return '';
	}

	$lat = atcf_arr( $value, 'lat', '' );
	$lng = atcf_arr( $value, 'lng', '' );

	if ( ! is_numeric( $lat ) || ! is_numeric( $lng ) ) {
		return '';
	}

	// Clamped to the actual planet. A coordinate outside these ranges is not a
	// place, and every map library reacts to one differently — some wrap, some
	// throw, some render the ocean.
	//
	// Cast *after* the clamp, not before. `min()` returns whichever argument
	// won, so `min( 90, 999.0 )` hands back the integer literal and a clamped
	// coordinate would store as `90` where an unclamped one stores as `51.5074`
	// — two types out of one field, which every consumer then has to defend
	// against.
	$lat = (float) max( -90, min( 90, (float) $lat ) );
	$lng = (float) max( -180, min( 180, (float) $lng ) );

	return array(
		'lat'      => $lat,
		'lng'      => $lng,
		'address'  => sanitize_text_field( (string) atcf_arr( $value, 'address', '' ) ),
		'zoom'     => max( 1, min( 20, (int) atcf_arr( $value, 'zoom', 12 ) ) ),
		'city'     => sanitize_text_field( (string) atcf_arr( $value, 'city', '' ) ),
		'country'  => sanitize_text_field( (string) atcf_arr( $value, 'country', '' ) ),
		'postcode' => sanitize_text_field( (string) atcf_arr( $value, 'postcode', '' ) ),
	);
}

/**
 * Sanitises a table.
 *
 * Every cell is plain text and every row has exactly the declared columns, so a
 * template can loop it without checking each cell exists.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @param array $field The field definition.
 * @return array[] Rows.
 */
function atcf_sanitize_table( $value, $field = array() ) {
	if ( ! is_array( $value ) ) {
		return array();
	}

	$settings = (array) atcf_arr( $field, 'settings', array() );
	$columns  = array();

	foreach ( (array) atcf_arr( $settings, 'columns', array() ) as $column ) {
		// Both spellings, because both exist: the builder's column editor
		// writes `value`/`label` (it is the choices editor wearing another
		// hat), and hand-written registrations say `key`. Reading only one of
		// them is how every builder-made table was sanitised against an empty
		// column list — which blanked every cell on save.
		$key = is_array( $column )
			? (string) atcf_arr( $column, 'key', (string) atcf_arr( $column, 'value', '' ) )
			: (string) $column;
		$key = atcf_sanitize_field_name( $key );

		if ( '' !== $key ) {
			$columns[] = $key;
		}
	}

	$max  = (int) atcf_arr( $settings, 'max_items', 0 );
	$rows = array();

	foreach ( $value as $row ) {
		if ( ! is_array( $row ) ) {
			continue;
		}

		$clean = array();

		foreach ( $columns as $key ) {
			$clean[ $key ] = sanitize_text_field( (string) atcf_arr( $row, $key, '' ) );
		}

		// A row where every cell is blank is a row somebody added and left. It
		// is stored anyway: deleting it here would make the Add Row button look
		// broken, since the row would vanish on save.
		$rows[] = $clean;

		if ( $max > 0 && count( $rows ) >= $max ) {
			break;
		}
	}

	return $rows;
}

/**
 * Sanitises a JSON value.
 *
 * Stored as the *string* it arrived as when it parses, so the author's
 * formatting survives a round trip. Storing the decoded array and re-encoding
 * would reorder keys and collapse the indentation somebody deliberately wrote.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return string Valid JSON, or an empty string.
 */
function atcf_sanitize_json( $value ) {
	if ( is_array( $value ) || is_object( $value ) ) {
		$encoded = wp_json_encode( $value );

		return is_string( $encoded ) ? $encoded : '';
	}

	$value = trim( (string) ( is_scalar( $value ) ? $value : '' ) );

	if ( '' === $value ) {
		return '';
	}

	json_decode( $value );

	return JSON_ERROR_NONE === json_last_error() ? $value : '';
}

/**
 * Decodes a stored JSON value for a template.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @return mixed The decoded value, or null.
 */
function atcf_format_json( $value ) {
	if ( ! is_string( $value ) || '' === $value ) {
		return null;
	}

	$decoded = json_decode( $value, true );

	return JSON_ERROR_NONE === json_last_error() ? $decoded : null;
}
