<?php
/**
 * Location rules — deciding where a field group appears.
 *
 * A group's location is an **OR of ANDs**: a list of rule groups, each a list of
 * rules, and the group shows when any one rule group matches entirely. That is
 * the structure the ecosystem settled on, and the right shape, because the sentence people
 * actually say is "on Products, and also on Pages using the landing template".
 *
 * The engine is deliberately dumb: it turns a screen into a small flat context
 * — what post, what type, what template, what taxonomy, which user — and each
 * rule is a lookup in it. Rules never run a query. A screen with twelve field
 * groups on it evaluates a couple of hundred rules before it paints, and a rule
 * that could hit the database would make that a page load.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Normalises a set of location rules.
 *
 * @since 0.1.0
 *
 * @param mixed $location Raw rules.
 * @return array[][] Groups of rules.
 */
function atcf_normalize_location_rules( $location ) {
	if ( ! is_array( $location ) ) {
		return array();
	}

	// A single flat list of rules is read as one AND group. It is what a
	// hand-written registration produces, and refusing it would make the simple
	// case the awkward one.
	if ( isset( $location['param'] ) ) {
		$location = array( array( $location ) );
	} elseif ( $location && isset( $location[0]['param'] ) ) {
		$location = array( $location );
	}

	$groups = array();

	foreach ( $location as $group ) {
		$rules = array();

		foreach ( (array) $group as $rule ) {
			$rule  = is_array( $rule ) ? $rule : array();
			$param = sanitize_key( (string) atcf_arr( $rule, 'param', '' ) );

			if ( '' === $param ) {
				continue;
			}

			$rules[] = array(
				'param'    => $param,
				'operator' => '!=' === (string) atcf_arr( $rule, 'operator', '==' ) ? '!=' : '==',
				'value'    => is_array( atcf_arr( $rule, 'value', '' ) )
					? array_map( 'sanitize_text_field', (array) $rule['value'] )
					: sanitize_text_field( (string) atcf_arr( $rule, 'value', '' ) ),
			);
		}

		if ( $rules ) {
			$groups[] = $rules;
		}
	}

	return $groups;
}

/**
 * The parameters a rule may test, grouped for the builder's dropdown.
 *
 * Each entry names how its choices are fetched, so the builder can populate the
 * second dropdown without a `switch` of its own — add a parameter here and its
 * control appears, which is the same no-privileged-path rule the field registry
 * follows.
 *
 * @since 0.1.0
 *
 * @return array[] Groups, each with a label and a list of parameters.
 */
