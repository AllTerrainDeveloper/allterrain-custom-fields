<?php
/**
 * Rendering a field.
 *
 * Every control here is **plain, semantic, working HTML**. No `<os-*>` tag is
 * printed by PHP, and that is a deliberate decision rather than an omission.
 *
 * A field renders in four places that do not share a JavaScript environment: the
 * classic editor, the block editor's metabox, a term or user screen, and inside
 * an OpenStation chromeless iframe. The component kit is reachable in one of
 * them by default. Printing `<os-text-field>` where the kit has not loaded gives
 * an inert custom element — a field that looks like nothing and stores nothing —
 * and the failure is invisible until somebody's post loses its subtitle.
 *
 * So PHP prints a `<label>` and an `<input>`, which work everywhere including
 * with JavaScript switched off, and `src/controls/upgrade.ts` swaps in the
 * component when the kit is actually there. One direction, one failure mode: the
 * worst case is a plain input, never a missing one.
 *
 * **Names are keys, not names.** Inputs are named `atcf[field_a1b2c3]`, and a
 * repeater's are `atcf[field_repeater][0][field_sub]`. The save handler walks
 * the schema and reads by key, so renaming a field between render and save
 * cannot land a value in the wrong row — which is exactly what happens when the
 * form is keyed by the thing the user is allowed to edit.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * The name attribute a field's input takes.
 *
 * @since 0.1.0
 *
 * @param array  $field  Canonical field.
 * @param string $prefix Parent input name, e.g. `atcf[field_x][0]`.
 * @return string The name attribute.
 */
function atcf_input_name( $field, $prefix = 'atcf' ) {
	return $prefix . '[' . $field['key'] . ']';
}

/**
 * The DOM id a field's control takes.
 *
 * Derived from the input name so it is unique even when the same field renders
 * twice on one screen — a group cloned into two places, or a preview window
 * showing the same group beside the editor. Two controls sharing an id means the
 * label points at whichever came first, and clicking the second one focuses the
 * first.
 *
 * @since 0.1.0
 *
 * @param string $name The input name.
 * @return string A valid id.
 */
function atcf_input_id( $name ) {
	return 'atcf-' . preg_replace( '/[^a-z0-9_-]+/i', '-', trim( $name, '[]' ) );
}

/**
 * Renders every field in a group.
 *
 * @since 0.1.0
 *
 * @param array  $group  Canonical group.
 * @param array  $ref    Object reference.
 * @param string $prefix Input name prefix.
 * @return void
 */
function atcf_render_group_fields( $group, $ref, $prefix = 'atcf' ) {
	$settings = (array) atcf_arr( $group, 'settings', array() );

	printf(
		'<div class="atcf-fields atcf-fields--labels-%s atcf-fields--hints-%s" data-atcf-group="%s">',
		esc_attr( $settings['label_placement'] ),
		esc_attr( $settings['instruction_placement'] ),
		esc_attr( $group['key'] )
	);

	foreach ( (array) atcf_arr( $group, 'fields', array() ) as $field ) {
		atcf_render_field( $field, atcf_load_value( $field, $ref, '', false ), $prefix, $ref );
	}

	echo '</div>';
}

/**
 * Renders one field: wrapper, label, control, hint and error slot.
 *
 * @since 0.1.0
 *
 * @param array  $field  Canonical field.
 * @param mixed  $value  Its raw stored value.
 * @param string $prefix Input name prefix.
 * @param array  $ref    Object reference.
 * @return void
 */
