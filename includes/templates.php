<?php
/**
 * Starter templates.
 *
 * Three worked examples, offered where somebody with no field groups lands.
 *
 * The point is not to save typing. It is that "custom fields" is an abstraction
 * with nothing in it until you have seen one — and a blank canvas beside a
 * palette of forty types tells a newcomer nothing about which of them to reach
 * for, or that a repeater is how you do ingredients, or that a total can work
 * itself out. A recipe does.
 *
 * So each template is chosen to *teach* something the palette cannot:
 *
 *   - **Recipes** — repeaters. Ingredients and method steps are lists, and a
 *     list is the thing people arrive wanting and do not know the name of.
 *     Also a computed total time, and a conditional that appears only when it
 *     is relevant.
 *   - **Property** — a computed field over two others (price per square metre),
 *     a location, a gallery, and a relationship to a person.
 *   - **Events** — dates, a capacity that works out the places left, and a
 *     conditional price that disappears when the event is free.
 *
 * Between them they use twelve of the field types, three computed formulas, two
 * conditionals and a repeater in each. Somebody who opens one and reads it knows
 * what this plugin does.
 *
 * ### On the keys
 *
 * The definitions below carry *symbolic* keys — `field_recipe_serves` — and
 * those are never what gets stored. {@see atcf_group_from_template()} mints a
 * fresh key for every field and rewrites the conditional rules through the same
 * map, so applying one template twice produces two independent groups rather
 * than two groups whose logic points at each other's fields.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * The starter templates.
 *
 * @since 0.1.0
 *
 * @return array[] Templates, keyed by slug.
 */
function atcf_field_group_templates() {
	$templates = array(
		'recipe'   => array(
			'slug'        => 'recipe',
			'label'       => __( 'Recipes', 'allterrain-fields' ),
			'description' => __( 'Ingredients and method as repeating rows, times that add themselves up, and an allergen note that only appears when it applies.', 'allterrain-fields' ),
			'icon'        => 'dashicons-food',
			'teaches'     => array( __( 'Repeaters', 'allterrain-fields' ), __( 'Computed totals', 'allterrain-fields' ), __( 'Conditional fields', 'allterrain-fields' ) ),
			'group'       => atcf_template_recipe(),
		),
		'property' => array(
			'slug'        => 'property',
			'label'       => __( 'Property listings', 'allterrain-fields' ),
			'description' => __( 'Price, floor area and a price per square metre that works itself out. A map, a photo gallery, and the agent who is selling it.', 'allterrain-fields' ),
			'icon'        => 'dashicons-admin-home',
			'teaches'     => array( __( 'Computed fields', 'allterrain-fields' ), __( 'Location and galleries', 'allterrain-fields' ), __( 'Linking to people', 'allterrain-fields' ) ),
			'group'       => atcf_template_property(),
		),
		'event'    => array(
			'slug'        => 'event',
			'label'       => __( 'Events', 'allterrain-fields' ),
			'description' => __( 'Start and end times, a running order, a capacity that tells you how many places are left, and a ticket price that disappears when the event is free.', 'allterrain-fields' ),
			'icon'        => 'dashicons-calendar-alt',
			'teaches'     => array( __( 'Dates and times', 'allterrain-fields' ), __( 'Computed remaining', 'allterrain-fields' ), __( 'Speakers as people', 'allterrain-fields' ) ),
			'group'       => atcf_template_event(),
		),
	);

	/**
	 * Filters the starter templates.
	 *
	 * A plugin or a site can add its own — the shape is the one above, and the
	 * `group` key is anything {@see atcf_normalize_group()} accepts.
	 *
	 * @since 0.1.0
	 *
	 * @param array[] $templates Templates, keyed by slug.
	 */
	return (array) apply_filters( 'atcf_field_group_templates', $templates );
}

/**
 * The templates, shaped for the builder's picker.
 *
 * Without the field definitions: the picker draws three cards, and shipping the
 * whole schema of all three to draw them is three times the payload for nothing.
 * The definition is fetched when one is chosen.
 *
 * @since 0.1.0
 *
 * @return array[] Slug, label, description, icon, what it teaches, field count.
 */
