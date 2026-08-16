<?php
/**
 * The admin pages.
 *
 * The same three bundles the desktop windows use, mounted on ordinary admin
 * pages. This is not a lesser fallback grafted on afterwards — it is the same
 * builder, the same graph and the same tools, in a page instead of a window.
 *
 * What is genuinely missing without the shell is everything that needs a
 * *second* surface: dragging a field between two builders, dropping a photo from
 * a Media window onto an image field, seeing two related posts tied together on
 * a desktop. Those are not features that were withheld; they are features that
 * have nowhere to happen in a browser tab.
 *
 * The menu is registered whether or not the shell is active, because
 * OpenStation's dock is built *from* the admin menu — a page that hid itself
 * from the menu when the shell was on would be a page with no way in from the
 * desktop either.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_menu', 'atcf_register_admin_pages' );

/**
 * Registers the Fields menu.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_admin_pages() {
	if ( ! atcf_can_manage() ) {
		return;
	}

	add_menu_page(
		__( 'Fields', 'allterrain-fields' ),
		__( 'Fields', 'allterrain-fields' ),
		ATCF_MANAGE_CAP,
		'allterrain-fields',
		'atcf_render_builder_page',
		'dashicons-index-card',
		58
	);

	add_submenu_page(
		'allterrain-fields',
		__( 'Field Groups', 'allterrain-fields' ),
		__( 'Field Groups', 'allterrain-fields' ),
		ATCF_MANAGE_CAP,
		'allterrain-fields',
		'atcf_render_builder_page'
	);

	add_submenu_page(
		'allterrain-fields',
		__( 'Content Model', 'allterrain-fields' ),
		__( 'Content Model', 'allterrain-fields' ),
		ATCF_MANAGE_CAP,
		'allterrain-fields-model',
		'atcf_render_model_page'
	);

	add_submenu_page(
		'allterrain-fields',
		__( 'Bulk Editor', 'allterrain-fields' ),
		__( 'Bulk Editor', 'allterrain-fields' ),
		ATCF_MANAGE_CAP,
		'allterrain-fields-bulk',
		'atcf_render_bulk_page'
	);

	add_submenu_page(
		'allterrain-fields',
		__( 'Tools', 'allterrain-fields' ),
		__( 'Tools', 'allterrain-fields' ),
		ATCF_MANAGE_CAP,
		'allterrain-fields-tools',
		'atcf_render_tools_page'
	);
}

add_action( 'admin_enqueue_scripts', 'atcf_enqueue_admin_pages' );

/**
 * Loads the right bundle for each admin page.
 *
 * @since 0.1.0
 *
 * @param string $hook_suffix The admin screen.
 * @return void
 */
function atcf_enqueue_admin_pages( $hook_suffix ) {
	// Matched on the `page` query argument rather than on `$hook_suffix`. A
	// submenu's hook suffix is built from the *translated* parent menu title, so
	// `fields_page_allterrain-fields-model` is only ever the hook on a site in
	// English — which is a very quiet way for a bundle to stop loading in French.
	unset( $hook_suffix );

	$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( (string) $_GET['page'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Reading which admin screen is being drawn; no state changes.

	$pages = array(
		'allterrain-fields'       => array( 'builder', 'allterrain-fields-builder' ),
		'allterrain-fields-model' => array( 'model', 'allterrain-fields-model' ),
		'allterrain-fields-bulk'  => array( 'bulk', 'allterrain-fields-builder' ),
		'allterrain-fields-tools' => array( 'tools', 'allterrain-fields-builder' ),
	);

	if ( ! isset( $pages[ $page ] ) ) {
		return;
	}

	$target = $pages[ $page ];

	atcf_print_runtime_config();

	wp_enqueue_style( $target[1] );
	wp_enqueue_script( 'allterrain-fields-' . $target[0] );
	wp_enqueue_media();

	wp_add_inline_script(
		'allterrain-fields-' . $target[0],
		'window.allTerrainFieldsL10n = ' . wp_json_encode( atcf_runtime_strings() ) . ';',
		'before'
	);
}

/**
 * Renders the builder page.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_render_builder_page() {
	echo '<div class="wrap atcf-page">';
	atcf_builder_template();
	echo '</div>';
}

/**
 * Renders the content model page.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_render_model_page() {
	echo '<div class="wrap atcf-page">';
	atcf_model_template();
	echo '</div>';
}

/**
 * Renders the bulk editor page.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_render_bulk_page() {
	echo '<div class="wrap atcf-page">';
	atcf_bulk_template();
	echo '</div>';
}

/**
 * Renders the tools page.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_render_tools_page() {
	echo '<div class="wrap atcf-page">';
	atcf_tools_template();
	echo '</div>';
}