function atcf_render_field( $field, $value, $prefix = 'atcf', $ref = array() ) {
	$definition = atcf_get_field_type( (string) $field['type'] );

	if ( ! $definition ) {
		atcf_render_unknown_field( $field );

		return;
	}

	$name    = atcf_input_name( $field, $prefix );
	$id      = atcf_input_id( $name );
	$wrapper = (array) $field['wrapper'];
	$classes = array(
		'atcf-field',
		'atcf-field--' . sanitize_html_class( $field['type'] ),
	);

	if ( $field['required'] ) {
		$classes[] = 'atcf-field--required';
	}

	if ( '' !== (string) $wrapper['class'] ) {
		$classes[] = $wrapper['class'];
	}

	// The conditional block travels to the browser as an attribute rather than
	// in a script blob, so a field cloned into a repeater row carries its own
	// condition with it — a blob keyed by field key could not, since every row
	// shares one.
	$conditional = (array) $field['conditional'];

	printf(
		'<div class="%s" style="--atcf-width:%d%%"%s%s data-atcf-field="%s" data-atcf-type="%s" data-atcf-name="%s"%s>',
		esc_attr( implode( ' ', $classes ) ),
		(int) $wrapper['width'],
		'' !== (string) $wrapper['id'] ? ' id="' . esc_attr( $wrapper['id'] ) . '"' : '',
		$conditional['enabled'] ? ' data-atcf-conditional="' . esc_attr( (string) wp_json_encode( $conditional ) ) . '"' : '',
		esc_attr( $field['key'] ),
		esc_attr( $field['type'] ),
		esc_attr( $field['name'] ),
		$definition['accepts'] ? ' data-atcf-accepts="' . esc_attr( implode( ' ', $definition['accepts'] ) ) . '"' : ''
	);

	$hint_id  = $id . '-hint';
	$error_id = $id . '-error';

	if ( ! in_array( $field['type'], array( 'tab', 'accordion', 'message' ), true ) ) {
		atcf_render_field_label( $field, $id, $hint_id );
	}

	echo '<div class="atcf-field__control">';

	$described = array();

	if ( '' !== (string) $field['instructions'] ) {
		$described[] = $hint_id;
	}

	$described[] = $error_id;

	$context = array(
		'id'          => $id,
		'name'        => $name,
		'prefix'      => $prefix,
		'ref'         => $ref,
		'describedby' => implode( ' ', $described ),
	);

	if ( $definition['mount'] || ! $definition['control'] || ! is_callable( $definition['control'] ) ) {
		atcf_render_mount( $field, $value, $context );
	} else {
		call_user_func( $definition['control'], $field, $value, $context );
	}

	echo '</div>';

	if ( '' !== (string) $field['instructions'] ) {
		printf(
			'<p class="atcf-field__hint" id="%s">%s</p>',
			esc_attr( $hint_id ),
			wp_kses_post( $field['instructions'] )
		);
	}

	// Always present and always empty on render. A `role="alert"` region that is
	// created when an error appears is a region a screen reader may never
	// announce, because the live region has to exist before the text lands in it.
	printf(
		'<p class="atcf-field__error" id="%s" role="alert"></p>',
		esc_attr( $error_id )
	);

	echo '</div>';
}

/**
 * Renders a field's label.
 *
 * `required` is announced with the attribute on the control, and the asterisk is
 * `aria-hidden`. "Asterisk" is not information; a screen reader saying "Title,
 * required, edit text" is.
 *
 * @since 0.1.0
 *
 * @param array  $field   Canonical field.
 * @param string $id      Control id.
 * @param string $hint_id Hint element id.
 * @return void
 */
function atcf_render_field_label( $field, $id, $hint_id ) {
	// Grouped controls have no single element for a `<label for>` to point at —
	// a `<label>` may only name one control, and one above six radios names none
	// of them. Those render a `<legend>` inside the control's own `<fieldset>`
	// instead, so the label here would be a second, unbound copy.
	$grouped = in_array( $field['type'], array( 'radio', 'checkbox', 'button_group' ), true );

	printf( '<div class="atcf-field__header">' );

	if ( $grouped ) {
		printf( '<span class="atcf-field__label">%s', esc_html( $field['label'] ) );
	} else {
		printf( '<label class="atcf-field__label" for="%s">%s', esc_attr( $id ), esc_html( $field['label'] ) );
	}

	if ( $field['required'] ) {
		echo ' <span class="atcf-field__required" aria-hidden="true">*</span>';
	}

	echo $grouped ? '</span>' : '</label>';

	unset( $hint_id );

	echo '</div>';
}

