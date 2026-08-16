<?php
/**
 * The REST API.
 *
 * Everything the windows do goes through here, and so does everything an
 * external client can do. There is no admin-ajax endpoint and no separate
 * "internal" surface: the builder is a REST client, which means the routes are
 * exercised by every save anybody makes rather than only by the people who read
 * the documentation.
 *
 * Two permission ceilings, and they are different on purpose:
 *
 *   - **Schema routes** (`/groups`, `/import`) need {@see atcf_can_manage()} —
 *     changing what fields exist is a structural change to the site.
 *   - **Value routes** (`/values`) need the capability of the object being
 *     written, checked per object rather than once for the request. A bulk write
 *     touching forty posts checks forty times, because a user who may edit
 *     thirty-nine of them must not get the fortieth for free.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * The REST namespace.
 *
 * @since 0.1.0
 */
const ATCF_REST_NAMESPACE = 'allterrain-fields/v1';

add_action( 'rest_api_init', 'atcf_register_rest_routes' );

/**
 * Registers every route.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_rest_routes() {
	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/config',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'atcf_rest_config',
			'permission_callback' => 'atcf_rest_can_manage',
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/groups',
		array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'atcf_rest_list_groups',
				'permission_callback' => 'atcf_rest_can_manage',
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => 'atcf_rest_save_group',
				'permission_callback' => 'atcf_rest_can_manage',
			),
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/groups/(?P<id>\d+)',
		array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'atcf_rest_get_group',
				'permission_callback' => 'atcf_rest_can_manage',
			),
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => 'atcf_rest_save_group',
				'permission_callback' => 'atcf_rest_can_manage',
			),
			array(
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => 'atcf_rest_delete_group',
				'permission_callback' => 'atcf_rest_can_manage',
			),
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/templates/(?P<slug>[a-z0-9_-]+)',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'atcf_rest_create_from_template',
			'permission_callback' => 'atcf_rest_can_manage',
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/content-types',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'atcf_rest_create_content_type',
			'permission_callback' => 'atcf_rest_can_manage',
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/content-types/(?P<id>[0-9]+)',
		array(
			'methods'             => WP_REST_Server::DELETABLE,
			'callback'            => 'atcf_rest_delete_content_type',
			'permission_callback' => 'atcf_rest_can_manage',
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/model',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'atcf_rest_model',
			'permission_callback' => 'atcf_rest_can_manage',
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/search',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'atcf_rest_search',
			'permission_callback' => 'atcf_rest_can_read',
			'args'                => array(
				'kind'      => array(
					'type'    => 'string',
					'default' => 'post',
				),
				'q'         => array(
					'type'    => 'string',
					'default' => '',
				),
				'post_type' => array(
					'type'    => 'string',
					'default' => '',
				),
				'taxonomy'  => array(
					'type'    => 'string',
					'default' => '',
				),
				'roles'     => array(
					'type'    => 'string',
					'default' => '',
				),
				'include'   => array(
					'type'    => 'string',
					'default' => '',
				),
				'page'      => array(
					'type'    => 'integer',
					'default' => 1,
				),
			),
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/values',
		array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'atcf_rest_read_values',
				'permission_callback' => 'atcf_rest_can_read',
			),
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => 'atcf_rest_write_values',
				'permission_callback' => 'atcf_rest_can_read',
			),
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/object',
		array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'atcf_rest_read_object',
				'permission_callback' => 'atcf_rest_can_read',
			),
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => 'atcf_rest_write_object',
				'permission_callback' => 'atcf_rest_can_read',
			),
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/export',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'atcf_rest_export',
			'permission_callback' => 'atcf_rest_can_manage',
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/import',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'atcf_rest_import',
			'permission_callback' => 'atcf_rest_can_manage',
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/sync',
		array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'atcf_rest_json_diff',
				'permission_callback' => 'atcf_rest_can_manage',
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => 'atcf_rest_json_sync',
				'permission_callback' => 'atcf_rest_can_manage',
			),
		)
	);

	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/preview/(?P<id>\d+)',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'atcf_rest_preview',
			'permission_callback' => 'atcf_rest_can_manage',
		)
	);
}

/**
 * Permission callback for the schema routes.
 *
 * @since 0.1.0
 *
 * @return true|WP_Error True, or a 403.
 */
function atcf_rest_can_manage() {
	if ( atcf_can_manage() ) {
		return true;
	}

	return new WP_Error(
		'atcf_forbidden',
		__( 'You are not allowed to change the site’s field groups.', 'allterrain-fields' ),
		array( 'status' => rest_authorization_required_code() )
	);
}

