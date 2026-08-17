<?php
/**
 * Importing from Meta Box.
 *
 * Meta Box is the other big custom-fields plugin, and its dialect is further
 * away than ACF's: fields have no keys (the `id` is both identity and meta
 * key), `name` means what everybody else calls a label, and a "field group"
 * is a meta box whose placement is a couple of settings rather than a rule
 * grammar. This file translates all of it, from any of the three places a
 * Meta Box site keeps its definitions:
 *
 *   - **A Meta Box Builder export.** The JSON its own export screen produces,
 *     which carries the runtime definition under a `meta_box` key — the exact
 *     array the `rwmb_meta_boxes` filter would have received. A hand-written
 *     array in that same shape is accepted too.
 *   - **The database.** Meta Box Builder stores each box as a `meta-box` post;
 *     the definition is unpacked from its content, so the import works after
 *     Meta Box has been deactivated.
 *   - **The running plugin.** With Meta Box active, everything registered
 *     through `rwmb_meta_boxes` — code and builder alike — can be pulled in
 *     one step.
 *
 * Identity is the delicate part. This plugin joins its schema on field keys
 * and Meta Box has none, so keys are **minted deterministically** from the box
 * id and the field's path — the same input always mints the same key, which is
 * what makes re-importing update instead of duplicate, and what lets a
 * converted conditional rule point at the key its target was about to get.
 *
 * Field `id`s become field names verbatim, and for every simple field that is
 * the whole migration: Meta Box wrote `get_post_meta( $id, 'price', true )`
 * rows and so does this plugin. The two storage layouts part ways at groups
 * and cloneable fields — Meta Box serialises those into one row, this plugin
 * writes a row per value — and the importer says so per field rather than
 * letting anybody discover it from an empty repeater.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', 'atcf_register_metabox_import_routes' );

/**
 * Registers the Meta Box import routes.
 *
 * @since 0.2.0
 *
 * @return void
 */
function atcf_register_metabox_import_routes() {
	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/import/metabox',
		array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'atcf_rest_metabox_sources',
				'permission_callback' => 'atcf_rest_can_manage',
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => 'atcf_rest_metabox_import',
				'permission_callback' => 'atcf_rest_can_manage',
			),
		)
	);
}

/**
 * What there is to import from.
 *
 * @since 0.2.0
 *
 * @return WP_REST_Response Detected sources and the boxes each one holds.
 */
function atcf_rest_metabox_sources() {
	$boxes = atcf_metabox_detected_boxes();
	$list  = array();

	foreach ( $boxes as $box ) {
		$id = atcf_metabox_box_id( $box );

		$list[] = array(
			'id'     => $id,
			'title'  => (string) atcf_arr( $box, 'title', $id ),
			'fields' => count( (array) atcf_arr( $box, 'fields', array() ) ),
			'source' => (string) atcf_arr( $box, '_atcf_source', 'database' ),
			'exists' => atcf_group_post_by_key( atcf_metabox_group_key( $id ) ) > 0,
		);
	}

	return rest_ensure_response(
		array(
			'active' => defined( 'RWMB_VER' ) || class_exists( 'RW_Meta_Box' ),
			'boxes'  => $list,
		)
	);
}

/**
 * Imports Meta Box definitions.
 *
 * A body carrying `boxes` converts a pasted export; a body carrying `ids`
 * imports that subset of what the site itself holds; an empty body imports
 * everything detected.
 *
 * @since 0.2.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error What was imported, with the warnings.
 */
