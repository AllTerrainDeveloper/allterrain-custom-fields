<?php
/**
 * The choice types.
 *
 * Dropdown, radios, checkboxes, button group, true/false. All five read the same
 * `choices` setting and differ only in how they present it, which is why the
 * builder lets you change one into another without losing the choices you typed
 * — a change of mind about presentation should not be a retyping exercise.
 *
 * A choice is stored as its **value**, never as its label. Labels are copy and
 * get rewritten; a stored label means every post breaks the day somebody fixes a
 * typo in the dropdown.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'atcf_register_choice_types', 6 );

/**
 * Registers the choice field types.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_choice_types() {
	$choice_settings = array(
		'choices'       => array(),
		'default_value' => '',
		'allow_null'    => false,
		'multiple'      => false,
		'return_format' => 'value',
	);

	atcf_register_field_type(
		'select',
		array(
			'label'       => __( 'Dropdown', 'allterrain-fields' ),
			'description' => __( 'Pick one of a list, or several.', 'allterrain-fields' ),
			'group'       => 'choice',
			'icon'        => 'dashicons-arrow-down-alt2',
			'value'       => 'string',
			'settings'    => array_merge(
				$choice_settings,
				array(
					'ui'          => true,
					'placeholder' => '',
				)
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper', 'multiple' ),
			'sanitize'    => 'atcf_sanitize_choice',
			'format'      => 'atcf_format_choice',
			'control'     => 'atcf_control_select',
		)
	);

	atcf_register_field_type(
		'radio',
		array(
			'label'       => __( 'Radio buttons', 'allterrain-fields' ),
			'description' => __( 'Pick exactly one, with every option visible.', 'allterrain-fields' ),
			'group'       => 'choice',
			'icon'        => 'dashicons-marker',
			'value'       => 'string',
			'settings'    => array_merge( $choice_settings, array( 'layout' => 'vertical' ) ),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_choice',
			'format'      => 'atcf_format_choice',
			'control'     => 'atcf_control_radio',
		)
	);

	atcf_register_field_type(
		'checkbox',
		array(
			'label'       => __( 'Checkboxes', 'allterrain-fields' ),
			'description' => __( 'Pick any number of a list.', 'allterrain-fields' ),
			'group'       => 'choice',
			'icon'        => 'dashicons-yes',
			'value'       => 'array',
			'settings'    => array_merge(
				$choice_settings,
				array(
					'layout'   => 'vertical',
					'multiple' => true,
				)
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_choice',
			'format'      => 'atcf_format_choice',
			'control'     => 'atcf_control_checkbox',
		)
	);

	atcf_register_field_type(
		'button_group',
		array(
			'label'       => __( 'Button group', 'allterrain-fields' ),
			'description' => __( 'One of a few, as a segmented control.', 'allterrain-fields' ),
			'group'       => 'choice',
			'icon'        => 'dashicons-editor-kitchensink',
			'value'       => 'string',
			'settings'    => $choice_settings,
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_choice',
			'format'      => 'atcf_format_choice',
			'control'     => 'atcf_control_button_group',
		)
	);

	atcf_register_field_type(
		'true_false',
		array(
			'label'       => __( 'Switch', 'allterrain-fields' ),
			'description' => __( 'On or off.', 'allterrain-fields' ),
			'group'       => 'choice',
			'icon'        => 'dashicons-controls-play',
			'value'       => 'boolean',
			'settings'    => array(
				'default_value' => false,
				'message'       => '',
				'ui'            => true,
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			'sanitize'    => 'atcf_sanitize_bool',
			'format'      => 'atcf_format_bool',
			'control'     => 'atcf_control_true_false',
		)
	);
}

/**
 * Normalises the `choices` setting into a list of `{ value, label }`.
 *
 * Three shapes reach this. The builder writes the list form. An import
 * writes a `value => label` map. And somebody hand-editing JSON writes a flat
 * list of strings, meaning "the value is the label". All three are common enough
 * that refusing two of them would be a bug report a week.
 *
 * @since 0.1.0
 *
 * @param mixed $choices Raw setting.
 * @return array[] List of `array( 'value' => string, 'label' => string )`.
 */
function atcf_normalize_choices( $choices ) {
	if ( is_string( $choices ) ) {
		// The one-per-line form settings textareas produce, with an optional
		// `value : Label` split.
		$choices = array_filter( array_map( 'trim', explode( "\n", $choices ) ), 'strlen' );
	}

	if ( ! is_array( $choices ) ) {
		return array();
	}

	$out = array();

	foreach ( $choices as $key => $choice ) {
		if ( is_array( $choice ) ) {
			$value = (string) atcf_arr( $choice, 'value', '' );
			$label = (string) atcf_arr( $choice, 'label', $value );
		} elseif ( is_string( $key ) ) {
			$value = (string) $key;
			$label = (string) $choice;
		} else {
			$parts = array_map( 'trim', explode( ':', (string) $choice, 2 ) );
			$value = $parts[0];
			$label = isset( $parts[1] ) && '' !== $parts[1] ? $parts[1] : $parts[0];
		}

		if ( '' === $value ) {
			continue;
		}

		$out[] = array(
			'value' => $value,
			'label' => '' === $label ? $value : $label,
		);
	}

	return $out;
}

