<?php
/**
 * The layout types.
 *
 * Two kinds live here and they are worth telling apart.
 *
 * **Furniture** — message, tab, accordion — hold no value at all. They exist to
 * break a long edit screen into something a person can read. Their `value` is
 * `none`, which is what stops the store writing an empty meta row for each of
 * them on every save.
 *
 * **Containers** — group, repeater, flexible content, clone — hold other fields.
 * They are where every other custom-fields plugin drew its paywall, and the
 * reason is not technical: a repeater is a list, and a list is the second data
 * structure anyone learns. All four are here.
 *
 * Containers store one row per sub-value, keyed `parent_0_child`. That is ACF's
 * layout and it is genuinely the right one — it means `get_post_meta( $id,
 * 'team_0_name', true )` works, a `meta_query` can find "any post whose first
 * team member is Ada", and a repeater with forty rows does not put a 400KB
 * serialized blob in one row where a single edit rewrites all of it.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'atcf_register_layout_types', 6 );

/**
 * Registers the layout field types.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_layout_types() {
	atcf_register_field_type(
		'message',
		array(
			'label'       => __( 'Message', 'allterrain-fields' ),
			'description' => __( 'A note to whoever is filling this in. Holds nothing.', 'allterrain-fields' ),
			'group'       => 'layout',
			'icon'        => 'dashicons-info-outline',
			'value'       => 'none',
			'settings'    => array(
				'message'   => '',
				'new_lines' => 'wpautop',
				'escape'    => true,
			),
			'supports'    => array( 'instructions', 'conditional', 'wrapper' ),
			'control'     => 'atcf_control_message',
		)
	);

	atcf_register_field_type(
		'tab',
		array(
			'label'       => __( 'Tab', 'allterrain-fields' ),
			'description' => __( 'Everything after it goes under this tab, until the next one.', 'allterrain-fields' ),
			'group'       => 'layout',
			'icon'        => 'dashicons-editor-insertmore',
			'value'       => 'none',
			'settings'    => array(
				'placement' => 'top',
				'endpoint'  => false,
			),
			'supports'    => array( 'conditional' ),
			'control'     => 'atcf_control_tab',
		)
	);

	atcf_register_field_type(
		'accordion',
		array(
			'label'       => __( 'Accordion', 'allterrain-fields' ),
			'description' => __( 'A heading that folds everything after it away.', 'allterrain-fields' ),
			'group'       => 'layout',
			'icon'        => 'dashicons-arrow-down',
			'value'       => 'none',
			'settings'    => array(
				'open'     => false,
				'multi'    => true,
				'endpoint' => false,
			),
			'supports'    => array( 'conditional' ),
			'control'     => 'atcf_control_accordion',
		)
	);

	atcf_register_field_type(
		'group',
		array(
			'label'       => __( 'Group', 'allterrain-fields' ),
			'description' => __( 'Several fields that belong together, addressed as one.', 'allterrain-fields' ),
			'group'       => 'layout',
			'icon'        => 'dashicons-screenoptions',
			'value'       => 'object',
			'settings'    => array(
				'sub_fields' => array(),
				'layout'     => 'block',
			),
			'supports'    => array( 'instructions', 'conditional', 'wrapper', 'sub_fields' ),
			'format'      => 'atcf_format_group',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'repeater',
		array(
			'label'       => __( 'Repeater', 'allterrain-fields' ),
			'description' => __( 'A list of rows, each with the same fields inside it.', 'allterrain-fields' ),
			'group'       => 'layout',
			'icon'        => 'dashicons-editor-ul',
			'value'       => 'array',
			'settings'    => array(
				'sub_fields'   => array(),
				'min_items'    => 0,
				'max_items'    => 0,
				'layout'       => 'block',
				'button_label' => __( 'Add row', 'allterrain-fields' ),
				'collapsed'    => '',
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper', 'sub_fields' ),
			'format'      => 'atcf_format_repeater',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'flexible_content',
		array(
			'label'       => __( 'Flexible content', 'allterrain-fields' ),
			'description' => __( 'A list of rows where each row can be a different shape.', 'allterrain-fields' ),
			'group'       => 'layout',
			'icon'        => 'dashicons-layout',
			'value'       => 'array',
			'settings'    => array(
				'layouts'      => array(),
				'min_items'    => 0,
				'max_items'    => 0,
				'button_label' => __( 'Add block', 'allterrain-fields' ),
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper', 'sub_fields' ),
			'format'      => 'atcf_format_flexible',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'clone',
		array(
			'label'       => __( 'Clone', 'allterrain-fields' ),
			'description' => __( 'Borrows fields from another group, so one definition serves many.', 'allterrain-fields' ),
			'group'       => 'layout',
			'icon'        => 'dashicons-admin-page',
			'value'       => 'object',
			'settings'    => array(
				'clone_source' => array(),
				'display'      => 'seamless',
				'layout'       => 'block',
				'prefix_name'  => false,
			),
			'supports'    => array( 'instructions', 'conditional', 'wrapper' ),
			'mount'       => true,
		)
	);
}

/**
 * Whether a field type holds sub-fields.
 *
 * Asked in eight places — the store, the validator, the logic engine, the REST
 * schema, the builder's canvas and the three formatters below — so it is one
 * function rather than eight copies of the same `in_array`.
 *
 * @since 0.1.0
 *
 * @param string $type Field type slug.
 * @return bool True when the type nests.
 */
