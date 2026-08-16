<?php
/**
 * The relational types.
 *
 * These are the reason this plugin is a desktop app.
 *
 * A relationship field has always been a picker: a modal with a search box, a
 * left column of candidates and a right column of chosen ones. It works, and it
 * hides the only interesting thing about the data — that the site is a *graph*,
 * and this field is an edge in it. You cannot see the graph through a picker,
 * you can only visit it one node at a time.
 *
 * Under OpenStation the edge is real. Every relationship value is announced to
 * the shell's relations framework, so the post you are editing and the posts it
 * points at are tied on the desktop, listed in the title bar's Related menu, and
 * one click from each other. Set `bidirectional` and the other end gets the tie
 * too, written into its own field, so the graph is navigable from either side
 * and stays consistent when either side changes.
 *
 * And because they declare what they accept, a post dragged out of WP Explorer,
 * off the wallpaper, or off an AllTerrain Work card lands in one.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'atcf_register_relational_types', 6 );

/**
 * Registers the relational field types.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_relational_types() {
	atcf_register_field_type(
		'post_object',
		array(
			'label'       => __( 'Post', 'allterrain-fields' ),
			'description' => __( 'A link to one other post. Drag one in from anywhere.', 'allterrain-fields' ),
			'group'       => 'relational',
			'icon'        => 'dashicons-admin-post',
			'value'       => 'number',
			'settings'    => array(
				'post_types'    => array(),
				'taxonomy'      => '',
				'allow_null'    => true,
				'multiple'      => false,
				'return_format' => 'object',
				'bidirectional' => false,
				'mirror'        => '',
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper', 'multiple' ),
			'accepts'     => array( 'post' ),
			'sanitize'    => 'atcf_sanitize_post_ref',
			'format'      => 'atcf_format_post_ref',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'relationship',
		array(
			'label'       => __( 'Relationship', 'allterrain-fields' ),
			'description' => __( 'Several other posts, in an order you choose. Can mirror itself onto the other side.', 'allterrain-fields' ),
			'group'       => 'relational',
			'icon'        => 'dashicons-networking',
			'value'       => 'ids',
			'settings'    => array(
				'post_types'    => array(),
				'taxonomy'      => '',
				'min_items'     => 0,
				'max_items'     => 0,
				'return_format' => 'object',
				'bidirectional' => false,
				'mirror'        => '',
				'filters'       => array( 'search', 'post_type' ),
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper' ),
			'accepts'     => array( 'post' ),
			'sanitize'    => 'atcf_sanitize_post_refs',
			'format'      => 'atcf_format_post_refs',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'page_link',
		array(
			'label'       => __( 'Page link', 'allterrain-fields' ),
			'description' => __( 'A post picked by name, returned as its URL.', 'allterrain-fields' ),
			'group'       => 'relational',
			'icon'        => 'dashicons-admin-links',
			'value'       => 'number',
			'settings'    => array(
				'post_types'     => array(),
				'allow_null'     => true,
				'multiple'       => false,
				'allow_archives' => true,
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper', 'multiple' ),
			'accepts'     => array( 'post' ),
			'sanitize'    => 'atcf_sanitize_post_ref',
			'format'      => 'atcf_format_page_link',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'taxonomy',
		array(
			'label'       => __( 'Taxonomy', 'allterrain-fields' ),
			'description' => __( 'Terms from one taxonomy, optionally assigned to the post as well.', 'allterrain-fields' ),
			'group'       => 'relational',
			'icon'        => 'dashicons-tag',
			'value'       => 'ids',
			'settings'    => array(
				'taxonomy'      => 'category',
				'multiple'      => true,
				'allow_null'    => true,
				'return_format' => 'object',
				'save_terms'    => false,
				'load_terms'    => false,
				'add_term'      => true,
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper', 'multiple' ),
			'accepts'     => array( 'term' ),
			'sanitize'    => 'atcf_sanitize_term_refs',
			'format'      => 'atcf_format_term_refs',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'user',
		array(
			'label'       => __( 'User', 'allterrain-fields' ),
			'description' => __( 'One or more people. Drag an avatar in.', 'allterrain-fields' ),
			'group'       => 'relational',
			'icon'        => 'dashicons-admin-users',
			'value'       => 'ids',
			'settings'    => array(
				'roles'         => array(),
				'multiple'      => false,
				'allow_null'    => true,
				'return_format' => 'array',
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper', 'multiple' ),
			'accepts'     => array( 'user' ),
			'sanitize'    => 'atcf_sanitize_user_refs',
			'format'      => 'atcf_format_user_refs',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'link',
		array(
			'label'       => __( 'Link', 'allterrain-fields' ),
			'description' => __( 'A URL with its own text and target — internal or external.', 'allterrain-fields' ),
			'group'       => 'relational',
			'icon'        => 'dashicons-admin-links',
			'value'       => 'object',
			'settings'    => array(
				'return_format' => 'array',
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper' ),
			'accepts'     => array( 'post', 'media', 'text' ),
			'sanitize'    => 'atcf_sanitize_link',
			'format'      => 'atcf_format_link',
			'mount'       => true,
		)
	);
}

/**
 * Whether a post id is one this field is allowed to point at.
 *
 * The `post_types` setting is a promise the builder made and the front end
 * relies on: a template written against "this is always a Product" should not
 * have to defend itself against a Page arriving through a REST write or a drag
 * from somewhere unexpected.
 *
 * An empty setting means every type, which is the honest reading of "the author
 * did not narrow it".
 *
 * @since 0.1.0
 *
 * @param int   $id    Post id.
 * @param array $field The field definition.
 * @return bool True when the post exists and is of an allowed type.
 */