/**
 * Renders a mount point for a control the browser builds.
 *
 * The value goes in a hidden input as JSON as well as into the mount's data
 * attribute. That looks redundant and is not: the hidden input is what the form
 * submits when the enhancement never runs — a JavaScript error, a slow bundle, a
 * browser extension — so the worst case for a relationship field is that it
 * saves what it already held rather than saving nothing and wiping it.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its raw stored value.
 * @param array $context Render context.
 * @return void
 */
function atcf_render_mount( $field, $value, $context ) {
	$encoded = wp_json_encode( atcf_value_for_client( $field, $value ) );
	$encoded = is_string( $encoded ) ? $encoded : 'null';

	// Containers ship their sub-field definitions alongside the value, so a
	// repeater can draw a new row the instant Add is pressed. Fetching them
	// would put a REST round trip between the click and anything appearing,
	// which reads as the button not working.
	$subs = atcf_type_has_sub_fields( (string) $field['type'] )
		? ' data-atcf-subs="' . esc_attr( (string) wp_json_encode( atcf_sub_fields_for_client( $field ) ) ) . '"'
		: '';

	printf(
		'<div class="atcf-mount" data-atcf-mount="%s" data-atcf-field-json="%s" data-atcf-value="%s" data-atcf-input="%s"%s><noscript>%s</noscript></div>',
		esc_attr( $field['type'] ),
		esc_attr( (string) wp_json_encode( atcf_field_for_client( $field ) ) ),
		esc_attr( $encoded ),
		esc_attr( $context['name'] ),
		$subs, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Escaped where it is built, immediately above.
		esc_html__( 'This field needs JavaScript to edit. Its current value has been kept.', 'allterrain-fields' )
	);

	printf(
		'<input type="hidden" name="%s" value="%s" data-atcf-fallback="1" />',
		esc_attr( $context['name'] . '[__json]' ),
		esc_attr( $encoded )
	);
}

/**
 * The parts of a field definition the browser needs.
 *
 * Deliberately not the whole thing. A field's definition is authored by an
 * administrator and read by everyone who can edit a post, so anything in it that
 * is not needed to *draw the control* is a detail leaked one privilege level
 * down for no benefit.
 *
 * @since 0.1.0
 *
 * @param array $field Canonical field.
 * @return array The client-safe subset.
 */
function atcf_field_for_client( $field ) {
	return array(
		'key'          => $field['key'],
		'name'         => $field['name'],
		'label'        => $field['label'],
		'type'         => $field['type'],
		'required'     => (bool) $field['required'],
		'readonly'     => (bool) $field['readonly'],
		'instructions' => $field['instructions'],
		'settings'     => (array) $field['settings'],
		'conditional'  => (array) $field['conditional'],
	);
}

/**
 * Renders a placeholder for a type nothing has registered.
 *
 * Says so, and keeps the value. A field whose type came from a plugin that has
 * been deactivated must not silently drop its data on the next save — which is
 * what rendering nothing would do, since a field with no input submits no value
 * and the save handler would read that as "cleared".
 *
 * @since 0.1.0
 *
 * @param array $field Canonical field.
 * @return void
 */
function atcf_render_unknown_field( $field ) {
	printf(
		'<div class="atcf-field atcf-field--unknown"><p class="atcf-field__label">%s</p><p class="atcf-field__hint">%s</p></div>',
		esc_html( $field['label'] ),
		esc_html(
			sprintf(
				/* translators: %s: field type slug. */
				__( 'Nothing on this site knows how to edit a “%s” field. Its value has been left alone.', 'allterrain-fields' ),
				$field['type']
			)
		)
	);
}

/**
 * The attributes every text-like control shares.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param array $context Render context.
 * @return string Escaped attribute string.
 */
