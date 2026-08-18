<?php
/**
 * Registering and enqueueing the bundles.
 *
 * Registration happens on `init` for everything, unconditionally and cheaply —
 * `wp_register_script()` stores an array and does no work. Enqueueing is the
 * decision, and it is made per screen.
 *
 * The split matters because of how OpenStation loads a native window's bundle:
 * lazily, by handle, the first time the window opens, long after
 * `wp_enqueue_scripts` has run for that page. A handle that was never
 * *registered* cannot be resolved to a URL at that point, so the shell would
 * quietly open an empty window.
 *
 * `SCRIPT_DEBUG` picks the readable build. Both are committed, which is what
 * makes "download the zip and install it" work with no `npm install`.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'atcf_register_assets' );

/**
 * Registers every script and style this plugin owns.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_assets() {
	$suffix = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '' : '.min';

	$bundles = array(
		'fields'  => array(),
		'builder' => array( 'allterrain-fields-config' ),
		'model'   => array( 'allterrain-fields-config' ),
		'tools'   => array( 'allterrain-fields-config' ),
		'bulk'    => array( 'allterrain-fields-config' ),
		'widget'  => array( 'allterrain-fields-config' ),
		'dock'    => array( 'allterrain-fields-config' ),
	);

	// The config handle carries no file of its own. It is a registration whose
	// only job is to be a dependency that `wp_add_inline_script()` can attach the
	// runtime blob to, so every bundle gets the blob before it in the document
	// no matter which of them loaded first — including the lazily loaded ones,
	// which never pass through `wp_print_scripts` at all.
	wp_register_script( 'allterrain-fields-config', '', array(), ATCF_VERSION, false );

	foreach ( $bundles as $handle => $deps ) {
		wp_register_script(
			'allterrain-fields-' . $handle,
			ATCF_URL . 'assets/js/' . $handle . $suffix . '.js',
			$deps,
			ATCF_VERSION,
			true
		);
	}

	wp_register_style(
		'allterrain-fields',
		ATCF_URL . 'assets/css/fields.css',
		array(),
		ATCF_VERSION
	);

	wp_register_style(
		'allterrain-fields-builder',
		ATCF_URL . 'assets/css/builder.css',
		array( 'allterrain-fields' ),
		ATCF_VERSION
	);

	wp_register_style(
		'allterrain-fields-model',
		ATCF_URL . 'assets/css/model.css',
		array( 'allterrain-fields' ),
		ATCF_VERSION
	);
}

/**
 * The runtime blob every bundle reads.
 *
 * @since 0.1.0
 *
 * @return array The config.
 */
function atcf_runtime_config() {
	$config = array(
		'restUrl'   => esc_url_raw( rest_url( 'allterrain-fields/v1/' ) ),
		'wpRestUrl' => esc_url_raw( rest_url( 'wp/v2/' ) ),
		'nonce'     => wp_create_nonce( 'wp_rest' ),
		'adminUrl'  => esc_url_raw( admin_url() ),
		'version'   => ATCF_VERSION,
		'canManage' => atcf_can_manage(),
		'devMode'   => atcf_dev_mode(),
		'locale'    => get_user_locale(),
		'dragTypes' => array(
			'field' => ATCF_DRAG_FIELD,
			'group' => ATCF_DRAG_GROUP,
			'value' => ATCF_DRAG_VALUE,
		),
		'shell'     => array(
			'active'     => atcf_shell_is_active(),
			'chromeless' => atcf_shell_is_chromeless(),
		),
	);

	/**
	 * Filters the runtime configuration handed to every bundle.
	 *
	 * Everything in it reaches anybody who can open an admin screen with a field
	 * on it, so a filter adding to it is adding to a payload with a wide
	 * audience.
	 *
	 * @since 0.1.0
	 *
	 * @param array $config The config.
	 */
	return (array) apply_filters( 'atcf_runtime_config', $config );
}

/**
 * Attaches the runtime blob to the config handle.
 *
 * Idempotent. It is called from three enqueue paths that can all run in one
 * request — a post editor inside a shell window enqueues the field runtime *and*
 * the shell-level bundles — and `wp_add_inline_script()` appends rather than
 * replaces, so a second call would print the blob twice.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_print_runtime_config() {
	static $printed = false;

	if ( $printed ) {
		return;
	}

	$printed = true;

	wp_enqueue_script( 'allterrain-fields-config' );

	wp_add_inline_script(
		'allterrain-fields-config',
		'window.allTerrainFields = ' . wp_json_encode( atcf_runtime_config() ) . ';',
		'before'
	);
}

add_action( 'admin_enqueue_scripts', 'atcf_enqueue_field_runtime' );

/**
 * Loads the field runtime on any screen that has a field on it.
 *
 * The check is "does any group match this screen", not "is this an editor" —
 * because a field group can be pointed at a term screen, a user profile or an
 * options page, and each of those is a different `$hook_suffix`.
 *
 * @since 0.1.0
 *
 * @param string $hook_suffix The admin screen.
 * @return void
 */