function atcf_location_params() {
	$params = array(
		array(
			'label'  => __( 'Post', 'allterrain-fields' ),
			'params' => array(
				array(
					'param'   => 'post_type',
					'label'   => __( 'Post type', 'allterrain-fields' ),
					'choices' => 'post_types',
				),
				array(
					'param'   => 'post_template',
					'label'   => __( 'Post template', 'allterrain-fields' ),
					'choices' => 'templates',
				),
				array(
					'param'   => 'post_status',
					'label'   => __( 'Post status', 'allterrain-fields' ),
					'choices' => 'post_statuses',
				),
				array(
					'param'   => 'post_format',
					'label'   => __( 'Post format', 'allterrain-fields' ),
					'choices' => 'post_formats',
				),
				array(
					'param'   => 'post_taxonomy',
					'label'   => __( 'Post has term', 'allterrain-fields' ),
					'choices' => 'terms',
				),
				array(
					'param'   => 'post',
					'label'   => __( 'One specific post', 'allterrain-fields' ),
					'choices' => 'posts',
				),
			),
		),
		array(
			'label'  => __( 'Page', 'allterrain-fields' ),
			'params' => array(
				array(
					'param'   => 'page_type',
					'label'   => __( 'Page type', 'allterrain-fields' ),
					'choices' => 'page_types',
				),
				array(
					'param'   => 'page_parent',
					'label'   => __( 'Page parent', 'allterrain-fields' ),
					'choices' => 'posts',
				),
			),
		),
		array(
			'label'  => __( 'Taxonomy', 'allterrain-fields' ),
			'params' => array(
				array(
					'param'   => 'taxonomy',
					'label'   => __( 'Taxonomy', 'allterrain-fields' ),
					'choices' => 'taxonomies',
				),
				array(
					'param'   => 'term',
					'label'   => __( 'One specific term', 'allterrain-fields' ),
					'choices' => 'terms',
				),
			),
		),
		array(
			'label'  => __( 'People', 'allterrain-fields' ),
			'params' => array(
				array(
					'param'   => 'user_form',
					'label'   => __( 'User form', 'allterrain-fields' ),
					'choices' => 'user_forms',
				),
				array(
					'param'   => 'user_role',
					'label'   => __( 'User role', 'allterrain-fields' ),
					'choices' => 'roles',
				),
			),
		),
		array(
			'label'  => __( 'Elsewhere', 'allterrain-fields' ),
			'params' => array(
				array(
					'param'   => 'options_page',
					'label'   => __( 'Options page', 'allterrain-fields' ),
					'choices' => 'options_pages',
				),
				array(
					'param'   => 'attachment',
					'label'   => __( 'Attachment', 'allterrain-fields' ),
					'choices' => 'mime_types',
				),
				array(
					'param'   => 'comment',
					'label'   => __( 'Comment', 'allterrain-fields' ),
					'choices' => 'post_types',
				),
				array(
					'param'   => 'block',
					'label'   => __( 'Block', 'allterrain-fields' ),
					'choices' => 'blocks',
				),
			),
		),
	);

	/**
	 * Filters the location parameters the builder offers.
	 *
	 * A parameter added here must also be taught to {@see atcf_location_test()},
	 * through the `atcf_location_test` filter — a parameter with no test never
	 * matches, which reads as a rule that quietly does nothing.
	 *
	 * @since 0.1.0
	 *
	 * @param array[] $params Grouped parameters.
	 */
	return (array) apply_filters( 'atcf_location_params', $params );
}

/**
 * Whether a set of rules matches a context.
 *
 * A group with no rules at all matches everything. That is the honest reading of
 * "the author has not said where this goes yet" — a group being built is a group
 * you want to see while you build it — and it is what makes a brand new group
 * appear on the preview screen immediately rather than nowhere.
 *
 * @since 0.1.0
 *
 * @param array[][] $location Normalised rule groups.
 * @param array     $context  Screen context from {@see atcf_screen_context()}.
 * @return bool True when the group belongs on this screen.
 */
function atcf_location_matches( $location, $context ) {
	$location = (array) $location;

	if ( ! $location ) {
		return true;
	}

	foreach ( $location as $group ) {
		$all = true;

		foreach ( (array) $group as $rule ) {
			$result = atcf_location_test( $rule, $context );

			if ( '!=' === (string) atcf_arr( $rule, 'operator', '==' ) ) {
				$result = ! $result;
			}

			if ( ! $result ) {
				$all = false;
				break;
			}
		}

		if ( $all ) {
			return true;
		}
	}

	return false;
}

/**
 * Tests one rule against a context, ignoring its operator.
 *
 * The operator is applied by the caller so that a `!=` rule is the exact
 * negation of its `==` twin — a test that handled both would eventually make
 * them disagree about the "not applicable" case, where `!=` should be true and
 * usually got written as false.
 *
 * @since 0.1.0
 *
 * @param array $rule    One rule.
 * @param array $context Screen context.
 * @return bool True when the rule's positive form holds.
 */
