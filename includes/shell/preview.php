<?php
/**
 * The eye in the title bar.
 *
 * OpenStation has a convention for previewing: a window with something to show
 * carries an eye on the right of its title bar, and pressing it opens the thing
 * **as its own window, paired with the editor** rather than replacing it. The
 * shell does this for post and page edit screens.
 *
 * A field group is exactly the same shape of thing, so it wears the same
 * affordance — but what a field group has to show is not a front-end page. It is
 * *the edit screen it is about to create*. So the eye opens a window rendering
 * the group's fields through the real renderer, against a real post, with the
 * real controls, beside the builder.
 *
 * Pairing beats a modal for a reason that only shows up once you use it: the
 * builder stays open and usable. You can widen a field, watch the preview
 * reflow, drag another in, and watch again — where a modal makes you close it,
 * change one thing, and open it again.
 *
 * The preview renders through `atcf_render_group_fields()` — the same function
 * the post editor calls. A preview built from a second, simplified renderer is a
 * preview that is wrong exactly where it matters.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'atcf_register_preview_window', 26 );

/**
 * Registers the preview window.
 *
 * Registered separately from the other four so that a shell which refuses it —
 * an older build with different validation — still gives the user a builder. The
 * eye button checks for the window before offering itself.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_preview_window() {
	if ( ! atcf_shell_has( 'register_window' ) || ! atcf_can_manage() ) {
		return;
	}

	atcf_shell_call(
		'register_window',
		ATCF_WINDOW_PREVIEW,
		array(
			'title'        => __( 'Field Preview', 'allterrain-fields' ),
			'icon'         => 'dashicons-visibility',
			'template'     => 'atcf_preview_template',
			// The builder bundle, not one of its own. The preview is drawn by
			// the same code that draws the builder's own inline preview pane,
			// and a second bundle would either duplicate all of it or need a
			// third shared chunk for a window most people open beside the one
			// that already has it loaded.
			'script'       => 'allterrain-fields-builder',
			'style'        => 'allterrain-fields-builder',
			'width'        => 620,
			'height'       => 820,
			'min_width'    => 360,
			'min_height'   => 320,
			'placement'    => 'none',
			'capabilities' => array( ATCF_MANAGE_CAP ),
			'config'       => atcf_window_config( ATCF_WINDOW_PREVIEW ),
		)
	);
}

/**
 * The preview window's body markup.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_preview_template() {
	?>
	<div class="atcfp" data-atcfp-root>
		<div class="atcfp__bar" data-atcfp-bar>
			<span class="atcfp__title" data-atcfp-title><?php esc_html_e( 'Preview', 'allterrain-fields' ); ?></span>
			<span class="atcfp__sample" data-atcfp-sample></span>
		</div>
		<div class="atcfp__body" data-atcfp-body>
			<p class="atcfp__empty"><?php esc_html_e( 'Open a field group in the builder and this shows what its edit screen will look like.', 'allterrain-fields' ); ?></p>
		</div>
	</div>
	<?php
}

/**
 * A post worth previewing a group against.
 *
 * A real post rather than a blank one, because a preview of an Image field with
 * no image in it shows an empty box — which is the one state the author already
 * knows what looks like. The most recently modified post of a type the group
 * actually applies to is the closest thing to "what this will look like in use".
 *
 * @since 0.1.0
 *
 * @param array $group Canonical group.
 * @return int A post id, or 0 when there is nothing suitable.
 */
function atcf_preview_sample_post( $group ) {
	$types = atcf_group_post_types( $group );
	$types = ( $types && '*' !== $types[0] ) ? $types : array( 'post', 'page' );

	$found = get_posts(
		array(
			'post_type'        => $types,
			'post_status'      => array( 'publish', 'draft', 'private' ),
			'numberposts'      => 1,
			'orderby'          => 'modified',
			'fields'           => 'ids',
			'suppress_filters' => false,
		)
	);

	return $found ? (int) $found[0] : 0;
}

add_filter( 'atcf_runtime_config', 'atcf_add_preview_config' );

/**
 * Tells the bundles whether the preview window is available.
 *
 * Read by `preview-button.ts` before it registers the eye. Offering a button
 * that opens a window the shell refused is worse than no button.
 *
 * @since 0.1.0
 *
 * @param array $config The runtime config.
 * @return array The config.
 */
function atcf_add_preview_config( $config ) {
	$config['previewWindow'] = ATCF_WINDOW_PREVIEW;

	return $config;
}
