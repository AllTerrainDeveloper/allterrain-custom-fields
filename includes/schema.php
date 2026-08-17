<?php
/**
 * The schema.
 *
 * One function decides what a field group *is* — `atcf_normalize_group()` — and
 * everything else in the plugin is allowed to assume the shape it produces. That
 * is the whole contract: the builder posts whatever it likes, an import brings
 * whatever another plugin wrote five years ago, a `atcf_register_field_group()` call from
 * another plugin brings a hand-written array, and all three arrive at the same
 * structure with every key present and correctly typed.
 *
 * The alternative — every consumer defending itself with `isset()` — is how a
 * plugin ends up with forty subtly different opinions about whether `required`
 * can be the string `"0"`.
 *
 * Two identifiers, and the difference matters:
 *
 *   - **key** (`field_a1b2c3`) never changes. Conditional logic, clones,
 *     bidirectional mirrors and the JSON sync all join on it.
 *   - **name** (`hero_title`) is the meta key, and it changes whenever somebody
 *     renames a field. Only the store cares about it.
 *
 * Joining on the name is the mistake that makes renaming a field destroy its
 * conditional logic, and it is the mistake every rewrite of this makes once.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * The schema version this build writes.
 *
 * Bumped when a stored shape changes in a way a reader has to know about.
 * Everything read is upgraded on the way through {@see atcf_normalize_group()},
 * so nothing on disk ever has to be migrated in place.
 *
 * @since 0.1.0
 */
const ATCF_SCHEMA_VERSION = 1;

/**
 * Normalises a field group into the canonical shape.
 *
 * @since 0.1.0
 *
 * @param array $group Raw group, from anywhere.
 * @return array The canonical group.
 */
function atcf_normalize_group( $group ) {
	$group = is_array( $group ) ? $group : array();

	$key = atcf_sanitize_field_key( (string) atcf_arr( $group, 'key', '' ) );

	if ( '' === $key ) {
		$key = atcf_new_group_key();
	}

	$fields = array();
	$seen   = array();

	foreach ( (array) atcf_arr( $group, 'fields', array() ) as $field ) {
		$normalized = atcf_normalize_field( $field, $seen );

		if ( $normalized ) {
			$seen[]   = $normalized['name'];
			$fields[] = $normalized;
		}
	}

	$normalized = array(
		'version'  => ATCF_SCHEMA_VERSION,
		'key'      => $key,
		'title'    => sanitize_text_field( (string) atcf_arr( $group, 'title', __( 'Untitled group', 'allterrain-fields' ) ) ),
		'fields'   => $fields,
		'location' => atcf_normalize_location_rules( atcf_arr( $group, 'location', array() ) ),
		'settings' => atcf_normalize_group_settings( atcf_arr( $group, 'settings', array() ) ),
	);

	/**
	 * Filters a normalised field group.
	 *
	 * The last word on what a group is. Runs on every read and every write, so a
	 * filter here reaches groups that were stored before it existed — which is
	 * what makes it usable for adding a field to somebody else's group without
	 * editing their JSON.
	 *
	 * @since 0.1.0
	 *
	 * @param array $normalized The canonical group.
	 * @param array $group      What arrived.
	 */
	return (array) apply_filters( 'atcf_normalize_group', $normalized, $group );
}

/**
 * Normalises a field group's settings.
 *
 * @since 0.1.0
 *
 * @param mixed $settings Raw settings.
 * @return array The canonical settings.
 */
function atcf_normalize_group_settings( $settings ) {
	$settings = is_array( $settings ) ? $settings : array();

	$positions = array( 'normal', 'side', 'after_title' );
	$position  = (string) atcf_arr( $settings, 'position', 'normal' );

	return array(
		'active'                => (bool) atcf_arr( $settings, 'active', true ),
		'description'           => sanitize_text_field( (string) atcf_arr( $settings, 'description', '' ) ),
		'position'              => in_array( $position, $positions, true ) ? $position : 'normal',
		'style'                 => 'seamless' === (string) atcf_arr( $settings, 'style', 'default' ) ? 'seamless' : 'default',
		'label_placement'       => 'left' === (string) atcf_arr( $settings, 'label_placement', 'top' ) ? 'left' : 'top',
		'instruction_placement' => 'field' === (string) atcf_arr( $settings, 'instruction_placement', 'label' ) ? 'field' : 'label',
		'menu_order'            => (int) atcf_arr( $settings, 'menu_order', 0 ),
		'hide_on_screen'        => array_values( array_filter( array_map( 'sanitize_key', (array) atcf_arr( $settings, 'hide_on_screen', array() ) ) ) ),
		'show_in_rest'          => (bool) atcf_arr( $settings, 'show_in_rest', true ),
		'block'                 => atcf_normalize_block_settings( atcf_arr( $settings, 'block', array() ) ),
		'frontend'              => atcf_normalize_frontend_settings( atcf_arr( $settings, 'frontend', array() ) ),
	);
}

