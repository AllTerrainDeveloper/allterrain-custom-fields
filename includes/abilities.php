<?php
/**
 * Abilities.
 *
 * WordPress's Abilities API is how an AI assistant or an MCP client is told what
 * it may do on a site, in a form it can call without being taught the plugin's
 * REST routes. Every ability here carries its own permission callback, so an
 * agent gets exactly the ceiling its user has and not a step more.
 *
 * The set is chosen for what an assistant is actually asked to do with custom
 * fields: read the content model, read and write values, and — deliberately —
 * *not* restructure the schema. "Add a field to every product" is a change a
 * person should make while looking at the consequences.
 *
 * Entirely optional. The whole file is behind `function_exists()`, so a site
 * without the Abilities API registers nothing and loses nothing else.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'wp_abilities_api_init', 'atcf_register_abilities' );
add_action( 'wp_abilities_api_categories_init', 'atcf_register_ability_category' );

// The spelling the Abilities feature plugin used before it landed in Core 6.9.
// Registered against both for the same reason the shell integration is: which
// one fires depends on which version of the API is installed, and a listener for
// a hook that never fires costs nothing. `wp_register_ability()` refuses a
// duplicate, so a site where both fire registers each ability once.
add_action( 'abilities_api_init', 'atcf_register_abilities' );

/**
 * Registers the category this plugin's abilities sit in.
 *
 * On its own hook, which fires **before** `wp_abilities_api_init` — an ability
 * naming a category that does not exist yet is refused, and the refusal is a
 * `_doing_it_wrong()` notice nobody reads.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_ability_category() {
	if ( ! function_exists( 'wp_register_ability_category' ) ) {
		return;
	}

	wp_register_ability_category(
		'allterrain-fields',
		array(
			'label'       => __( 'Custom fields', 'allterrain-fields' ),
			'description' => __( 'Read and change the shape of the site’s content — its field groups, its content types, and the values stored against posts, terms and people.', 'allterrain-fields' ),
		)
	);
}

/**
 * Registers this plugin's abilities.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_abilities() {
	if ( ! function_exists( 'wp_register_ability' ) ) {
		return;
	}

	// Guarded because both spellings of the hook are listened for and a site
	// running the feature plugin alongside 6.9 would fire both.
	static $done = false;

	if ( $done ) {
		return;
	}

	$done = true;

	wp_register_ability(
		'allterrain-fields/list-groups',
		array(
			'category'            => 'allterrain-fields',
			'label'               => __( 'List field groups', 'allterrain-fields' ),
			'description'         => __( 'Every field group on the site, with where each one appears and how many fields it has.', 'allterrain-fields' ),
			'input_schema'        => array(
				'type'       => 'object',
				'properties' => new stdClass(),
			),
			'output_schema'       => array( 'type' => 'array' ),
			'execute_callback'    => 'atcf_ability_list_groups',
			'permission_callback' => 'atcf_can_manage',
		)
	);

	wp_register_ability(
		'allterrain-fields/describe-model',
		array(
			'category'            => 'allterrain-fields',
			'label'               => __( 'Describe the content model', 'allterrain-fields' ),
			'description'         => __( 'The site’s post types, taxonomies and the relationships between them, as a graph.', 'allterrain-fields' ),
			'input_schema'        => array(
				'type'       => 'object',
				'properties' => new stdClass(),
			),
			'output_schema'       => array( 'type' => 'object' ),
			'execute_callback'    => 'atcf_ability_describe_model',
			'permission_callback' => 'atcf_can_manage',
		)
	);

	wp_register_ability(
		'allterrain-fields/read-values',
		array(
			'category'            => 'allterrain-fields',
			'label'               => __( 'Read a post’s custom fields', 'allterrain-fields' ),
			'description'         => __( 'Every custom field value on one post, keyed by field name.', 'allterrain-fields' ),
			'input_schema'        => array(
				'type'       => 'object',
				'properties' => array(
					'post_id' => array( 'type' => 'integer' ),
				),
				'required'   => array( 'post_id' ),
			),
			'output_schema'       => array( 'type' => 'object' ),
			'execute_callback'    => 'atcf_ability_read_values',
			'permission_callback' => 'atcf_ability_can_read_post',
		)
	);

	wp_register_ability(
		'allterrain-fields/write-value',
		array(
			'category'            => 'allterrain-fields',
			'label'               => __( 'Set a custom field on a post', 'allterrain-fields' ),
			'description'         => __( 'Writes one field value on one post. The value is sanitised by the field’s own type, so a bad value is refused rather than stored.', 'allterrain-fields' ),
			'input_schema'        => array(
				'type'       => 'object',
				'properties' => array(
					'post_id' => array( 'type' => 'integer' ),
					'field'   => array( 'type' => 'string' ),
					'value'   => array(),
				),
				'required'   => array( 'post_id', 'field' ),
			),
			'output_schema'       => array( 'type' => 'object' ),
			'execute_callback'    => 'atcf_ability_write_value',
			'permission_callback' => 'atcf_ability_can_edit_post',
		)
	);

	wp_register_ability(
		'allterrain-fields/find-by-value',
		array(
			'category'            => 'allterrain-fields',
			'label'               => __( 'Find posts by a field value', 'allterrain-fields' ),
			'description'         => __( 'Posts whose named field holds a given value. The question a custom-fields plugin exists to answer and which nothing else can.', 'allterrain-fields' ),
			'input_schema'        => array(
				'type'       => 'object',
				'properties' => array(
					'field'     => array( 'type' => 'string' ),
					'value'     => array( 'type' => 'string' ),
					'compare'   => array( 'type' => 'string' ),
					'post_type' => array( 'type' => 'string' ),
				),
				'required'   => array( 'field' ),
			),
			'output_schema'       => array( 'type' => 'array' ),
			'execute_callback'    => 'atcf_ability_find_by_value',
			'permission_callback' => 'atcf_ability_can_list_posts',
		)
	);

	wp_register_ability(
		'allterrain-fields/describe-group',
		array(
			'category'            => 'allterrain-fields',
			'label'               => __( 'Describe a field group', 'allterrain-fields' ),
			'description'         => __( 'One field group in full — every field, its type, its meta key, whether it is required, its conditions and its formula. What an agent needs before it can write a value or a template.', 'allterrain-fields' ),
			'input_schema'        => array(
				'type'       => 'object',
				'properties' => array(
					'group' => array(
						'type'        => 'string',
						'description' => __( 'The group key or its numeric id.', 'allterrain-fields' ),
					),
				),
				'required'   => array( 'group' ),
			),
			'output_schema'       => array( 'type' => 'object' ),
			'execute_callback'    => 'atcf_ability_describe_group',
			'permission_callback' => 'atcf_can_manage',
		)
	);

	wp_register_ability(
		'allterrain-fields/list-templates',
		array(
			'category'            => 'allterrain-fields',
			'label'               => __( 'List starter templates', 'allterrain-fields' ),
			'description'         => __( 'The worked field groups this plugin ships — recipes, property listings, events — with what each one teaches.', 'allterrain-fields' ),
			'input_schema'        => array( 'type' => 'object' ),
			'output_schema'       => array( 'type' => 'array' ),
			'execute_callback'    => 'atcf_ability_list_templates',
			'permission_callback' => 'atcf_can_manage',
		)
	);

	wp_register_ability(
		'allterrain-fields/create-group-from-template',
		array(
			'category'            => 'allterrain-fields',
			'label'               => __( 'Create a field group from a template', 'allterrain-fields' ),
			'description'         => __( 'Builds a real field group from one of the starter templates. Keys are minted fresh and conditional rules rewritten, so applying one twice gives two independent groups.', 'allterrain-fields' ),
			'input_schema'        => array(
				'type'       => 'object',
				'properties' => array(
					'template' => array(
						'type'        => 'string',
						'description' => __( 'A slug from list-templates.', 'allterrain-fields' ),
					),
				),
				'required'   => array( 'template' ),
			),
			'output_schema'       => array( 'type' => 'object' ),
			'execute_callback'    => 'atcf_ability_create_from_template',
			'permission_callback' => 'atcf_can_manage',
		)
	);

	wp_register_ability(
		'allterrain-fields/create-content-type',
		array(
			'category'            => 'allterrain-fields',
			'label'               => __( 'Create a custom post type', 'allterrain-fields' ),
			'description'         => __( 'Registers a custom post type — Recipes, Properties, Staff — with its own menu entry, its own list and its own place for fields. Removing one later never removes what was stored in it.', 'allterrain-fields' ),
			'input_schema'        => array(
				'type'       => 'object',
				'properties' => array(
					'singular'     => array(
						'type'        => 'string',
						'description' => __( 'What one of them is called. “Recipe”.', 'allterrain-fields' ),
					),
					'plural'       => array(
						'type'        => 'string',
						'description' => __( 'What several are called. “Recipes”. Defaults to the singular.', 'allterrain-fields' ),
					),
					'icon'         => array( 'type' => 'string' ),
					'public'       => array( 'type' => 'boolean' ),
					'hierarchical' => array( 'type' => 'boolean' ),
				),
				'required'   => array( 'singular' ),
			),
			'output_schema'       => array( 'type' => 'object' ),
			'execute_callback'    => 'atcf_ability_create_content_type',
			'permission_callback' => 'atcf_can_manage',
		)
	);

	wp_register_ability(
		'allterrain-fields/evaluate-formula',
		array(
			'category'            => 'allterrain-fields',
			'label'               => __( 'Try a formula', 'allterrain-fields' ),
			'description'         => __( 'Works out what a computed-field formula comes to for a given set of values, without storing anything. The same evaluator that runs on save, so the answer is the answer.', 'allterrain-fields' ),
			'input_schema'        => array(
				'type'       => 'object',
				'properties' => array(
					'formula' => array(
						'type'        => 'string',
						'description' => __( 'The expression, with field names in braces: {price} * {quantity}.', 'allterrain-fields' ),
					),
					'values'  => array(
						'type'        => 'object',
						'description' => __( 'Field name to number.', 'allterrain-fields' ),
					),
				),
				'required'   => array( 'formula' ),
			),
			'output_schema'       => array( 'type' => 'object' ),
			'execute_callback'    => 'atcf_ability_evaluate_formula',
			// Deliberately the low bar. Trying a formula stores nothing, reads
			// nothing and touches no post; gating it on `manage_options` would
			// stop an agent checking its own arithmetic before writing a value it
			// *is* allowed to write.
			'permission_callback' => 'atcf_ability_can_list_posts',
		)
	);
}

/**
 * Permission callback for reading one post's fields.
 *
 * @since 0.1.0
 *
 * @param array $input The ability input.
 * @return bool True when the user may read it.
 */