function atcf_rest_metabox_import( $request ) {
	$payload = (array) $request->get_json_params();
	$raw     = array();

	foreach ( (array) atcf_arr( $payload, 'boxes', array() ) as $item ) {
		$box = atcf_metabox_from_export_item( $item );

		if ( $box ) {
			$raw[] = $box;
		}
	}

	if ( ! $raw ) {
		$ids = array_filter( array_map( 'sanitize_text_field', (array) atcf_arr( $payload, 'ids', array() ) ) );
		$raw = atcf_metabox_detected_boxes();

		if ( $ids ) {
			$raw = array_values(
				array_filter(
					$raw,
					static function ( $box ) use ( $ids ) {
						return in_array( atcf_metabox_box_id( $box ), $ids, true );
					}
				)
			);
		}
	}

	if ( ! $raw ) {
		return new WP_Error(
			'atcf_nothing_to_import',
			__( 'No Meta Box definitions were given, and none were found on this site.', 'allterrain-fields' ),
			array( 'status' => 400 )
		);
	}

	$results = array();

	foreach ( $raw as $box ) {
		$converted = atcf_convert_metabox( $box );
		$group     = $converted['group'];
		$existing  = atcf_group_post_by_key( (string) atcf_arr( $group, 'key', '' ) );

		if ( $existing ) {
			$group['id'] = $existing;
		}

		$saved = atcf_save_group( $group );

		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		$results[] = array(
			'id'       => (int) $saved['id'],
			'key'      => $saved['key'],
			'title'    => $saved['title'],
			'fields'   => count( atcf_flatten_fields( $saved['fields'] ) ),
			'updated'  => (bool) $existing,
			'warnings' => $converted['warnings'],
		);
	}

	return rest_ensure_response( array( 'imported' => $results ) );
}

/*
 * Finding boxes on the site.
 */

/**
 * Every Meta Box definition this site holds, as raw Meta Box arrays.
 *
 * The running plugin is asked first because `rwmb_meta_boxes` is where
 * code-registered boxes live; the Builder's own `meta-box` posts are merged in
 * for anything it did not report — or everything, once Meta Box is gone.
 *
 * @since 0.2.0
 *
 * @return array[] Meta Box definitions, each tagged with an `_atcf_source`.
 */
function atcf_metabox_detected_boxes() {
	$boxes = array();
	$seen  = array();

	if ( defined( 'RWMB_VER' ) || class_exists( 'RW_Meta_Box' ) ) {
		/** This filter is documented in the Meta Box plugin. */
		foreach ( (array) apply_filters( 'rwmb_meta_boxes', array() ) as $box ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Meta Box's own registration filter, read the same way Meta Box reads it.
			if ( ! is_array( $box ) || ! atcf_arr( $box, 'fields', array() ) ) {
				continue;
			}

			$box['_atcf_source'] = 'plugin';

			$boxes[] = $box;
			$seen[]  = atcf_metabox_box_id( $box );
		}
	}

	foreach ( atcf_metabox_boxes_from_database() as $box ) {
		if ( in_array( atcf_metabox_box_id( $box ), $seen, true ) ) {
			continue;
		}

		$box['_atcf_source'] = 'database';

		$boxes[] = $box;
	}

	return $boxes;
}

/**
 * Reads Meta Box Builder's boxes out of the posts table.
 *
 * The Builder stores one `meta-box` post per box. What the content holds has
 * varied across Builder versions — serialized PHP, JSON, and JSON wrapped in a
 * `meta_box` key have all shipped — so the unpacking tries each shape and
 * keeps whatever yields a definition with fields.
 *
 * @since 0.2.0
 *
 * @return array[] Meta Box definitions.
 */
function atcf_metabox_boxes_from_database() {
	$posts = get_posts(
		array(
			'post_type'        => 'meta-box',
			'post_status'      => array( 'publish', 'draft' ),
			'numberposts'      => -1,
			'orderby'          => 'menu_order title',
			'order'            => 'ASC',
			'suppress_filters' => false,
		)
	);

	$boxes = array();

	foreach ( $posts as $post ) {
		$box = atcf_metabox_from_export_item( atcf_metabox_unpack( $post->post_content ) );

		if ( ! $box ) {
			continue;
		}

		if ( '' === (string) atcf_arr( $box, 'title', '' ) ) {
			$box['title'] = $post->post_title;
		}

		if ( '' === (string) atcf_arr( $box, 'id', '' ) ) {
			$box['id'] = $post->post_name;
		}

		$boxes[] = $box;
	}

	return $boxes;
}

