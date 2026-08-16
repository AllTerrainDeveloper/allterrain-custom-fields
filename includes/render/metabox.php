<?php
/**
 * Fields on the post editor.
 *
 * A metabox, in both editors. That is a decision worth defending, because the
 * fashionable answer is a block-editor sidebar panel written in React.
 *
 * A metabox works in the classic editor, the block editor, the widget screen and
 * the site editor's template parts, and it is one implementation. A React panel
 * works in one of those and needs the metabox anyway for the other three — so
 * the choice is not "modern panel versus old metabox", it is "one thing that
 * works everywhere, or two things where the second one is the one that rots".
 *
 * The block editor renders metaboxes in a real iframe-free DOM below the canvas,
 * which is also where OpenStation's drag bridge can reach them. A React sidebar
 * panel lives inside the editor's own component tree, where a pointer event that
 * started on the wallpaper never arrives.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'add_meta_boxes', 'atcf_register_metaboxes', 10, 2 );

/**
 * Adds a metabox per matching field group.
 *
 * @since 0.1.0
 *
 * @param string  $post_type The post type being edited.
 * @param WP_Post $post      The post.
 * @return void
 */
function atcf_register_metaboxes( $post_type, $post ) {
	if ( ! $post instanceof WP_Post ) {
		return;
	}

	// The plugin's own post types never get field groups on them. A field group
	// whose location rule said "post type is any" would otherwise appear on the
	// screen that edits field groups, which is a hall of mirrors.
	if ( in_array( $post_type, array( ATCF_GROUP_TYPE, ATCF_OPTIONS_TYPE ), true ) ) {
		return;
	}

	$context = atcf_post_context( $post );
	$groups  = atcf_groups_for( $context );

	if ( ! $groups ) {
		return;
	}

	foreach ( $groups as $group ) {
		$settings = (array) $group['settings'];
		$position = 'after_title' === $settings['position'] ? 'normal' : $settings['position'];

		add_meta_box(
			'atcf-group-' . $group['key'],
			$group['title'],
			'atcf_render_metabox',
			$post_type,
			$position,
			'after_title' === $settings['position'] ? 'high' : 'default',
			array( 'group' => $group )
		);

		if ( 'seamless' === $settings['style'] ) {
			// A seamless group has no metabox chrome. Done with a body class
			// rather than by rendering outside the metabox, because a metabox is
			// the only container both editors agree on — the styling is the part
			// that should bend, not the structure.
			add_filter(
				'postbox_classes_' . $post_type . '_atcf-group-' . $group['key'],
				static function ( $classes ) {
					$classes[] = 'atcf-postbox--seamless';

					return $classes;
				}
			);
		}
	}

	atcf_apply_hide_on_screen( $groups, $post_type );
}

/**
 * Renders one group's metabox.
 *
 * @since 0.1.0
 *
 * @param WP_Post $post The post.
 * @param array   $box  The metabox arguments.
 * @return void
 */
function atcf_render_metabox( $post, $box ) {
	$group = (array) atcf_arr( (array) atcf_arr( $box, 'args', array() ), 'group', array() );

	if ( ! $group ) {
		return;
	}

	// Printed once per screen, not once per group. Two nonce fields with the
	// same name in one form is legal HTML and submits the first one, so it
	// happens to work — and it works by accident, which is not a thing to leave
	// in a save path.
	if ( ! atcf_form_marker_printed() ) {
		atcf_render_form_marker();
	}

	if ( '' !== (string) $group['settings']['description'] ) {
		printf( '<p class="atcf-group__description">%s</p>', esc_html( $group['settings']['description'] ) );
	}

	atcf_render_group_fields(
		$group,
		array(
			'type' => 'post',
			'id'   => (int) $post->ID,
		)
	);
}

/**
 * Whether the nonce and marker have already been printed this request.
 *
 * @since 0.1.0
 *
 * @return bool True the second time onwards.
 */
function atcf_form_marker_printed() {
	static $printed = false;

	if ( $printed ) {
		return true;
	}

	$printed = true;

	return false;
}

/**
 * Hides the core editor panels a group asks to hide.
 *
 * Done by removing the metabox rather than with CSS, because a panel hidden with
 * CSS is still in the DOM, still submits its values, and is still reachable by
 * keyboard — so "hide the excerpt" would leave the excerpt editable by anybody
 * who pressed Tab enough times.
 *
 * @since 0.1.0
 *
 * @param array[] $groups    The groups on this screen.
 * @param string  $post_type The post type.
 * @return void
 */