function atcf_template_summaries() {
	$summaries = array();

	foreach ( atcf_field_group_templates() as $template ) {
		$summaries[] = array(
			'slug'        => $template['slug'],
			'label'       => $template['label'],
			'description' => $template['description'],
			'icon'        => $template['icon'],
			'teaches'     => array_values( (array) atcf_arr( $template, 'teaches', array() ) ),
			'fields'      => count( atcf_flatten_fields( (array) atcf_arr( (array) $template['group'], 'fields', array() ) ) ),
		);
	}

	return $summaries;
}

/**
 * Builds a real, saveable group from a template.
 *
 * Every key is minted fresh and every conditional rule is rewritten through the
 * same map. Without that, applying a template twice would give two groups whose
 * conditions point at each other's fields — and the symptom would be a field
 * that shows and hides according to a switch in a different group entirely,
 * which is close to impossible to diagnose from the outside.
 *
 * Formulas need no rewriting: they name sibling fields by **name**, and the
 * names are what the author reads on screen.
 *
 * @since 0.1.0
 *
 * @param string $slug Template slug.
 * @return array|WP_Error The group, ready to save, or an error.
 */
function atcf_group_from_template( $slug ) {
	$templates = atcf_field_group_templates();
	$slug      = sanitize_key( (string) $slug );

	if ( ! isset( $templates[ $slug ] ) ) {
		return new WP_Error(
			'atcf_no_template',
			__( 'There is no template by that name.', 'allterrain-fields' ),
			array( 'status' => 404 )
		);
	}

	$group = (array) $templates[ $slug ]['group'];
	$map   = array();

	$group['key']    = atcf_new_group_key();
	$group['fields'] = atcf_remap_template_keys( (array) atcf_arr( $group, 'fields', array() ), $map );
	$group['fields'] = atcf_rewrite_template_rules( $group['fields'], $map );

	return $group;
}

/**
 * Gives every field in a template a fresh key, recording what became what.
 *
 * @since 0.1.0
 *
 * @param array[] $fields Template fields.
 * @param array   $map    Symbolic key => minted key. Filled in by reference.
 * @return array[] The fields, re-keyed.
 */
function atcf_remap_template_keys( $fields, &$map ) {
	$out = array();

	foreach ( (array) $fields as $field ) {
		$field = (array) $field;
		$old   = (string) atcf_arr( $field, 'key', '' );
		$new   = atcf_new_field_key();

		if ( '' !== $old ) {
			$map[ $old ] = $new;
		}

		$field['key'] = $new;

		// Containers carry their own fields, and a sub-field's key is a key like
		// any other — a conditional inside a repeater row points at one.
		if ( isset( $field['settings']['sub_fields'] ) ) {
			$field['settings']['sub_fields'] = atcf_remap_template_keys( $field['settings']['sub_fields'], $map );
		}

		if ( isset( $field['settings']['layouts'] ) ) {
			foreach ( $field['settings']['layouts'] as $index => $layout ) {
				$layout = (array) $layout;

				$layout['key'] = atcf_new_field_key();

				if ( isset( $layout['sub_fields'] ) ) {
					$layout['sub_fields'] = atcf_remap_template_keys( $layout['sub_fields'], $map );
				}

				$field['settings']['layouts'][ $index ] = $layout;
			}
		}

		$out[] = $field;
	}

	return $out;
}

/**
 * Points every conditional rule at the key its field actually got.
 *
 * A rule naming a key the map does not know is dropped rather than kept: a rule
 * pointing at nothing is drawn in red in the builder and would make a brand new
 * group look broken on the day it was created.
 *
 * @since 0.1.0
 *
 * @param array[] $fields Re-keyed fields.
 * @param array   $map    Symbolic key => minted key.
 * @return array[] The fields, with their rules rewritten.
 */
function atcf_rewrite_template_rules( $fields, $map ) {
	$out = array();

	foreach ( (array) $fields as $field ) {
		$field = (array) $field;
		$rules = (array) atcf_arr( (array) atcf_arr( $field, 'conditional', array() ), 'rules', array() );

		if ( $rules ) {
			$rewritten = array();

			foreach ( $rules as $rule ) {
				$rule = (array) $rule;
				$key  = (string) atcf_arr( $rule, 'field', '' );

				if ( ! isset( $map[ $key ] ) ) {
					continue;
				}

				$rule['field'] = $map[ $key ];
				$rewritten[]   = $rule;
			}

			$field['conditional']['rules'] = $rewritten;
		}

		if ( isset( $field['settings']['sub_fields'] ) ) {
			$field['settings']['sub_fields'] = atcf_rewrite_template_rules( $field['settings']['sub_fields'], $map );
		}

		if ( isset( $field['settings']['layouts'] ) ) {
			foreach ( $field['settings']['layouts'] as $index => $layout ) {
				$layout = (array) $layout;

				if ( isset( $layout['sub_fields'] ) ) {
					$layout['sub_fields'] = atcf_rewrite_template_rules( $layout['sub_fields'], $map );
				}

				$field['settings']['layouts'][ $index ] = $layout;
			}
		}

		$out[] = $field;
	}

	return $out;
}