/**
 * Permission callback for routes any editor may reach.
 *
 * `edit_posts` and not `read`: every one of these routes exists to fill in a
 * control on an edit screen, and somebody who cannot edit anything has no edit
 * screen to fill in. The routes then check the *specific* object again.
 *
 * @since 0.1.0
 *
 * @return true|WP_Error True, or a 403.
 */
function atcf_rest_can_read() {
	if ( current_user_can( 'edit_posts' ) ) {
		return true;
	}

	return new WP_Error(
		'atcf_forbidden',
		__( 'You are not allowed to do that.', 'allterrain-fields' ),
		array( 'status' => rest_authorization_required_code() )
	);
}

/**
 * Everything the builder needs to draw itself.
 *
 * @since 0.1.0
 *
 * @return WP_REST_Response The config.
 */
function atcf_rest_config() {
	return rest_ensure_response(
		array(
			'fieldTypes'      => atcf_field_type_palette(),
			'fieldGroups'     => atcf_field_groups_list(),
			'settingControls' => atcf_setting_controls(),
			'operators'       => atcf_logic_operators(),
			'locationParams'  => atcf_location_params(),
			'locationChoices' => atcf_location_choices(),
			'postTypes'       => atcf_post_type_choices(),
			'taxonomies'      => atcf_taxonomy_choices(),
			'roles'           => atcf_role_choices(),
			'imageSizes'      => atcf_image_size_choices(),
			'optionsPages'    => array_values( atcf_get_options_pages() ),
			'templates'       => atcf_template_summaries(),
			'calcFunctions'   => array_keys( atcf_calc_functions() ),
			'adminUrl'        => esc_url_raw( admin_url() ),
		)
	);
}

/**
 * Lists the field groups.
 *
 * @since 0.1.0
 *
 * @return WP_REST_Response The groups.
 */
function atcf_rest_list_groups() {
	$groups = array();

	foreach ( atcf_get_groups( true ) as $group ) {
		$groups[] = atcf_group_summary( $group );
	}

	return rest_ensure_response( $groups );
}

/**
 * A group as the builder's list shows it.
 *
 * Deliberately not the whole group. The list is drawn before anything is opened,
 * and shipping every field of every group to draw a list of titles is how a site
 * with sixty groups takes four seconds to show one.
 *
 * @since 0.1.0
 *
 * @param array $group Canonical group.
 * @return array The summary.
 */
function atcf_group_summary( $group ) {
	return array(
		'id'       => (int) atcf_arr( $group, 'id', 0 ),
		'key'      => $group['key'],
		'title'    => $group['title'],
		'fields'   => count( atcf_flatten_fields( $group['fields'] ) ),
		'top'      => count( $group['fields'] ),
		'active'   => (bool) $group['settings']['active'],
		'local'    => (bool) atcf_arr( $group, 'local', false ),
		'block'    => (bool) $group['settings']['block']['enabled'],
		'location' => atcf_describe_location( $group['location'] ),
		'types'    => atcf_group_post_types( $group ),
	);
}

/**
 * A one-line, human reading of a group's location rules.
 *
 * Built on the server because it needs the *labels* of post types and
 * taxonomies, which the browser would otherwise have to look up per rule against
 * four different lists.
 *
 * @since 0.1.0
 *
 * @param array[][] $location Normalised rules.
 * @return string The description.
 */
function atcf_describe_location( $location ) {
	if ( ! $location ) {
		return __( 'Everywhere', 'allterrain-fields' );
	}

	$parts = array();

	foreach ( $location as $group ) {
		$clauses = array();

		foreach ( (array) $group as $rule ) {
			$clauses[] = sprintf(
				'%s %s %s',
				(string) $rule['param'],
				'!=' === $rule['operator'] ? __( 'is not', 'allterrain-fields' ) : __( 'is', 'allterrain-fields' ),
				is_array( $rule['value'] ) ? implode( ', ', $rule['value'] ) : (string) $rule['value']
			);
		}

		$parts[] = implode( __( ' and ', 'allterrain-fields' ), $clauses );
	}

	return implode( __( ', or ', 'allterrain-fields' ), $parts );
}

/**
 * Reads one group in full.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error The group.
 */
function atcf_rest_get_group( $request ) {
	$group = atcf_get_group( (int) $request['id'] );

	if ( ! $group ) {
		return new WP_Error( 'atcf_not_found', __( 'No such field group.', 'allterrain-fields' ), array( 'status' => 404 ) );
	}

	return rest_ensure_response( $group );
}

/**
 * Creates or updates a group.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error The saved group.
 */