function atcf_location_test( $rule, $context ) {
	$param = (string) atcf_arr( $rule, 'param', '' );
	$value = atcf_arr( $rule, 'value', '' );
	$match = null;

	switch ( $param ) {
		case 'post_type':
			$match = atcf_location_equals( atcf_arr( $context, 'post_type', '' ), $value );
			break;

		case 'post_status':
			$match = atcf_location_equals( atcf_arr( $context, 'post_status', '' ), $value );
			break;

		case 'post_template':
			// An empty stored value means "the default template", which the
			// screen reports as `default` — matching them as equal is what makes
			// the rule people expect ("Pages using no special template") work.
			$template = (string) atcf_arr( $context, 'page_template', '' );
			$template = '' === $template ? 'default' : $template;
			$wanted   = '' === (string) $value ? 'default' : (string) $value;
			$match    = atcf_location_equals( $template, $wanted );
			break;

		case 'post_format':
			$match = atcf_location_equals( atcf_arr( $context, 'post_format', '' ), $value );
			break;

		case 'post':
			$match = atcf_location_equals( (string) (int) atcf_arr( $context, 'post_id', 0 ), $value );
			break;

		case 'page_parent':
			$match = atcf_location_equals( (string) (int) atcf_arr( $context, 'post_parent', 0 ), $value );
			break;

		case 'post_taxonomy':
			$match = in_array( (string) $value, array_map( 'strval', (array) atcf_arr( $context, 'terms', array() ) ), true );
			break;

		case 'page_type':
			$match = atcf_location_page_type( (string) $value, $context );
			break;

		case 'taxonomy':
			$match = atcf_location_equals( atcf_arr( $context, 'taxonomy', '' ), $value );
			break;

		case 'term':
			$match = atcf_location_equals( (string) (int) atcf_arr( $context, 'term_id', 0 ), $value );
			break;

		case 'user_form':
			$form  = (string) atcf_arr( $context, 'user_form', '' );
			$match = 'all' === (string) $value ? '' !== $form : atcf_location_equals( $form, $value );
			break;

		case 'user_role':
			$match = in_array( (string) $value, array_map( 'strval', (array) atcf_arr( $context, 'user_roles', array() ) ), true );
			break;

		case 'options_page':
			$match = atcf_location_equals( atcf_arr( $context, 'options_page', '' ), $value );
			break;

		case 'attachment':
			$mime  = (string) atcf_arr( $context, 'mime_type', '' );
			$match = 'all' === (string) $value
				? 'attachment' === (string) atcf_arr( $context, 'post_type', '' )
				: ( '' !== $mime && 0 === strpos( $mime, (string) $value ) );
			break;

		case 'comment':
			$match = 'comment' === (string) atcf_arr( $context, 'screen', '' )
				&& ( 'all' === (string) $value || atcf_location_equals( atcf_arr( $context, 'post_type', '' ), $value ) );
			break;

		case 'block':
			$match = atcf_location_equals( atcf_arr( $context, 'block', '' ), $value );
			break;
	}

	/**
	 * Filters the result of one location rule.
	 *
	 * `null` means no built-in test handled this parameter, which is the seam a
	 * plugin adding a parameter fills. Returning null from a filter leaves the
	 * rule unmatched, so an unknown parameter never accidentally shows a group
	 * everywhere.
	 *
	 * @since 0.1.0
	 *
	 * @param bool|null $match   Whether the rule holds, or null when untested.
	 * @param array     $rule    The rule.
	 * @param array     $context Screen context.
	 */
	$match = apply_filters( 'atcf_location_test', $match, $rule, $context );

	return (bool) $match;
}

/**
 * Compares a context value against a rule value.
 *
 * `all` matches anything that is set, which is what "Post type is all" means on
 * every screen it can be asked about.
 *
 * @since 0.1.0
 *
 * @param mixed $actual   What the screen has.
 * @param mixed $expected What the rule wants.
 * @return bool True when they agree.
 */
function atcf_location_equals( $actual, $expected ) {
	$actual   = is_scalar( $actual ) ? (string) $actual : '';
	$expected = is_scalar( $expected ) ? (string) $expected : '';

	if ( 'all' === $expected ) {
		return '' !== $actual && '0' !== $actual;
	}

	return $actual === $expected;
}

