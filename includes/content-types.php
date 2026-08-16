<?php
/**
 * Content types you make yourself.
 *
 * A field group has to live *on* something. Every custom-fields plugin assumes
 * that something already exists — that somebody has already written a
 * `register_post_type()` call in a theme's `functions.php`, or installed a
 * second plugin whose entire job is to write one for them.
 *
 * That assumption is fine for a developer and useless for everybody else. The
 * honest shape of "I want to keep recipes on this site" is: make a place to put
 * recipes, then say what a recipe has. This file is the first half. Without it
 * the Content Model can only ever draw the types somebody else registered, and
 * "what have I built" has no answer that includes the word *built*.
 *
 * ### Where they live
 *
 * One post per type, in `atcf_content_type`, with the definition in post meta.
 * The same choice as field groups and for the same reasons — revisions, trash,
 * capabilities, export, and `WP_Query` all come free, and a site that deactivates
 * this plugin keeps every row rather than losing its content model to a dropped
 * table.
 *
 * ### What it deliberately does not do
 *
 * It does not try to be a post-type builder with every argument exposed.
 * `register_post_type()` takes forty of them and thirty-eight are wrong to ask
 * about before somebody has any content. What is here is the set you cannot skip
 * — what it is called, what it looks like, whether the public can see it,
 * whether it groups into categories — and a filter for anybody who wants the
 * other thirty-eight.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Where a content type's definition is stored.
 *
 * @since 0.1.0
 */
const ATCF_CONTENT_TYPE_META = '_atcf_content_type';

/**
 * Post types this plugin will not let anybody create.
 *
 * Not a security boundary — the capability check is that. This is to stop
 * somebody registering `post` a second time and spending an afternoon working
 * out why their site broke.
 *
 * @since 0.1.0
 *
 * @return string[] Reserved slugs.
 */
function atcf_reserved_type_slugs() {
	/**
	 * Filters the post type slugs a content type may not use.
	 *
	 * @since 0.1.0
	 *
	 * @param string[] $reserved Reserved slugs.
	 */
	return (array) apply_filters(
		'atcf_reserved_type_slugs',
		array(
			'post',
			'page',
			'attachment',
			'revision',
			'nav_menu_item',
			'custom_css',
			'customize_changeset',
			'oembed_cache',
			'user_request',
			'wp_block',
			'wp_template',
			'wp_template_part',
			'wp_global_styles',
			'wp_navigation',
			'action',
			'author',
			'order',
			'theme',
			ATCF_GROUP_TYPE,
			ATCF_OPTIONS_TYPE,
			ATCF_CONTENT_TYPE,
		)
	);
}

add_action( 'init', 'atcf_register_stored_types', 7 );

/**
 * Registers every content type somebody has made.
 *
 * Named `..._stored_types` rather than `..._content_types`, which is what it
 * wanted to be called: `atcf_register_content_types()` already exists and
 * registers the *field* types in the content group — text, image, oEmbed. Two
 * different senses of "content type" in one plugin is unfortunate, and the one
 * that gets the plain name is the one that was there first.
 *
 * At priority 7 — after this plugin's own types at 5, and before the field types
 * at 6 have any bearing on it, but comfortably before the default 10 where a
 * theme's `functions.php` and most other plugins hook. Anything that reads
 * `get_post_types()` on `init` therefore sees these.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_stored_types() {
	foreach ( atcf_get_content_types() as $type ) {
		$slug = (string) atcf_arr( $type, 'slug', '' );

		if ( '' === $slug || post_type_exists( $slug ) ) {
			continue;
		}

		register_post_type( $slug, atcf_content_type_args( $type ) );

		foreach ( (array) atcf_arr( $type, 'taxonomies', array() ) as $taxonomy ) {
			if ( taxonomy_exists( (string) $taxonomy ) ) {
				register_taxonomy_for_object_type( (string) $taxonomy, $slug );
			}
		}
	}
}

/**
 * Turns a stored definition into `register_post_type()` arguments.
 *
 * The labels are generated from two words — the singular and the plural — rather
 * than asked for one at a time. WordPress wants seventeen of them and a person
 * making their first content type should not have to fill in "Uploaded to this
 * Recipe" before they can save.
 *
 * @since 0.1.0
 *
 * @param array $type The stored definition.
 * @return array Arguments for `register_post_type()`.
 */