function atcf_rest_save_group( $request ) {
	$group = (array) $request->get_json_params();

	if ( isset( $request['id'] ) ) {
		$group['id'] = (int) $request['id'];
	}

	$saved = atcf_save_group( $group );

	if ( is_wp_error( $saved ) ) {
		return $saved;
	}

	return rest_ensure_response( $saved );
}

/**
 * Deletes a group.
 *
 * Trashed rather than erased. A field group is the shape of a site's content,
 * and "I deleted it and now every product page is empty" is not a mistake to
 * make irreversible — the values themselves are left in the database untouched,
 * so restoring the group restores everything with it.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error The result.
 */
function atcf_rest_delete_group( $request ) {
	$id = (int) $request['id'];

	if ( ATCF_GROUP_TYPE !== get_post_type( $id ) ) {
		return new WP_Error( 'atcf_not_found', __( 'No such field group.', 'allterrain-fields' ), array( 'status' => 404 ) );
	}

	$result = $request->get_param( 'force' ) ? wp_delete_post( $id, true ) : wp_trash_post( $id );

	atcf_flush_group_cache();

	return rest_ensure_response( array( 'deleted' => (bool) $result ) );
}

/**
 * The site's content model, as nodes and edges.
 *
 * @since 0.1.0
 *
 * @return WP_REST_Response The model.
 */
function atcf_rest_model() {
	$attached = atcf_model_attachments();
	$mine     = array();
	$nodes    = array();

	foreach ( atcf_get_content_types() as $type ) {
		$mine[ $type['slug'] ] = (int) $type['id'];
	}

	foreach ( get_post_types( array( 'show_ui' => true ), 'objects' ) as $type ) {
		if ( in_array( $type->name, array( ATCF_GROUP_TYPE, ATCF_OPTIONS_TYPE, ATCF_CONTENT_TYPE ), true ) ) {
			continue;
		}

		$nodes[] = atcf_model_node(
			$type->name,
			'post_type',
			$type->labels->name,
			is_string( $type->menu_icon ) ? $type->menu_icon : 'dashicons-admin-post',
			(int) array_sum( (array) wp_count_posts( $type->name ) ),
			$attached,
			isset( $mine[ $type->name ] ) ? $mine[ $type->name ] : 0
		);
	}

	foreach ( get_taxonomies( array( 'show_ui' => true ), 'objects' ) as $taxonomy ) {
		$nodes[] = atcf_model_node(
			'taxonomy:' . $taxonomy->name,
			'taxonomy',
			$taxonomy->labels->name,
			'dashicons-tag',
			(int) wp_count_terms(
				array(
					'taxonomy'   => $taxonomy->name,
					'hide_empty' => false,
				)
			),
			$attached
		);
	}

	$nodes[] = atcf_model_node(
		'user',
		'user',
		__( 'People', 'allterrain-fields' ),
		'dashicons-admin-users',
		(int) count_users()['total_users'],
		$attached
	);

	$groups = array();

	foreach ( atcf_get_groups( true ) as $group ) {
		$groups[] = atcf_group_summary( $group );
	}

	return rest_ensure_response(
		array(
			'nodes'  => $nodes,
			'edges'  => atcf_relationship_graph(),
			'groups' => $groups,
		)
	);
}

/**
 * Searches posts, terms or users for a relational control.
 *
 * One route rather than three, because the three controls differ only in which
 * table they look in and the client-side code for "type, wait, show a list" is
 * identical. Results are a flat `{ id, label, sub, icon }` for the same reason.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response The results.
 */