/**
 * Tests the `page_type` parameter.
 *
 * @since 0.1.0
 *
 * @param string $value   Which page type.
 * @param array  $context Screen context.
 * @return bool True when it holds.
 */
function atcf_location_page_type( $value, $context ) {
	$id     = (int) atcf_arr( $context, 'post_id', 0 );
	$parent = (int) atcf_arr( $context, 'post_parent', 0 );

	switch ( $value ) {
		case 'front_page':
			return $id > 0 && (int) get_option( 'page_on_front' ) === $id;

		case 'posts_page':
			return $id > 0 && (int) get_option( 'page_for_posts' ) === $id;

		case 'top_level':
			return 0 === $parent;

		case 'parent':
			// A page is a parent when something already has it as one. The
			// answer is a query, and it is the only one in this file — but it is
			// asked at most once per screen, and only when a group actually uses
			// this rule.
			return $id > 0 && (bool) get_posts(
				array(
					'post_type'        => (string) atcf_arr( $context, 'post_type', 'page' ),
					'post_parent'      => $id,
					'post_status'      => 'any',
					'numberposts'      => 1,
					'fields'           => 'ids',
					'suppress_filters' => false,
				)
			);

		case 'child':
			return $parent > 0;
	}

	return false;
}

/**
 * Builds the context for a post being edited.
 *
 * @since 0.1.0
 *
 * @param int|WP_Post $post The post.
 * @return array Screen context.
 */
function atcf_post_context( $post ) {
	$post = get_post( $post );

	if ( ! $post ) {
		return array( 'screen' => 'post' );
	}

	$terms = array();

	foreach ( get_object_taxonomies( $post->post_type ) as $taxonomy ) {
		$assigned = get_the_terms( $post, $taxonomy );

		if ( is_wp_error( $assigned ) || ! $assigned ) {
			continue;
		}

		foreach ( $assigned as $term ) {
			// Stored as `taxonomy:slug` because a term id is meaningless across
			// sites and a bare slug collides between taxonomies — `news` is
			// plausibly both a category and a tag.
			$terms[] = $term->taxonomy . ':' . $term->slug;
			$terms[] = (string) $term->term_id;
		}
	}

	$format = get_post_format( $post );

	return array(
		'screen'        => 'post',
		'post_id'       => (int) $post->ID,
		'post_type'     => $post->post_type,
		'post_status'   => $post->post_status,
		'post_parent'   => (int) $post->post_parent,
		'post_format'   => $format ? $format : 'standard',
		'page_template' => (string) get_page_template_slug( $post ),
		'mime_type'     => (string) $post->post_mime_type,
		'terms'         => array_values( array_unique( $terms ) ),
	);
}

/**
 * Builds the context for a term being edited.
 *
 * @since 0.1.0
 *
 * @param int|WP_Term $term The term.
 * @return array Screen context.
 */
function atcf_term_context( $term ) {
	$term = get_term( $term );

	if ( ! $term instanceof WP_Term ) {
		return array( 'screen' => 'term' );
	}

	return array(
		'screen'   => 'term',
		'taxonomy' => $term->taxonomy,
		'term_id'  => (int) $term->term_id,
	);
}

/**
 * Builds the context for a user being edited.
 *
 * @since 0.1.0
 *
 * @param int    $user_id The user.
 * @param string $form    Which screen: `add`, `edit` or `profile`.
 * @return array Screen context.
 */
function atcf_user_context( $user_id, $form = 'edit' ) {
	$user = $user_id ? get_userdata( (int) $user_id ) : null;

	return array(
		'screen'     => 'user',
		'user_form'  => in_array( $form, array( 'add', 'edit', 'profile' ), true ) ? $form : 'edit',
		'user_id'    => (int) $user_id,
		'user_roles' => $user ? array_values( (array) $user->roles ) : array(),
	);
}