/**
 * Where a template's group starts out.
 *
 * Posts, deliberately, rather than no rule at all. "Everywhere" is technically
 * what an empty rule set means and it reads as a mistake — a brand new group
 * appearing on every screen on the site is alarming. Posts is somewhere real,
 * visible immediately, and one tab away from being changed.
 *
 * @since 0.1.0
 *
 * @return array[][] Location rules.
 */
function atcf_template_location() {
	return array(
		array(
			array(
				'param'    => 'post_type',
				'operator' => '==',
				'value'    => 'post',
			),
		),
	);
}

/**
 * A field, with the boilerplate filled in.
 *
 * The templates below are long enough already; spelling out `instructions`,
 * `required`, `readonly`, `wrapper` and `conditional` on all sixty fields would
 * make them unreadable and would hide the two or three lines in each that
 * actually say something.
 *
 * @since 0.1.0
 *
 * @param string $key   Symbolic key, remapped before saving.
 * @param string $label What it is called.
 * @param string $type  Field type.
 * @param array  $extra Anything else.
 * @return array The field.
 */
function atcf_template_field( $key, $label, $type, $extra = array() ) {
	return array_merge(
		array(
			'key'   => $key,
			'name'  => atcf_sanitize_field_name( $label ),
			'label' => $label,
			'type'  => $type,
		),
		$extra
	);
}

/**
 * A width, as the wrapper wants it.
 *
 * @since 0.1.0
 *
 * @param int $percent Per cent of the column.
 * @return array The wrapper.
 */
function atcf_template_width( $percent ) {
	return array(
		'width' => $percent,
		'class' => '',
		'id'    => '',
	);
}

/**
 * A "show this only when" block.
 *
 * @since 0.1.0
 *
 * @param string $field    Symbolic key of the controlling field.
 * @param string $operator Operator.
 * @param string $value    What it compares against.
 * @return array The conditional block.
 */
function atcf_template_when( $field, $operator, $value ) {
	return array(
		'enabled' => true,
		'action'  => 'show',
		'match'   => 'all',
		'rules'   => array(
			array(
				'field'    => $field,
				'operator' => $operator,
				'value'    => $value,
			),
		),
	);
}

/**
 * The Recipes template.
 *
 * @since 0.1.0
 *
 * @return array The group.
 */