function atcf_type_has_sub_fields( $type ) {
	/**
	 * Filters which field types nest.
	 *
	 * A plugin registering its own container type has to be in this list or the
	 * store will never walk into it.
	 *
	 * @since 0.1.0
	 *
	 * @param string[] $types Type slugs that hold sub-fields.
	 */
	$types = (array) apply_filters(
		'atcf_container_types',
		array( 'group', 'repeater', 'flexible_content', 'clone' )
	);

	return in_array( (string) $type, $types, true );
}

/**
 * The sub-fields a container declares, whatever shape it declares them in.
 *
 * `group`, `repeater` and `clone` keep a flat `sub_fields` list. Flexible
 * content keeps one list per layout, so this returns every sub-field across all
 * of them — which is what the store and the validator want, since a saved row
 * names its layout and only that layout's fields are read back.
 *
 * @since 0.1.0
 *
 * @param array $field The container field.
 * @return array[] Sub-field definitions.
 */
function atcf_field_sub_fields( $field ) {
	$settings = (array) atcf_arr( $field, 'settings', array() );

	if ( 'flexible_content' === (string) atcf_arr( $field, 'type', '' ) ) {
		$fields = array();

		foreach ( (array) atcf_arr( $settings, 'layouts', array() ) as $layout ) {
			foreach ( (array) atcf_arr( (array) $layout, 'sub_fields', array() ) as $sub ) {
				$fields[] = $sub;
			}
		}

		return $fields;
	}

	return (array) atcf_arr( $settings, 'sub_fields', array() );
}

/**
 * One flexible-content layout by name.
 *
 * @since 0.1.0
 *
 * @param array  $field The flexible content field.
 * @param string $name  Layout name.
 * @return array|null The layout, or null when the row names one that has gone.
 */
function atcf_flexible_layout( $field, $name ) {
	foreach ( (array) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'layouts', array() ) as $layout ) {
		if ( (string) atcf_arr( (array) $layout, 'name', '' ) === (string) $name ) {
			return (array) $layout;
		}
	}

	return null;
}

/**
 * Formats a group's stored value.
 *
 * The store has already assembled the sub-values into a map keyed by sub-field
 * *name*, so this only has to hand it over. It exists as a named formatter
 * rather than as no formatter so that a filter has somewhere to attach.
 *
 * @since 0.1.0
 *
 * @param mixed $value Assembled sub-values.
 * @return array The group.
 */
function atcf_format_group( $value ) {
	return is_array( $value ) ? $value : array();
}

/**
 * Formats a repeater's stored value.
 *
 * @since 0.1.0
 *
 * @param mixed $value Assembled rows.
 * @return array[] The rows, in order.
 */
function atcf_format_repeater( $value ) {
	return is_array( $value ) ? array_values( $value ) : array();
}

/**
 * Formats flexible content.
 *
 * Each row keeps its `acf_fc_layout` key, spelled exactly that way. A theme
 * looping flexible content switches on it, and the entire body of published
 * WordPress tutorial code — every Stack Overflow answer, every agency's internal
 * boilerplate — spells it that way. Renaming it to `atcf_layout` would be tidier
 * and would break every template anybody has ever written.
 *
 * @since 0.1.0
 *
 * @param mixed $value Assembled rows.
 * @return array[] The rows, in order.
 */
function atcf_format_flexible( $value ) {
	return is_array( $value ) ? array_values( $value ) : array();
}
