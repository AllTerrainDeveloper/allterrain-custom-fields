<?php
/**
 * The two post types.
 *
 * A field group is a post and an options page is a post. Nothing in this plugin
 * lives in a bespoke table, which is not a stylistic preference — it is what
 * makes the REST API, `current_user_can()`, revisions, search, the trash,
 * WP-CLI, `wp_insert_post` hooks and every backup plugin already work on a
 * site's content model with no integration code anywhere.
 *
 * Revisions in particular pay for themselves the first time somebody deletes a
 * field by accident: a field group's schema is one meta row, and a post type
 * that supports revisions keeps every previous version of it.
 *
 * Both are `show_ui` but not `show_in_menu`. `show_ui` is what puts them in
 * OpenStation's WP Explorer, which browses every UI-capable type; `show_in_menu`
 * false keeps the block editor's "Add New" out of an admin menu where it would
 * open the wrong editor for the job. The right editor is the builder window.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Post type holding one field group.
 *
 * @since 0.1.0
 */
const ATCF_GROUP_TYPE = 'atcf_field_group';

/**
 * Post type holding one options page definition.
 *
 * @since 0.1.0
 */
const ATCF_OPTIONS_TYPE = 'atcf_options_page';

/**
 * The post type holding the content types somebody made.
 *
 * One post per type. Not an option, for the same reason field groups are not:
 * revisions, trash, capabilities and export all come free, and a definition that
 * lives in a row somebody can find is a definition somebody can recover.
 *
 * @since 0.1.0
 */
const ATCF_CONTENT_TYPE = 'atcf_content_type';

/**
 * Meta key on a field group holding its serialized schema.
 *
 * One row, not one row per field. A field group is read in full or not at all —
 * every render, every save and every location match needs the whole thing — so
 * splitting it across forty rows would buy a `meta_query` nobody performs and
 * cost a join on every request that does.
 *
 * Leading underscore because it is machinery: it keeps the JSON out of the
 * Custom Fields metabox, where a stray edit would corrupt a site's content model
 * with no warning and no undo.
 *
 * @since 0.1.0
 */
const ATCF_SCHEMA_META = '_atcf_schema';

/**
 * Meta key holding a field group's stable key.
 *
 * Duplicated out of the schema JSON into its own row precisely so it *can* be
 * queried: importing a group has to answer "do I already have this one?" in a
 * single `WP_Query`, and asking that of a JSON blob means loading every group on
 * the site and decoding each one.
 *
 * @since 0.1.0
 */
const ATCF_KEY_META = '_atcf_key';

add_action( 'init', 'atcf_register_post_types', 5 );

