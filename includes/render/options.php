<?php
/**
 * Options pages.
 *
 * A screen of fields that belongs to the site rather than to any one post — the
 * header phone number, the footer address, the social links. It is the single
 * most-bought add-on in the history of this category, and it is a `add_menu_page()`
 * call, a form, and `update_option()`.
 *
 * Values go into `wp_options`, autoloaded, under the names migrating sites already hold: the
 * default page prefixes with `options_`, a named one with its own slug. That
 * means a site migrating in finds its values already in place, and a site
 * migrating out keeps them.
 *
 * Pages come from two places and behave identically: created in the Options
 * window (a post of type `atcf_options_page`), or declared in code with
 * `atcf_add_options_page()`.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Meta key holding an options page's definition.
 *
 * @since 0.1.0
 */
const ATCF_OPTIONS_META = '_atcf_options';

/**
 * Registers an options page from code.
 *
 * @since 0.1.0
 *
 * @param array|string $args A page definition, or just its title.
 * @return array The normalised page.
 */
function atcf_add_options_page( $args = array() ) {
	if ( is_string( $args ) ) {
		$args = array( 'page_title' => $args );
	}

	$page = atcf_normalize_options_page( $args );

	$registry = atcf_local_options_pages();

	$registry[ $page['slug'] ] = $page;

	atcf_local_options_pages( $registry );

	return $page;
}

/**
 * Reads or replaces the code-registered options pages.
 *
 * @since 0.1.0
 *
 * @param array|null $replace New registry, or null to read.
 * @return array<string,array> Slug => page.
 */
function atcf_local_options_pages( $replace = null ) {
	static $registry = array();

	if ( is_array( $replace ) ) {
		$registry = $replace;
	}

	return $registry;
}

/**
 * Normalises an options page definition.
 *
 * @since 0.1.0
 *
 * @param array $args Raw definition.
 * @return array The canonical page.
 */
function atcf_normalize_options_page( $args ) {
	$args  = is_array( $args ) ? $args : array();
	$title = sanitize_text_field( (string) atcf_arr( $args, 'page_title', __( 'Options', 'allterrain-fields' ) ) );
	$slug  = sanitize_key( (string) atcf_arr( $args, 'slug', atcf_arr( $args, 'menu_slug', '' ) ) );

	if ( '' === $slug ) {
		$slug = sanitize_key( str_replace( ' ', '-', $title ) );
	}

	return array(
		'slug'        => $slug,
		'page_title'  => $title,
		'menu_title'  => sanitize_text_field( (string) atcf_arr( $args, 'menu_title', $title ) ),
		'capability'  => sanitize_text_field( (string) atcf_arr( $args, 'capability', 'manage_options' ) ),
		'icon'        => sanitize_text_field( (string) atcf_arr( $args, 'icon', 'dashicons-admin-generic' ) ),
		'position'    => (int) atcf_arr( $args, 'position', 80 ),
		'parent'      => sanitize_text_field( (string) atcf_arr( $args, 'parent', atcf_arr( $args, 'parent_slug', '' ) ) ),
		'description' => sanitize_text_field( (string) atcf_arr( $args, 'description', '' ) ),
	);
}

/**
 * Every options page on the site.
 *
 * @since 0.1.0
 *
 * @return array[] Canonical pages, keyed by slug.
 */
function atcf_get_options_pages() {
	$pages = atcf_local_options_pages();

	$posts = get_posts(
		array(
			'post_type'        => ATCF_OPTIONS_TYPE,
			'post_status'      => 'publish',
			'numberposts'      => -1,
			'orderby'          => 'menu_order title',
			'order'            => 'ASC',
			'suppress_filters' => false,
		)
	);

	foreach ( $posts as $post ) {
		$stored = get_post_meta( $post->ID, ATCF_OPTIONS_META, true );
		$stored = is_array( $stored ) ? $stored : array();

		$stored['page_title'] = $post->post_title;

		$page       = atcf_normalize_options_page( $stored );
		$page['id'] = (int) $post->ID;

		// A stored page wins over a code-registered one with the same slug, the
		// same way a stored field group does — declare it in code, then let a
		// site adjust it without editing the code.
		$pages[ $page['slug'] ] = $page;
	}

	/**
	 * Filters the site's options pages.
	 *
	 * @since 0.1.0
	 *
	 * @param array[] $pages Slug => canonical page.
	 */
	return (array) apply_filters( 'atcf_options_pages', $pages );
}

