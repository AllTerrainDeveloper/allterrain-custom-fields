<?php
/**
 * The basic types.
 *
 * Text, paragraph, number, range, email, URL, password. Between them they are
 * most of what most sites use, and they are the types where "premium" never made
 * any sense at all — a character counter and a min/max were sold as an upgrade
 * for a decade.
 *
 * Each one renders through {@see atcf_control_input()} rather than echoing its
 * own markup, because the wrapper, the label pairing, the `aria-describedby`
 * wiring and the `aria-invalid` handling are the same for all of them and are
 * exactly the parts that rot when they are copied seven times.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'atcf_register_basic_types', 6 );

/**
 * Registers the basic field types.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_basic_types() {
	atcf_register_field_type(
		'text',
		array(
			'label'       => __( 'Text', 'allterrain-fields' ),
			'description' => __( 'One line of plain text.', 'allterrain-fields' ),
			'group'       => 'basic',
			'icon'        => 'dashicons-editor-textcolor',
			'value'       => 'string',
			'settings'    => array(
				'default_value' => '',
				'placeholder'   => '',
				'prepend'       => '',
				'append'        => '',
				'maxlength'     => 0,
				'pattern'       => '',
				'unique'        => false,
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper', 'readonly' ),
			// A dragged post, term or user all have a title, and dropping one on
			// a text field to get its name is a gesture people try immediately.
			// It costs nothing to be right about it.
			'accepts'     => array( 'text', 'post', 'term', 'user' ),
			'sanitize'    => 'atcf_sanitize_text',
			'control'     => 'atcf_control_text',
		)
	);

	atcf_register_field_type(
		'textarea',
		array(
			'label'       => __( 'Paragraph', 'allterrain-fields' ),
			'description' => __( 'Several lines of plain text.', 'allterrain-fields' ),
			'group'       => 'basic',
			'icon'        => 'dashicons-editor-paragraph',
			'value'       => 'string',
			'settings'    => array(
				'default_value' => '',
				'placeholder'   => '',
				'rows'          => 5,
				'maxlength'     => 0,
				'new_lines'     => 'wpautop',
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper', 'readonly' ),
			'accepts'     => array( 'text' ),
			'sanitize'    => 'atcf_sanitize_textarea',
			'format'      => 'atcf_format_textarea',
			'control'     => 'atcf_control_textarea',
		)
	);

	atcf_register_field_type(
		'number',
		array(
			'label'       => __( 'Number', 'allterrain-fields' ),
			'description' => __( 'A number, with an optional range and step.', 'allterrain-fields' ),
			'group'       => 'basic',
			'icon'        => 'dashicons-calculator',
			'value'       => 'number',
			'settings'    => array(
				'default_value' => '',
				'placeholder'   => '',
				'prepend'       => '',
				'append'        => '',
				'min'           => '',
				'max'           => '',
				'step'          => '',
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper', 'readonly' ),
			'sanitize'    => 'atcf_sanitize_number',
			'format'      => 'atcf_format_number',
			'control'     => 'atcf_control_number',
		)
	);

	atcf_register_field_type(
		'range',
		array(
			'label'       => __( 'Slider', 'allterrain-fields' ),
			'description' => __( 'A number chosen by dragging, with the value shown.', 'allterrain-fields' ),
			'group'       => 'basic',
			'icon'        => 'dashicons-leftright',
			'value'       => 'number',
			'settings'    => array(
				'default_value' => 0,
				'min'           => 0,
				'max'           => 100,
				'step'          => 1,
				'prepend'       => '',
				'append'        => '',
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_number',
			'format'      => 'atcf_format_number',
			'control'     => 'atcf_control_range',
		)
	);

	atcf_register_field_type(
		'email',
		array(
			'label'       => __( 'Email', 'allterrain-fields' ),
			'description' => __( 'An email address, validated on both sides.', 'allterrain-fields' ),
			'group'       => 'basic',
			'icon'        => 'dashicons-email',
			'value'       => 'string',
			'settings'    => array(
				'default_value' => '',
				'placeholder'   => '',
				'prepend'       => '',
				'append'        => '',
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			'accepts'     => array( 'text', 'user' ),
			'sanitize'    => 'atcf_sanitize_email',
			'control'     => 'atcf_control_email',
		)
	);

	atcf_register_field_type(
		'url',
		array(
			'label'       => __( 'URL', 'allterrain-fields' ),
			'description' => __( 'A web address.', 'allterrain-fields' ),
			'group'       => 'basic',
			'icon'        => 'dashicons-admin-links',
			'value'       => 'string',
			'settings'    => array(
				'default_value' => '',
				'placeholder'   => '',
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			// A post dropped here becomes its permalink, which is the only thing
			// a URL field could possibly want from one.
			'accepts'     => array( 'text', 'post', 'media' ),
			'sanitize'    => 'atcf_sanitize_url',
			'control'     => 'atcf_control_url',
		)
	);

	atcf_register_field_type(
		'password',
		array(
			'label'       => __( 'Password', 'allterrain-fields' ),
			'description' => __( 'A masked value. Stored as typed — this is not a hash.', 'allterrain-fields' ),
			'group'       => 'basic',
			'icon'        => 'dashicons-lock',
			'value'       => 'string',
			'settings'    => array(
				'placeholder' => '',
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_text',
			'control'     => 'atcf_control_password',
		)
	);
}

/**
 * Sanitises a single-line text value.
 *
 * `sanitize_text_field()` and not `wp_kses_post()`: a text field is a text
 * field, and a site that wants markup in one has reached for the wrong type.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @param array $field The field definition.
 * @return string Clean value.
 */