function atcf_content_type_args( $type ) {
	$singular = (string) atcf_arr( $type, 'singular', '' );
	$plural   = (string) atcf_arr( $type, 'plural', $singular );
	$public   = (bool) atcf_arr( $type, 'public', true );

	$supports = array( 'title', 'custom-fields' );

	if ( atcf_arr( $type, 'editor', true ) ) {
		$supports[] = 'editor';
	}

	if ( atcf_arr( $type, 'thumbnail', true ) ) {
		$supports[] = 'thumbnail';
	}

	if ( atcf_arr( $type, 'excerpt', false ) ) {
		$supports[] = 'excerpt';
	}

	$args = array(
		'labels'              => array(
			/* translators: %s: The plural name of a content type. */
			'name'               => $plural,
			'singular_name'      => $singular,
			/* translators: %s: The singular name of a content type. */
			'add_new_item'       => sprintf( __( 'Add %s', 'allterrain-fields' ), $singular ),
			/* translators: %s: The singular name of a content type. */
			'edit_item'          => sprintf( __( 'Edit %s', 'allterrain-fields' ), $singular ),
			/* translators: %s: The singular name of a content type. */
			'new_item'           => sprintf( __( 'New %s', 'allterrain-fields' ), $singular ),
			/* translators: %s: The singular name of a content type. */
			'view_item'          => sprintf( __( 'View %s', 'allterrain-fields' ), $singular ),
			/* translators: %s: The plural name of a content type. */
			'search_items'       => sprintf( __( 'Search %s', 'allterrain-fields' ), $plural ),
			/* translators: %s: The plural name of a content type, lower-cased. */
			'not_found'          => sprintf( __( 'No %s yet.', 'allterrain-fields' ), atcf_lower( $plural ) ),
			/* translators: %s: The plural name of a content type, lower-cased. */
			'not_found_in_trash' => sprintf( __( 'No %s in the trash.', 'allterrain-fields' ), atcf_lower( $plural ) ),
			'all_items'          => $plural,
			'menu_name'          => $plural,
		),
		'public'              => $public,
		'publicly_queryable'  => $public,
		'show_ui'             => true,
		'show_in_menu'        => true,
		'show_in_nav_menus'   => $public,
		'show_in_rest'        => true,
		'exclude_from_search' => ! $public,
		'hierarchical'        => (bool) atcf_arr( $type, 'hierarchical', false ),
		'supports'            => $supports,
		'menu_icon'           => (string) atcf_arr( $type, 'icon', 'dashicons-portfolio' ),
		'menu_position'       => 25,
		'has_archive'         => $public && (bool) atcf_arr( $type, 'archive', true ),
		'capability_type'     => 'post',
		'map_meta_cap'        => true,
		'rewrite'             => $public ? array( 'slug' => (string) atcf_arr( $type, 'slug', '' ) ) : false,
	);

	/**
	 * Filters the arguments a content type is registered with.
	 *
	 * The thirty-eight arguments the form does not ask about live here. A site
	 * needing `register_meta_box_cb`, a custom `capability_type` or a
	 * `rest_controller_class` sets it in one place and every content type made
	 * through this plugin gets it.
	 *
	 * @since 0.1.0
	 *
	 * @param array $args The arguments.
	 * @param array $type The stored definition.
	 */
	return (array) apply_filters( 'atcf_content_type_args', $args, $type );
}

/**
 * Lower-cases a label for use inside a sentence.
 *
 * `mb_strtolower()` when it is there, because "Übungen" lower-cased by
 * `strtolower()` is "Übungen" with a broken first byte.
 *
 * @since 0.1.0
 *
 * @param string $text The label.
 * @return string The label, lower-cased.
 */
function atcf_lower( $text ) {
	return function_exists( 'mb_strtolower' ) ? mb_strtolower( $text, 'UTF-8' ) : strtolower( $text );
}

/**
 * Every content type somebody has made.
 *
 * @since 0.1.0
 *
 * @return array[] The definitions, in menu order.
 */