function atcf_control_attributes( $field, $context ) {
	$settings = (array) $field['settings'];
	$parts    = array(
		sprintf( 'id="%s"', esc_attr( $context['id'] ) ),
		sprintf( 'name="%s"', esc_attr( $context['name'] ) ),
		sprintf( 'aria-describedby="%s"', esc_attr( $context['describedby'] ) ),
		'class="atcf-input"',
	);

	if ( $field['required'] ) {
		$parts[] = 'required';
		$parts[] = 'aria-required="true"';
	}

	if ( $field['readonly'] ) {
		$parts[] = 'readonly';
	}

	if ( '' !== (string) atcf_arr( $settings, 'placeholder', '' ) ) {
		$parts[] = sprintf( 'placeholder="%s"', esc_attr( (string) $settings['placeholder'] ) );
	}

	if ( (int) atcf_arr( $settings, 'maxlength', 0 ) > 0 ) {
		$parts[] = sprintf( 'maxlength="%d"', (int) $settings['maxlength'] );
	}

	if ( '' !== (string) atcf_arr( $settings, 'pattern', '' ) ) {
		$parts[] = sprintf( 'pattern="%s"', esc_attr( (string) $settings['pattern'] ) );
	}

	return implode( ' ', $parts );
}

/**
 * Wraps a control in its prepend/append affixes.
 *
 * @since 0.1.0
 *
 * @param array    $field  Canonical field.
 * @param callable $render Echoes the control.
 * @return void
 */
function atcf_with_affixes( $field, $render ) {
	$settings = (array) $field['settings'];
	$prepend  = (string) atcf_arr( $settings, 'prepend', '' );
	$append   = (string) atcf_arr( $settings, 'append', '' );

	if ( '' === $prepend && '' === $append ) {
		$render();

		return;
	}

	echo '<div class="atcf-affixed">';

	if ( '' !== $prepend ) {
		// `aria-hidden`, because an affix is a visual unit marker sitting beside
		// the input. A screen reader announcing "dollars, edit text, dollars"
		// for a field labelled "Price" is noise; the label is where the unit
		// belongs, and the affix is a reminder for people who can see it.
		printf( '<span class="atcf-affix atcf-affix--before" aria-hidden="true">%s</span>', esc_html( $prepend ) );
	}

	$render();

	if ( '' !== $append ) {
		printf( '<span class="atcf-affix atcf-affix--after" aria-hidden="true">%s</span>', esc_html( $append ) );
	}

	echo '</div>';
}