function atcf_post_ref_allowed( $id, $field ) {
	$post = get_post( (int) $id );

	if ( ! $post ) {
		return false;
	}

	$types = (array) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'post_types', array() );
	$types = array_values( array_filter( array_map( 'strval', $types ) ) );

	if ( ! $types ) {
		return true;
	}

	return in_array( $post->post_type, $types, true );
}

/**
 * Sanitises a single post reference.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @param array $field The field definition.
 * @return int|int[] The id, or a list when the field allows several.
 */
function atcf_sanitize_post_ref( $value, $field = array() ) {
	$multiple = (bool) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'multiple', false );
	$ids      = array();

	foreach ( atcf_to_id_list( $value ) as $id ) {
		if ( atcf_post_ref_allowed( $id, $field ) ) {
			$ids[] = $id;
		}
	}

	if ( $multiple ) {
		return $ids;
	}

	return $ids ? $ids[0] : 0;
}

/**
 * Sanitises a list of post references, order preserved.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @param array $field The field definition.
 * @return int[] Post ids.
 */
function atcf_sanitize_post_refs( $value, $field = array() ) {
	$ids   = array();
	$max   = (int) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'max_items', 0 );
	$given = atcf_to_id_list( $value );

	foreach ( $given as $id ) {
		if ( atcf_post_ref_allowed( $id, $field ) ) {
			$ids[] = $id;
		}
	}

	if ( $max > 0 && count( $ids ) > $max ) {
		$ids = array_slice( $ids, 0, $max );
	}

	return $ids;
}

/**
 * Formats one post reference.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @param array $field The field definition.
 * @return WP_Post|WP_Post[]|int|int[]|null Depending on the settings.
 */
function atcf_format_post_ref( $value, $field = array() ) {
	$settings = (array) atcf_arr( $field, 'settings', array() );
	$format   = (string) atcf_arr( $settings, 'return_format', 'object' );
	$multiple = (bool) atcf_arr( $settings, 'multiple', false );
	$ids      = atcf_to_id_list( $value );

	if ( 'id' === $format ) {
		return $multiple ? $ids : ( $ids ? $ids[0] : 0 );
	}

	$posts = array_values( array_filter( array_map( 'get_post', $ids ) ) );

	return $multiple ? $posts : ( $posts ? $posts[0] : null );
}

/**
 * Formats a list of post references.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @param array $field The field definition.
 * @return WP_Post[]|int[] Depending on `return_format`.
 */
function atcf_format_post_refs( $value, $field = array() ) {
	$ids    = atcf_to_id_list( $value );
	$format = (string) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'return_format', 'object' );

	if ( 'id' === $format ) {
		return $ids;
	}

	return array_values( array_filter( array_map( 'get_post', $ids ) ) );
}

/**
 * Formats a page link as a URL.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @param array $field The field definition.
 * @return string|string[] Permalink, or a list of them.
 */
function atcf_format_page_link( $value, $field = array() ) {
	$multiple = (bool) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'multiple', false );
	$links    = array();

	foreach ( atcf_to_id_list( $value ) as $id ) {
		$url = get_permalink( $id );

		if ( $url ) {
			$links[] = $url;
		}
	}

	return $multiple ? $links : ( $links ? $links[0] : '' );
}

/**
 * Sanitises term references against the field's taxonomy.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @param array $field The field definition.
 * @return int|int[] Term ids.
 */
function atcf_sanitize_term_refs( $value, $field = array() ) {
	$settings = (array) atcf_arr( $field, 'settings', array() );
	$taxonomy = (string) atcf_arr( $settings, 'taxonomy', '' );
	$multiple = (bool) atcf_arr( $settings, 'multiple', true );
	$ids      = array();

	foreach ( atcf_to_id_list( $value ) as $id ) {
		$term = get_term( $id );

		if ( ! $term instanceof WP_Term ) {
			continue;
		}

		if ( '' !== $taxonomy && $term->taxonomy !== $taxonomy ) {
			continue;
		}

		$ids[] = $term->term_id;
	}

	if ( $multiple ) {
		return $ids;
	}

	return $ids ? $ids[0] : 0;
}