/**
 * Normalises the front-end display settings a group can carry.
 *
 * The zero-code display: switch it on and the group renders on the post's own
 * page, no template edit, no block, no shortcode. The competition either does
 * not have this or sells it — a repeater is a list, and a list is not worth
 * an upsell here either.
 *
 * @since 0.2.0
 *
 * @param mixed $frontend Raw settings.
 * @return array The canonical settings.
 */
function atcf_normalize_frontend_settings( $frontend ) {
	$frontend = is_array( $frontend ) ? $frontend : array();

	return array(
		'enabled'   => (bool) atcf_arr( $frontend, 'enabled', false ),
		'placement' => 'before' === (string) atcf_arr( $frontend, 'placement', 'after' ) ? 'before' : 'after',
		'heading'   => (bool) atcf_arr( $frontend, 'heading', true ),
	);
}

/**
 * Normalises the block settings a group can carry.
 *
 * A field group that ticks this box becomes a Gutenberg block whose attributes
 * are its fields. It is the feature that was sold as the reason to buy the pro
 * tier, and it is about sixty lines of `register_block_type()`.
 *
 * @since 0.1.0
 *
 * @param mixed $block Raw block settings.
 * @return array The canonical block settings.
 */
function atcf_normalize_block_settings( $block ) {
	$block = is_array( $block ) ? $block : array();
	$name  = sanitize_key( (string) atcf_arr( $block, 'name', '' ) );

	return array(
		'enabled'     => (bool) atcf_arr( $block, 'enabled', false ),
		'name'        => $name,
		'title'       => sanitize_text_field( (string) atcf_arr( $block, 'title', '' ) ),
		'description' => sanitize_text_field( (string) atcf_arr( $block, 'description', '' ) ),
		'icon'        => sanitize_html_class( (string) atcf_arr( $block, 'icon', 'block-default' ) ),
		'category'    => sanitize_key( (string) atcf_arr( $block, 'category', 'widgets' ) ),
		'keywords'    => array_values( array_filter( array_map( 'sanitize_text_field', (array) atcf_arr( $block, 'keywords', array() ) ) ) ),
		'template'    => (string) atcf_arr( $block, 'template', '' ),
		'align'       => sanitize_key( (string) atcf_arr( $block, 'align', '' ) ),
	);
}

/**
 * Normalises one field, recursively.
 *
 * @since 0.1.0
 *
 * @param mixed    $field Raw field.
 * @param string[] $taken Names already used by siblings, so a duplicate can be
 *                        renamed rather than silently overwriting its twin's
 *                        values on every save.
 * @return array|null The canonical field, or null when there is nothing usable.
 */