/**
 * Registers both post types.
 *
 * Priority 5 rather than the default 10: field groups have to exist before
 * anything on `init` at 10 asks which fields a post type has, and the location
 * engine, the REST routes and the block registrations all do.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_post_types() {
	register_post_type(
		ATCF_GROUP_TYPE,
		array(
			'labels'              => array(
				'name'          => _x( 'Field Groups', 'post type general name', 'allterrain-fields' ),
				'singular_name' => _x( 'Field Group', 'post type singular name', 'allterrain-fields' ),
				'add_new_item'  => __( 'Add Field Group', 'allterrain-fields' ),
				'edit_item'     => __( 'Edit Field Group', 'allterrain-fields' ),
				'search_items'  => __( 'Search field groups', 'allterrain-fields' ),
				'not_found'     => __( 'No field groups yet.', 'allterrain-fields' ),
			),
			'public'              => false,
			'show_ui'             => true,
			'show_in_menu'        => false,
			'show_in_admin_bar'   => false,
			'show_in_nav_menus'   => false,
			'exclude_from_search' => true,
			'hierarchical'        => false,
			'supports'            => array( 'title', 'revisions' ),
			'menu_icon'           => 'dashicons-index-card',
			'capability_type'     => 'post',
			'map_meta_cap'        => true,
			'rewrite'             => false,
			'query_var'           => false,
			'show_in_rest'        => false,
		)
	);

	register_post_type(
		ATCF_CONTENT_TYPE,
		array(
			'labels'              => array(
				'name'          => _x( 'Content Types', 'post type general name', 'allterrain-fields' ),
				'singular_name' => _x( 'Content Type', 'post type singular name', 'allterrain-fields' ),
				'add_new_item'  => __( 'Add Content Type', 'allterrain-fields' ),
				'edit_item'     => __( 'Edit Content Type', 'allterrain-fields' ),
				'not_found'     => __( 'No content types yet.', 'allterrain-fields' ),
			),
			'public'              => false,
			'show_ui'             => true,
			'show_in_menu'        => false,
			'show_in_admin_bar'   => false,
			'show_in_nav_menus'   => false,
			'exclude_from_search' => true,
			'hierarchical'        => false,
			'supports'            => array( 'title', 'revisions' ),
			'menu_icon'           => 'dashicons-portfolio',
			'capability_type'     => 'post',
			'map_meta_cap'        => true,
			'rewrite'             => false,
			'query_var'           => false,
			'show_in_rest'        => false,
		)
	);

	register_post_type(
		ATCF_OPTIONS_TYPE,
		array(
			'labels'              => array(
				'name'          => _x( 'Options Pages', 'post type general name', 'allterrain-fields' ),
				'singular_name' => _x( 'Options Page', 'post type singular name', 'allterrain-fields' ),
				'add_new_item'  => __( 'Add Options Page', 'allterrain-fields' ),
				'edit_item'     => __( 'Edit Options Page', 'allterrain-fields' ),
				'not_found'     => __( 'No options pages yet.', 'allterrain-fields' ),
			),
			'public'              => false,
			'show_ui'             => true,
			'show_in_menu'        => false,
			'show_in_admin_bar'   => false,
			'show_in_nav_menus'   => false,
			'exclude_from_search' => true,
			'hierarchical'        => false,
			'supports'            => array( 'title' ),
			'menu_icon'           => 'dashicons-admin-generic',
			'capability_type'     => 'post',
			'map_meta_cap'        => true,
			'rewrite'             => false,
			'query_var'           => false,
			'show_in_rest'        => false,
		)
	);

	register_post_meta(
		ATCF_GROUP_TYPE,
		ATCF_SCHEMA_META,
		array(
			'type'          => 'string',
			'single'        => true,
			'default'       => '',
			'show_in_rest'  => false,
			// Not `sanitize_callback`: the schema is normalised by
			// `atcf_normalize_schema()` before it is ever written, and a second
			// sanitiser that only knows the value is a string would be free to
			// mangle valid JSON while proving nothing about its shape.
			'auth_callback' => 'atcf_can_manage',
		)
	);

	register_post_meta(
		ATCF_GROUP_TYPE,
		ATCF_KEY_META,
		array(
			'type'          => 'string',
			'single'        => true,
			'default'       => '',
			'show_in_rest'  => false,
			'auth_callback' => 'atcf_can_manage',
		)
	);
}

/**
 * Every published field group on the site, newest edit first.
 *
 * Cached for the request. Location matching asks this question once per screen
 * and once per REST call, and the block registrar asks it again on `init` — a
 * site with sixty groups was running the same query four times before anything
 * had rendered.
 *
 * @since 0.1.0
 *
 * @param bool $include_drafts Whether to include groups that are not published.
 * @return WP_Post[] Field group posts.
 */
function atcf_get_group_posts( $include_drafts = false ) {
	static $cache = array();

	// Keyed on the epoch as well as the bucket, so invalidation is one integer
	// increment somewhere else rather than a way to reach into this function's
	// static — which PHP does not offer, and which every workaround for reaches
	// through a global that anything can write.
	$bucket = ( $include_drafts ? 'all' : 'published' ) . ':' . atcf_group_cache_epoch();

	if ( isset( $cache[ $bucket ] ) ) {
		return $cache[ $bucket ];
	}

	$cache[ $bucket ] = get_posts(
		array(
			'post_type'        => ATCF_GROUP_TYPE,
			'post_status'      => $include_drafts ? array( 'publish', 'draft', 'pending' ) : 'publish',
			'numberposts'      => -1,
			'orderby'          => 'menu_order title',
			'order'            => 'ASC',
			'suppress_filters' => false,
		)
	);

	return $cache[ $bucket ];
}

add_action( 'save_post_' . ATCF_GROUP_TYPE, 'atcf_flush_group_cache' );
add_action( 'deleted_post', 'atcf_flush_group_cache' );

/**
 * Drops the per-request group cache.
 *
 * Saving a group inside the same request that later renders a screen — which is
 * exactly what the builder's save does before it re-reads the schema — would
 * otherwise render the version from before the save.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_flush_group_cache() {
	atcf_group_cache_epoch( true );
}

/**
 * The current cache epoch, bumped whenever a group changes.
 *
 * @since 0.1.0
 *
 * @param bool $bump Whether to advance the epoch.
 * @return int The epoch.
 */
function atcf_group_cache_epoch( $bump = false ) {
	static $epoch = 0;

	if ( $bump ) {
		++$epoch;
	}

	return $epoch;
}