function atcf_ability_can_read_post( $input = array() ) {
	return current_user_can( 'edit_post', (int) atcf_arr( (array) $input, 'post_id', 0 ) );
}

/**
 * Permission callback for writing one post's fields.
 *
 * @since 0.1.0
 *
 * @param array $input The ability input.
 * @return bool True when the user may edit it.
 */
function atcf_ability_can_edit_post( $input = array() ) {
	return current_user_can( 'edit_post', (int) atcf_arr( (array) $input, 'post_id', 0 ) );
}

/**
 * Permission callback for querying posts.
 *
 * @since 0.1.0
 *
 * @return bool True when the user may edit anything at all.
 */
function atcf_ability_can_list_posts() {
	return current_user_can( 'edit_posts' );
}

/**
 * Lists the field groups.
 *
 * @since 0.1.0
 *
 * @return array[] Group summaries.
 */
function atcf_ability_list_groups() {
	$groups = array();

	foreach ( atcf_get_groups( true ) as $group ) {
		$groups[] = atcf_group_summary( $group );
	}

	return $groups;
}

/**
 * Describes the content model.
 *
 * @since 0.1.0
 *
 * @return array The graph.
 */
function atcf_ability_describe_model() {
	return array(
		'edges'  => atcf_relationship_graph(),
		'groups' => atcf_ability_list_groups(),
	);
}

