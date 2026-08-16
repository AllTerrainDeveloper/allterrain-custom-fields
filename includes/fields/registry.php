<?php
/**
 * The field type registry.
 *
 * Every built-in type is one `atcf_register_field_type()` call using exactly the
 * API a third-party plugin would use. There is no privileged path: if a built-in
 * needs something the registry cannot express, the registry gets a feature
 * rather than the built-in reaching around it. That rule is the only reason a
 * registry stays honest — the moment one built-in is special, the API documents
 * a subset of what the plugin can actually do.
 *
 * A type declares five things, and each one is read by a different half of the
 * plugin:
 *
 *   - **What it looks like** — `label`, `icon`, `group`. Read by the builder's
 *     palette.
 *   - **What it can be told** — `settings`, `supports`. Read by the inspector,
 *     which builds its controls from this rather than from a switch statement.
 *   - **What it holds** — `value`, `sanitize`, `format`. Read by the store and
 *     the template API.
 *   - **What it renders as** — `control`, or `mount` for the ones that genuinely
 *     need JavaScript.
 *   - **What it accepts off the desktop** — `accepts`. Read by the drag bridge,
 *     which is how a photo dragged out of WP Explorer knows an Image field will
 *     have it and a Number field will not.
 *
 * That last one is the piece no custom-fields plugin has had, because until the
 * shell existed there was nothing on the other end of the gesture.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * The palette groups, in the order the builder shows them.
 *
 * @since 0.1.0
 *
 * @return array<string,string> Group slug => translated label.
 */
function atcf_field_groups_list() {
	/**
	 * Filters the palette groups.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string,string> $groups Slug => label.
	 */
	return apply_filters(
		'atcf_field_type_groups',
		array(
			'basic'      => __( 'Basic', 'allterrain-fields' ),
			'content'    => __( 'Content', 'allterrain-fields' ),
			'choice'     => __( 'Choice', 'allterrain-fields' ),
			'relational' => __( 'Relational', 'allterrain-fields' ),
			'layout'     => __( 'Layout', 'allterrain-fields' ),
			'advanced'   => __( 'Advanced', 'allterrain-fields' ),
		)
	);
}

/**
 * Registers a field type.
 *
 * @since 0.1.0
 *
 * @param string $type Type slug, e.g. `text`. Lowercase, underscores.
 * @param array  $args {
 *     Type definition.
 *
 *     @type string   $label       Human name shown in the palette. Required.
 *     @type string   $description One line explaining when to reach for it.
 *     @type string   $group       Palette group slug. Default 'basic'.
 *     @type string   $icon        Dashicons class. Default 'dashicons-editor-code'.
 *     @type string   $value       What the field holds: 'string', 'number',
 *                                 'boolean', 'ids', 'array', 'object' or
 *                                 'none'. Read by the bulk editor to decide
 *                                 whether a column is editable inline, and by
 *                                 the REST schema. Default 'string'.
 *     @type array    $settings    Type-specific settings and their defaults.
 *                                 The inspector builds a control per entry from
 *                                 `atcf_setting_controls()`; anything not
 *                                 described there is stored but not offered.
 *     @type string[] $supports    Generic features this type honours. Any of
 *                                 'required', 'default', 'placeholder',
 *                                 'instructions', 'multiple', 'readonly',
 *                                 'wrapper', 'conditional', 'sub_fields'.
 *     @type string[] $accepts     Drag payload kinds the field is a drop target
 *                                 for: 'media', 'post', 'user', 'term', 'text'.
 *                                 Empty means the field refuses every drop —
 *                                 visibly, because the shell's claimant rule
 *                                 means a refusing target still swallows the
 *                                 drop rather than letting it fall through.
 *     @type callable $sanitize    `( mixed $value, array $field ) => mixed`.
 *                                 Runs on every write, from any source.
 *     @type callable $format      `( mixed $value, array $field, array $ctx )
 *                                 => mixed`. Turns the stored value into what
 *                                 `atcf_get_field()` hands a theme.
 *     @type callable $control     `( array $field, mixed $value, string $name )
 *                                 => void`. Echoes the edit-screen control.
 *                                 Omit to get the JavaScript mount point, which
 *                                 is right for anything that cannot be a plain
 *                                 input.
 *     @type bool     $mount       Force the JS mount point even with a
 *                                 `control`. Default false.
 * }
 * @return true|WP_Error True, or an error when the definition is unusable.
 */