function atcf_get_content_types() {
	$cached = wp_cache_get( 'atcf_content_types' );

	if ( is_array( $cached ) ) {
		return $cached;
	}

	$posts = get_posts(
		array(
			'post_type'        => ATCF_CONTENT_TYPE,
			'post_status'      => 'publish',
			'posts_per_page'   => 200,
			'orderby'          => 'menu_order title',
			'order'            => 'ASC',
			'suppress_filters' => false,
		)
	);

	$types = array();

	foreach ( $posts as $post ) {
		$types[] = atcf_content_type_from_post( $post );
	}

	/**
	 * Filters the content types this plugin registers.
	 *
	 * @since 0.1.0
	 *
	 * @param array[] $types The definitions.
	 */
	$types = (array) apply_filters( 'atcf_content_types', $types );

	wp_cache_set( 'atcf_content_types', $types );

	return $types;
}

/**
 * Reads one definition off its post.
 *
 * @since 0.1.0
 *
 * @param WP_Post $post The stored post.
 * @return array The definition.
 */
function atcf_content_type_from_post( $post ) {
	$stored = get_post_meta( $post->ID, ATCF_CONTENT_TYPE_META, true );

	$type = atcf_normalize_content_type( is_array( $stored ) ? $stored : array() );

	$type['id']       = (int) $post->ID;
	$type['singular'] = '' !== $type['singular'] ? $type['singular'] : $post->post_title;
	$type['plural']   = '' !== $type['plural'] ? $type['plural'] : $post->post_title;
	$type['slug']     = '' !== $type['slug'] ? $type['slug'] : $post->post_name;

	return $type;
}

/**
 * Fills in everything a definition did not say.
 *
 * @since 0.1.0
 *
 * @param array $type A partial definition.
 * @return array The definition, complete.
 */
function atcf_normalize_content_type( $type ) {
	$type = (array) $type;

	$singular = sanitize_text_field( (string) atcf_arr( $type, 'singular', '' ) );
	$plural   = sanitize_text_field( (string) atcf_arr( $type, 'plural', '' ) );

	return array(
		'id'           => (int) atcf_arr( $type, 'id', 0 ),
		'slug'         => atcf_content_type_slug( (string) atcf_arr( $type, 'slug', $singular ) ),
		'singular'     => $singular,
		'plural'       => '' !== $plural ? $plural : $singular,
		'icon'         => sanitize_html_class( (string) atcf_arr( $type, 'icon', 'dashicons-portfolio' ) ),
		'public'       => (bool) atcf_arr( $type, 'public', true ),
		'hierarchical' => (bool) atcf_arr( $type, 'hierarchical', false ),
		'editor'       => (bool) atcf_arr( $type, 'editor', true ),
		'thumbnail'    => (bool) atcf_arr( $type, 'thumbnail', true ),
		'excerpt'      => (bool) atcf_arr( $type, 'excerpt', false ),
		'archive'      => (bool) atcf_arr( $type, 'archive', true ),
		'taxonomies'   => array_values(
			array_filter(
				array_map( 'sanitize_key', (array) atcf_arr( $type, 'taxonomies', array() ) )
			)
		),
	);
}

/**
 * A post type slug, from whatever somebody typed.
 *
 * Twenty characters, because `register_post_type()` refuses anything longer and
 * does it with a `_doing_it_wrong()` nobody sees. Truncating here means a person
 * who names something "Continuing professional development" gets a working
 * content type instead of a silent failure.
 *
 * @since 0.1.0
 *
 * @param string $text The name or slug.
 * @return string A usable slug.
 */
function atcf_content_type_slug( $text ) {
	$slug = sanitize_key( str_replace( array( ' ', '-' ), '_', (string) $text ) );
	$slug = preg_replace( '/[^a-z0-9_]/', '', $slug );

	return substr( (string) $slug, 0, 20 );
}

/**
 * Creates a content type.
 *
 * @since 0.1.0
 *
 * @param array $type The definition.
 * @return array|WP_Error The stored definition, or why not.
 */