/**
 * Reads one post's field values.
 *
 * @since 0.1.0
 *
 * @param array $input The ability input.
 * @return array Name => value.
 */
function atcf_ability_read_values( $input ) {
	return atcf_get_fields( (int) atcf_arr( (array) $input, 'post_id', 0 ), false );
}

/**
 * Writes one field value.
 *
 * @since 0.1.0
 *
 * @param array $input The ability input.
 * @return array|WP_Error What was written, or an error.
 */
function atcf_ability_write_value( $input ) {
	$post_id = (int) atcf_arr( (array) $input, 'post_id', 0 );
	$field   = (string) atcf_arr( (array) $input, 'field', '' );
	$ref     = array(
		'type' => 'post',
		'id'   => $post_id,
	);
	$found   = atcf_locate_field( $field, $ref );

	if ( ! $found ) {
		return new WP_Error(
			'atcf_no_field',
			/* translators: %s: field name. */
			sprintf( __( 'There is no field called “%s” on that post.', 'allterrain-fields' ), $field )
		);
	}

	$value = atcf_arr( (array) $input, 'value', null );

	atcf_save_value( $found, $ref, $value );
	atcf_sync_relationships( $found, $ref, $value );

	return array(
		'post_id' => $post_id,
		'field'   => $found['name'],
		'value'   => atcf_load_value( $found, $ref, '', false ),
	);
}