function atcf_normalize_field( $field, $taken = array() ) {
	$field = is_array( $field ) ? $field : array();
	$type  = atcf_sanitize_field_name( (string) atcf_arr( $field, 'type', 'text' ) );

	if ( '' === $type ) {
		$type = 'text';
	}

	$key = atcf_sanitize_field_key( (string) atcf_arr( $field, 'key', '' ) );

	if ( '' === $key ) {
		$key = atcf_new_field_key();
	}

	$label = sanitize_text_field( (string) atcf_arr( $field, 'label', '' ) );
	$name  = atcf_sanitize_field_name( (string) atcf_arr( $field, 'name', '' ) );

	if ( '' === $name ) {
		// Derived from the label, which is what somebody typing "Hero title"
		// expects to find in `get_post_meta()`. A field with neither is given
		// its key, so it still has a stable place to store a value rather than
		// writing to the empty-string meta key.
		$name = atcf_sanitize_field_name( $label );
		$name = '' === $name ? $key : $name;
	}

	if ( atcf_is_reserved_field_name( $name ) ) {
		// The key is always a safe meta key, and a refused name falling back to
		// it keeps the field working instead of silently writing into a row
		// WordPress reads roles and sessions out of.
		$name = $key;
	}

	$name = atcf_unique_field_name( $name, $taken );

	$definition = atcf_get_field_type( $type );
	$defaults   = $definition ? (array) $definition['settings'] : array();
	$settings   = array_merge( $defaults, (array) atcf_arr( $field, 'settings', array() ) );

	// The one setting that is HTML by design. Everything else is escaped where
	// it is printed; this one is printed *as* markup, so it is capped at the
	// `wp_kses_post()` ceiling before it is ever stored.
	if ( isset( $settings['message'] ) && is_string( $settings['message'] ) ) {
		$settings['message'] = wp_kses_post( $settings['message'] );
	}

	// Sub-fields are normalised with their *own* name scope. Two repeaters may
	// each hold a `title`, because the stored keys are `team_0_title` and
	// `links_0_title` — deduplicating them against the outer scope would rename
	// one of them for no reason and orphan its values.
	if ( atcf_type_has_sub_fields( $type ) ) {
		$settings = atcf_normalize_container_settings( $type, $settings );
	}

	$normalized = array(
		'key'          => $key,
		'name'         => $name,
		'label'        => '' === $label ? $name : $label,
		'type'         => $type,
		// `wp_kses_post()` on the way in as well as on the way out. The render
		// path escapes too, but a schema is exported, imported and shipped to
		// the client as JSON, and defense-in-depth is cheap for a string only
		// ever meant to hold formatting.
		'instructions' => wp_kses_post( (string) atcf_arr( $field, 'instructions', '' ) ),
		'required'     => (bool) atcf_arr( $field, 'required', false ),
		'readonly'     => (bool) atcf_arr( $field, 'readonly', false ),
		'wrapper'      => atcf_normalize_wrapper( atcf_arr( $field, 'wrapper', array() ) ),
		'conditional'  => atcf_normalize_conditional( atcf_arr( $field, 'conditional', array() ) ),
		'settings'     => $settings,
	);

	/**
	 * Filters a normalised field.
	 *
	 * @since 0.1.0
	 *
	 * @param array $normalized The canonical field.
	 * @param array $field      What arrived.
	 */
	return (array) apply_filters( 'atcf_normalize_field', $normalized, $field );
}

/**
 * Normalises the sub-field lists a container carries.
 *
 * @since 0.1.0
 *
 * @param string $type     Container type.
 * @param array  $settings Its settings.
 * @return array The settings with their sub-fields normalised.
 */
function atcf_normalize_container_settings( $type, $settings ) {
	if ( 'flexible_content' === $type ) {
		$layouts = array();

		foreach ( (array) atcf_arr( $settings, 'layouts', array() ) as $layout ) {
			$layout = is_array( $layout ) ? $layout : array();
			$name   = atcf_sanitize_field_name( (string) atcf_arr( $layout, 'name', '' ) );

			if ( '' === $name ) {
				$name = 'layout_' . count( $layouts );
			}

			$layout_key = atcf_sanitize_field_key( (string) atcf_arr( $layout, 'key', '' ) );

			$layouts[] = array(
				'key'        => '' === $layout_key ? atcf_new_field_key() : $layout_key,
				'name'       => $name,
				'label'      => sanitize_text_field( (string) atcf_arr( $layout, 'label', $name ) ),
				'display'    => 'row' === (string) atcf_arr( $layout, 'display', 'block' ) ? 'row' : 'block',
				'min'        => (int) atcf_arr( $layout, 'min', 0 ),
				'max'        => (int) atcf_arr( $layout, 'max', 0 ),
				'sub_fields' => atcf_normalize_field_list( atcf_arr( $layout, 'sub_fields', array() ) ),
			);
		}

		$settings['layouts'] = $layouts;

		return $settings;
	}

	if ( 'clone' === $type ) {
		// A clone points at keys, not at copies. Storing the copies would freeze
		// them at the moment of cloning, which is the exact opposite of what a
		// clone is for.
		$settings['clone_source'] = array_values(
			array_filter(
				array_map( 'atcf_sanitize_field_key', (array) atcf_arr( $settings, 'clone_source', array() ) )
			)
		);

		return $settings;
	}

	$settings['sub_fields'] = atcf_normalize_field_list( atcf_arr( $settings, 'sub_fields', array() ) );

	return $settings;
}