/**
 * Renders a single-line text control.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_text( $field, $value, $context ) {
	atcf_with_affixes(
		$field,
		static function () use ( $field, $value, $context ) {
			printf(
				'<input type="text" value="%s" %s />',
				esc_attr( is_scalar( $value ) ? (string) $value : '' ),
				atcf_control_attributes( $field, $context ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Each attribute is escaped as it is built.
			);
		}
	);
}

/**
 * Renders a multi-line text control.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_textarea( $field, $value, $context ) {
	$rows = max( 2, (int) atcf_arr( (array) $field['settings'], 'rows', 5 ) );

	printf(
		'<textarea rows="%d" %s>%s</textarea>',
		(int) $rows,
		atcf_control_attributes( $field, $context ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Every attribute is escaped as it is built, inside `atcf_control_attributes()`.
		esc_textarea( is_scalar( $value ) ? (string) $value : '' )
	);
}

/**
 * Renders a numeric control.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_number( $field, $value, $context ) {
	$settings = (array) $field['settings'];
	$range    = '';

	foreach ( array( 'min', 'max', 'step' ) as $key ) {
		if ( '' !== (string) atcf_arr( $settings, $key, '' ) ) {
			$range .= sprintf( ' %s="%s"', $key, esc_attr( (string) $settings[ $key ] ) );
		}
	}

	atcf_with_affixes(
		$field,
		static function () use ( $field, $value, $context, $range ) {
			printf(
				'<input type="number" value="%s"%s %s />',
				esc_attr( is_scalar( $value ) ? (string) $value : '' ),
				$range, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Built from escaped parts above.
				atcf_control_attributes( $field, $context ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Each attribute is escaped as it is built.
			);
		}
	);
}

/**
 * Renders a slider with a live readout.
 *
 * The readout is an `<output>` bound to the input, which is the element the
 * platform provides for exactly this and which screen readers already
 * understand — a `<span>` updated by script would need an `aria-live` region and
 * would still announce at the wrong moments.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_range( $field, $value, $context ) {
	$settings = (array) $field['settings'];
	$min      = (float) atcf_arr( $settings, 'min', 0 );
	$max      = (float) atcf_arr( $settings, 'max', 100 );
	$step     = atcf_arr( $settings, 'step', 1 );
	$current  = is_numeric( $value ) ? $value + 0 : $min;

	printf(
		'<div class="atcf-range"><input type="range" min="%s" max="%s" step="%s" value="%s" %s /><output class="atcf-range__value" for="%s">%s</output></div>',
		esc_attr( (string) $min ),
		esc_attr( (string) $max ),
		esc_attr( (string) $step ),
		esc_attr( (string) $current ),
		atcf_control_attributes( $field, $context ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Each attribute is escaped as it is built.
		esc_attr( $context['id'] ),
		esc_html( (string) $current )
	);
}

/**
 * Renders an email control.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_email( $field, $value, $context ) {
	atcf_with_affixes(
		$field,
		static function () use ( $field, $value, $context ) {
			printf(
				'<input type="email" value="%s" %s />',
				esc_attr( is_scalar( $value ) ? (string) $value : '' ),
				atcf_control_attributes( $field, $context ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Each attribute is escaped as it is built.
			);
		}
	);
}

/**
 * Renders a URL control.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_url( $field, $value, $context ) {
	printf(
		'<input type="url" value="%s" %s />',
		esc_attr( is_scalar( $value ) ? (string) $value : '' ),
		atcf_control_attributes( $field, $context ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Each attribute is escaped as it is built.
	);
}

/**
 * Renders a password control.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_password( $field, $value, $context ) {
	printf(
		'<input type="password" value="%s" autocomplete="off" %s />',
		esc_attr( is_scalar( $value ) ? (string) $value : '' ),
		atcf_control_attributes( $field, $context ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Each attribute is escaped as it is built.
	);
}

/**
 * Renders a date control.
 *
 * `<input type="date">` rather than a scripted calendar. The native one is
 * keyboard-complete, localised by the browser, works on a phone, and is the one
 * the user's own operating system already taught them.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_date( $field, $value, $context ) {
	atcf_control_datelike( 'date', $field, $value, $context );
}

/**
 * Renders a date and time control.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_datetime( $field, $value, $context ) {
	atcf_control_datelike( 'datetime-local', $field, $value, $context );
}

/**
 * Renders a time control.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_time( $field, $value, $context ) {
	atcf_control_datelike( 'time', $field, $value, $context );
}

/**
 * Renders one of the three date-shaped controls.
 *
 * @since 0.1.0
 *
 * @param string $input_type HTML input type.
 * @param array  $field      Canonical field.
 * @param mixed  $value      Its value.
 * @param array  $context    Render context.
 * @return void
 */