function atcf_apply_hide_on_screen( $groups, $post_type ) {
	$hide = array();

	foreach ( $groups as $group ) {
		$hide = array_merge( $hide, (array) $group['settings']['hide_on_screen'] );
	}

	$hide = array_unique( $hide );

	$boxes = array(
		'excerpt'         => array( 'postexcerpt', 'normal' ),
		'discussion'      => array( 'commentstatus', 'normal' ),
		'comments'        => array( 'commentsdiv', 'normal' ),
		'slug'            => array( 'slugdiv', 'normal' ),
		'author'          => array( 'authordiv', 'normal' ),
		'format'          => array( 'formatdiv', 'side' ),
		'featured_image'  => array( 'postimagediv', 'side' ),
		'categories'      => array( 'categorydiv', 'side' ),
		'tags'            => array( 'tagsdiv-post_tag', 'side' ),
		'page_attributes' => array( 'pageparentdiv', 'side' ),
		'revisions'       => array( 'revisionsdiv', 'normal' ),
		'custom_fields'   => array( 'postcustom', 'normal' ),
		'trackbacks'      => array( 'trackbacksdiv', 'normal' ),
	);

	foreach ( $hide as $what ) {
		if ( isset( $boxes[ $what ] ) ) {
			remove_meta_box( $boxes[ $what ][0], $post_type, $boxes[ $what ][1] );
		}
	}

	if ( in_array( 'the_content', $hide, true ) ) {
		remove_post_type_support( $post_type, 'editor' );
	}
}

add_action( 'save_post', 'atcf_save_post_fields', 10, 2 );

/**
 * Writes the fields when a post is saved.
 *
 * Every guard here has a specific failure behind it. An autosave carries no
 * metabox output, so saving from one wipes every field. A revision is a separate
 * post id, so writing to it puts the values somewhere nothing reads. And a
 * request with no nonce is either a bulk edit or somebody else's `wp_update_post`
 * call, neither of which submitted these fields.
 *
 * @since 0.1.0
 *
 * @param int     $post_id The post id.
 * @param WP_Post $post    The post.
 * @return void
 */
function atcf_save_post_fields( $post_id, $post ) {
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}

	if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
		return;
	}

	if ( ! atcf_has_submission() ) {
		return;
	}

	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}

	$errors = atcf_save_submission(
		array(
			'type' => 'post',
			'id'   => (int) $post_id,
		),
		atcf_submitted_payload(),
		atcf_post_context( $post )
	);

	if ( $errors ) {
		atcf_stash_errors( (int) $post_id, $errors );
	}
}

/**
 * Keeps validation errors for one redirect, then forgets them.
 *
 * A transient keyed by post and user, because a `save_post` handler cannot
 * refuse the save — by the time it runs the post is already written. What it can
 * do is tell the next page load what was wrong, which is what the editor's own
 * notices do for everything else that fails after the fact.
 *
 * @since 0.1.0
 *
 * @param int   $post_id The post.
 * @param array $errors  Field key => message.
 * @return void
 */
function atcf_stash_errors( $post_id, $errors ) {
	set_transient( 'atcf_errors_' . $post_id . '_' . get_current_user_id(), $errors, 60 );
}

add_action( 'admin_notices', 'atcf_print_stashed_errors' );

/**
 * Prints the errors stashed by the last save, once.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_print_stashed_errors() {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;

	if ( ! $screen || 'post' !== $screen->base ) {
		return;
	}

	$post_id = (int) get_the_ID();
	$key     = 'atcf_errors_' . $post_id . '_' . get_current_user_id();
	$errors  = get_transient( $key );

	if ( ! is_array( $errors ) || ! $errors ) {
		return;
	}

	delete_transient( $key );

	echo '<div class="notice notice-error atcf-notice"><p>';
	echo esc_html__( 'Some fields were not saved:', 'allterrain-fields' );
	echo '</p><ul>';

	foreach ( $errors as $field_key => $message ) {
		printf(
			'<li><a href="#" data-atcf-focus="%s">%s</a></li>',
			esc_attr( (string) $field_key ),
			esc_html( (string) $message )
		);
	}

	echo '</ul></div>';
}