/**
 * Normalises a list of fields, deduplicating names within it.
 *
 * @since 0.1.0
 *
 * @param mixed $fields Raw list.
 * @return array[] Canonical fields.
 */
function atcf_normalize_field_list( $fields ) {
	$out  = array();
	$seen = array();

	foreach ( (array) $fields as $field ) {
		$normalized = atcf_normalize_field( $field, $seen );

		if ( $normalized ) {
			$seen[] = $normalized['name'];
			$out[]  = $normalized;
		}
	}

	return $out;
}

/**
 * Gives a field a name no sibling is already using.
 *
 * Two fields with one name write to one meta row, so the second silently
 * overwrites the first on every save — and the symptom is "my field keeps
 * losing its value", which points at everything except the real cause.
 *
 * @since 0.1.0
 *
 * @param string   $name  Desired name.
 * @param string[] $taken Names already used by siblings.
 * @return string A free name.
 */
function atcf_unique_field_name( $name, $taken ) {
	if ( ! in_array( $name, (array) $taken, true ) ) {
		return $name;
	}

	$suffix = 2;

	while ( in_array( $name . '_' . $suffix, (array) $taken, true ) ) {
		++$suffix;
	}

	return $name . '_' . $suffix;
}

/**
 * Normalises a field's wrapper settings.
 *
 * @since 0.1.0
 *
 * @param mixed $wrapper Raw wrapper.
 * @return array Canonical wrapper.
 */
function atcf_normalize_wrapper( $wrapper ) {
	$wrapper = is_array( $wrapper ) ? $wrapper : array();
	$width   = (int) atcf_arr( $wrapper, 'width', 100 );

	return array(
		// Zero is treated as "unset" and becomes full width, which is what a
		// blank box in the inspector means. Clamped to 100 so a typo cannot
		// push a field wider than the column it lives in.
		'width' => $width > 0 ? min( 100, $width ) : 100,
		'class' => sanitize_text_field( (string) atcf_arr( $wrapper, 'class', '' ) ),
		'id'    => sanitize_html_class( (string) atcf_arr( $wrapper, 'id', '' ) ),
	);
}

/**
 * Normalises a conditional-logic block.
 *
 * The same shape everywhere it appears, which is what lets one engine evaluate
 * a field's condition, a tab's condition and a group's location without
 * knowing which it was handed.
 *
 * @since 0.1.0
 *
 * @param mixed $conditional Raw block.
 * @return array Canonical block.
 */
function atcf_normalize_conditional( $conditional ) {
	$conditional = is_array( $conditional ) ? $conditional : array();
	$rules       = array();

	foreach ( (array) atcf_arr( $conditional, 'rules', array() ) as $rule ) {
		$rule  = is_array( $rule ) ? $rule : array();
		$field = atcf_sanitize_field_key( (string) atcf_arr( $rule, 'field', '' ) );

		if ( '' === $field ) {
			continue;
		}

		$rules[] = array(
			'field'    => $field,
			'operator' => atcf_normalize_operator( (string) atcf_arr( $rule, 'operator', 'is' ) ),
			'value'    => is_array( atcf_arr( $rule, 'value', '' ) )
				? array_map( 'sanitize_text_field', (array) $rule['value'] )
				: sanitize_text_field( (string) atcf_arr( $rule, 'value', '' ) ),
		);
	}

	return array(
		// Enabled is derived rather than trusted when it is absent: a block that
		// arrived with rules and no flag came from an import that had no flag to
		// give, and treating it as off would silently disable every condition in
		// the file.
		'enabled' => (bool) atcf_arr( $conditional, 'enabled', (bool) $rules ),
		'action'  => 'hide' === (string) atcf_arr( $conditional, 'action', 'show' ) ? 'hide' : 'show',
		'match'   => 'any' === (string) atcf_arr( $conditional, 'match', 'all' ) ? 'any' : 'all',
		'rules'   => $rules,
	);
}

/**
 * Reads a field group by post id.
 *
 * @since 0.1.0
 *
 * @param int|WP_Post $post Group post or id.
 * @return array|null The canonical group with its post id attached, or null.
 */