function atcf_template_recipe() {
	return array(
		'title'    => __( 'Recipe', 'allterrain-fields' ),
		'location' => atcf_template_location(),
		'settings' => array(
			'description' => __( 'Everything a recipe needs beyond the story above it.', 'allterrain-fields' ),
		),
		'fields'   => array(
			atcf_template_field(
				'field_recipe_photo',
				__( 'Finished dish', 'allterrain-fields' ),
				'image',
				array(
					'instructions' => __( 'Drag one in from the Media window, or from your desktop.', 'allterrain-fields' ),
					'settings'     => array(
						'return_format' => 'array',
						'preview_size'  => 'medium',
					),
				)
			),
			atcf_template_field(
				'field_recipe_serves',
				__( 'Serves', 'allterrain-fields' ),
				'number',
				array(
					'wrapper'  => atcf_template_width( 33 ),
					'settings' => array(
						'min'    => 1,
						'append' => __( 'people', 'allterrain-fields' ),
					),
				)
			),
			atcf_template_field(
				'field_recipe_prep',
				__( 'Prep time', 'allterrain-fields' ),
				'number',
				array(
					'wrapper'  => atcf_template_width( 33 ),
					'settings' => array(
						'min'    => 0,
						'append' => __( 'min', 'allterrain-fields' ),
					),
				)
			),
			atcf_template_field(
				'field_recipe_cook',
				__( 'Cook time', 'allterrain-fields' ),
				'number',
				array(
					'wrapper'  => atcf_template_width( 34 ),
					'settings' => array(
						'min'    => 0,
						'append' => __( 'min', 'allterrain-fields' ),
					),
				)
			),
			atcf_template_field(
				'field_recipe_total',
				__( 'Total time', 'allterrain-fields' ),
				'computed',
				array(
					'instructions' => __( 'Adds itself up. Nobody types into this one.', 'allterrain-fields' ),
					'wrapper'      => atcf_template_width( 50 ),
					'settings'     => array(
						'formula'  => '{prep_time} + {cook_time}',
						'decimals' => 0,
						'append'   => __( ' min', 'allterrain-fields' ),
					),
				)
			),
			atcf_template_field(
				'field_recipe_difficulty',
				__( 'Difficulty', 'allterrain-fields' ),
				'button_group',
				array(
					'wrapper'  => atcf_template_width( 50 ),
					'settings' => array(
						'choices'       => array(
							array(
								'value' => 'easy',
								'label' => __( 'Easy', 'allterrain-fields' ),
							),
							array(
								'value' => 'medium',
								'label' => __( 'Medium', 'allterrain-fields' ),
							),
							array(
								'value' => 'hard',
								'label' => __( 'Hard', 'allterrain-fields' ),
							),
						),
						'default_value' => 'easy',
					),
				)
			),
			atcf_template_field(
				'field_recipe_cuisine',
				__( 'Cuisine', 'allterrain-fields' ),
				'taxonomy',
				array(
					'settings' => array(
						'taxonomy' => 'category',
						'multiple' => true,
					),
				)
			),
			atcf_template_field(
				'field_recipe_ingredients',
				__( 'Ingredients', 'allterrain-fields' ),
				'repeater',
				array(
					'instructions' => __( 'One row per ingredient. Drag the handle to reorder, or use Alt and the arrow keys.', 'allterrain-fields' ),
					'settings'     => array(
						'button_label' => __( 'Add an ingredient', 'allterrain-fields' ),
						'sub_fields'   => array(
							atcf_template_field(
								'field_recipe_amount',
								__( 'Amount', 'allterrain-fields' ),
								'text',
								array(
									'wrapper'  => atcf_template_width( 30 ),
									'settings' => array( 'placeholder' => __( '200g', 'allterrain-fields' ) ),
								)
							),
							atcf_template_field(
								'field_recipe_item',
								__( 'Ingredient', 'allterrain-fields' ),
								'text',
								array(
									'wrapper'  => atcf_template_width( 70 ),
									'settings' => array( 'placeholder' => __( 'plain flour', 'allterrain-fields' ) ),
								)
							),
						),
					),
				)
			),
			atcf_template_field(
				'field_recipe_method',
				__( 'Method', 'allterrain-fields' ),
				'repeater',
				array(
					'settings' => array(
						'button_label' => __( 'Add a step', 'allterrain-fields' ),
						'sub_fields'   => array(
							atcf_template_field(
								'field_recipe_step',
								__( 'Step', 'allterrain-fields' ),
								'textarea',
								array( 'settings' => array( 'rows' => 3 ) )
							),
						),
					),
				)
			),
			atcf_template_field(
				'field_recipe_allergens',
				__( 'Contains allergens', 'allterrain-fields' ),
				'true_false',
				array( 'wrapper' => atcf_template_width( 50 ) )
			),
			atcf_template_field(
				'field_recipe_allergen_list',
				__( 'Which allergens', 'allterrain-fields' ),
				'text',
				array(
					'instructions' => __( 'This field only appears when the switch beside it is on.', 'allterrain-fields' ),
					'wrapper'      => atcf_template_width( 50 ),
					'conditional'  => atcf_template_when( 'field_recipe_allergens', 'is', '1' ),
				)
			),
		),
	);
}

/**
 * The Property listings template.
 *
 * @since 0.1.0
 *
 * @return array The group.
 */