/**
 * Formats term references.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @param array $field The field definition.
 * @return WP_Term|WP_Term[]|int|int[] Depending on the settings.
 */
function atcf_format_term_refs( $value, $field = array() ) {
	$settings = (array) atcf_arr( $field, 'settings', array() );
	$format   = (string) atcf_arr( $settings, 'return_format', 'object' );
	$multiple = (bool) atcf_arr( $settings, 'multiple', true );
	$ids      = atcf_to_id_list( $value );

	if ( 'id' === $format ) {
		return $multiple ? $ids : ( $ids ? $ids[0] : 0 );
	}

	$terms = array();

	foreach ( $ids as $id ) {
		$term = get_term( $id );

		if ( $term instanceof WP_Term ) {
			$terms[] = $term;
		}
	}

	return $multiple ? $terms : ( $terms ? $terms[0] : null );
}

/**
 * Sanitises user references, checking the role allowlist.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @param array $field The field definition.
 * @return int|int[] User ids.
 */
function atcf_sanitize_user_refs( $value, $field = array() ) {
	$settings = (array) atcf_arr( $field, 'settings', array() );
	$multiple = (bool) atcf_arr( $settings, 'multiple', false );
	$roles    = array_values( array_filter( array_map( 'strval', (array) atcf_arr( $settings, 'roles', array() ) ) ) );
	$ids      = array();

	foreach ( atcf_to_id_list( $value ) as $id ) {
		$user = get_userdata( $id );

		if ( ! $user ) {
			continue;
		}

		if ( $roles && ! array_intersect( $roles, (array) $user->roles ) ) {
			continue;
		}

		$ids[] = (int) $user->ID;
	}

	if ( $multiple ) {
		return $ids;
	}

	return $ids ? $ids[0] : 0;
}

/**
 * Formats user references.
 *
 * The array form is deliberately not a `WP_User`: a template echoing a
 * `WP_User` gets an object-to-string error, and the fields people actually want
 * — name, avatar, URL — are spread across `WP_User`, `get_avatar_url()` and
 * `get_author_posts_url()`.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @param array $field The field definition.
 * @return array|array[]|int|int[] Depending on the settings.
 */
function atcf_format_user_refs( $value, $field = array() ) {
	$settings = (array) atcf_arr( $field, 'settings', array() );
	$format   = (string) atcf_arr( $settings, 'return_format', 'array' );
	$multiple = (bool) atcf_arr( $settings, 'multiple', false );
	$ids      = atcf_to_id_list( $value );

	if ( 'id' === $format ) {
		return $multiple ? $ids : ( $ids ? $ids[0] : 0 );
	}

	$users = array();

	foreach ( $ids as $id ) {
		$user = get_userdata( $id );

		if ( ! $user ) {
			continue;
		}

		$users[] = array(
			'ID'           => (int) $user->ID,
			'id'           => (int) $user->ID,
			'user_login'   => $user->user_login,
			'display_name' => $user->display_name,
			'user_email'   => $user->user_email,
			'first_name'   => (string) $user->first_name,
			'last_name'    => (string) $user->last_name,
			'nickname'     => (string) $user->nickname,
			'description'  => (string) $user->description,
			'avatar'       => get_avatar_url( $user->ID ),
			'url'          => get_author_posts_url( $user->ID ),
			'roles'        => array_values( (array) $user->roles ),
		);
	}

	return $multiple ? $users : ( $users ? $users[0] : null );
}

/**
 * Sanitises a link.
 *
 * Three keys and nothing else. `target` is constrained to the two values a link
 * may legally have, because a stored `target` is echoed straight into an
 * attribute and the set of useful ones is exactly two.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return array|string The link, or an empty string when there is no URL.
 */
function atcf_sanitize_link( $value ) {
	if ( is_string( $value ) ) {
		$value = array( 'url' => $value );
	}

	if ( ! is_array( $value ) ) {
		return '';
	}

	$url = esc_url_raw( (string) atcf_arr( $value, 'url', '' ) );

	if ( '' === $url ) {
		return '';
	}

	return array(
		'url'    => $url,
		'title'  => sanitize_text_field( (string) atcf_arr( $value, 'title', '' ) ),
		'target' => '_blank' === (string) atcf_arr( $value, 'target', '' ) ? '_blank' : '',
	);
}

/**
 * Formats a link.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored value.
 * @param array $field The field definition.
 * @return array|string The array, or just the URL.
 */
function atcf_format_link( $value, $field = array() ) {
	$format = (string) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'return_format', 'array' );

	if ( ! is_array( $value ) ) {
		return 'url' === $format ? '' : array();
	}

	if ( 'url' === $format ) {
		return (string) atcf_arr( $value, 'url', '' );
	}

	return $value;
}