/**
 * Whether a field holds more than one choice at a time.
 *
 * Checkboxes always do; a dropdown does when it was told to. Asked as a function
 * because three separate places need the same answer and one of them getting it
 * wrong turns an array into the string `Array`.
 *
 * @since 0.1.0
 *
 * @param array $field The field definition.
 * @return bool True when the value is a list.
 */
function atcf_choice_is_multiple( $field ) {
	$type     = (string) atcf_arr( $field, 'type', '' );
	$settings = (array) atcf_arr( $field, 'settings', array() );

	if ( 'checkbox' === $type ) {
		return true;
	}

	return (bool) atcf_arr( $settings, 'multiple', false );
}

/**
 * Sanitises a choice value against the field's own list.
 *
 * A value not in the list is dropped. That is the whole point of a choice field:
 * the set of legal values is declared, so anything else is either an import
 * error or somebody editing a `<select>` in devtools, and neither should end up
 * in the database.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @param array $field The field definition.
 * @return string|string[] Clean value.
 */
function atcf_sanitize_choice( $value, $field = array() ) {
	$settings = (array) atcf_arr( $field, 'settings', array() );
	$choices  = atcf_normalize_choices( atcf_arr( $settings, 'choices', array() ) );
	$legal    = wp_list_pluck( $choices, 'value' );
	$multiple = atcf_choice_is_multiple( $field );

	$given = is_array( $value ) ? $value : ( '' === $value || null === $value ? array() : array( $value ) );
	$given = array_map( static fn( $item ) => is_scalar( $item ) ? (string) $item : '', $given );

	// A field with no choices declared yet accepts what it is given. The builder
	// can add a field before its choices are typed, and dropping the value the
	// moment somebody saves in between would look like the save had failed.
	$clean = $legal ? array_values( array_intersect( $given, $legal ) ) : array_values( array_filter( $given, 'strlen' ) );

	if ( $multiple ) {
		return $clean;
	}

	return $clean ? $clean[0] : '';
}

/**
 * Turns a stored choice into what the theme asked for.
 *
 * `return_format` picks between the value, the label, or both as an array. Both
 * is the one that saves a template a second lookup — a select showing "Draft"
 * for `draft` needs both halves and had to hardcode the map to get them.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @param array $field The field definition.
 * @return mixed Formatted value.
 */
function atcf_format_choice( $value, $field = array() ) {
	$settings = (array) atcf_arr( $field, 'settings', array() );
	$format   = (string) atcf_arr( $settings, 'return_format', 'value' );
	$choices  = atcf_normalize_choices( atcf_arr( $settings, 'choices', array() ) );
	$labels   = wp_list_pluck( $choices, 'label', 'value' );
	$multiple = atcf_choice_is_multiple( $field );

	$shape = static function ( $one ) use ( $format, $labels ) {
		$one   = (string) $one;
		$label = isset( $labels[ $one ] ) ? $labels[ $one ] : $one;

		if ( 'label' === $format ) {
			return $label;
		}

		if ( 'both' === $format ) {
			return array(
				'value' => $one,
				'label' => $label,
			);
		}

		return $one;
	};

	if ( $multiple ) {
		$list = is_array( $value ) ? $value : ( '' === $value || null === $value ? array() : array( $value ) );

		return array_map( $shape, $list );
	}

	if ( '' === $value || null === $value ) {
		return '';
	}

	return $shape( is_array( $value ) ? reset( $value ) : $value );
}

/**
 * Sanitises a boolean.
 *
 * Stored as `'1'` or `'0'` rather than as `true`/`false`, because meta is
 * strings either way and PHP's `false` serialises to an empty string — which is
 * indistinguishable from "never set". A site querying `meta_value = '0'` for
 * every post with the switch off needs the row to exist and to say so.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return string `'1'` or `'0'`.
 */
function atcf_sanitize_bool( $value ) {
	if ( is_string( $value ) ) {
		$value = in_array( strtolower( $value ), array( 'false', '0', '', 'no', 'off' ), true ) ? false : true;
	}

	return $value ? '1' : '0';
}

/**
 * Returns a stored boolean as a real boolean.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @return bool The value.
 */
function atcf_format_bool( $value ) {
	return '1' === (string) $value || true === $value;
}