function atcf_register_field_type( $type, $args = array() ) {
	$type = atcf_sanitize_field_name( $type );

	if ( '' === $type ) {
		return new WP_Error( 'atcf_missing_type', __( 'A field type needs a slug.', 'allterrain-fields' ) );
	}

	if ( '' === (string) atcf_arr( $args, 'label' ) ) {
		return new WP_Error(
			'atcf_missing_label',
			/* translators: %s: field type slug. */
			sprintf( __( 'The field type "%s" needs a label.', 'allterrain-fields' ), $type )
		);
	}

	$registry = atcf_field_type_registry();

	$registry[ $type ] = array(
		'type'        => $type,
		'label'       => (string) $args['label'],
		'description' => (string) atcf_arr( $args, 'description' ),
		'group'       => (string) atcf_arr( $args, 'group', 'basic' ),
		'icon'        => (string) atcf_arr( $args, 'icon', 'dashicons-editor-code' ),
		'value'       => (string) atcf_arr( $args, 'value', 'string' ),
		'settings'    => (array) atcf_arr( $args, 'settings', array() ),
		'supports'    => array_values( (array) atcf_arr( $args, 'supports', array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ) ) ),
		'accepts'     => array_values( (array) atcf_arr( $args, 'accepts', array() ) ),
		'sanitize'    => atcf_arr( $args, 'sanitize', null ),
		'format'      => atcf_arr( $args, 'format', null ),
		'control'     => atcf_arr( $args, 'control', null ),
		'mount'       => (bool) atcf_arr( $args, 'mount', false ),
	);

	atcf_field_type_registry( $registry );

	/**
	 * Fires after a field type is registered.
	 *
	 * @since 0.1.0
	 *
	 * @param string $type Type slug.
	 * @param array  $def  The stored definition.
	 */
	do_action( 'atcf_field_type_registered', $type, $registry[ $type ] );

	return true;
}

/**
 * Reads or replaces the registry.
 *
 * A function rather than a global so nothing can append to it without going
 * through {@see atcf_register_field_type()} and getting its defaults filled in —
 * a half-populated definition reaches the palette, the inspector, the store and
 * the REST schema, and each of those four fails differently.
 *
 * @since 0.1.0
 *
 * @param array|null $replace New registry, or null to read.
 * @return array The registry.
 */
function atcf_field_type_registry( $replace = null ) {
	static $registry = array();

	if ( is_array( $replace ) ) {
		$registry = $replace;
	}

	return $registry;
}

/**
 * Unregisters a field type.
 *
 * Fields already using it keep their values — the store never consults the
 * registry to *read* a raw meta row — but they render as an unknown type, which
 * says so on the screen rather than silently dropping the value.
 *
 * @since 0.1.0
 *
 * @param string $type Type slug.
 * @return bool True when something was removed.
 */
function atcf_unregister_field_type( $type ) {
	$registry = atcf_field_type_registry();
	$type     = atcf_sanitize_field_name( $type );

	if ( ! isset( $registry[ $type ] ) ) {
		return false;
	}

	unset( $registry[ $type ] );
	atcf_field_type_registry( $registry );

	return true;
}

/**
 * Every registered field type, filtered.
 *
 * @since 0.1.0
 *
 * @return array<string,array> Slug => definition.
 */
function atcf_get_field_types() {
	/**
	 * Filters the whole field type registry.
	 *
	 * Runs on read rather than on write, so a filter can react to types
	 * registered after it was added — which is every type, for a filter added
	 * on `plugins_loaded`.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string,array> $registry Slug => definition.
	 */
	return (array) apply_filters( 'atcf_field_types', atcf_field_type_registry() );
}

/**
 * One field type's definition.
 *
 * @since 0.1.0
 *
 * @param string $type Type slug.
 * @return array|null The definition, or null when nothing is registered.
 */
function atcf_get_field_type( $type ) {
	$types = atcf_get_field_types();

	return isset( $types[ $type ] ) ? $types[ $type ] : null;
}

/**
 * Whether a type honours a generic feature.
 *
 * @since 0.1.0
 *
 * @param string $type    Type slug.
 * @param string $feature Feature name.
 * @return bool True when supported.
 */