function atcf_sanitize_text( $value, $field = array() ) {
	$value = sanitize_text_field( is_scalar( $value ) ? (string) $value : '' );
	$limit = (int) atcf_arr( atcf_arr( $field, 'settings', array() ), 'maxlength', 0 );

	// Trimmed rather than rejected. The control already stops a person typing
	// past the limit, so a value that arrives over it came from an import or an
	// API call — and failing a whole import over one long string helps nobody.
	if ( $limit > 0 && mb_strlen( $value ) > $limit ) {
		$value = mb_substr( $value, 0, $limit );
	}

	return $value;
}

/**
 * Sanitises a multi-line text value.
 *
 * Newlines survive, which `sanitize_text_field()` would eat.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @param array $field The field definition.
 * @return string Clean value.
 */
function atcf_sanitize_textarea( $value, $field = array() ) {
	$value = sanitize_textarea_field( is_scalar( $value ) ? (string) $value : '' );
	$limit = (int) atcf_arr( atcf_arr( $field, 'settings', array() ), 'maxlength', 0 );

	if ( $limit > 0 && mb_strlen( $value ) > $limit ) {
		$value = mb_substr( $value, 0, $limit );
	}

	return $value;
}

/**
 * Turns stored paragraph text into what a theme should echo.
 *
 * The `new_lines` setting decides, because "the value with the line breaks I
 * typed" and "the value as HTML" are both reasonable things to want and neither
 * is safely guessable. `none` returns it untouched, which is the right answer
 * for a value going into an attribute or a JSON response.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @param array $field The field definition.
 * @return string Formatted value.
 */
function atcf_format_textarea( $value, $field = array() ) {
	$value = (string) $value;
	$mode  = (string) atcf_arr( atcf_arr( $field, 'settings', array() ), 'new_lines', 'wpautop' );

	if ( 'wpautop' === $mode ) {
		return wpautop( $value );
	}

	if ( 'br' === $mode ) {
		return nl2br( $value );
	}

	return $value;
}

/**
 * Sanitises a numeric value.
 *
 * An empty string stays an empty string rather than becoming `0`. Those are
 * genuinely different — "nobody has filled this in" and "somebody said zero" —
 * and collapsing them is how a price field on an unedited post starts reading
 * "Free".
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @param array $field The field definition.
 * @return string|float Clean value.
 */
function atcf_sanitize_number( $value, $field = array() ) {
	if ( '' === $value || null === $value || array() === $value ) {
		return '';
	}

	$number   = is_numeric( $value ) ? $value + 0 : 0;
	$settings = (array) atcf_arr( $field, 'settings', array() );
	$min      = atcf_arr( $settings, 'min', '' );
	$max      = atcf_arr( $settings, 'max', '' );

	// Clamped, not rejected — same reasoning as the character limit. The control
	// enforces the range live; a value outside it arrived from somewhere with no
	// control attached.
	if ( '' !== $min && is_numeric( $min ) ) {
		$number = max( $number, $min + 0 );
	}

	if ( '' !== $max && is_numeric( $max ) ) {
		$number = min( $number, $max + 0 );
	}

	return $number;
}

/**
 * Returns a stored number as a number rather than as the string meta gave back.
 *
 * `get_post_meta()` hands back strings for everything, so a theme doing
 * `atcf_get_field( 'price' ) > 10` was comparing a string to an integer. An
 * integral value comes back as `int` and a fractional one as `float`, because
 * `"3"` becoming `3.0` shows up in every `json_encode` and every template that
 * echoes it.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @return int|float|string The number, or an empty string when unset.
 */
function atcf_format_number( $value ) {
	if ( '' === $value || null === $value ) {
		return '';
	}

	if ( ! is_numeric( $value ) ) {
		return '';
	}

	$number = $value + 0;

	return ( is_float( $number ) && floor( $number ) === $number && abs( $number ) < PHP_INT_MAX )
		? (int) $number
		: $number;
}

/**
 * Sanitises an email address.
 *
 * An address that fails `is_email()` is stored as an empty string rather than
 * kept: the validator has already refused the save with a message pointing at
 * this field, so anything reaching here is an import, and an import writing
 * `not an email` into a field a theme will put in a `mailto:` is worse than a
 * blank.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return string Clean address, or an empty string.
 */
function atcf_sanitize_email( $value ) {
	$value = sanitize_email( is_scalar( $value ) ? (string) $value : '' );

	return is_email( $value ) ? $value : '';
}

/**
 * Sanitises a URL.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return string Clean URL, or an empty string.
 */
function atcf_sanitize_url( $value ) {
	return esc_url_raw( is_scalar( $value ) ? (string) $value : '' );
}