/**
 * Digs the runtime definition out of one export item.
 *
 * A Builder export wraps the runtime array in a `meta_box` key; a hand-written
 * registration *is* the runtime array. Either way, a definition without
 * fields is nothing to import.
 *
 * @since 0.2.0
 *
 * @param mixed $item One item from an export file or an unpacked post.
 * @return array|null The runtime definition.
 */
function atcf_metabox_from_export_item( $item ) {
	if ( ! is_array( $item ) ) {
		return null;
	}

	if ( is_array( atcf_arr( $item, 'meta_box', null ) ) ) {
		$box = (array) $item['meta_box'];

		if ( '' === (string) atcf_arr( $box, 'title', '' ) && '' !== (string) atcf_arr( $item, 'post_title', '' ) ) {
			$box['title'] = (string) $item['post_title'];
		}

		return atcf_arr( $box, 'fields', array() ) ? $box : null;
	}

	return atcf_arr( $item, 'fields', array() ) ? $item : null;
}

/**
 * Unpacks whatever a Builder post's content holds.
 *
 * @since 0.2.0
 *
 * @param string $content The post_content.
 * @return array The definition, or an empty array.
 */
function atcf_metabox_unpack( $content ) {
	$content = (string) $content;

	if ( '' === trim( $content ) ) {
		return array();
	}

	if ( is_serialized( $content ) ) {
		$data = @unserialize( trim( $content ), array( 'allowed_classes' => false ) ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- Corrupt rows fall through to the JSON attempt below.

		if ( is_array( $data ) ) {
			return $data;
		}
	}

	$data = json_decode( $content, true );

	return is_array( $data ) ? $data : array();
}

/**
 * The identity a box goes by.
 *
 * @since 0.2.0
 *
 * @param array $box A Meta Box definition.
 * @return string Its id, derived from the title when it never declared one.
 */
function atcf_metabox_box_id( $box ) {
	$id = (string) atcf_arr( $box, 'id', '' );

	return '' !== $id ? $id : sanitize_title( (string) atcf_arr( $box, 'title', 'meta-box' ) );
}

/**
 * The group key a box imports under.
 *
 * Deterministic on purpose: the same box always lands on the same key, which
 * is what makes a second import an update — and what a converted conditional
 * rule relies on when it points at a sibling.
 *
 * @since 0.2.0
 *
 * @param string $box_id The box id.
 * @return string The group key.
 */
function atcf_metabox_group_key( $box_id ) {
	return 'group_mb_' . substr( md5( (string) $box_id ), 0, 13 );
}

/**
 * The field key a Meta Box field imports under.
 *
 * Minted from the box id and the field's path — nesting included, because two
 * groups in one box can each hold a `title`.
 *
 * @since 0.2.0
 *
 * @param string $box_id The box id.
 * @param string $path   The field's id, prefixed by its ancestors' ids.
 * @return string The field key.
 */
function atcf_metabox_field_key( $box_id, $path ) {
	return 'field_mb_' . substr( md5( $box_id . ':' . $path ), 0, 13 );
}

/*
 * Conversion.
 */

/**
 * Converts one Meta Box definition into this plugin's dialect.
 *
 * @since 0.2.0
 *
 * @param array $box A Meta Box runtime definition.
 * @return array `{ group, warnings }` — the group ready for atcf_save_group().
 */
function atcf_convert_metabox( $box ) {
	$warnings = array();
	$box_id   = atcf_metabox_box_id( $box );
	$title    = (string) atcf_arr( $box, 'title', $box_id );
	$context  = (string) atcf_arr( $box, 'context', 'normal' );

	$group = array(
		'key'      => atcf_metabox_group_key( $box_id ),
		'title'    => $title,
		'fields'   => atcf_convert_metabox_fields( (array) atcf_arr( $box, 'fields', array() ), $box_id, '', $warnings ),
		'location' => atcf_convert_metabox_location( $box, $title, $warnings ),
		'settings' => array(
			'description' => '',
			'position'    => 'side' === $context ? 'side' : 'normal',
			'style'       => 'seamless' === (string) atcf_arr( $box, 'style', 'default' ) ? 'seamless' : 'default',
			'menu_order'  => (int) atcf_arr( $box, 'priority_order', 0 ),
		),
	);

	/**
	 * Filters a group converted from Meta Box, before it is saved.
	 *
	 * The place to carry a setting this conversion has no opinion about, or to
	 * veto a box by returning an empty array.
	 *
	 * @since 0.2.0
	 *
	 * @param array $group    The converted group.
	 * @param array $box      The Meta Box original.
	 * @param array $warnings What the conversion could not carry.
	 */
	$group = (array) apply_filters( 'atcf_import_metabox_group', $group, $box, $warnings );

	return array(
		'group'    => $group,
		'warnings' => $warnings,
	);
}

/**
 * How Meta Box type slugs spell themselves here.
 *
 * The special cases — `post`, `group`, cloneables — are decided in
 * {@see atcf_convert_metabox_field()}, because their answer depends on more
 * than the slug.
 *
 * @since 0.2.0
 *
 * @return array<string,string> Meta Box type => this plugin's type.
 */
function atcf_metabox_type_map() {
	/**
	 * Filters the Meta-Box-to-AllTerrain field type map.
	 *
	 * A plugin porting a custom Meta Box field type registers its own slug
	 * here and the importer stops flagging it.
	 *
	 * @since 0.2.0
	 *
	 * @param array<string,string> $map Meta Box type => this plugin's type.
	 */
	return (array) apply_filters(
		'atcf_import_metabox_type_map',
		array(
			'text'              => 'text',
			'textarea'          => 'textarea',
			'number'            => 'number',
			'range'             => 'range',
			'email'             => 'email',
			'url'               => 'url',
			'password'          => 'password',
			'select'            => 'select',
			'select_advanced'   => 'select',
			'radio'             => 'radio',
			'checkbox_list'     => 'checkbox',
			'checkbox'          => 'true_false',
			'switch'            => 'true_false',
			'button_group'      => 'button_group',
			'autocomplete'      => 'select',
			'wysiwyg'           => 'wysiwyg',
			'oembed'            => 'oembed',
			'single_image'      => 'image',
			'image'             => 'gallery',
			'image_advanced'    => 'gallery',
			'image_upload'      => 'gallery',
			'file'              => 'file',
			'file_advanced'     => 'file',
			'file_upload'       => 'file',
			'file_input'        => 'url',
			'date'              => 'date_picker',
			'datetime'          => 'date_time_picker',
			'time'              => 'time_picker',
			'color'             => 'color_picker',
			'map'               => 'location',
			'osm'               => 'location',
			'post'              => 'post_object',
			'taxonomy'          => 'taxonomy',
			'taxonomy_advanced' => 'taxonomy',
			'user'              => 'user',
			'heading'           => 'message',
			'divider'           => 'message',
			'custom_html'       => 'message',
			'key_value'         => 'table',
		)
	);
}

/**
 * Converts a list of Meta Box fields.
 *
 * @since 0.2.0
 *
 * @param array[] $fields   Meta Box fields.
 * @param string  $box_id   The box id, for minting keys.
 * @param string  $path     The ancestors' ids, for minting keys.
 * @param array   $warnings Accumulates what would not convert. Passed by reference.
 * @return array[] Converted fields.
 */
function atcf_convert_metabox_fields( $fields, $box_id, $path, &$warnings ) {
	$out = array();

	foreach ( (array) $fields as $field ) {
		if ( ! is_array( $field ) ) {
			continue;
		}

		$converted = atcf_convert_metabox_field( $field, $box_id, $path, $warnings );

		if ( $converted ) {
			$out[] = $converted;
		}
	}

	return $out;
}

/**
 * Converts one Meta Box field.
 *
 * @since 0.2.0
 *
 * @param array  $mb       A Meta Box field.
 * @param string $box_id   The box id, for minting keys.
 * @param string $path     The ancestors' ids, for minting keys.
 * @param array  $warnings Accumulates what would not convert. Passed by reference.
 * @return array|null The converted field.
 */
function atcf_convert_metabox_field( $mb, $box_id, $path, &$warnings ) {
	$mb_type = (string) atcf_arr( $mb, 'type', 'text' );
	$id      = (string) atcf_arr( $mb, 'id', '' );
	// Meta Box's `name` is the human label; a heading's text is its `name` too.
	$label = (string) atcf_arr( $mb, 'name', $id );

	// Purely presentational rows carry no id and store nothing.
	if ( 'button' === $mb_type ) {
		$warnings[] = sprintf(
			/* translators: %s: field label. */
			__( '“%s” is a button, which is a behaviour rather than a field; it was not imported.', 'allterrain-fields' ),
			$label
		);

		return null;
	}

	if ( '' === $id && ! in_array( $mb_type, array( 'heading', 'divider', 'custom_html' ), true ) ) {
		return null;
	}

	$fieldpath = '' === $path ? ( '' !== $id ? $id : $mb_type ) : $path . '.' . ( '' !== $id ? $id : $mb_type );
	$map       = atcf_metabox_type_map();
	$cloneable = (bool) atcf_arr( $mb, 'clone', false );

	// A group is this plugin's group — unless it repeats, which is a repeater.
	// A cloneable *scalar* becomes a one-column repeater: same shape on
	// screen, honest about being a list underneath.
	if ( 'group' === $mb_type ) {
		$type = $cloneable ? 'repeater' : 'group';
	} elseif ( $cloneable ) {
		$type = 'repeater';
	} elseif ( isset( $map[ $mb_type ] ) ) {
		$type = $map[ $mb_type ];

		if ( 'post' === $mb_type && (bool) atcf_arr( $mb, 'multiple', false ) ) {
			$type = 'relationship';
		}
	} else {
		$warnings[] = sprintf(
			/* translators: 1: field label, 2: Meta Box field type. */
			__( '“%1$s” has type “%2$s”, which has no equivalent here — imported as plain text so its stored value stays reachable.', 'allterrain-fields' ),
			$label,
			$mb_type
		);

		$type = 'text';
	}

	$field = array(
		'key'          => atcf_metabox_field_key( $box_id, $fieldpath ),
		'name'         => $id,
		'label'        => $label,
		'type'         => $type,
		'instructions' => (string) atcf_arr( $mb, 'desc', '' ),
		'required'     => (bool) atcf_arr( $mb, 'required', false ),
		'wrapper'      => array( 'class' => (string) atcf_arr( $mb, 'class', '' ) ),
		'conditional'  => atcf_convert_metabox_conditional( $mb, $box_id, $path, $label, $warnings ),
		'settings'     => atcf_convert_metabox_settings( $type, $mb_type, $mb, $box_id, $fieldpath, $warnings ),
	);

	// The storage layouts part ways here, and silence would be a lie: Meta Box
	// serialises a group or a clone into one meta row, this plugin writes a
	// row per value, and neither reads the other's shape.
	if ( ( $cloneable || 'group' === $mb_type ) && '' !== $id ) {
		$warnings[] = sprintf(
			/* translators: %s: field label. */
			__( '“%s” came across, but its existing values did not: Meta Box stores groups and cloneable fields as one serialised row, which this plugin does not read. Its future values save row-per-value.', 'allterrain-fields' ),
			$label
		);
	}

	if ( in_array( $mb_type, array( 'image', 'image_advanced', 'image_upload' ), true ) ) {
		$warnings[] = sprintf(
			/* translators: %s: field label. */
			__( '“%s” is now a gallery. Meta Box stored each image as its own meta row under one key; re-pick the images once, and they will save in the gallery’s own shape.', 'allterrain-fields' ),
			$label
		);
	}

	if ( 'taxonomy' === $mb_type ) {
		$warnings[] = sprintf(
			/* translators: %s: field label. */
			__( '“%s” assigned terms rather than storing meta, so it was imported with “assign to the object” switched on — behaviour unchanged, and nothing to migrate.', 'allterrain-fields' ),
			$label
		);
	}

	/**
	 * Filters a field converted from Meta Box.
	 *
	 * @since 0.2.0
	 *
	 * @param array $field    The converted field.
	 * @param array $mb       The Meta Box original.
	 * @param array $warnings What the conversion could not carry.
	 */
	return apply_filters( 'atcf_import_metabox_field', $field, $mb, $warnings );
}

/**
 * Converts a field's settings.
 *
 * @since 0.2.0
 *
 * @param string $type      The converted type.
 * @param string $mb_type   The original Meta Box type.
 * @param array  $mb        The whole Meta Box field.
 * @param string $box_id    The box id, for minting sub-field keys.
 * @param string $fieldpath The field's path, for minting sub-field keys.
 * @param array  $warnings  Accumulates what would not convert. Passed by reference.
 * @return array The settings.
 */
function atcf_convert_metabox_settings( $type, $mb_type, $mb, $box_id, $fieldpath, &$warnings ) {
	// Carry what translates by meaning, not by key — Meta Box scatters its
	// settings across enough differently-named keys that a blind passthrough
	// would carry more noise than signal.
	$settings = array(
		'default_value' => atcf_arr( $mb, 'std', '' ),
		'placeholder'   => (string) atcf_arr( $mb, 'placeholder', '' ),
	);

	foreach ( array( 'min', 'max', 'step', 'rows', 'multiple', 'return_format' ) as $shared ) {
		if ( null !== atcf_arr( $mb, $shared, null ) ) {
			$settings[ $shared ] = $mb[ $shared ];
		}
	}

	// Choices: Meta Box's `options` map is this plugin's `choices` — the map
	// form is a native dialect here.
	if ( null !== atcf_arr( $mb, 'options', null ) ) {
		$settings['choices'] = $mb['options'];
	}

	if ( 'true_false' === $type ) {
		$settings['message']       = (string) atcf_arr( $mb, 'desc', '' );
		$settings['default_value'] = (bool) atcf_arr( $mb, 'std', false );
	}

	if ( 'message' === $type ) {
		if ( 'divider' === $mb_type ) {
			$settings['message'] = '<hr />';
		} elseif ( 'custom_html' === $mb_type ) {
			$settings['message'] = (string) atcf_arr( $mb, 'std', '' );
		} else {
			$settings['message'] = '<h3>' . esc_html( (string) atcf_arr( $mb, 'name', '' ) ) . '</h3>';
		}
	}

	if ( in_array( $type, array( 'post_object', 'relationship' ), true ) ) {
		$post_types = atcf_arr( $mb, 'post_type', array() );

		$settings['post_types'] = array_values( array_filter( is_array( $post_types ) ? $post_types : array( $post_types ) ) );
	}

	if ( 'user' === $type ) {
		$query_args        = (array) atcf_arr( $mb, 'query_args', array() );
		$roles             = atcf_arr( $query_args, 'role__in', atcf_arr( $query_args, 'role', array() ) );
		$settings['roles'] = array_values( array_filter( is_array( $roles ) ? $roles : array( $roles ) ) );
	}

	if ( 'taxonomy' === $type ) {
		$taxonomy = atcf_arr( $mb, 'taxonomy', 'category' );

		$settings['taxonomy'] = is_array( $taxonomy ) ? (string) reset( $taxonomy ) : (string) $taxonomy;
		$settings['multiple'] = ! in_array( (string) atcf_arr( $mb, 'field_type', 'select' ), array( 'radio_list', 'select' ), true )
			|| (bool) atcf_arr( $mb, 'multiple', false );

		// `taxonomy` assigns terms to the object; `taxonomy_advanced` stores
		// ids in meta. The first maps onto save+load terms exactly.
		$settings['save_terms'] = 'taxonomy' === $mb_type;
		$settings['load_terms'] = 'taxonomy' === $mb_type;
	}

	if ( 'gallery' === $type && null !== atcf_arr( $mb, 'max_file_uploads', null ) ) {
		$settings['max_items'] = (int) $mb['max_file_uploads'];
	}

	// Containers. A Meta Box group's insides convert with the same machinery;
	// a cloneable scalar becomes a repeater holding one field of its own type.
	if ( 'repeater' === $type || 'group' === $type ) {
		$settings['min_items'] = (int) atcf_arr( $mb, 'min_clone', 0 );
		$settings['max_items'] = (int) atcf_arr( $mb, 'max_clone', 0 );

		if ( 'group' === $mb_type ) {
			$settings['sub_fields'] = atcf_convert_metabox_fields( (array) atcf_arr( $mb, 'fields', array() ), $box_id, $fieldpath, $warnings );
		} else {
			$sub = $mb;

			unset( $sub['clone'], $sub['min_clone'], $sub['max_clone'], $sub['sort_clone'], $sub['visible'], $sub['hidden'] );

			$converted = atcf_convert_metabox_field( $sub, $box_id, $fieldpath, $warnings );

			$settings['sub_fields'] = $converted ? array( $converted ) : array();
		}

		unset( $settings['default_value'], $settings['placeholder'], $settings['multiple'] );
	}

	return $settings;
}

/**
 * Converts Meta Box conditional logic.
 *
 * The Conditional Logic extension writes `visible`/`hidden` as a list of
 * `[ field, operator, value ]` clauses under an `and`/`or` relation. The
 * clauses reference field *ids*; ours reference keys — and because keys are
 * minted deterministically from those same ids, the reference can be rebuilt
 * without the target existing yet. A clause naming something that is not a
 * sibling field — a post format, an input selector — has no meaning here and
 * goes loudly.
 *
 * @since 0.2.0
 *
 * @param array  $mb       The Meta Box field.
 * @param string $box_id   The box id.
 * @param string $path     The ancestors' ids.
 * @param string $label    The field's label, for warnings.
 * @param array  $warnings Accumulates what would not convert. Passed by reference.
 * @return array The conditional block.
 */
function atcf_convert_metabox_conditional( $mb, $box_id, $path, $label, &$warnings ) {
	$action = null;
	$raw    = null;

	if ( is_array( atcf_arr( $mb, 'visible', null ) ) ) {
		$action = 'show';
		$raw    = (array) $mb['visible'];
	} elseif ( is_array( atcf_arr( $mb, 'hidden', null ) ) ) {
		$action = 'hide';
		$raw    = (array) $mb['hidden'];
	}

	if ( null === $raw ) {
		return array();
	}

	// Both spellings the extension accepts: `[ 'when' => [ ...clauses ],
	// 'relation' => 'or' ]`, and a bare clause list — including the shortest
	// form, one clause not even wrapped in a list.
	$relation = strtolower( (string) atcf_arr( $raw, 'relation', 'and' ) );
	$clauses  = is_array( atcf_arr( $raw, 'when', null ) ) ? (array) $raw['when'] : $raw;

	if ( isset( $clauses[0] ) && ! is_array( $clauses[0] ) ) {
		$clauses = array( $clauses );
	}

	$operators = array(
		'='  => '==',
		'==' => '==',
		'!=' => '!=',
		'>'  => '>',
		'<'  => '<',
		'>=' => '>=',
		'<=' => '<=',
		'in' => 'in',
	);

	$rules = array();

	foreach ( $clauses as $clause ) {
		if ( ! is_array( $clause ) ) {
			continue;
		}

		$target   = (string) atcf_arr( $clause, 0, '' );
		$operator = count( $clause ) >= 3 ? strtolower( (string) $clause[1] ) : '=';
		$value    = count( $clause ) >= 3 ? $clause[2] : atcf_arr( $clause, 1, '' );

		if ( '' === $target || ! preg_match( '/^[a-z0-9_]+$/i', $target ) ) {
			$warnings[] = sprintf(
				/* translators: 1: field label, 2: what the rule referenced. */
				__( '“%1$s” had a visibility rule on “%2$s”, which is not a sibling field; that rule was dropped.', 'allterrain-fields' ),
				$label,
				$target
			);

			continue;
		}

		if ( ! isset( $operators[ $operator ] ) ) {
			$warnings[] = sprintf(
				/* translators: 1: field label, 2: the operator. */
				__( '“%1$s” had a visibility rule using “%2$s”, which has no equivalent here; that rule was dropped.', 'allterrain-fields' ),
				$label,
				$operator
			);

			continue;
		}

		$rules[] = array(
			'field'    => atcf_metabox_field_key( $box_id, '' === $path ? $target : $path . '.' . $target ),
			'operator' => $operators[ $operator ],
			'value'    => is_scalar( $value ) || is_array( $value ) ? $value : '',
		);
	}

	if ( ! $rules ) {
		return array();
	}

	return array(
		'enabled' => true,
		'action'  => $action,
		'match'   => 'or' === $relation ? 'any' : 'all',
		'rules'   => $rules,
	);
}

/**
 * Converts a box's placement into location rules.
 *
 * Meta Box places a box with settings — an object type and some lists — and
 * this plugin places a group with rules. Same facts, different grammar.
 *
 * @since 0.2.0
 *
 * @param array  $box      The Meta Box definition.
 * @param string $title    The box title, for warnings.
 * @param array  $warnings Accumulates what would not convert. Passed by reference.
 * @return array[][] Location rules.
 */
function atcf_convert_metabox_location( $box, $title, &$warnings ) {
	$object_type = (string) atcf_arr( $box, 'object_type', 'post' );
	$location    = array();

	if ( 'term' === $object_type ) {
		$taxonomies = atcf_arr( $box, 'taxonomies', atcf_arr( $box, 'taxonomy', array() ) );

		foreach ( (array) ( is_array( $taxonomies ) ? $taxonomies : array( $taxonomies ) ) as $taxonomy ) {
			if ( '' !== (string) $taxonomy ) {
				$location[] = array(
					array(
						'param'    => 'taxonomy',
						'operator' => '==',
						'value'    => (string) $taxonomy,
					),
				);
			}
		}

		return $location;
	}

	if ( 'user' === $object_type ) {
		return array(
			array(
				array(
					'param'    => 'user_form',
					'operator' => '==',
					'value'    => 'all',
				),
			),
		);
	}

	if ( 'setting' === $object_type ) {
		$pages = (array) atcf_arr( $box, 'settings_pages', array() );

		foreach ( $pages as $page ) {
			$location[] = array(
				array(
					'param'    => 'options_page',
					'operator' => '==',
					'value'    => (string) $page,
				),
			);
		}

		$warnings[] = sprintf(
			/* translators: %s: box title. */
			__( '“%s” lived on a Meta Box settings page. Its location points at an options page of the same slug — create that options page here for the fields to appear.', 'allterrain-fields' ),
			$title
		);

		return $location;
	}

	$post_types = atcf_arr( $box, 'post_types', atcf_arr( $box, 'pages', array( 'post' ) ) );

	foreach ( (array) ( is_array( $post_types ) ? $post_types : array( $post_types ) ) as $post_type ) {
		if ( '' !== (string) $post_type ) {
			$location[] = array(
				array(
					'param'    => 'post_type',
					'operator' => '==',
					'value'    => (string) $post_type,
				),
			);
		}
	}

	return $location;
}