function atcf_field_type_supports( $type, $feature ) {
	$def = atcf_get_field_type( $type );

	return $def && in_array( $feature, $def['supports'], true );
}

/**
 * The palette, shaped for the builder.
 *
 * Sorted by group in the order {@see atcf_field_groups_list()} declares, then by
 * label within each group — so a plugin adding a type to `relational` lands
 * beside the built-in relational types rather than at the end of the list.
 *
 * @since 0.1.0
 *
 * @return array[] Definitions without their callbacks, ready to serialize.
 */
function atcf_field_type_palette() {
	$types  = atcf_get_field_types();
	$groups = array_keys( atcf_field_groups_list() );
	$list   = array();

	foreach ( $types as $def ) {
		// Callbacks are stripped rather than serialized: a closure cannot cross
		// `wp_json_encode()` at all, and a string callback that could would tell
		// the browser the name of a PHP function it can never call.
		unset( $def['sanitize'], $def['format'], $def['control'] );

		$list[] = $def;
	}

	usort(
		$list,
		static function ( $a, $b ) use ( $groups ) {
			$ga = array_search( $a['group'], $groups, true );
			$gb = array_search( $b['group'], $groups, true );

			// A type in a group nobody declared sorts last rather than first,
			// which is what `false` from `array_search()` would otherwise do.
			$ga = false === $ga ? PHP_INT_MAX : $ga;
			$gb = false === $gb ? PHP_INT_MAX : $gb;

			if ( $ga !== $gb ) {
				return $ga <=> $gb;
			}

			return strcasecmp( $a['label'], $b['label'] );
		}
	);

	return $list;
}

/**
 * The controls the inspector knows how to draw for a setting.
 *
 * A field type declares its settings as `key => default`. That is enough for the
 * store, and not enough for the inspector — it needs to know whether `min` is a
 * number box or a dropdown. Rather than make every type repeat a control
 * descriptor, the shapes are described once here and matched by key.
 *
 * A type wanting something this table does not describe declares the key anyway;
 * the setting is stored and honoured, and the inspector offers it under
 * Advanced as raw text rather than pretending it does not exist.
 *
 * @since 0.1.0
 *
 * @return array<string,array> Setting key => control descriptor.
 */
function atcf_setting_controls() {
	// `control` names a renderer in the builder's inspector; `label` is what the
	// row is called. Both are per *setting key*, not per field type, which is
	// what lets two unrelated types share one control by naming the same key.
	$number   = array( 'min', 'max', 'step', 'rows', 'maxlength', 'min_items', 'max_items', 'decimals', 'first_day' );
	$text     = array( 'prepend', 'append', 'placeholder', 'mime_types', 'button_label', 'display_format', 'return_date', 'default_value', 'pattern' );
	$switch   = array( 'allow_null', 'multiple', 'ui', 'media_upload', 'unique', 'bidirectional', 'save_terms', 'load_terms', 'stylised' );
	$select   = array( 'return_format', 'preview_size', 'library', 'layout', 'toolbar', 'new_lines', 'display', 'append_units' );
	$labels   = atcf_setting_labels();
	$controls = array();

	foreach ( $number as $key ) {
		$controls[ $key ] = array( 'control' => 'number' );
	}

	foreach ( $text as $key ) {
		$controls[ $key ] = array( 'control' => 'text' );
	}

	foreach ( $switch as $key ) {
		$controls[ $key ] = array( 'control' => 'switch' );
	}

	foreach ( $select as $key ) {
		$controls[ $key ] = array( 'control' => 'select' );
	}

	// The rest each have a control of their own, because each edits something
	// no generic input can express — a list of choices, a tree of post types,
	// an expression over sibling fields.
	$controls['choices']      = array( 'control' => 'choices' );
	$controls['post_types']   = array( 'control' => 'post-types' );
	$controls['taxonomies']   = array( 'control' => 'taxonomies' );
	$controls['taxonomy']     = array( 'control' => 'taxonomy' );
	$controls['roles']        = array( 'control' => 'roles' );
	$controls['formula']      = array( 'control' => 'formula' );
	$controls['mirror']       = array( 'control' => 'field-ref' );
	$controls['clone_source'] = array( 'control' => 'field-ref' );
	$controls['message']      = array( 'control' => 'textarea' );
	$controls['columns']      = array( 'control' => 'columns' );

	foreach ( $controls as $key => $descriptor ) {
		$controls[ $key ]['label'] = isset( $labels[ $key ] ) ? $labels[ $key ] : ucfirst( str_replace( '_', ' ', $key ) );
	}

	/**
	 * Filters the setting control descriptors.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string,array> $controls Setting key => descriptor.
	 */
	return (array) apply_filters( 'atcf_setting_controls', $controls );
}

