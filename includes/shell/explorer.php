<?php
/**
 * WP Explorer.
 *
 * OpenStation's site window browses every `show_ui` post type automatically, so
 * field groups and options pages appear there without a line of code. What
 * arrives by default is two loose folders of tiles reading only a title — and a
 * field group's title is the least interesting thing about it. Where does it
 * appear? How many fields does it have? Is it switched on?
 *
 * This file answers those in the places the Explorer already looks, rather than
 * inventing a surface:
 *
 *   - **The folder.** Both types collapse into one *Fields* folder with the
 *     builder's icon, sorted ahead of the generic plugin folders.
 *   - **The tiles.** A group's excerpt becomes its location and field count, so
 *     the grid reads like a content model even where there is no graph.
 *   - **The icons.** Per type, so a group and an options page are
 *     distinguishable at a glance in a folder holding both.
 *
 * There was no need to patch OpenStation for any of it.
 *
 * Every filter here is additive and gated: with no shell installed none of them
 * ever fire.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * The folder id both post types share in the Explorer root.
 *
 * @since 0.1.0
 */
const ATCF_EXPLORER_GROUP = 'plugin:allterrain-fields';

add_filter( 'openstation_my_wordpress_post_type_group', 'atcf_explorer_group', 10, 2 );
add_filter( 'desktop_mode_my_wordpress_post_type_group', 'atcf_explorer_group', 10, 2 );

/**
 * Puts field groups and options pages in one folder.
 *
 * The Explorer files a type under whichever plugin called `register_post_type()`,
 * which already lands both of ours together — but it derives the label and icon
 * from the plugin header, so the folder gets a generic post icon. Declaring the
 * group explicitly is what buys the builder's own icon and a sort weight ahead
 * of the other plugin folders.
 *
 * @since 0.1.0
 *
 * @param array|null $group     Resolved group, or null for a loose section.
 * @param string     $post_type Post type slug.
 * @return array|null Group descriptor.
 */
function atcf_explorer_group( $group, $post_type ) {
	if ( ! in_array( $post_type, array( ATCF_GROUP_TYPE, ATCF_OPTIONS_TYPE ), true ) ) {
		return $group;
	}

	return array(
		'id'    => ATCF_EXPLORER_GROUP,
		'label' => __( 'Fields', 'allterrain-fields' ),
		'icon'  => 'dashicons-index-card',
		// Below the built-in Posts / Pages / Media, above the generic plugin
		// folders at 20. A site's content model is something people open often;
		// a folder they have to scroll to is a folder they stop using.
		'order' => 16,
	);
}

add_filter( 'openstation_my_wordpress_post_type_entity', 'atcf_explorer_entity', 10, 2 );
add_filter( 'desktop_mode_my_wordpress_post_type_entity', 'atcf_explorer_entity', 10, 2 );

/**
 * Tunes each section inside that folder.
 *
 * @since 0.1.0
 *
 * @param array        $entity    Section descriptor.
 * @param WP_Post_Type $post_type The type it was built from.
 * @return array Filtered descriptor.
 */
function atcf_explorer_entity( $entity, $post_type ) {
	if ( ! $post_type instanceof WP_Post_Type ) {
		return $entity;
	}

	if ( ATCF_GROUP_TYPE === $post_type->name ) {
		$entity['icon'] = 'dashicons-index-card';
	}

	if ( ATCF_OPTIONS_TYPE === $post_type->name ) {
		$entity['icon'] = 'dashicons-admin-generic';
	}

	if ( in_array( $post_type->name, array( ATCF_GROUP_TYPE, ATCF_OPTIONS_TYPE ), true ) ) {
		// Neither type supports thumbnails and neither ever will. Leaving them
		// on makes the list request ask for embedded media on every tile and get
		// nothing back, once per tile.
		$entity['thumbnails'] = false;
	}

	return $entity;
}

add_filter( 'the_excerpt', 'atcf_explorer_excerpt', 10 );
add_filter( 'get_the_excerpt', 'atcf_explorer_excerpt', 10, 2 );

/**
 * Makes a field group's excerpt say what it is.
 *
 * The Explorer renders a tile's excerpt under its title, and a field group has
 * none — so the tile reads as a bare name in a folder of bare names. Answering
 * "where does this appear and how big is it" turns the folder into something
 * worth opening.
 *
 * Scoped to this plugin's own post types, so nothing else on the site is
 * touched.
 *
 * @since 0.1.0
 *
 * @param string       $excerpt The excerpt so far.
 * @param WP_Post|null $post    The post, when the filter passes one.
 * @return string The excerpt.
 */
function atcf_explorer_excerpt( $excerpt, $post = null ) {
	$post = $post instanceof WP_Post ? $post : get_post();

	if ( ! $post instanceof WP_Post ) {
		return $excerpt;
	}

	if ( ATCF_OPTIONS_TYPE === $post->post_type ) {
		return __( 'Options page', 'allterrain-fields' );
	}

	if ( ATCF_GROUP_TYPE !== $post->post_type ) {
		return $excerpt;
	}

	$group = atcf_get_group( $post );

	if ( ! $group ) {
		return $excerpt;
	}

	$count = count( atcf_flatten_fields( $group['fields'] ) );

	$parts = array(
		sprintf(
			/* translators: %s: number of fields. */
			_n( '%s field', '%s fields', $count, 'allterrain-fields' ),
			number_format_i18n( $count )
		),
		atcf_describe_location( $group['location'] ),
	);

	if ( ! $group['settings']['active'] ) {
		$parts[] = __( 'switched off', 'allterrain-fields' );
	}

	return implode( ' · ', $parts );
}

add_filter( 'atcf_runtime_config', 'atcf_add_explorer_config' );

/**
 * Tells the bundles which drag payload kinds arrive from the Explorer.
 *
 * The Explorer's own payload slug has changed once already, in the rename from
 * Desktop Mode to OpenStation, and a field runtime that hardcoded one of them
 * would silently stop accepting dropped media on half the installs out there.
 * Listing them is cheap; guessing is not.
 *
 * @since 0.1.0
 *
 * @param array $config The runtime config.
 * @return array The config.
 */
function atcf_add_explorer_config( $config ) {
	/**
	 * Filters the drag payload types this plugin's fields accept from the shell.
	 *
	 * @since 0.1.0
	 *
	 * @param string[] $types Payload type slugs.
	 */
	$config['acceptTypes'] = (array) apply_filters(
		'atcf_accepted_drag_types',
		array( 'shortcut', 'desktop-file', 'openstation/file', 'desktop-mode/file', 'openstation/attachment' )
	);

	return $config;
}