function atcf_rest_search( $request ) {
	$kind    = (string) $request['kind'];
	$query   = sanitize_text_field( (string) $request['q'] );
	$include = atcf_to_id_list( (string) $request['include'] );
	$page    = max( 1, (int) $request['page'] );
	$results = array();

	if ( 'user' === $kind ) {
		$roles = array_filter( array_map( 'sanitize_key', explode( ',', (string) $request['roles'] ) ) );
		$args  = array(
			'number'  => 30,
			'paged'   => $page,
			'search'  => '' === $query ? '' : '*' . $query . '*',
			'orderby' => 'display_name',
		);

		if ( $roles ) {
			$args['role__in'] = $roles;
		}

		if ( $include ) {
			$args['include'] = $include;
			$args['search']  = '';
		}

		foreach ( get_users( $args ) as $user ) {
			$results[] = array(
				'id'    => (int) $user->ID,
				'label' => $user->display_name,
				'sub'   => $user->user_email,
				'icon'  => get_avatar_url( $user->ID, array( 'size' => 48 ) ),
			);
		}
	} elseif ( 'term' === $kind ) {
		$taxonomy = sanitize_key( (string) $request['taxonomy'] );
		$args     = array(
			'taxonomy'   => $taxonomy ? $taxonomy : null,
			'hide_empty' => false,
			'number'     => 40,
			'offset'     => ( $page - 1 ) * 40,
			'search'     => $query,
		);

		if ( $include ) {
			$args['include'] = $include;
			$args['search']  = '';
			$args['number']  = 0;
		}

		foreach ( (array) get_terms( array_filter( $args, static fn( $one ) => null !== $one ) ) as $term ) {
			if ( ! $term instanceof WP_Term ) {
				continue;
			}

			$results[] = array(
				'id'    => (int) $term->term_id,
				'label' => $term->name,
				'sub'   => $term->taxonomy,
				'icon'  => 'dashicons-tag',
			);
		}
	} else {
		$types = array_filter( array_map( 'sanitize_key', explode( ',', (string) $request['post_type'] ) ) );
		$args  = array(
			'post_type'        => $types ? $types : 'any',
			'post_status'      => array( 'publish', 'draft', 'pending', 'private', 'future' ),
			'posts_per_page'   => 30,
			'paged'            => $page,
			's'                => $query,
			'orderby'          => '' === $query ? 'modified' : 'relevance',
			'suppress_filters' => false,
		);

		if ( $include ) {
			$args['post__in'] = $include;
			$args['s']        = '';
			// Ordering by the given ids keeps a relationship field's stored
			// order when it re-hydrates its chips. `post__in` without this
			// returns them by date, which silently reorders the field on every
			// page load.
			$args['orderby']        = 'post__in';
			$args['posts_per_page'] = count( $include );
		}

		foreach ( get_posts( $args ) as $post ) {
			$type = get_post_type_object( $post->post_type );

			$results[] = array(
				'id'        => (int) $post->ID,
				'label'     => '' === $post->post_title ? __( '(no title)', 'allterrain-fields' ) : $post->post_title,
				'sub'       => $type ? $type->labels->singular_name : $post->post_type,
				'icon'      => 'dashicons-admin-post',
				'status'    => $post->post_status,
				'thumbnail' => (string) get_the_post_thumbnail_url( $post, 'thumbnail' ),
				'editUrl'   => (string) get_edit_post_link( $post, 'raw' ),
			);
		}
	}

	return rest_ensure_response( array( 'results' => $results ) );
}

/**
 * Reads field values across many objects, for the bulk editor.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error The rows.
 */
function atcf_rest_read_values( $request ) {
	$group = atcf_get_group( (int) $request->get_param( 'group' ) );

	if ( ! $group ) {
		return new WP_Error( 'atcf_not_found', __( 'No such field group.', 'allterrain-fields' ), array( 'status' => 404 ) );
	}

	$post_type = sanitize_key( (string) $request->get_param( 'post_type' ) );
	$page      = max( 1, (int) $request->get_param( 'page' ) );
	$types     = atcf_group_post_types( $group );

	if ( '' === $post_type ) {
		$post_type = ( $types && '*' !== $types[0] ) ? $types[0] : 'post';
	}

	$query = new WP_Query(
		array(
			'post_type'      => $post_type,
			'post_status'    => array( 'publish', 'draft', 'pending', 'private', 'future' ),
			'posts_per_page' => 50,
			'paged'          => $page,
			's'              => sanitize_text_field( (string) $request->get_param( 'q' ) ),
			'orderby'        => 'modified',
		)
	);

	// Only the fields a spreadsheet can meaningfully hold a column of. A
	// repeater in a cell is not a cell.
	$columns = array();

	foreach ( $group['fields'] as $field ) {
		if ( atcf_type_has_sub_fields( (string) $field['type'] ) ) {
			continue;
		}

		if ( 'none' === (string) atcf_arr( (array) atcf_get_field_type( $field['type'] ), 'value', 'string' ) ) {
			continue;
		}

		$columns[] = array(
			'key'      => $field['key'],
			'name'     => $field['name'],
			'label'    => $field['label'],
			'type'     => $field['type'],
			'settings' => (array) $field['settings'],
		);
	}

	$rows = array();

	foreach ( $query->posts as $post ) {
		$ref    = array(
			'type' => 'post',
			'id'   => (int) $post->ID,
		);
		$values = array();

		foreach ( $columns as $column ) {
			$field = atcf_get_field_by_key( $column['key'] );

			$values[ $column['key'] ] = $field ? atcf_load_value( $field, $ref, '', false ) : null;
		}

		$rows[] = array(
			'id'      => (int) $post->ID,
			'title'   => $post->post_title,
			'status'  => $post->post_status,
			'editUrl' => (string) get_edit_post_link( $post, 'raw' ),
			'canEdit' => current_user_can( 'edit_post', $post->ID ),
			'values'  => $values,
		);
	}

	return rest_ensure_response(
		array(
			'columns'   => $columns,
			'rows'      => $rows,
			'total'     => (int) $query->found_posts,
			'pages'     => (int) $query->max_num_pages,
			'postType'  => $post_type,
			'postTypes' => $types,
		)
	);
}