function atcf_save_content_type( $type ) {
	$type = atcf_normalize_content_type( $type );

	if ( '' === $type['singular'] ) {
		return new WP_Error(
			'atcf_type_no_name',
			__( 'Give it a name first — what is one of them called?', 'allterrain-fields' ),
			array( 'status' => 400 )
		);
	}

	if ( '' === $type['slug'] ) {
		return new WP_Error(
			'atcf_type_no_slug',
			__( 'That name has no letters or numbers in it, so there is nothing to build an address from.', 'allterrain-fields' ),
			array( 'status' => 400 )
		);
	}

	if ( in_array( $type['slug'], atcf_reserved_type_slugs(), true ) ) {
		return new WP_Error(
			'atcf_type_reserved',
			sprintf(
				/* translators: %s: A post type slug. */
				__( '“%s” is a name WordPress already uses for something else. Try another.', 'allterrain-fields' ),
				$type['slug']
			),
			array( 'status' => 400 )
		);
	}

	// A slug that is already registered by a theme or another plugin. Refused
	// rather than silently skipped at registration time, because a content type
	// that saves and then never appears is the worst of both.
	if ( ! $type['id'] && post_type_exists( $type['slug'] ) ) {
		return new WP_Error(
			'atcf_type_exists',
			sprintf(
				/* translators: %s: A post type slug. */
				__( 'Something on this site already registers “%s”. Give yours a different name.', 'allterrain-fields' ),
				$type['slug']
			),
			array( 'status' => 409 )
		);
	}

	$post = array(
		'post_type'   => ATCF_CONTENT_TYPE,
		'post_status' => 'publish',
		'post_title'  => $type['plural'],
		'post_name'   => $type['slug'],
	);

	if ( $type['id'] ) {
		$post['ID'] = $type['id'];
	}

	$id = wp_insert_post( $post, true );

	if ( is_wp_error( $id ) ) {
		return $id;
	}

	$type['id'] = (int) $id;

	update_post_meta( $id, ATCF_CONTENT_TYPE_META, $type );
	atcf_flush_content_type_cache();

	// The type is registered on `init`, which has already run by the time a REST
	// request gets here. Registering it now means the response can describe a
	// type that really exists, and the caller can put a field group on it in the
	// same breath rather than after a reload.
	if ( ! post_type_exists( $type['slug'] ) ) {
		register_post_type( $type['slug'], atcf_content_type_args( $type ) );
	}

	// Permalinks for a public type do not exist until the rules are rebuilt, and
	// the symptom of skipping this is a brand new content type whose every entry
	// 404s until somebody happens to visit the Permalinks screen.
	if ( $type['public'] ) {
		flush_rewrite_rules( false );
	}

	/**
	 * Fires after a content type is created or changed.
	 *
	 * @since 0.1.0
	 *
	 * @param array $type The stored definition.
	 */
	do_action( 'atcf_content_type_saved', $type );

	return $type;
}

/**
 * Deletes a content type.
 *
 * The **posts are left alone**, and that is not an oversight. Deleting a content
 * type is routinely a change of mind about the name, and a delete that takes two
 * hundred recipes with it is a delete nobody dares press. The rows stay in
 * `wp_posts` under the old post type; recreating the type with the same slug
 * brings every one of them back.
 *
 * @since 0.1.0
 *
 * @param int $id The definition's post id.
 * @return bool|WP_Error True, or why not.
 */
function atcf_delete_content_type( $id ) {
	$id = (int) $id;

	if ( ATCF_CONTENT_TYPE !== get_post_type( $id ) ) {
		return new WP_Error(
			'atcf_no_content_type',
			__( 'No such content type.', 'allterrain-fields' ),
			array( 'status' => 404 )
		);
	}

	$deleted = wp_delete_post( $id, true );

	atcf_flush_content_type_cache();

	/**
	 * Fires after a content type is deleted.
	 *
	 * @since 0.1.0
	 *
	 * @param int $id The definition's post id.
	 */
	do_action( 'atcf_content_type_deleted', $id );

	return (bool) $deleted;
}

add_action( 'save_post_' . ATCF_CONTENT_TYPE, 'atcf_flush_content_type_cache' );
add_action( 'deleted_post', 'atcf_flush_content_type_cache' );

/**
 * Forgets the cached list.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_flush_content_type_cache() {
	wp_cache_delete( 'atcf_content_types' );
}