/**
 * Builds the context for an options page.
 *
 * @since 0.1.0
 *
 * @param string $slug Options page slug.
 * @return array Screen context.
 */
function atcf_options_context( $slug ) {
	return array(
		'screen'       => 'options',
		'options_page' => sanitize_key( (string) $slug ),
	);
}

/**
 * Every group that belongs on a given context, in display order.
 *
 * @since 0.1.0
 *
 * @param array $context Screen context.
 * @return array[] Canonical groups.
 */
function atcf_groups_for( $context ) {
	$groups = array();

	foreach ( atcf_get_groups() as $group ) {
		if ( atcf_location_matches( $group['location'], $context ) ) {
			$groups[] = $group;
		}
	}

	/**
	 * Filters the field groups that apply to a context.
	 *
	 * The last chance to add or remove a group before it renders — which is
	 * where a "hide this group from anyone but an editor" rule belongs, since
	 * location rules describe *where* a group goes and not *who* may see it.
	 *
	 * @since 0.1.0
	 *
	 * @param array[] $groups  Matching groups.
	 * @param array   $context Screen context.
	 */
	return (array) apply_filters( 'atcf_groups_for_context', $groups, $context );
}

/**
 * The choice lists every location parameter's second dropdown needs.
 *
 * Built in one pass and shipped in one payload. The builder's rule editor
 * changes its second dropdown the instant the first one changes, and a control
 * that has to fetch before it can repaint is a control that flickers on every
 * keystroke.
 *
 * @since 0.1.0
 *
 * @return array<string,array> Choices source => `value => label` map.
 */
function atcf_location_choices() {
	$choices = array(
		'post_types'    => atcf_post_type_choices(),
		'taxonomies'    => atcf_taxonomy_choices(),
		'roles'         => atcf_role_choices(),
		'post_statuses' => atcf_post_status_choices(),
		'post_formats'  => atcf_post_format_choices(),
		'page_types'    => array(
			'front_page' => __( 'The front page', 'allterrain-fields' ),
			'posts_page' => __( 'The posts page', 'allterrain-fields' ),
			'top_level'  => __( 'A top-level page', 'allterrain-fields' ),
			'parent'     => __( 'A page with children', 'allterrain-fields' ),
			'child'      => __( 'A page with a parent', 'allterrain-fields' ),
		),
		'user_forms'    => array(
			'all'     => __( 'Any user screen', 'allterrain-fields' ),
			'add'     => __( 'Adding a user', 'allterrain-fields' ),
			'edit'    => __( 'Editing somebody else', 'allterrain-fields' ),
			'profile' => __( 'Your own profile', 'allterrain-fields' ),
		),
		'mime_types'    => array(
			'all'         => __( 'Any attachment', 'allterrain-fields' ),
			'image'       => __( 'Images', 'allterrain-fields' ),
			'video'       => __( 'Video', 'allterrain-fields' ),
			'audio'       => __( 'Audio', 'allterrain-fields' ),
			'application' => __( 'Documents', 'allterrain-fields' ),
		),
		'templates'     => atcf_template_choices(),
		'options_pages' => wp_list_pluck( atcf_get_options_pages(), 'page_title', 'slug' ),
		'blocks'        => atcf_block_choices(),
	);

	// `posts` and `terms` are deliberately absent: a site with fifty thousand
	// posts cannot ship them as a dropdown, so those two parameters use the
	// search route instead. Listing them here with a truncated set would look
	// like a complete list that is silently missing most of it.
	/**
	 * Filters the location rule choice lists.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string,array> $choices Source => `value => label`.
	 */
	return (array) apply_filters( 'atcf_location_choices', $choices );
}

/**
 * Every post type a field group can be pointed at.
 *
 * @since 0.1.0
 *
 * @return array<string,string> Slug => label.
 */