/**
 * Writes field values across many objects.
 *
 * The capability is checked per object inside the loop, and a refusal skips that
 * object rather than failing the request. A bulk edit of fifty posts where the
 * user may edit forty-nine should write forty-nine and say so — refusing all
 * fifty over one teaches people to stop using it.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response The result.
 */
function atcf_rest_write_values( $request ) {
	$writes  = (array) $request->get_param( 'writes' );
	$written = 0;
	$refused = array();

	foreach ( $writes as $write ) {
		$id    = (int) atcf_arr( (array) $write, 'id', 0 );
		$key   = atcf_sanitize_field_key( (string) atcf_arr( (array) $write, 'field', '' ) );
		$field = atcf_get_field_by_key( $key );

		if ( ! $field || $id <= 0 ) {
			continue;
		}

		if ( ! current_user_can( 'edit_post', $id ) ) {
			$refused[] = $id;

			continue;
		}

		$ref = array(
			'type' => 'post',
			'id'   => $id,
		);

		atcf_save_value( $field, $ref, atcf_arr( (array) $write, 'value', null ) );
		atcf_sync_relationships( $field, $ref, atcf_arr( (array) $write, 'value', null ) );

		++$written;
	}

	return rest_ensure_response(
		array(
			'written' => $written,
			'refused' => array_values( array_unique( $refused ) ),
		)
	);
}

/**
 * Exports groups as JSON.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response The export.
 */
function atcf_rest_export( $request ) {
	$wanted = array_filter( array_map( 'intval', explode( ',', (string) $request->get_param( 'ids' ) ) ) );
	$export = array();

	foreach ( atcf_get_groups( true ) as $group ) {
		if ( $wanted && ! in_array( (int) atcf_arr( $group, 'id', 0 ), $wanted, true ) ) {
			continue;
		}

		// The post id is stripped. It is meaningless on the site importing the
		// file, and leaving it in makes an import silently overwrite whatever
		// post happens to have that id there — which on a fresh site is
		// routinely somebody's About page.
		unset( $group['id'], $group['status'], $group['local'] );

		$export[] = $group;
	}

	return rest_ensure_response( $export );
}

/**
 * Imports groups from JSON.
 *
 * Matched on key, so re-importing an updated file updates the groups rather than
 * duplicating them. That is what makes the JSON sync usable as a deployment
 * mechanism rather than as a one-way door.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error The result.
 */
function atcf_rest_import( $request ) {
	$payload = $request->get_json_params();
	$groups  = isset( $payload['groups'] ) ? (array) $payload['groups'] : (array) $payload;
	$results = array();

	foreach ( $groups as $group ) {
		if ( ! is_array( $group ) ) {
			continue;
		}

		$existing = atcf_group_post_by_key( (string) atcf_arr( $group, 'key', '' ) );

		if ( $existing ) {
			$group['id'] = $existing;
		} else {
			unset( $group['id'] );
		}

		$saved = atcf_save_group( $group );

		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		$results[] = array(
			'id'      => (int) $saved['id'],
			'key'     => $saved['key'],
			'title'   => $saved['title'],
			'updated' => (bool) $existing,
		);
	}

	return rest_ensure_response( array( 'imported' => $results ) );
}

/**
 * Finds the post holding a group with a given key.
 *
 * @since 0.1.0
 *
 * @param string $key The group key.
 * @return int The post id, or 0.
 */
function atcf_group_post_by_key( $key ) {
	$key = atcf_sanitize_field_key( $key );

	if ( '' === $key ) {
		return 0;
	}

	$found = get_posts(
		array(
			'post_type'        => ATCF_GROUP_TYPE,
			'post_status'      => 'any',
			'numberposts'      => 1,
			'fields'           => 'ids',
			'meta_key'         => ATCF_KEY_META, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Indexed lookup on a table with one row per field group; the alternative is loading and decoding every group on the site.
			'meta_value'       => $key, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			'suppress_filters' => false,
		)
	);

	return $found ? (int) $found[0] : 0;
}

/**
 * Renders a group's fields as they would appear on an edit screen.
 *
 * This is what the preview window shows. It is the *real* renderer against a
 * real object, not a mock — a preview built from a second, simplified renderer
 * is a preview that is wrong exactly where it matters.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error The markup.
 */