/**
 * What each setting row is called in the inspector.
 *
 * Split out from the control table so the labels sit together and read as
 * copy — which is what they are. A key with no entry here falls back to its own
 * name with the underscores taken out, which is right for the ones a plugin
 * adds and wrong-but-harmless for anything we forgot.
 *
 * @since 0.1.0
 *
 * @return array<string,string> Setting key => translated label.
 */
function atcf_setting_labels() {
	return array(
		'min'            => __( 'Minimum', 'allterrain-fields' ),
		'max'            => __( 'Maximum', 'allterrain-fields' ),
		'step'           => __( 'Step', 'allterrain-fields' ),
		'rows'           => __( 'Rows', 'allterrain-fields' ),
		'maxlength'      => __( 'Character limit', 'allterrain-fields' ),
		'min_items'      => __( 'Fewest items', 'allterrain-fields' ),
		'max_items'      => __( 'Most items', 'allterrain-fields' ),
		'decimals'       => __( 'Decimal places', 'allterrain-fields' ),
		'first_day'      => __( 'Week starts on', 'allterrain-fields' ),
		'prepend'        => __( 'Before the input', 'allterrain-fields' ),
		'append'         => __( 'After the input', 'allterrain-fields' ),
		'placeholder'    => __( 'Placeholder', 'allterrain-fields' ),
		'mime_types'     => __( 'Allowed file types', 'allterrain-fields' ),
		'button_label'   => __( 'Add button label', 'allterrain-fields' ),
		'display_format' => __( 'Shown as', 'allterrain-fields' ),
		'return_date'    => __( 'Returned as', 'allterrain-fields' ),
		'default_value'  => __( 'Default', 'allterrain-fields' ),
		'pattern'        => __( 'Must match', 'allterrain-fields' ),
		'allow_null'     => __( 'Allow no selection', 'allterrain-fields' ),
		'multiple'       => __( 'Allow several', 'allterrain-fields' ),
		'ui'             => __( 'Enhanced control', 'allterrain-fields' ),
		'media_upload'   => __( 'Allow media', 'allterrain-fields' ),
		'unique'         => __( 'Must be unique', 'allterrain-fields' ),
		'bidirectional'  => __( 'Mirror on the other side', 'allterrain-fields' ),
		'save_terms'     => __( 'Also assign the terms', 'allterrain-fields' ),
		'load_terms'     => __( 'Start from assigned terms', 'allterrain-fields' ),
		'stylised'       => __( 'Stylised control', 'allterrain-fields' ),
		'return_format'  => __( 'Returns', 'allterrain-fields' ),
		'preview_size'   => __( 'Preview size', 'allterrain-fields' ),
		'library'        => __( 'Library', 'allterrain-fields' ),
		'layout'         => __( 'Layout', 'allterrain-fields' ),
		'toolbar'        => __( 'Toolbar', 'allterrain-fields' ),
		'new_lines'      => __( 'New lines', 'allterrain-fields' ),
		'display'        => __( 'Display', 'allterrain-fields' ),
		'append_units'   => __( 'Units', 'allterrain-fields' ),
		'choices'        => __( 'Choices', 'allterrain-fields' ),
		'post_types'     => __( 'Post types', 'allterrain-fields' ),
		'taxonomies'     => __( 'Taxonomies', 'allterrain-fields' ),
		'taxonomy'       => __( 'Taxonomy', 'allterrain-fields' ),
		'roles'          => __( 'Roles', 'allterrain-fields' ),
		'formula'        => __( 'Formula', 'allterrain-fields' ),
		'mirror'         => __( 'Mirrored by', 'allterrain-fields' ),
		'clone_source'   => __( 'Clone of', 'allterrain-fields' ),
		'message'        => __( 'Message', 'allterrain-fields' ),
		'columns'        => __( 'Columns', 'allterrain-fields' ),
	);
}
