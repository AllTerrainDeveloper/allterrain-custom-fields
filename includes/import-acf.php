<?php
/**
 * Importing from Advanced Custom Fields.
 *
 * The storage convention is already ACF's — `hero_title` next to a
 * `_hero_title` holding the field key, repeater rows as `team_0_name` — so a
 * site migrating in never touches its values. The only thing standing between
 * an ACF site and this plugin is the *schema*, and that is what this file
 * moves: field groups, from any of the three places ACF keeps them.
 *
 *   - **A JSON export.** The file ACF's own Tools screen produces. Most of it
 *     is this plugin's own dialect already; the rest is a rename here and a
 *     reshaped list there, all catalogued below.
 *   - **The database.** ACF stores groups as `acf-field-group` posts with one
 *     `acf-field` post per field. Those rows survive ACF being deactivated or
 *     deleted, which is exactly the state a migrating site is in — so the
 *     import reads them directly and needs ACF for nothing.
 *   - **The running plugin.** With ACF still active, whatever
 *     `acf_get_field_groups()` reports — including groups registered from PHP
 *     and local JSON — can be pulled across in one step.
 *
 * Everything lands in {@see atcf_save_group()}, matched on the group key, so
 * importing twice updates rather than duplicates — same contract as the native
 * import. And because keys and names come across verbatim, `get_field()`
 * finds every value the site already has.
 *
 * What does not survive is reported, not swallowed: every conversion returns
 * its warnings, and the response lists them per group. An import that quietly
 * dropped half a conditional is worse than one that says so.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', 'atcf_register_acf_import_routes' );

/**
 * Registers the ACF import routes.
 *
 * @since 0.2.0
 *
 * @return void
 */