function atcf_rest_preview( $request ) {
	$group = atcf_get_group( (int) $request['id'] );

	if ( ! $group ) {
		return new WP_Error( 'atcf_not_found', __( 'No such field group.', 'allterrain-fields' ), array( 'status' => 404 ) );
	}

	$sample = (int) $request->get_param( 'post' );
	$ref    = array(
		'type' => 'post',
		'id'   => $sample > 0 ? $sample : 0,
	);

	ob_start();
	atcf_render_group_fields( $group, $ref, 'atcf_preview' );
	$markup = (string) ob_get_clean();

	return rest_ensure_response(
		array(
			'title'  => $group['title'],
			'markup' => $markup,
			'sample' => $sample,
		)
	);
}

/**
 * What differs between the JSON files on disk and the database.
 *
 * @since 0.1.0
 *
 * @return WP_REST_Response The diff.
 */
function atcf_rest_json_diff() {
	return rest_ensure_response( atcf_json_diff() );
}

/**
 * Imports the groups on disk.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response What was imported.
 */
function atcf_rest_json_sync( $request ) {
	$payload = (array) $request->get_json_params();
	$keys    = array_filter( array_map( 'strval', (array) atcf_arr( $payload, 'keys', array() ) ) );

	return rest_ensure_response( array( 'imported' => atcf_sync_from_json( $keys ) ) );
}

/**
 * Everything one object's fields are, and hold.
 *
 * What the Field Inspector widget reads. Shaped as definitions plus values
 * rather than as rendered markup, because the widget draws them with the same
 * client-side renderer the repeater uses — a second HTML endpoint would be a
 * second renderer to keep in step.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error The fields and values.
 */
function atcf_rest_read_object( $request ) {
	$type = (string) $request->get_param( 'type' );
	$id   = $request->get_param( 'id' );
	$ref  = array(
		'type' => in_array( $type, array( 'post', 'term', 'user', 'option' ), true ) ? $type : 'post',
		'id'   => 'option' === $type ? sanitize_key( (string) $id ) : (int) $id,
	);

	if ( ! atcf_can_edit_values( $ref['type'], $ref['id'] ) ) {
		return new WP_Error(
			'atcf_forbidden',
			__( 'You are not allowed to see that.', 'allterrain-fields' ),
			array( 'status' => rest_authorization_required_code() )
		);
	}

	$fields = array();
	$values = array();

	foreach ( atcf_groups_for( atcf_ref_context( $ref ) ) as $group ) {
		foreach ( $group['fields'] as $field ) {
			if ( 'none' === (string) atcf_arr( (array) atcf_get_field_type( $field['type'] ), 'value', 'string' ) ) {
				continue;
			}

			$fields[] = array_merge(
				atcf_field_for_client( $field ),
				array( 'group' => $group['title'] )
			);

			$values[ $field['key'] ] = atcf_value_for_client( $field, atcf_load_value( $field, $ref, '', false ) );
		}
	}

	return rest_ensure_response(
		array(
			'label'  => atcf_object_label( $ref ),
			'fields' => $fields,
			'values' => $values,
		)
	);
}

/**
 * Writes one field on one object.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error What was written.
 */
function atcf_rest_write_object( $request ) {
	$payload = (array) $request->get_json_params();
	$type    = (string) atcf_arr( $payload, 'type', 'post' );
	$id      = atcf_arr( $payload, 'id', 0 );
	$ref     = array(
		'type' => in_array( $type, array( 'post', 'term', 'user', 'option' ), true ) ? $type : 'post',
		'id'   => 'option' === $type ? sanitize_key( (string) $id ) : (int) $id,
	);

	if ( ! atcf_can_edit_values( $ref['type'], $ref['id'] ) ) {
		return new WP_Error(
			'atcf_forbidden',
			__( 'You are not allowed to edit that.', 'allterrain-fields' ),
			array( 'status' => rest_authorization_required_code() )
		);
	}

	$field = atcf_get_field_by_key( (string) atcf_arr( $payload, 'field', '' ) );

	if ( ! $field ) {
		return new WP_Error( 'atcf_no_field', __( 'No such field.', 'allterrain-fields' ), array( 'status' => 404 ) );
	}

	$value = atcf_unwrap_submitted( atcf_arr( $payload, 'value', null ), $field );

	atcf_save_value( $field, $ref, $value );
	atcf_sync_relationships( $field, $ref, $value );

	return rest_ensure_response(
		array(
			'field' => $field['key'],
			'value' => atcf_value_for_client( $field, atcf_load_value( $field, $ref, '', false ) ),
		)
	);
}