function atcf_post_type_choices() {
	$choices = array( 'all' => __( 'Any post type', 'allterrain-fields' ) );

	foreach ( get_post_types( array( 'show_ui' => true ), 'objects' ) as $type ) {
		if ( in_array( $type->name, array( ATCF_GROUP_TYPE, ATCF_OPTIONS_TYPE ), true ) ) {
			continue;
		}

		$choices[ $type->name ] = $type->labels->singular_name;
	}

	return $choices;
}

/**
 * Every taxonomy a field can point at.
 *
 * @since 0.1.0
 *
 * @return array<string,string> Slug => label.
 */
function atcf_taxonomy_choices() {
	$choices = array();

	foreach ( get_taxonomies( array( 'show_ui' => true ), 'objects' ) as $taxonomy ) {
		$choices[ $taxonomy->name ] = $taxonomy->labels->singular_name;
	}

	return $choices;
}

/**
 * Every role.
 *
 * @since 0.1.0
 *
 * @return array<string,string> Slug => label.
 */
function atcf_role_choices() {
	$roles   = wp_roles();
	$choices = array();

	foreach ( (array) $roles->roles as $slug => $role ) {
		$choices[ $slug ] = translate_user_role( (string) atcf_arr( (array) $role, 'name', $slug ) );
	}

	return $choices;
}

/**
 * Every post status a rule can name.
 *
 * @since 0.1.0
 *
 * @return array<string,string> Slug => label.
 */
function atcf_post_status_choices() {
	$choices = array();

	foreach ( get_post_stati( array(), 'objects' ) as $status ) {
		$choices[ $status->name ] = $status->label;
	}

	return $choices;
}

/**
 * Every post format.
 *
 * @since 0.1.0
 *
 * @return array<string,string> Slug => label.
 */
function atcf_post_format_choices() {
	$choices = array( 'standard' => __( 'Standard', 'allterrain-fields' ) );

	foreach ( get_post_format_strings() as $slug => $label ) {
		$choices[ $slug ] = $label;
	}

	return $choices;
}

/**
 * Every page template the active theme offers, across post types.
 *
 * Merged into one flat list. A template file is usually declared for one post
 * type and used on another, and a rule editor that only offered the ones
 * declared for the type in the *previous* rule would be guessing about an order
 * the author has not committed to yet.
 *
 * @since 0.1.0
 *
 * @return array<string,string> File => label.
 */
function atcf_template_choices() {
	$choices = array( 'default' => __( 'The default template', 'allterrain-fields' ) );

	foreach ( get_post_types( array( 'show_ui' => true ), 'names' ) as $type ) {
		foreach ( (array) wp_get_theme()->get_page_templates( null, $type ) as $file => $name ) {
			$choices[ $file ] = $name;
		}
	}

	return $choices;
}

/**
 * Every block a field group can be attached to.
 *
 * Only the blocks this plugin itself registered from a field group. A rule
 * pointing at somebody else's block would render fields into a block that has no
 * idea how to save them.
 *
 * @since 0.1.0
 *
 * @return array<string,string> Block name => title.
 */
function atcf_block_choices() {
	$choices = array();

	foreach ( atcf_get_groups( true ) as $group ) {
		$block = (array) $group['settings']['block'];

		if ( $block['enabled'] && '' !== $block['name'] ) {
			$choices[ 'atcf/' . $block['name'] ] = '' !== $block['title'] ? $block['title'] : $group['title'];
		}
	}

	return $choices;
}

/**
 * The image sizes a preview control can offer.
 *
 * @since 0.1.0
 *
 * @return array<string,string> Size => label.
 */
function atcf_image_size_choices() {
	$choices = array();

	foreach ( get_intermediate_image_sizes() as $size ) {
		$choices[ $size ] = $size;
	}

	$choices['full'] = __( 'Full size', 'allterrain-fields' );

	return $choices;
}