/**
 * Finds posts by a field value.
 *
 * @since 0.1.0
 *
 * @param array $input The ability input.
 * @return array[] Matching posts.
 */
function atcf_ability_find_by_value( $input ) {
	$input   = (array) $input;
	$name    = atcf_sanitize_field_name( (string) atcf_arr( $input, 'field', '' ) );
	$compare = strtoupper( (string) atcf_arr( $input, 'compare', '=' ) );
	$allowed = array( '=', '!=', '>', '>=', '<', '<=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'EXISTS', 'NOT EXISTS' );

	if ( '' === $name ) {
		return array();
	}

	$query = new WP_Query(
		array(
			'post_type'      => (string) atcf_arr( $input, 'post_type', 'any' ),
			'post_status'    => array( 'publish', 'draft', 'pending', 'private', 'future' ),
			'posts_per_page' => 50,
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- A meta query is the question being asked; there is no other way to answer it.
			'meta_query'     => array(
				array(
					'key'     => $name,
					'value'   => (string) atcf_arr( $input, 'value', '' ),
					'compare' => in_array( $compare, $allowed, true ) ? $compare : '=',
				),
			),
		)
	);

	$results = array();

	foreach ( $query->posts as $post ) {
		if ( ! current_user_can( 'edit_post', $post->ID ) ) {
			// Filtered per post rather than by narrowing the query, because the
			// question "which posts have this value" and the question "which of
			// those may this user see" have different answers and conflating
			// them into one query gets the second one wrong.
			continue;
		}

		$results[] = array(
			'id'     => (int) $post->ID,
			'title'  => $post->post_title,
			'type'   => $post->post_type,
			'status' => $post->post_status,
			'url'    => (string) get_edit_post_link( $post, 'raw' ),
			'value'  => atcf_get_field( $name, $post->ID, false ),
		);
	}

	return $results;
}

/**
 * One field group in full.
 *
 * The schema, not the values. An agent asked to "set the price on post 42" needs
 * to know that the field is called `price`, that it is a number, and that it
 * lives on posts — and none of that is guessable from the request.
 *
 * @since 0.1.0
 *
 * @param array $input The ability input.
 * @return array|WP_Error The group, or why not.
 */
function atcf_ability_describe_group( $input ) {
	$wanted = (string) atcf_arr( (array) $input, 'group', '' );
	$group  = null;

	foreach ( atcf_get_groups( true ) as $one ) {
		if ( (string) atcf_arr( $one, 'key', '' ) === $wanted || (string) (int) atcf_arr( $one, 'id', 0 ) === $wanted ) {
			$group = $one;
			break;
		}
	}

	if ( ! $group ) {
		return new WP_Error(
			'atcf_no_group',
			__( 'No field group by that key or id.', 'allterrain-fields' ),
			array( 'status' => 404 )
		);
	}

	$fields = array();

	foreach ( atcf_flatten_fields( (array) atcf_arr( $group, 'fields', array() ) ) as $field ) {
		$settings = (array) atcf_arr( $field, 'settings', array() );

		$fields[] = array(
			'key'          => (string) atcf_arr( $field, 'key', '' ),
			'name'         => (string) atcf_arr( $field, 'name', '' ),
			'label'        => (string) atcf_arr( $field, 'label', '' ),
			'type'         => (string) atcf_arr( $field, 'type', '' ),
			'required'     => (bool) atcf_arr( $field, 'required', false ),
			'instructions' => (string) atcf_arr( $field, 'instructions', '' ),
			'formula'      => (string) atcf_arr( $settings, 'formula', '' ),
			'conditional'  => (bool) atcf_arr( (array) atcf_arr( $field, 'conditional', array() ), 'enabled', false ),
		);
	}

	return array(
		'key'      => (string) atcf_arr( $group, 'key', '' ),
		'id'       => (int) atcf_arr( $group, 'id', 0 ),
		'title'    => (string) atcf_arr( $group, 'title', '' ),
		'location' => atcf_describe_location( (array) atcf_arr( $group, 'location', array() ) ),
		'fields'   => $fields,
	);
}

/**
 * The starter templates, as an agent would choose between them.
 *
 * @since 0.1.0
 *
 * @return array[] The summaries.
 */
function atcf_ability_list_templates() {
	return atcf_template_summaries();
}

/**
 * Builds a field group from a template.
 *
 * @since 0.1.0
 *
 * @param array $input The ability input.
 * @return array|WP_Error The saved group, or why not.
 */
function atcf_ability_create_from_template( $input ) {
	$group = atcf_group_from_template( (string) atcf_arr( (array) $input, 'template', '' ) );

	if ( is_wp_error( $group ) ) {
		return $group;
	}

	$saved = atcf_save_group( $group );

	if ( is_wp_error( $saved ) ) {
		return $saved;
	}

	return array(
		'id'     => (int) atcf_arr( $saved, 'id', 0 ),
		'key'    => (string) atcf_arr( $saved, 'key', '' ),
		'title'  => (string) atcf_arr( $saved, 'title', '' ),
		'fields' => count( atcf_flatten_fields( (array) atcf_arr( $saved, 'fields', array() ) ) ),
	);
}

/**
 * Makes a new content type.
 *
 * The one ability here that changes the *shape* of the site rather than its
 * contents, which is why it is gated on `manage_options` like the builder is —
 * an agent that can add a post type can add a menu entry to every admin screen
 * on the site.
 *
 * @since 0.1.0
 *
 * @param array $input The ability input.
 * @return array|WP_Error The stored definition, or why not.
 */
function atcf_ability_create_content_type( $input ) {
	$type = atcf_save_content_type( (array) $input );

	if ( is_wp_error( $type ) ) {
		return $type;
	}

	return array(
		'id'       => (int) $type['id'],
		'slug'     => (string) $type['slug'],
		'singular' => (string) $type['singular'],
		'plural'   => (string) $type['plural'],
		'public'   => (bool) $type['public'],
	);
}

/**
 * Works out what a formula comes to, without storing anything.
 *
 * The same `atcf_calc()` that runs on every save, so the answer an agent checks
 * is the answer that will be stored. A second, friendlier evaluator would be
 * right until the day it was not.
 *
 * @since 0.1.0
 *
 * @param array $input The ability input.
 * @return array The result, and what it read to get there.
 */
function atcf_ability_evaluate_formula( $input ) {
	$input   = (array) $input;
	$formula = (string) atcf_arr( $input, 'formula', '' );
	$values  = (array) atcf_arr( $input, 'values', array() );
	$numbers = array();

	foreach ( $values as $name => $value ) {
		$numbers[ (string) $name ] = is_numeric( $value ) ? (float) $value : 0.0;
	}

	$result  = atcf_calc( $formula, $numbers );
	$named   = atcf_calc_variables( $formula );
	$missing = array_values( array_diff( $named, array_keys( $numbers ) ) );

	return array(
		'result'  => '' === $result ? null : $result,
		'usable'  => '' !== $result,
		'reads'   => $named,
		'missing' => $missing,
	);
}