add_action( 'admin_menu', 'atcf_register_options_menus', 20 );

/**
 * Adds an admin menu entry per options page.
 *
 * Registered even when the desktop shell is active. The shell builds its dock
 * from the admin menu, so a page that skipped the menu would be a page with no
 * way in from the desktop either — the menu is the registration, and the dock is
 * a *view* of it.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_options_menus() {
	foreach ( atcf_get_options_pages() as $page ) {
		$render = static function () use ( $page ) {
			atcf_render_options_page( $page );
		};

		if ( '' !== $page['parent'] ) {
			add_submenu_page(
				$page['parent'],
				$page['page_title'],
				$page['menu_title'],
				$page['capability'],
				'atcf-options-' . $page['slug'],
				$render
			);

			continue;
		}

		add_menu_page(
			$page['page_title'],
			$page['menu_title'],
			$page['capability'],
			'atcf-options-' . $page['slug'],
			$render,
			$page['icon'],
			$page['position']
		);
	}
}

/**
 * Renders one options page.
 *
 * @since 0.1.0
 *
 * @param array $page Canonical page.
 * @return void
 */
function atcf_render_options_page( $page ) {
	if ( ! current_user_can( $page['capability'] ) ) {
		wp_die( esc_html__( 'You are not allowed to see this page.', 'allterrain-fields' ) );
	}

	$ref     = array(
		'type' => 'option',
		'id'   => $page['slug'],
	);
	$context = atcf_options_context( $page['slug'] );
	$groups  = atcf_groups_for( $context );
	$saved   = false;
	$errors  = array();

	if ( atcf_has_submission() ) {
		$errors = atcf_save_submission( $ref, atcf_submitted_payload(), $context );
		$saved  = ! $errors;
	}

	echo '<div class="wrap atcf-options">';
	printf( '<h1>%s</h1>', esc_html( $page['page_title'] ) );

	if ( '' !== $page['description'] ) {
		printf( '<p class="atcf-options__description">%s</p>', esc_html( $page['description'] ) );
	}

	if ( $saved ) {
		printf(
			'<div class="notice notice-success is-dismissible"><p>%s</p></div>',
			esc_html__( 'Saved.', 'allterrain-fields' )
		);
	}

	foreach ( $errors as $message ) {
		printf( '<div class="notice notice-error"><p>%s</p></div>', esc_html( (string) $message ) );
	}

	if ( ! $groups ) {
		printf(
			'<p class="atcf-options__empty">%s</p>',
			esc_html__( 'No field group is pointed at this page yet. Add a location rule of “Options page is this one” to a group and its fields will appear here.', 'allterrain-fields' )
		);

		echo '</div>';

		return;
	}

	echo '<form method="post" class="atcf-options__form">';

	atcf_render_form_marker();

	foreach ( $groups as $group ) {
		echo '<div class="atcf-options__group">';
		printf( '<h2>%s</h2>', esc_html( $group['title'] ) );

		atcf_render_group_fields( $group, $ref );

		echo '</div>';
	}

	submit_button( __( 'Save', 'allterrain-fields' ) );

	echo '</form></div>';
}

/**
 * Reads a value from an options page.
 *
 * A convenience over `atcf_get_field( $name, 'option' )` for the named-page
 * case, which otherwise needs the caller to build the reference by hand.
 *
 * @since 0.1.0
 *
 * @param string $selector Field name or key.
 * @param string $page     Options page slug.
 * @return mixed The value.
 */
function atcf_get_option_field( $selector, $page = 'options' ) {
	return atcf_get_field(
		$selector,
		array(
			'type' => 'option',
			'id'   => sanitize_key( $page ),
		)
	);
}