function atcf_template_property() {
	return array(
		'title'    => __( 'Property', 'allterrain-fields' ),
		'location' => atcf_template_location(),
		'settings' => array(
			'description' => __( 'What a listing needs: the numbers, where it is, what it looks like and who is selling it.', 'allterrain-fields' ),
		),
		'fields'   => array(
			atcf_template_field(
				'field_property_status',
				__( 'Status', 'allterrain-fields' ),
				'button_group',
				array(
					'settings' => array(
						'choices'       => array(
							array(
								'value' => 'for-sale',
								'label' => __( 'For sale', 'allterrain-fields' ),
							),
							array(
								'value' => 'under-offer',
								'label' => __( 'Under offer', 'allterrain-fields' ),
							),
							array(
								'value' => 'sold',
								'label' => __( 'Sold', 'allterrain-fields' ),
							),
						),
						'default_value' => 'for-sale',
					),
				)
			),
			atcf_template_field(
				'field_property_price',
				__( 'Price', 'allterrain-fields' ),
				'number',
				array(
					'wrapper'  => atcf_template_width( 33 ),
					'settings' => array( 'min' => 0 ),
				)
			),
			atcf_template_field(
				'field_property_area',
				__( 'Floor area', 'allterrain-fields' ),
				'number',
				array(
					'wrapper'  => atcf_template_width( 33 ),
					'settings' => array(
						'min'    => 0,
						'append' => 'm²',
					),
				)
			),
			atcf_template_field(
				'field_property_per_metre',
				__( 'Price per m²', 'allterrain-fields' ),
				'computed',
				array(
					'instructions' => __( 'Price divided by floor area. Dividing by nothing gives nothing, rather than an error.', 'allterrain-fields' ),
					'wrapper'      => atcf_template_width( 34 ),
					'settings'     => array(
						'formula'  => 'round({price} / {floor_area}, 2)',
						'decimals' => 2,
					),
				)
			),
			atcf_template_field(
				'field_property_type',
				__( 'Property type', 'allterrain-fields' ),
				'select',
				array(
					'wrapper'  => atcf_template_width( 34 ),
					'settings' => array(
						'choices'    => array(
							array(
								'value' => 'house',
								'label' => __( 'House', 'allterrain-fields' ),
							),
							array(
								'value' => 'flat',
								'label' => __( 'Flat', 'allterrain-fields' ),
							),
							array(
								'value' => 'studio',
								'label' => __( 'Studio', 'allterrain-fields' ),
							),
							array(
								'value' => 'land',
								'label' => __( 'Land', 'allterrain-fields' ),
							),
						),
						'allow_null' => true,
					),
				)
			),
			atcf_template_field(
				'field_property_beds',
				__( 'Bedrooms', 'allterrain-fields' ),
				'number',
				array(
					'wrapper'  => atcf_template_width( 33 ),
					'settings' => array( 'min' => 0 ),
				)
			),
			atcf_template_field(
				'field_property_baths',
				__( 'Bathrooms', 'allterrain-fields' ),
				'number',
				array(
					'wrapper'  => atcf_template_width( 33 ),
					'settings' => array( 'min' => 0 ),
				)
			),
			atcf_template_field(
				'field_property_where',
				__( 'Where it is', 'allterrain-fields' ),
				'location',
				array(
					'instructions' => __( 'Type an address and press Find. No map key, no billing account.', 'allterrain-fields' ),
				)
			),
			atcf_template_field(
				'field_property_photos',
				__( 'Photographs', 'allterrain-fields' ),
				'gallery',
				array(
					'instructions' => __( 'Drag pictures in from the Media window. Drag them within the grid to reorder.', 'allterrain-fields' ),
				)
			),
			atcf_template_field(
				'field_property_features',
				__( 'Features', 'allterrain-fields' ),
				'checkbox',
				array(
					'settings' => array(
						'layout'  => 'horizontal',
						'choices' => array(
							array(
								'value' => 'garden',
								'label' => __( 'Garden', 'allterrain-fields' ),
							),
							array(
								'value' => 'parking',
								'label' => __( 'Parking', 'allterrain-fields' ),
							),
							array(
								'value' => 'pool',
								'label' => __( 'Pool', 'allterrain-fields' ),
							),
							array(
								'value' => 'terrace',
								'label' => __( 'Terrace', 'allterrain-fields' ),
							),
							array(
								'value' => 'lift',
								'label' => __( 'Lift', 'allterrain-fields' ),
							),
						),
					),
				)
			),
			atcf_template_field(
				'field_property_agent',
				__( 'Agent', 'allterrain-fields' ),
				'user',
				array(
					'instructions' => __( 'A person on this site. Open the window beside this one and the two are tied together on the desktop.', 'allterrain-fields' ),
				)
			),
			atcf_template_field(
				'field_property_reduced',
				__( 'Price reduced', 'allterrain-fields' ),
				'true_false',
				array( 'wrapper' => atcf_template_width( 50 ) )
			),
			atcf_template_field(
				'field_property_was',
				__( 'Previous price', 'allterrain-fields' ),
				'number',
				array(
					'wrapper'     => atcf_template_width( 50 ),
					'conditional' => atcf_template_when( 'field_property_reduced', 'is', '1' ),
				)
			),
		),
	);
}