function atcf_get_group( $post ) {
	$post = get_post( $post );

	if ( ! $post || ATCF_GROUP_TYPE !== $post->post_type ) {
		return null;
	}

	$raw    = (string) get_post_meta( $post->ID, ATCF_SCHEMA_META, true );
	$stored = '' === $raw ? array() : json_decode( $raw, true );

	if ( ! is_array( $stored ) ) {
		$stored = array();
	}

	// The post title wins over the stored one. It is what the Explorer, the
	// search index and the trash all show, and a group renamed through any of
	// those would otherwise still call itself the old name inside the builder.
	$stored['title'] = $post->post_title;

	if ( '' === (string) atcf_arr( $stored, 'key', '' ) ) {
		$stored['key'] = (string) get_post_meta( $post->ID, ATCF_KEY_META, true );
	}

	$group = atcf_normalize_group( $stored );

	$group['id']     = (int) $post->ID;
	$group['status'] = $post->post_status;

	return $group;
}

/**
 * Every active field group on the site.
 *
 * @since 0.1.0
 *
 * @param bool $include_inactive Whether to include groups switched off.
 * @return array[] Canonical groups.
 */
function atcf_get_groups( $include_inactive = false ) {
	$groups = array();

	foreach ( atcf_get_group_posts( $include_inactive ) as $post ) {
		$group = atcf_get_group( $post );

		if ( ! $group ) {
			continue;
		}

		if ( ! $include_inactive && ! $group['settings']['active'] ) {
			continue;
		}

		$groups[] = $group;
	}

	usort(
		$groups,
		static function ( $a, $b ) {
			if ( $a['settings']['menu_order'] !== $b['settings']['menu_order'] ) {
				return $a['settings']['menu_order'] <=> $b['settings']['menu_order'];
			}

			return strcasecmp( $a['title'], $b['title'] );
		}
	);

	/**
	 * Filters every field group the site has.
	 *
	 * The seam a plugin registering groups in code hooks into — a group added
	 * here behaves exactly like one stored in the database, including its
	 * location rules, its blocks and its REST exposure.
	 *
	 * @since 0.1.0
	 *
	 * @param array[] $groups           Canonical groups.
	 * @param bool    $include_inactive Whether inactive groups were asked for.
	 */
	return (array) apply_filters( 'atcf_groups', $groups, $include_inactive );
}

/**
 * Saves a field group, creating its post when it has none.
 *
 * @since 0.1.0
 *
 * @param array $group Raw group. An `id` key updates that post.
 * @return array|WP_Error The saved canonical group, or an error.
 */