function atcf_register_acf_import_routes() {
	register_rest_route(
		ATCF_REST_NAMESPACE,
		'/import/acf',
		array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'atcf_rest_acf_sources',
				'permission_callback' => 'atcf_rest_can_manage',
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => 'atcf_rest_acf_import',
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
 * @return WP_REST_Response Detected sources and the groups each one holds.
 */
function atcf_rest_acf_sources() {
	$groups = atcf_acf_detected_groups();
	$list   = array();

	foreach ( $groups as $group ) {
		$list[] = array(
			'key'    => (string) atcf_arr( $group, 'key', '' ),
			'title'  => (string) atcf_arr( $group, 'title', '' ),
			'fields' => count( (array) atcf_arr( $group, 'fields', array() ) ),
			'source' => (string) atcf_arr( $group, '_atcf_source', 'database' ),
			'exists' => atcf_group_post_by_key( (string) atcf_arr( $group, 'key', '' ) ) > 0,
		);
	}

	return rest_ensure_response(
		array(
			'active'   => function_exists( 'acf_get_field_groups' ),
			'database' => count(
				get_posts(
					array(
						'post_type'        => 'acf-field-group',
						'post_status'      => array( 'publish', 'acf-disabled' ),
						'numberposts'      => -1,
						'fields'           => 'ids',
						'suppress_filters' => false,
					)
				)
			),
			'groups'   => $list,
		)
	);
}

/**
 * Imports ACF groups.
 *
 * Two shapes of request, one behaviour. A body carrying `groups` is a pasted
 * ACF export and those groups are converted as given. A body carrying `keys`
 * imports that subset of whatever {@see atcf_acf_detected_groups()} found on
 * the site itself; an empty body imports all of it.
 *
 * @since 0.2.0
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error What was imported, with the warnings.
 */
function atcf_rest_acf_import( $request ) {
	$payload = (array) $request->get_json_params();
	$raw     = (array) atcf_arr( $payload, 'groups', array() );

	if ( ! $raw ) {
		$keys = array_filter( array_map( 'atcf_sanitize_field_key', (array) atcf_arr( $payload, 'keys', array() ) ) );
		$raw  = atcf_acf_detected_groups();

		if ( $keys ) {
			$raw = array_values(
				array_filter(
					$raw,
					static function ( $group ) use ( $keys ) {
						return in_array( (string) atcf_arr( $group, 'key', '' ), $keys, true );
					}
				)
			);
		}
	}

	if ( ! $raw ) {
		return new WP_Error(
			'atcf_nothing_to_import',
			__( 'No ACF field groups were given, and none were found on this site.', 'allterrain-fields' ),
			array( 'status' => 400 )
		);
	}

	$results = array();

	foreach ( $raw as $acf_group ) {
		if ( ! is_array( $acf_group ) ) {
			continue;
		}

		$converted = atcf_convert_acf_group( $acf_group );
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
 * Finding groups on the site.
 */

/**
 * Every ACF group this site holds, as raw ACF-shaped arrays.
 *
 * The running plugin is asked first because its answer includes groups
 * registered from PHP and local JSON, which the database never sees. The
 * database rows are then merged in for anything the plugin did not report —
 * or everything, on the usual migrating site where ACF is already gone.
 *
 * @since 0.2.0
 *
 * @return array[] ACF-shaped groups, each tagged with an `_atcf_source`.
 */
function atcf_acf_detected_groups() {
	$groups = array();
	$seen   = array();

	if ( function_exists( 'acf_get_field_groups' ) && function_exists( 'acf_get_fields' ) ) {
		foreach ( (array) acf_get_field_groups() as $group ) {
			if ( ! is_array( $group ) || '' === (string) atcf_arr( $group, 'key', '' ) ) {
				continue;
			}

			$group['fields']       = (array) acf_get_fields( $group['key'] );
			$group['_atcf_source'] = 'plugin';

			$groups[] = $group;
			$seen[]   = (string) $group['key'];
		}
	}

	foreach ( atcf_acf_groups_from_database() as $group ) {
		if ( in_array( (string) atcf_arr( $group, 'key', '' ), $seen, true ) ) {
			continue;
		}

		$group['_atcf_source'] = 'database';

		$groups[] = $group;
	}

	return $groups;
}

/**
 * Reads ACF's groups straight out of the posts table.
 *
 * ACF keeps a group as an `acf-field-group` post whose `post_content` is a
 * serialized settings array, and each field as an `acf-field` post parented to
 * the group — or to another field, which is how repeaters and flexible
 * layouts nest. All of it survives ACF's deactivation, which is the whole
 * point: the one moment a site wants this import is the moment ACF is gone.
 *
 * @since 0.2.0
 *
 * @return array[] ACF-shaped groups.
 */
function atcf_acf_groups_from_database() {
	$group_posts = get_posts(
		array(
			'post_type'        => 'acf-field-group',
			'post_status'      => array( 'publish', 'acf-disabled' ),
			'numberposts'      => -1,
			'orderby'          => 'menu_order title',
			'order'            => 'ASC',
			'suppress_filters' => false,
		)
	);

	if ( ! $group_posts ) {
		return array();
	}

	$field_posts = get_posts(
		array(
			'post_type'        => 'acf-field',
			'post_status'      => 'publish',
			'numberposts'      => -1,
			'orderby'          => 'menu_order',
			'order'            => 'ASC',
			'suppress_filters' => false,
		)
	);

	$children = array();

	foreach ( $field_posts as $post ) {
		$children[ (int) $post->post_parent ][] = $post;
	}

	$groups = array();

	foreach ( $group_posts as $post ) {
		$settings = atcf_acf_unpack( $post->post_content );

		$group = array_merge(
			$settings,
			array(
				'key'    => $post->post_name,
				'title'  => $post->post_title,
				'active' => 'acf-disabled' !== $post->post_status && (bool) atcf_arr( $settings, 'active', true ),
				'fields' => atcf_acf_fields_from_posts( (int) $post->ID, $children ),
			)
		);

		$groups[] = $group;
	}

	return $groups;
}

/**
 * Rebuilds a field list from `acf-field` posts, recursively.
 *
 * @since 0.2.0
 *
 * @param int     $parent   Post id of the group or parent field.
 * @param array[] $children Field posts grouped by post_parent.
 * @return array[] ACF-shaped fields.
 */
function atcf_acf_fields_from_posts( $parent, $children ) {
	$fields = array();

	foreach ( (array) atcf_arr( $children, $parent, array() ) as $post ) {
		$settings = atcf_acf_unpack( $post->post_content );

		$field = array_merge(
			$settings,
			array(
				'key'   => $post->post_name,
				'name'  => $post->post_excerpt,
				'label' => $post->post_title,
			)
		);

		$type = (string) atcf_arr( $field, 'type', 'text' );
		$subs = atcf_acf_fields_from_posts( (int) $post->ID, $children );

		if ( $subs && 'flexible_content' === $type ) {
			// A flexible field's children all hang off the field post; each one
			// names its layout in `parent_layout`, keyed by the layout's key.
			$layouts = array();

			foreach ( (array) atcf_arr( $field, 'layouts', array() ) as $layout ) {
				$layout               = (array) $layout;
				$layout_key           = (string) atcf_arr( $layout, 'key', '' );
				$layout['sub_fields'] = array_values(
					array_filter(
						$subs,
						static function ( $sub ) use ( $layout_key ) {
							return (string) atcf_arr( $sub, 'parent_layout', '' ) === $layout_key;
						}
					)
				);

				$layouts[] = $layout;
			}

			$field['layouts'] = $layouts;
		} elseif ( $subs ) {
			$field['sub_fields'] = $subs;
		}

		$fields[] = $field;
	}

	return $fields;
}

/**
 * Unpacks the settings blob an ACF post carries.
 *
 * Serialized PHP from every ACF this decade, with a JSON fallback because a
 * blob that has been through an importer or a search-replace tool sometimes
 * comes back that way. Never objects: a group's settings are arrays all the
 * way down, so anything else in the stream is refused wholesale.
 *
 * @since 0.2.0
 *
 * @param string $content The post_content.
 * @return array The settings.
 */
function atcf_acf_unpack( $content ) {
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

/*
 * Conversion.
 */

/**
 * Converts one ACF group into this plugin's dialect.
 *
 * @since 0.2.0
 *
 * @param array $acf An ACF-shaped group.
 * @return array `{ group, warnings }` — the group ready for atcf_save_group().
 */
function atcf_convert_acf_group( $acf ) {
	$warnings = array();
	$title    = (string) atcf_arr( $acf, 'title', __( 'Imported from ACF', 'allterrain-fields' ) );

	$position = (string) atcf_arr( $acf, 'position', 'normal' );
	$position = 'acf_after_title' === $position ? 'after_title' : $position;

	$group = array(
		'key'      => (string) atcf_arr( $acf, 'key', '' ),
		'title'    => $title,
		'fields'   => atcf_convert_acf_fields( (array) atcf_arr( $acf, 'fields', array() ), $warnings ),
		'location' => atcf_convert_acf_location( (array) atcf_arr( $acf, 'location', array() ), $title, $warnings ),
		'settings' => array(
			'active'                => (bool) atcf_arr( $acf, 'active', true ),
			'description'           => (string) atcf_arr( $acf, 'description', '' ),
			'position'              => $position,
			'style'                 => (string) atcf_arr( $acf, 'style', 'default' ),
			'label_placement'       => (string) atcf_arr( $acf, 'label_placement', 'top' ),
			'instruction_placement' => (string) atcf_arr( $acf, 'instruction_placement', 'label' ),
			'menu_order'            => (int) atcf_arr( $acf, 'menu_order', 0 ),
			'hide_on_screen'        => (array) atcf_arr( $acf, 'hide_on_screen', array() ),
			'show_in_rest'          => (bool) atcf_arr( $acf, 'show_in_rest', true ),
		),
	);

	/**
	 * Filters a group converted from ACF, before it is saved.
	 *
	 * The place to carry a setting this conversion has no opinion about, or to
	 * veto a group by returning an empty array.
	 *
	 * @since 0.2.0
	 *
	 * @param array $group    The converted group.
	 * @param array $acf      The ACF original.
	 * @param array $warnings What the conversion could not carry.
	 */
	$group = (array) apply_filters( 'atcf_import_acf_group', $group, $acf, $warnings );

	return array(
		'group'    => $group,
		'warnings' => $warnings,
	);
}

/**
 * How ACF type slugs spell themselves here.
 *
 * Almost all of them are identical — that was a founding decision, not a
 * coincidence — so this map only holds the strays.
 *
 * @since 0.2.0
 *
 * @return array<string,string> ACF type => this plugin's type.
 */
function atcf_acf_type_map() {
	/**
	 * Filters the ACF-to-AllTerrain field type map.
	 *
	 * A plugin porting a custom ACF field type registers its own slug here and
	 * the importer stops flagging it.
	 *
	 * @since 0.2.0
	 *
	 * @param array<string,string> $map ACF type => this plugin's type.
	 */
	return (array) apply_filters(
		'atcf_import_acf_type_map',
		array(
			'google_map'  => 'location',
			'icon_picker' => 'icon',
		)
	);
}

/**
 * Converts a list of ACF fields.
 *
 * @since 0.2.0
 *
 * @param array[] $fields   ACF-shaped fields.
 * @param array   $warnings Accumulates what would not convert. Passed by reference.
 * @return array[] Converted fields.
 */
function atcf_convert_acf_fields( $fields, &$warnings ) {
	$out = array();

	foreach ( (array) $fields as $field ) {
		if ( ! is_array( $field ) ) {
			continue;
		}

		$converted = atcf_convert_acf_field( $field, $warnings );

		if ( $converted ) {
			$out[] = $converted;
		}
	}

	return $out;
}

/**
 * Converts one ACF field.
 *
 * @since 0.2.0
 *
 * @param array $acf      An ACF-shaped field.
 * @param array $warnings Accumulates what would not convert. Passed by reference.
 * @return array|null The converted field.
 */
function atcf_convert_acf_field( $acf, &$warnings ) {
	$acf_type = (string) atcf_arr( $acf, 'type', 'text' );
	$map      = atcf_acf_type_map();
	$type     = isset( $map[ $acf_type ] ) ? $map[ $acf_type ] : $acf_type;
	$label    = (string) atcf_arr( $acf, 'label', (string) atcf_arr( $acf, 'name', '' ) );

	if ( ! atcf_get_field_type( $type ) ) {
		$warnings[] = sprintf(
			/* translators: 1: field label, 2: ACF field type. */
			__( '“%1$s” has type “%2$s”, which has no equivalent here — imported as plain text so its stored value stays reachable.', 'allterrain-fields' ),
			$label,
			$acf_type
		);

		$type = 'text';
	}

	$field = array(
		'key'          => (string) atcf_arr( $acf, 'key', '' ),
		'name'         => (string) atcf_arr( $acf, 'name', '' ),
		'label'        => $label,
		'type'         => $type,
		'instructions' => (string) atcf_arr( $acf, 'instructions', '' ),
		'required'     => (bool) atcf_arr( $acf, 'required', false ),
		'wrapper'      => (array) atcf_arr( $acf, 'wrapper', array() ),
		'conditional'  => atcf_convert_acf_conditional( atcf_arr( $acf, 'conditional_logic', array() ), $label, $warnings ),
		'settings'     => atcf_convert_acf_settings( $type, $acf, $warnings ),
	);

	/**
	 * Filters a field converted from ACF.
	 *
	 * @since 0.2.0
	 *
	 * @param array $field    The converted field.
	 * @param array $acf      The ACF original.
	 * @param array $warnings What the conversion could not carry.
	 */
	return apply_filters( 'atcf_import_acf_field', $field, $acf, $warnings );
}

/**
 * Converts a field's settings.
 *
 * Strategy: carry everything, then rename the handful of keys the two dialects
 * spell differently. A setting this plugin never reads is inert in the schema
 * blob, which is a far better failure mode than a dropped one — and it is
 * still there for a filter to pick up.
 *
 * @since 0.2.0
 *
 * @param string $type     The converted field type.
 * @param array  $acf      The whole ACF field.
 * @param array  $warnings Accumulates what would not convert. Passed by reference.
 * @return array The settings.
 */
function atcf_convert_acf_settings( $type, $acf, &$warnings ) {
	// Everything except the structural keys the field itself carries.
	$settings = array_diff_key(
		(array) $acf,
		array_flip(
			array(
				'key',
				'name',
				'label',
				'type',
				'instructions',
				'required',
				'wrapper',
				'conditional_logic',
				'parent',
				'parent_layout',
				'menu_order',
				'id',
				'prefix',
				'value',
				'_name',
				'_valid',
				'_prepare',
				'aria-label',
			)
		)
	);

	$label = (string) atcf_arr( $acf, 'label', '' );

	// The universal renames: ACF says min/max, this plugin says
	// min_items/max_items for the types where the count is of *things*.
	if ( in_array( $type, array( 'repeater', 'flexible_content', 'relationship', 'gallery' ), true ) ) {
		$settings['min_items'] = (int) atcf_arr( $settings, 'min', 0 );
		$settings['max_items'] = (int) atcf_arr( $settings, 'max', 0 );

		unset( $settings['min'], $settings['max'] );
	}

	// Relational fields: `post_type` is a list called `post_types` here.
	if ( in_array( $type, array( 'post_object', 'relationship', 'page_link' ), true ) ) {
		$settings['post_types'] = array_values( array_filter( (array) atcf_arr( $settings, 'post_type', array() ) ) );

		unset( $settings['post_type'] );

		// ACF's term filter speaks `taxonomy:term`; this plugin's filter is a
		// whole taxonomy. Narrower than what was asked is a silent surprise,
		// so it is dropped loudly instead.
		if ( ! empty( $settings['taxonomy'] ) ) {
			$warnings[] = sprintf(
				/* translators: %s: field label. */
				__( '“%s” filtered its posts by term; that filter has no equivalent here and was not carried across.', 'allterrain-fields' ),
				$label
			);

			unset( $settings['taxonomy'] );
		}
	}

	if ( 'user' === $type ) {
		$settings['roles'] = array_values( array_filter( (array) atcf_arr( $settings, 'role', array() ) ) );

		unset( $settings['role'] );
	}

	if ( 'taxonomy' === $type ) {
		$field_type           = (string) atcf_arr( $settings, 'field_type', 'checkbox' );
		$settings['multiple'] = in_array( $field_type, array( 'checkbox', 'multi_select' ), true );

		unset( $settings['field_type'] );
	}

	if ( 'clone' === $type ) {
		$settings['clone_source'] = array_values( array_filter( (array) atcf_arr( $settings, 'clone', array() ) ) );

		unset( $settings['clone'] );
	}

	// Containers convert their insides with the same machinery.
	if ( 'repeater' === $type || 'group' === $type ) {
		$settings['sub_fields'] = atcf_convert_acf_fields( (array) atcf_arr( $settings, 'sub_fields', array() ), $warnings );
	}

	if ( 'flexible_content' === $type ) {
		$layouts = array();

		// ACF keeps layouts as a map keyed by layout key; this plugin keeps a
		// list. Same rows either way.
		foreach ( (array) atcf_arr( $settings, 'layouts', array() ) as $layout ) {
			if ( ! is_array( $layout ) ) {
				continue;
			}

			$layout['sub_fields'] = atcf_convert_acf_fields( (array) atcf_arr( $layout, 'sub_fields', array() ), $warnings );

			$layouts[] = $layout;
		}

		$settings['layouts'] = $layouts;
	}

	return $settings;
}

/**
 * Converts ACF conditional logic.
 *
 * ACF writes an OR of ANDs; this plugin's engine evaluates one list of rules
 * under a single `all`/`any`. The shapes that translate exactly — one group,
 * or many groups of one rule each — come across exactly. The genuinely mixed
 * shape cannot be said in this grammar, so the first group is kept and the
 * loss is reported rather than silently approximated.
 *
 * @since 0.2.0
 *
 * @param mixed  $logic    ACF's conditional_logic value.
 * @param string $label    The field's label, for the warning.
 * @param array  $warnings Accumulates what would not convert. Passed by reference.
 * @return array The conditional block.
 */
function atcf_convert_acf_conditional( $logic, $label, &$warnings ) {
	if ( ! is_array( $logic ) || ! $logic ) {
		return array();
	}

	$groups = array();

	foreach ( $logic as $group ) {
		$rules = array();

		foreach ( (array) $group as $rule ) {
			if ( ! is_array( $rule ) || '' === (string) atcf_arr( $rule, 'field', '' ) ) {
				continue;
			}

			// The operator comes across as ACF spells it — the logic engine's
			// own normaliser speaks that dialect already.
			$rules[] = array(
				'field'    => (string) $rule['field'],
				'operator' => (string) atcf_arr( $rule, 'operator', '==' ),
				'value'    => atcf_arr( $rule, 'value', '' ),
			);
		}

		if ( $rules ) {
			$groups[] = $rules;
		}
	}

	if ( ! $groups ) {
		return array();
	}

	if ( 1 === count( $groups ) ) {
		return array(
			'enabled' => true,
			'match'   => 'all',
			'rules'   => $groups[0],
		);
	}

	$singles = array_filter( $groups, static fn( $rules ) => 1 === count( $rules ) );

	if ( count( $singles ) === count( $groups ) ) {
		return array(
			'enabled' => true,
			'match'   => 'any',
			'rules'   => array_merge( ...$groups ),
		);
	}

	$warnings[] = sprintf(
		/* translators: %s: field label. */
		__( '“%s” had conditional logic mixing AND and OR; only its first rule group was carried across.', 'allterrain-fields' ),
		$label
	);

	return array(
		'enabled' => true,
		'match'   => 'all',
		'rules'   => $groups[0],
	);
}

/**
 * Converts a group's location rules.
 *
 * The grammar is shared — an OR of ANDs over `param`/`operator`/`value` — and
 * most parameters are spelled identically. The two renames are applied, and a
 * parameter with no equivalent takes its whole rule out, loudly: a rule that
 * stayed but never matched would pin the group to nowhere.
 *
 * @since 0.2.0
 *
 * @param array  $location ACF location rules.
 * @param string $title    The group's title, for warnings.
 * @param array  $warnings Accumulates what would not convert. Passed by reference.
 * @return array[][] Converted rules.
 */
function atcf_convert_acf_location( $location, $title, &$warnings ) {
	$renames   = array(
		'page_template' => 'post_template',
		'post_category' => 'post_taxonomy',
		'page'          => 'post',
	);
	$supported = array(
		'post_type',
		'post_template',
		'post_status',
		'post_format',
		'post_taxonomy',
		'post',
		'page_type',
		'page_parent',
		'taxonomy',
		'term',
		'user_form',
		'user_role',
		'options_page',
		'attachment',
		'comment',
		'block',
	);

	$out = array();

	foreach ( (array) $location as $group ) {
		$rules = array();

		foreach ( (array) $group as $rule ) {
			if ( ! is_array( $rule ) ) {
				continue;
			}

			$param = (string) atcf_arr( $rule, 'param', '' );
			$param = isset( $renames[ $param ] ) ? $renames[ $param ] : $param;

			if ( ! in_array( $param, $supported, true ) ) {
				$warnings[] = sprintf(
					/* translators: 1: group title, 2: location parameter. */
					__( '“%1$s” had a location rule on “%2$s”, which does not exist here; that rule was dropped.', 'allterrain-fields' ),
					$title,
					(string) atcf_arr( $rule, 'param', '' )
				);

				continue;
			}

			$rules[] = array(
				'param'    => $param,
				'operator' => (string) atcf_arr( $rule, 'operator', '==' ),
				'value'    => atcf_arr( $rule, 'value', '' ),
			);
		}

		if ( $rules ) {
			$out[] = $rules;
		}
	}

	return $out;
}