/**
 * A human name for whatever the inspector is looking at.
 *
 * @since 0.1.0
 *
 * @param array $ref Object reference.
 * @return string The name.
 */
function atcf_object_label( $ref ) {
	switch ( (string) atcf_arr( $ref, 'type', 'post' ) ) {
		case 'term':
			$term = get_term( (int) atcf_arr( $ref, 'id', 0 ) );

			return $term instanceof WP_Term ? $term->name : '';

		case 'user':
			$user = get_userdata( (int) atcf_arr( $ref, 'id', 0 ) );

			return $user ? $user->display_name : '';

		case 'option':
			return (string) atcf_arr( $ref, 'id', '' );
	}

	$post = get_post( (int) atcf_arr( $ref, 'id', 0 ) );

	return $post ? $post->post_title : '';
}

/**
 * Creates a real field group from a starter template.
 *
 * A route rather than something the browser assembles, because the keys have to
 * be minted server-side and the conditional rules rewritten to match — see
 * `includes/templates.php`. Handing the browser a template with symbolic keys
 * and trusting it to rewire them is how two groups made from one template end up
 * with logic pointing at each other.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error The saved group.
 */
function atcf_rest_create_from_template( $request ) {
	$group = atcf_group_from_template( (string) $request['slug'] );

	if ( is_wp_error( $group ) ) {
		return $group;
	}

	$saved = atcf_save_group( $group );

	if ( is_wp_error( $saved ) ) {
		return $saved;
	}

	return rest_ensure_response( $saved );
}

/**
 * One node, with what has been built on it.
 *
 * `count` is how many *things* there are — 966 posts. `fields` is how many
 * custom fields those things have. They are wildly different numbers and only
 * the second one is what a content model is about, which is why the graph now
 * leads with it: a site with 966 posts and no custom fields has nothing to draw,
 * and a site with four Properties carrying thirteen fields each has everything.
 *
 * @since 0.1.0
 *
 * @param string $id       Node id.
 * @param string $kind     `post_type`, `taxonomy` or `user`.
 * @param string $label    What it is called.
 * @param string $icon     Dashicon class.
 * @param int    $count    How many objects of this kind exist.
 * @param array  $attached Field groups per node id, from atcf_model_attachments().
 * @param int    $own      The definition post id when this plugin registered it; 0 otherwise.
 * @return array The node.
 */
function atcf_model_node( $id, $kind, $label, $icon, $count, $attached, $own = 0 ) {
	$groups = isset( $attached[ $id ] ) ? $attached[ $id ] : array();
	$fields = 0;
	$list   = array();

	foreach ( $groups as $group ) {
		$fields += (int) $group['fields'];

		foreach ( (array) $group['list'] as $field ) {
			$list[] = $field;
		}
	}

	/**
	 * Filters how many fields a node lists before it says "and N more".
	 *
	 * A node is a box on a diagram, not a list table. Ten rows is about where one
	 * stops being readable at a glance and starts being something you scroll —
	 * and the whole value of a class diagram is that you do not have to.
	 *
	 * @since 0.1.0
	 *
	 * @param int    $limit How many fields to name.
	 * @param string $id    The node id.
	 */
	$limit = (int) apply_filters( 'atcf_model_node_field_limit', 10, $id );

	return array(
		'id'     => $id,
		'kind'   => $kind,
		'label'  => $label,
		'icon'   => $icon,
		'count'  => (int) $count,
		'fields' => $fields,
		'list'   => array_slice( $list, 0, max( 0, $limit ) ),
		'groups' => array_values( $groups ),
		'own'    => (int) $own,
	);
}

/**
 * Which field groups land on which node.
 *
 * Read straight off the location rules rather than by asking
 * `atcf_groups_for_context()` once per node — that would mean building a fake
 * screen for every post type, taxonomy and the user form, thirty times over, to
 * answer a question the rules already state outright.
 *
 * The reading is deliberately generous. A group whose rule set mentions a post
 * type *anywhere* counts as attached to it, even when another rule in the same
 * set narrows it to one template or one status. The alternative is a graph that
 * quietly omits half of what a site has built because the rules were specific,
 * and "roughly where your fields are" is the honest answer to a question about
 * shape.
 *
 * @since 0.1.0
 *
 * @return array[] Node id => list of `{ id, title, fields }`.
 */