/**
 * The Events template.
 *
 * @since 0.1.0
 *
 * @return array The group.
 */
function atcf_template_event() {
	return array(
		'title'    => __( 'Event', 'allterrain-fields' ),
		'location' => atcf_template_location(),
		'settings' => array(
			'description' => __( 'When it is, where it is, who is speaking and how many places are left.', 'allterrain-fields' ),
		),
		'fields'   => array(
			atcf_template_field(
				'field_event_starts',
				__( 'Starts', 'allterrain-fields' ),
				'date_time_picker',
				array(
					'wrapper'  => atcf_template_width( 50 ),
					'required' => true,
				)
			),
			atcf_template_field(
				'field_event_ends',
				__( 'Ends', 'allterrain-fields' ),
				'date_time_picker',
				array( 'wrapper' => atcf_template_width( 50 ) )
			),
			atcf_template_field(
				'field_event_venue',
				__( 'Venue', 'allterrain-fields' ),
				'location',
				array()
			),
			atcf_template_field(
				'field_event_free',
				__( 'Free to attend', 'allterrain-fields' ),
				'true_false',
				array( 'wrapper' => atcf_template_width( 50 ) )
			),
			atcf_template_field(
				'field_event_price',
				__( 'Ticket price', 'allterrain-fields' ),
				'number',
				array(
					'instructions' => __( 'Disappears when the event is free, and is not required of you when it is hidden.', 'allterrain-fields' ),
					'wrapper'      => atcf_template_width( 50 ),
					'settings'     => array( 'min' => 0 ),
					'conditional'  => atcf_template_when( 'field_event_free', 'is', '0' ),
				)
			),
			atcf_template_field(
				'field_event_capacity',
				__( 'Capacity', 'allterrain-fields' ),
				'number',
				array(
					'wrapper'  => atcf_template_width( 33 ),
					'settings' => array( 'min' => 0 ),
				)
			),
			atcf_template_field(
				'field_event_sold',
				__( 'Tickets sold', 'allterrain-fields' ),
				'number',
				array(
					'wrapper'  => atcf_template_width( 33 ),
					'settings' => array( 'min' => 0 ),
				)
			),
			atcf_template_field(
				'field_event_left',
				__( 'Places left', 'allterrain-fields' ),
				'computed',
				array(
					'instructions' => __( 'Never goes below zero, because a negative number of places is not a thing.', 'allterrain-fields' ),
					'wrapper'      => atcf_template_width( 34 ),
					'settings'     => array(
						'formula'  => 'max({capacity} - {tickets_sold}, 0)',
						'decimals' => 0,
					),
				)
			),
			atcf_template_field(
				'field_event_speakers',
				__( 'Speakers', 'allterrain-fields' ),
				'user',
				array(
					'instructions' => __( 'People on this site. Click one and it opens in its own window beside this.', 'allterrain-fields' ),
					'settings'     => array( 'multiple' => true ),
				)
			),
			atcf_template_field(
				'field_event_schedule',
				__( 'Running order', 'allterrain-fields' ),
				'repeater',
				array(
					'settings' => array(
						'button_label' => __( 'Add a slot', 'allterrain-fields' ),
						'sub_fields'   => array(
							atcf_template_field(
								'field_event_time',
								__( 'Time', 'allterrain-fields' ),
								'time_picker',
								array( 'wrapper' => atcf_template_width( 30 ) )
							),
							atcf_template_field(
								'field_event_what',
								__( 'What', 'allterrain-fields' ),
								'text',
								array( 'wrapper' => atcf_template_width( 70 ) )
							),
						),
					),
				)
			),
			atcf_template_field(
				'field_event_closes',
				__( 'Registration closes', 'allterrain-fields' ),
				'date_picker',
				array()
			),
		),
	);
}