function atcf_control_datelike( $input_type, $field, $value, $context ) {
	$stored = is_scalar( $value ) ? (string) $value : '';
	$stamp  = '' === $stored ? false : strtotime( $stored );

	// The control wants ISO whatever the field stores. `datetime-local` in
	// particular refuses anything with a space instead of a `T` and silently
	// renders empty — which reads as the value having been lost.
	if ( false !== $stamp ) {
		$formats = array(
			'date'           => 'Y-m-d',
			'datetime-local' => 'Y-m-d\TH:i',
			'time'           => 'H:i',
		);

		$stored = gmdate( $formats[ $input_type ], $stamp );
	}

	printf(
		'<input type="%s" value="%s" %s />',
		esc_attr( $input_type ),
		esc_attr( $stored ),
		atcf_control_attributes( $field, $context ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Each attribute is escaped as it is built.
	);
}

/**
 * Renders a dropdown.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_select( $field, $value, $context ) {
	$settings = (array) $field['settings'];
	$choices  = atcf_normalize_choices( atcf_arr( $settings, 'choices', array() ) );
	$multiple = atcf_choice_is_multiple( $field );
	$selected = array_map( 'strval', is_array( $value ) ? $value : ( '' === $value || null === $value ? array() : array( $value ) ) );

	printf(
		'<select %s%s%s>',
		atcf_control_attributes( $field, $context ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Each attribute is escaped as it is built.
		$multiple ? ' multiple' : '',
		// The `[]` suffix is what makes a multiple select submit every choice
		// rather than only the last one. It is on the *element*, not on the
		// name attribute built above, because the single case must not have it.
		$multiple ? sprintf( ' name="%s"', esc_attr( $context['name'] . '[]' ) ) : ''
	);

	if ( atcf_arr( $settings, 'allow_null', false ) && ! $multiple ) {
		printf(
			'<option value="">%s</option>',
			esc_html( (string) atcf_arr( $settings, 'placeholder', __( '— none —', 'allterrain-fields' ) ) )
		);
	}

	foreach ( $choices as $choice ) {
		printf(
			'<option value="%s"%s>%s</option>',
			esc_attr( $choice['value'] ),
			in_array( $choice['value'], $selected, true ) ? ' selected' : '',
			esc_html( $choice['label'] )
		);
	}

	echo '</select>';
}

/**
 * Renders a radio group.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_radio( $field, $value, $context ) {
	atcf_control_choice_group( 'radio', $field, $value, $context );
}

/**
 * Renders a checkbox group.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_checkbox( $field, $value, $context ) {
	atcf_control_choice_group( 'checkbox', $field, $value, $context );
}

/**
 * Renders a segmented button group.
 *
 * Radios underneath, styled as buttons. Real radios keep arrow-key navigation,
 * the roving focus behaviour and the group semantics for free; a row of
 * `<button>`s with `aria-pressed` has to reimplement all three and usually
 * reimplements two.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_button_group( $field, $value, $context ) {
	atcf_control_choice_group( 'radio', $field, $value, $context, 'atcf-choices--buttons' );
}

/**
 * Renders a group of radios or checkboxes inside a fieldset.
 *
 * @since 0.1.0
 *
 * @param string $input_type `radio` or `checkbox`.
 * @param array  $field      Canonical field.
 * @param mixed  $value      Its value.
 * @param array  $context    Render context.
 * @param string $extra      Extra class on the list.
 * @return void
 */
function atcf_control_choice_group( $input_type, $field, $value, $context, $extra = '' ) {
	$settings = (array) $field['settings'];
	$choices  = atcf_normalize_choices( atcf_arr( $settings, 'choices', array() ) );
	$multiple = 'checkbox' === $input_type;
	$selected = array_map( 'strval', is_array( $value ) ? $value : ( '' === $value || null === $value ? array() : array( $value ) ) );
	$layout   = 'horizontal' === (string) atcf_arr( $settings, 'layout', 'vertical' ) ? 'horizontal' : 'vertical';

	printf(
		'<fieldset class="atcf-choices atcf-choices--%s %s" aria-describedby="%s"%s>',
		esc_attr( $layout ),
		esc_attr( $extra ),
		esc_attr( $context['describedby'] ),
		$field['required'] ? ' aria-required="true"' : ''
	);

	printf( '<legend class="screen-reader-text">%s</legend>', esc_html( $field['label'] ) );

	// An unchecked checkbox group submits nothing at all, which the save handler
	// cannot tell from "this field was not on the form". The empty marker is how
	// clearing every box is distinguishable from the field never rendering.
	if ( $multiple ) {
		printf( '<input type="hidden" name="%s" value="__empty" />', esc_attr( $context['name'] . '[]' ) );
	}

	foreach ( $choices as $index => $choice ) {
		$choice_id = $context['id'] . '-' . $index;

		printf(
			'<label class="atcf-choice" for="%s"><input type="%s" id="%s" name="%s" value="%s"%s%s /><span class="atcf-choice__label">%s</span></label>',
			esc_attr( $choice_id ),
			esc_attr( $input_type ),
			esc_attr( $choice_id ),
			esc_attr( $multiple ? $context['name'] . '[]' : $context['name'] ),
			esc_attr( $choice['value'] ),
			in_array( $choice['value'], $selected, true ) ? ' checked' : '',
			$field['readonly'] ? ' disabled' : '',
			esc_html( $choice['label'] )
		);
	}

	if ( ! $choices ) {
		printf( '<p class="atcf-choices__empty">%s</p>', esc_html__( 'This field has no choices yet.', 'allterrain-fields' ) );
	}

	echo '</fieldset>';
}

/**
 * Renders a switch.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_true_false( $field, $value, $context ) {
	$settings = (array) $field['settings'];
	$on       = '1' === (string) $value || true === $value;

	// The hidden `0` before the checkbox is what makes "off" submit a value.
	// Without it an unchecked box sends nothing and the save reads it as absent,
	// so a switch could be turned on and never off again.
	printf( '<input type="hidden" name="%s" value="0" />', esc_attr( $context['name'] ) );

	printf(
		'<label class="atcf-switch" for="%s"><input type="checkbox" id="%s" name="%s" value="1"%s%s aria-describedby="%s" /><span class="atcf-switch__track" aria-hidden="true"></span><span class="atcf-switch__label">%s</span></label>',
		esc_attr( $context['id'] ),
		esc_attr( $context['id'] ),
		esc_attr( $context['name'] ),
		$on ? ' checked' : '',
		$field['readonly'] ? ' disabled' : '',
		esc_attr( $context['describedby'] ),
		esc_html( (string) atcf_arr( $settings, 'message', '' ) )
	);
}

/**
 * Renders a rich text control.
 *
 * `wp_editor()` when it is available and a textarea when it is not. It is not
 * available inside a REST response or a preview render, and calling it there
 * prints an editor with no scripts behind it — a box that looks right and eats
 * every keystroke.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Its value.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_wysiwyg( $field, $value, $context ) {
	$settings = (array) $field['settings'];

	if ( ! function_exists( 'wp_editor' ) || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
		atcf_control_textarea( $field, $value, $context );

		return;
	}

	wp_editor(
		is_scalar( $value ) ? (string) $value : '',
		$context['id'],
		array(
			'textarea_name' => $context['name'],
			'textarea_rows' => max( 4, (int) atcf_arr( $settings, 'rows', 8 ) ),
			'media_buttons' => (bool) atcf_arr( $settings, 'media_upload', true ),
			'teeny'         => 'basic' === (string) atcf_arr( $settings, 'toolbar', 'full' ),
			'quicktags'     => 'full' === (string) atcf_arr( $settings, 'toolbar', 'full' ),
			'tinymce'       => 'none' !== (string) atcf_arr( $settings, 'toolbar', 'full' ),
		)
	);
}

/**
 * Renders a message.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Unused; a message holds nothing.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_message( $field, $value, $context ) {
	$settings = (array) $field['settings'];
	$message  = (string) atcf_arr( $settings, 'message', '' );

	if ( 'wpautop' === (string) atcf_arr( $settings, 'new_lines', 'wpautop' ) ) {
		$message = wpautop( $message );
	} elseif ( 'br' === (string) atcf_arr( $settings, 'new_lines', '' ) ) {
		$message = nl2br( $message );
	}

	unset( $value, $context );

	printf( '<div class="atcf-message">%s</div>', wp_kses_post( $message ) );
}

/**
 * Renders a tab marker.
 *
 * A marker rather than a container. Tabs in a field group are *separators* — the
 * fields after one belong to it until the next — so nesting the following fields
 * inside a `<div>` here would require the renderer to look ahead, and a group
 * whose tabs are conditionally hidden would need it to look ahead conditionally.
 * The runtime reads the markers and moves the panels.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Unused.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_tab( $field, $value, $context ) {
	unset( $value, $context );

	printf(
		'<div class="atcf-tab-marker" data-atcf-tab="%s" data-atcf-endpoint="%s">%s</div>',
		esc_attr( $field['key'] ),
		esc_attr( atcf_arr( (array) $field['settings'], 'endpoint', false ) ? '1' : '0' ),
		esc_html( $field['label'] )
	);
}

/**
 * Renders an accordion marker.
 *
 * @since 0.1.0
 *
 * @param array $field   Canonical field.
 * @param mixed $value   Unused.
 * @param array $context Render context.
 * @return void
 */
function atcf_control_accordion( $field, $value, $context ) {
	unset( $value, $context );

	$settings = (array) $field['settings'];

	printf(
		'<div class="atcf-accordion-marker" data-atcf-accordion="%s" data-atcf-open="%s" data-atcf-endpoint="%s">%s</div>',
		esc_attr( $field['key'] ),
		esc_attr( atcf_arr( $settings, 'open', false ) ? '1' : '0' ),
		esc_attr( atcf_arr( $settings, 'endpoint', false ) ? '1' : '0' ),
		esc_html( $field['label'] )
	);
}

/**
 * Re-keys a container's value from field **names** to field **keys**.
 *
 * The store speaks names, because a stored row is `team_0_name` and a template
 * author reads `$row['name']`. The *form* speaks keys, because a submitted value
 * has to survive somebody renaming the field between rendering the page and
 * pressing Save.
 *
 * Both are right, and the translation has to happen somewhere. It happens here,
 * on the way out, and in `atcf_unwrap_row()` on the way back — one pair of
 * functions rather than a convention every control has to remember. Getting this
 * asymmetric is how a repeater renders its rows correctly and then saves them
 * all empty.
 *
 * @since 0.1.0
 *
 * @param array $field Canonical field.
 * @param mixed $value The value as the store returned it.
 * @return mixed The value as the browser wants it.
 */
function atcf_value_for_client( $field, $value ) {
	$type = (string) atcf_arr( $field, 'type', '' );

	if ( ! atcf_type_has_sub_fields( $type ) ) {
		return $value;
	}

	if ( 'repeater' === $type ) {
		$subs = atcf_field_sub_fields( $field );
		$rows = array();

		foreach ( (array) $value as $row ) {
			$rows[] = atcf_row_for_client( $subs, (array) $row );
		}

		return $rows;
	}

	if ( 'flexible_content' === $type ) {
		$rows = array();

		foreach ( (array) $value as $row ) {
			$row    = (array) $row;
			$name   = (string) atcf_arr( $row, 'atcf_layout', '' );
			$layout = atcf_flexible_layout( $field, $name );
			$clean  = atcf_row_for_client( (array) atcf_arr( (array) $layout, 'sub_fields', array() ), $row );

			$clean['atcf_layout'] = $name;

			$rows[] = $clean;
		}

		return $rows;
	}

	$subs = 'clone' === $type ? atcf_resolve_clone_fields( $field ) : atcf_field_sub_fields( $field );

	return atcf_row_for_client( $subs, (array) $value );
}

/**
 * Re-keys one row.
 *
 * @since 0.1.0
 *
 * @param array[] $subs Sub-field definitions.
 * @param array   $row  The row, keyed by name.
 * @return array The row, keyed by key.
 */
function atcf_row_for_client( $subs, $row ) {
	$clean = array();

	foreach ( (array) $subs as $sub ) {
		$name = (string) atcf_arr( $sub, 'name', '' );

		$clean[ $sub['key'] ] = atcf_value_for_client( $sub, atcf_arr( $row, $name, null ) );
	}

	return $clean;
}

/**
 * A container's sub-field definitions, shaped for the browser.
 *
 * Sent alongside the value so a repeater can draw its rows without a REST call —
 * a repeater with six sub-fields would otherwise need one round trip before it
 * could paint anything at all.
 *
 * @since 0.1.0
 *
 * @param array $field Canonical container field.
 * @return array The sub-fields, client-safe.
 */
function atcf_sub_fields_for_client( $field ) {
	$type = (string) atcf_arr( $field, 'type', '' );

	if ( 'flexible_content' === $type ) {
		$layouts = array();

		foreach ( (array) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'layouts', array() ) as $layout ) {
			$layout = (array) $layout;

			$layouts[] = array(
				'key'        => (string) atcf_arr( $layout, 'key', '' ),
				'name'       => (string) atcf_arr( $layout, 'name', '' ),
				'label'      => (string) atcf_arr( $layout, 'label', '' ),
				'display'    => (string) atcf_arr( $layout, 'display', 'block' ),
				'min'        => (int) atcf_arr( $layout, 'min', 0 ),
				'max'        => (int) atcf_arr( $layout, 'max', 0 ),
				'sub_fields' => array_map( 'atcf_field_for_client', (array) atcf_arr( $layout, 'sub_fields', array() ) ),
			);
		}

		return $layouts;
	}

	$subs = 'clone' === $type ? atcf_resolve_clone_fields( $field ) : atcf_field_sub_fields( $field );

	return array_map( 'atcf_field_for_client', $subs );
}