function atcf_model_attachments() {
	$map = array();

	/**
	 * Which location parameters attach a group to which kind of node.
	 *
	 * A plugin adding a location parameter that means "this post type" — say
	 * `post_type_archive` — adds it here and the graph understands it.
	 *
	 * @since 0.1.0
	 *
	 * @param array<string,string> $params Location param => node kind prefix.
	 */
	$params = (array) apply_filters(
		'atcf_model_location_params',
		array(
			'post_type'     => '',
			'post_taxonomy' => 'taxonomy:',
			'taxonomy'      => 'taxonomy:',
			'user_form'     => 'user',
			'user_role'     => 'user',
		)
	);

	foreach ( atcf_get_groups( true ) as $group ) {
		$summary = atcf_group_summary( $group );
		$entry   = array(
			'id'     => (int) atcf_arr( $summary, 'id', 0 ),
			'title'  => (string) atcf_arr( $summary, 'title', '' ),
			'fields' => (int) atcf_arr( $summary, 'fields', 0 ),
			'list'   => atcf_model_field_list( (array) atcf_arr( $group, 'fields', array() ) ),
		);

		foreach ( (array) atcf_arr( $group, 'location', array() ) as $any ) {
			foreach ( (array) $any as $rule ) {
				$param = (string) atcf_arr( (array) $rule, 'param', '' );

				if ( ! isset( $params[ $param ] ) || '==' !== (string) atcf_arr( (array) $rule, 'operator', '==' ) ) {
					continue;
				}

				$value = (string) atcf_arr( (array) $rule, 'value', '' );
				$node  = 'user' === $params[ $param ] ? 'user' : $params[ $param ] . $value;

				// A taxonomy rule states `taxonomy:term`; the node is the taxonomy.
				if ( 'post_taxonomy' === $param && false !== strpos( $value, ':' ) ) {
					$node = 'taxonomy:' . strtok( $value, ':' );
				}

				if ( '' === $value && 'user' !== $params[ $param ] ) {
					continue;
				}

				if ( ! isset( $map[ $node ] ) ) {
					$map[ $node ] = array();
				}

				$map[ $node ][ $entry['id'] ] = $entry;
			}
		}
	}

	return $map;
}

/**
 * Creates a content type.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error The stored definition.
 */
function atcf_rest_create_content_type( $request ) {
	$type = atcf_save_content_type( (array) $request->get_json_params() );

	if ( is_wp_error( $type ) ) {
		return $type;
	}

	return rest_ensure_response( $type );
}

/**
 * Deletes a content type. Its entries are left where they are.
 *
 * @since 0.1.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error Whether it went.
 */
function atcf_rest_delete_content_type( $request ) {
	$deleted = atcf_delete_content_type( (int) $request['id'] );

	if ( is_wp_error( $deleted ) ) {
		return $deleted;
	}

	return rest_ensure_response( array( 'deleted' => (bool) $deleted ) );
}

/**
 * A group's fields, as a diagram reads them.
 *
 * Name and type, in declared order — the two columns of a class diagram, and the
 * only two facts about a field that belong on a box somebody is looking at from
 * across the room. Not the label: the *name* is the meta key, and the meta key is
 * what a theme writes in `get_post_meta()`, which is the question somebody
 * squints at a content model to answer.
 *
 * Layout furniture — tabs, accordions, messages — is left out. They hold no
 * value, so they are not part of the shape of the data; a box listing "Tab" as
 * though it were a field describes the edit screen rather than the model.
 *
 * @since 0.1.0
 *
 * @param array[] $fields   Field definitions.
 * @param string  $prefix   Ancestor path, for sub-fields.
 * @return array[] `{ name, type, label, sub }` per field.
 */
function atcf_model_field_list( $fields, $prefix = '' ) {
	$out = array();

	foreach ( (array) $fields as $field ) {
		$field = (array) $field;
		$type  = (string) atcf_arr( $field, 'type', 'text' );

		if ( in_array( $type, array( 'tab', 'accordion', 'message' ), true ) ) {
			continue;
		}

		$registered = atcf_get_field_type( $type );

		$out[] = array(
			'name'  => $prefix . (string) atcf_arr( $field, 'name', '' ),
			'label' => (string) atcf_arr( $field, 'label', '' ),
			'type'  => $registered ? (string) atcf_arr( (array) $registered, 'label', $type ) : $type,
			'sub'   => '' !== $prefix,
		);

		// One level of nesting, no more. A repeater's rows are part of the shape
		// and worth showing; a repeater inside a repeater inside a group is a
		// tree, and a box on a diagram is not where a tree goes.
		if ( '' === $prefix && atcf_type_has_sub_fields( $type ) ) {
			foreach ( atcf_model_field_list( atcf_field_sub_fields( $field ), '· ' ) as $sub ) {
				$out[] = $sub;
			}
		}
	}

	return $out;
}