function atcf_enqueue_field_runtime( $hook_suffix ) {
	if ( ! atcf_screen_has_fields( $hook_suffix ) ) {
		return;
	}

	atcf_print_runtime_config();

	wp_enqueue_style( 'allterrain-fields' );
	wp_enqueue_script( 'allterrain-fields-fields' );
	wp_enqueue_media();

	wp_add_inline_script(
		'allterrain-fields-fields',
		'window.allTerrainFieldsL10n = ' . wp_json_encode( atcf_runtime_strings() ) . ';',
		'before'
	);
}

/**
 * Whether the current admin screen renders any field.
 *
 * Deliberately generous on the editor screens: a post editor is matched by its
 * hook rather than by running the location engine, because the post's terms and
 * template are not settled at `admin_enqueue_scripts` and a group whose rule
 * depends on one would be missed. Loading a bundle that finds nothing to mount
 * costs a few kilobytes; not loading one that was needed costs the whole screen.
 *
 * @since 0.1.0
 *
 * @param string $hook_suffix The admin screen.
 * @return bool True when the runtime is wanted.
 */
function atcf_screen_has_fields( $hook_suffix ) {
	if ( in_array( $hook_suffix, array( 'post.php', 'post-new.php', 'term.php', 'edit-tags.php', 'profile.php', 'user-edit.php', 'user-new.php', 'upload.php' ), true ) ) {
		return true;
	}

	if ( 0 === strpos( (string) $hook_suffix, 'toplevel_page_atcf-options-' ) ) {
		return true;
	}

	return (bool) strpos( (string) $hook_suffix, '_page_atcf-options-' );
}

/**
 * The strings the field runtime needs.
 *
 * Passed as a blob rather than through `wp_set_script_translations()`, because
 * that requires a JED file per locale generated at build time and this plugin's
 * bundles are IIFEs with no `@wordpress/i18n` dependency. A blob is honest about
 * what it is: a small, complete, translatable set.
 *
 * @since 0.1.0
 *
 * @return array<string,string> Key => translated string.
 */
function atcf_runtime_strings() {
	return array(
		'add'             => __( 'Add', 'allterrain-fields' ),
		'addRow'          => __( 'Add row', 'allterrain-fields' ),
		'linkText'        => __( 'Link text', 'allterrain-fields' ),
		'remove'          => __( 'Remove', 'allterrain-fields' ),
		'edit'            => __( 'Edit', 'allterrain-fields' ),
		'clear'           => __( 'Clear', 'allterrain-fields' ),
		'search'          => __( 'Search', 'allterrain-fields' ),
		'searching'       => __( 'Searching…', 'allterrain-fields' ),
		'noResults'       => __( 'Nothing matched.', 'allterrain-fields' ),
		'selectImage'     => __( 'Choose an image', 'allterrain-fields' ),
		'selectFile'      => __( 'Choose a file', 'allterrain-fields' ),
		'selectImages'    => __( 'Choose images', 'allterrain-fields' ),
		'dropHere'        => __( 'Drop it here', 'allterrain-fields' ),
		'cannotDropHere'  => __( 'That cannot go here', 'allterrain-fields' ),
		'moveUp'          => __( 'Move up', 'allterrain-fields' ),
		'moveDown'        => __( 'Move down', 'allterrain-fields' ),
		'collapse'        => __( 'Collapse', 'allterrain-fields' ),
		'expand'          => __( 'Expand', 'allterrain-fields' ),
		'chooseLayout'    => __( 'Choose a block', 'allterrain-fields' ),
		'empty'           => __( 'Nothing here yet.', 'allterrain-fields' ),
		'openInWindow'    => __( 'Open in its own window', 'allterrain-fields' ),
		/* translators: %d: how many more rows a repeater will accept. */
		'rowsRemaining'   => __( '%d left', 'allterrain-fields' ),
		'invalidJson'     => __( 'That is not valid JSON.', 'allterrain-fields' ),
		'address'         => __( 'Address', 'allterrain-fields' ),
		'latitude'        => __( 'Latitude', 'allterrain-fields' ),
		'longitude'       => __( 'Longitude', 'allterrain-fields' ),
		'findOnMap'       => __( 'Find', 'allterrain-fields' ),
		'noIcon'          => __( 'No icon', 'allterrain-fields' ),
		'windowGroups'    => __( 'Field Groups', 'allterrain-fields' ),
		'windowModel'     => __( 'Content Model', 'allterrain-fields' ),
		'windowBulk'      => __( 'Bulk Editor', 'allterrain-fields' ),
		'windowTools'     => __( 'Field Tools', 'allterrain-fields' ),
		'bulkEmptyTitle'  => __( 'Nothing to edit in bulk yet', 'allterrain-fields' ),
		'bulkEmptyBody'   => __( 'The bulk editor works across every post a field group covers. Create a field group and its posts appear here as rows.', 'allterrain-fields' ),
		'bulkEmptyAction' => __( 'Open Field Groups', 'allterrain-fields' ),
	);
}