function atcf_save_group( $group ) {
	if ( ! atcf_can_manage() ) {
		return new WP_Error(
			'atcf_forbidden',
			__( 'You are not allowed to change the site’s field groups.', 'allterrain-fields' ),
			array( 'status' => 403 )
		);
	}

	$normalized = atcf_normalize_group( $group );
	$id         = (int) atcf_arr( $group, 'id', 0 );

	$postarr = array(
		'post_type'   => ATCF_GROUP_TYPE,
		'post_title'  => $normalized['title'],
		'post_status' => 'publish',
		'menu_order'  => $normalized['settings']['menu_order'],
	);

	if ( $id > 0 && get_post_type( $id ) === ATCF_GROUP_TYPE ) {
		$postarr['ID'] = $id;
		$result        = wp_update_post( $postarr, true );
	} else {
		$result = wp_insert_post( $postarr, true );
	}

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	$id = (int) $result;

	// Encoded with the slashes left alone: a schema is full of URLs and regular
	// expressions, and `wp_json_encode()`'s default escaping turns every `/`
	// into `\/`, which survives a round trip but makes the JSON sync file
	// unreadable and its diffs unusable.
	$encoded = wp_json_encode( $normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

	// `wp_slash()` because `update_post_meta()` unslashes what it is given, and a
	// JSON string full of `\"` is a JSON string that arrives at the database
	// with its quotes unescaped and comes back out unparseable.
	update_post_meta( $id, ATCF_SCHEMA_META, wp_slash( (string) $encoded ) );
	update_post_meta( $id, ATCF_KEY_META, $normalized['key'] );

	atcf_flush_group_cache();

	$saved = atcf_get_group( $id );

	/**
	 * Fires after a field group is saved.
	 *
	 * @since 0.1.0
	 *
	 * @param array $saved The canonical group as stored.
	 * @param array $group What was submitted.
	 */
	do_action( 'atcf_group_saved', $saved, $group );

	return $saved;
}

/**
 * Every field in a group, flattened, including the ones inside containers.
 *
 * Each entry carries its ancestry so a caller can tell a top-level `title` from
 * a repeater's `title` without walking the tree again. Used by the validator,
 * the logic engine, the merge-tag catalogue, the bulk editor's column list and
 * the REST schema.
 *
 * @since 0.1.0
 *
 * @param array[] $fields    Field list.
 * @param array   $ancestors Keys of the containers above these, outermost first.
 * @return array[] Fields, each with an `ancestors` key added.
 */
function atcf_flatten_fields( $fields, $ancestors = array() ) {
	$flat = array();

	foreach ( (array) $fields as $field ) {
		if ( ! is_array( $field ) || ! isset( $field['key'] ) ) {
			continue;
		}

		$field['ancestors'] = $ancestors;
		$flat[]             = $field;

		if ( atcf_type_has_sub_fields( (string) atcf_arr( $field, 'type', '' ) ) ) {
			$flat = array_merge(
				$flat,
				atcf_flatten_fields( atcf_field_sub_fields( $field ), array_merge( $ancestors, array( $field['key'] ) ) )
			);
		}
	}

	return $flat;
}

/**
 * Finds a field anywhere on the site by its key.
 *
 * Cached per request. Conditional logic resolves a key per rule per field per
 * render, and a page with a forty-field group was walking every group on the
 * site several hundred times before it painted.
 *
 * @since 0.1.0
 *
 * @param string $key Field key.
 * @return array|null The field, or null.
 */
function atcf_get_field_by_key( $key ) {
	static $index = array();
	static $epoch = -1;

	$now = atcf_group_cache_epoch();

	if ( $epoch !== $now ) {
		$index = array();
		$epoch = $now;

		foreach ( atcf_get_groups( true ) as $group ) {
			foreach ( atcf_flatten_fields( $group['fields'] ) as $field ) {
				$field['group_key'] = $group['key'];
				$field['group_id']  = (int) atcf_arr( $group, 'id', 0 );

				$index[ $field['key'] ] = $field;
			}
		}
	}

	$key = atcf_sanitize_field_key( (string) $key );

	return isset( $index[ $key ] ) ? $index[ $key ] : null;
}

/**
 * Registers a field group in code.
 *
 * The seam for a plugin or a theme that wants its fields in version control
 * rather than in the database. A registered group is indistinguishable from a
 * stored one everywhere it matters — location rules, blocks, REST, the template
 * API — with one deliberate exception: the builder shows it read-only, because
 * saving it would write a second copy into the database and the file would win
 * again on the next request.
 *
 * @since 0.1.0
 *
 * @param array $group Raw group. Needs at least a `key` and some `fields`.
 * @return array The canonical group as registered.
 */
function atcf_register_field_group( $group ) {
	$normalized           = atcf_normalize_group( $group );
	$normalized['id']     = 0;
	$normalized['status'] = 'publish';
	$normalized['local']  = true;

	$registry = atcf_local_groups();

	$registry[ $normalized['key'] ] = $normalized;

	atcf_local_groups( $registry );

	return $normalized;
}

/**
 * Reads or replaces the code-registered groups.
 *
 * @since 0.1.0
 *
 * @param array|null $replace New registry, or null to read.
 * @return array<string,array> Key => canonical group.
 */
function atcf_local_groups( $replace = null ) {
	static $registry = array();

	if ( is_array( $replace ) ) {
		$registry = $replace;
	}

	return $registry;
}

add_filter( 'atcf_groups', 'atcf_merge_local_groups', 5, 2 );

/**
 * Folds code-registered groups into the list.
 *
 * A stored group with the same key wins. That ordering is what makes "register
 * it in code, then let a site override it in the builder" work — which is the
 * whole reason a site would use both.
 *
 * @since 0.1.0
 *
 * @param array[] $groups           Groups from the database.
 * @param bool    $include_inactive Whether inactive groups were asked for.
 * @return array[] The merged list.
 */
function atcf_merge_local_groups( $groups, $include_inactive ) {
	$stored = wp_list_pluck( $groups, 'key' );

	foreach ( atcf_local_groups() as $group ) {
		if ( in_array( $group['key'], $stored, true ) ) {
			continue;
		}

		if ( ! $include_inactive && ! $group['settings']['active'] ) {
			continue;
		}

		$groups[] = $group;
	}

	return $groups;
}
