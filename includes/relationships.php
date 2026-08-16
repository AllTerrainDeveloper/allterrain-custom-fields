<?php
/**
 * Relationships, in both directions.
 *
 * A relationship field points one way. Somebody sets "Related products" on a
 * post and the other product knows nothing about it — so every site with a
 * relationship field also has a second relationship field on the other type,
 * maintained by hand, and the two drift apart within a month. Everybody knows
 * this. It gets fixed by writing a `save_post` hook, in every project, again.
 *
 * A field with `bidirectional` on names a `mirror` field on the other side, and
 * this file keeps the two consistent: adding A→B adds B→A, removing it removes
 * it, and deleting either post cleans up whatever pointed at it.
 *
 * The whole thing is one idea — that a relationship is an **edge**, not a value
 * on one node — and it is also what the desktop draws. `includes/shell/identity.php`
 * turns exactly this graph into the ties OpenStation renders between windows and
 * the rows in the title bar's Related menu.
 *
 * ### Not recursing
 *
 * Writing B's mirror fires B's own save, which would write A's mirror, which
 * would fire A's save. The guard is a static list of edges already written this
 * request, checked before every write. A depth counter would also stop the loop
 * and would stop *legitimate* second-order updates with it; keying on the edge
 * stops exactly the repeat and nothing else.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Edges already written during this request.
 *
 * @since 0.1.0
 *
 * @param string $edge Edge signature to record, or an empty string to just read.
 * @return array<string,bool> The set.
 */
function atcf_relationship_guard( $edge = '' ) {
	static $written = array();

	if ( '' !== $edge ) {
		$written[ $edge ] = true;
	}

	return $written;
}

/**
 * Whether a field maintains the other side of its relationship.
 *
 * @since 0.1.0
 *
 * @param array $field Canonical field.
 * @return string The mirror field's key, or an empty string.
 */
function atcf_mirror_key( $field ) {
	$settings = (array) atcf_arr( $field, 'settings', array() );

	if ( ! atcf_arr( $settings, 'bidirectional', false ) ) {
		return '';
	}

	$mirror = atcf_arr( $settings, 'mirror', '' );

	// Stored as a list by the builder's picker and as a string by a hand-written
	// registration. One mirror per field either way: two would mean a single
	// edge written into two places on the far side, and nothing could then say
	// which of them was authoritative when they disagreed.
	if ( is_array( $mirror ) ) {
		$mirror = $mirror ? reset( $mirror ) : '';
	}

	$mirror = atcf_sanitize_field_key( (string) $mirror );

	// A field mirroring *itself* is legal and is the most useful case of all —
	// "Related articles" on one post type, where the far side is the same field
	// on another post of the same type.
	return $mirror;
}

/**
 * Writes the other side of a relationship after a value changes.
 *
 * @since 0.1.0
 *
 * @param array $field Canonical field that was written.
 * @param array $ref   The object it was written on.
 * @param mixed $value Its new value.
 * @return void
 */
function atcf_sync_relationships( $field, $ref, $value ) {
	$mirror_key = atcf_mirror_key( $field );

	if ( '' === $mirror_key ) {
		return;
	}

	// Only post-to-post for now. A term or a user holding a mirror is coherent
	// and is simply not built yet; returning early is honest, where guessing a
	// meta key for it would write values nothing reads.
	if ( 'post' !== (string) atcf_arr( $ref, 'type', 'post' ) ) {
		return;
	}

	$mirror = atcf_get_field_by_key( $mirror_key );

	if ( ! $mirror ) {
		return;
	}

	$source = (int) atcf_arr( $ref, 'id', 0 );

	if ( $source <= 0 ) {
		return;
	}

	$now    = atcf_to_id_list( $value );
	$before = atcf_to_id_list( atcf_previous_relationship( $field, $ref ) );

	foreach ( array_diff( $now, $before ) as $target ) {
		atcf_write_mirror( $mirror, $target, $source, true );
	}

	foreach ( array_diff( $before, $now ) as $target ) {
		atcf_write_mirror( $mirror, $target, $source, false );
	}

	atcf_remember_relationship( $field, $ref, $now );
}

/**
 * Adds or removes one id from a mirror field on one post.
 *
 * @since 0.1.0
 *
 * @param array $mirror The mirror field.
 * @param int   $target The post holding the mirror.
 * @param int   $source The post to add or remove.
 * @param bool  $add    True to add, false to remove.
 * @return void
 */
function atcf_write_mirror( $mirror, $target, $source, $add ) {
	$target = (int) $target;
	$source = (int) $source;

	if ( $target <= 0 || $source <= 0 || $target === $source ) {
		// Self-edges are dropped rather than stored. A post related to itself
		// renders as a card linking to the page you are already on, and every
		// "related items" loop then has to remember to exclude the current post
		// — which half of them do not.
		return;
	}

	$edge = $mirror['key'] . ':' . $target . ':' . $source . ':' . ( $add ? '1' : '0' );

	if ( isset( atcf_relationship_guard()[ $edge ] ) ) {
		return;
	}

	atcf_relationship_guard( $edge );

	$ref     = array(
		'type' => 'post',
		'id'   => $target,
	);
	$current = atcf_to_id_list( atcf_load_value( $mirror, $ref, '', false ) );

	if ( $add ) {
		if ( in_array( $source, $current, true ) ) {
			return;
		}

		$current[] = $source;
	} else {
		if ( ! in_array( $source, $current, true ) ) {
			return;
		}

		$current = array_values( array_diff( $current, array( $source ) ) );
	}

	// Single-value mirrors keep the last one written rather than silently
	// dropping the write. A one-to-many relationship mirrored onto a `post_object`
	// is a legitimate model — one product, many reviews — and the review's field
	// should end up pointing at the product that just claimed it.
	$multiple = 'relationship' === (string) $mirror['type']
		|| (bool) atcf_arr( (array) atcf_arr( $mirror, 'settings', array() ), 'multiple', false );

	atcf_save_value( $mirror, $ref, $multiple ? $current : ( $current ? end( $current ) : 0 ) );
	atcf_remember_relationship( $mirror, $ref, $current );

	/**
	 * Fires after one side of a bidirectional relationship is rewritten.
	 *
	 * @since 0.1.0
	 *
	 * @param array $mirror The mirror field.
	 * @param int   $target The post it was written on.
	 * @param int   $source The post added or removed.
	 * @param bool  $add    Whether it was an addition.
	 */
	do_action( 'atcf_mirror_written', $mirror, $target, $source, $add );
}

/**
 * What a relationship field held before this request touched it.
 *
 * Read from a shadow row rather than from the value itself, because by the time
 * the sync runs the value has already been overwritten — the store writes, then
 * the sync reconciles, and asking "what was there before" of a row that was
 * updated a microsecond ago gets the new answer.
 *
 * The shadow is written after every sync, so it is the previous *synced* state,
 * which is exactly the set the far side currently reflects.
 *
 * @since 0.1.0
 *
 * @param array $field Canonical field.
 * @param array $ref   Object reference.
 * @return int[] The ids as last synced.
 */
function atcf_previous_relationship( $field, $ref ) {
	return atcf_to_id_list( atcf_read_raw( $ref, '_atcf_rel_' . $field['name'] ) );
}

/**
 * Records the ids a relationship field now holds, for the next sync to diff.
 *
 * @since 0.1.0
 *
 * @param array $field Canonical field.
 * @param array $ref   Object reference.
 * @param array $ids   The ids.
 * @return void
 */
function atcf_remember_relationship( $field, $ref, $ids ) {
	atcf_write_raw( $ref, '_atcf_rel_' . $field['name'], array_map( 'intval', (array) $ids ) );
}

add_action( 'before_delete_post', 'atcf_clean_relationships_on_delete' );

/**
 * Removes a deleted post from everything that pointed at it.
 *
 * Without this, a deleted post lives on as an id in a dozen relationship fields,
 * and every template looping them has to null-check each one — which is the
 * check everybody forgets and which produces the "Attempt to read property on
 * null" that shows up in production a month later.
 *
 * Scoped to the fields that actually declare a mirror. Scanning every meta row
 * on the site for a stray id would be correct and would also be a full table
 * scan on `before_delete_post`, which fires during bulk operations.
 *
 * @since 0.1.0
 *
 * @param int $post_id The post being deleted.
 * @return void
 */
function atcf_clean_relationships_on_delete( $post_id ) {
	$post_id = (int) $post_id;

	if ( $post_id <= 0 ) {
		return;
	}

	foreach ( atcf_bidirectional_fields() as $field ) {
		$mirror = atcf_get_field_by_key( atcf_mirror_key( $field ) );

		if ( ! $mirror ) {
			continue;
		}

		$ref     = array(
			'type' => 'post',
			'id'   => $post_id,
		);
		$pointed = atcf_to_id_list( atcf_load_value( $field, $ref, '', false ) );

		foreach ( $pointed as $target ) {
			atcf_write_mirror( $mirror, $target, $post_id, false );
		}
	}
}

/**
 * Every field on the site that maintains the other side of its relationship.
 *
 * @since 0.1.0
 *
 * @return array[] Canonical fields.
 */
function atcf_bidirectional_fields() {
	$fields = array();

	foreach ( atcf_get_groups( true ) as $group ) {
		foreach ( atcf_flatten_fields( $group['fields'] ) as $field ) {
			if ( '' !== atcf_mirror_key( $field ) ) {
				$fields[] = $field;
			}
		}
	}

	return $fields;
}

/**
 * Every relational field on the site, with the types it joins.
 *
 * This is the site's content model expressed as edges, and it is what the
 * Content Model window draws. Each entry says which post types the field lives
 * on (from its group's location rules), which it points at, and whether the edge
 * is drawn with one arrowhead or two.
 *
 * @since 0.1.0
 *
 * @return array[] Edges.
 */
function atcf_relationship_graph() {
	$relational = array( 'post_object', 'relationship', 'page_link', 'taxonomy', 'user' );
	$edges      = array();

	foreach ( atcf_get_groups( true ) as $group ) {
		$from = atcf_group_post_types( $group );

		foreach ( atcf_flatten_fields( $group['fields'] ) as $field ) {
			if ( ! in_array( (string) $field['type'], $relational, true ) ) {
				continue;
			}

			$settings = (array) $field['settings'];

			if ( 'taxonomy' === $field['type'] ) {
				$to   = array( 'taxonomy:' . (string) atcf_arr( $settings, 'taxonomy', '' ) );
				$kind = 'taxonomy';
			} elseif ( 'user' === $field['type'] ) {
				$to   = array( 'user' );
				$kind = 'user';
			} else {
				$to   = (array) atcf_arr( $settings, 'post_types', array() );
				$kind = 'post';

				// A relationship field with no type filter points at everything
				// that has a group, which is the honest drawing of it — an
				// unfiltered edge really can reach any of them.
				$to = $to ? $to : array( '*' );
			}

			$edges[] = array(
				'field'         => $field['key'],
				'label'         => $field['label'],
				'name'          => $field['name'],
				'type'          => $field['type'],
				'group'         => $group['key'],
				'group_id'      => (int) atcf_arr( $group, 'id', 0 ),
				'group_title'   => $group['title'],
				'from'          => $from,
				'to'            => array_values( array_map( 'strval', $to ) ),
				'kind'          => $kind,
				'bidirectional' => '' !== atcf_mirror_key( $field ),
				'mirror'        => atcf_mirror_key( $field ),
			);
		}
	}

	/**
	 * Filters the site's relationship graph.
	 *
	 * @since 0.1.0
	 *
	 * @param array[] $edges The edges.
	 */
	return (array) apply_filters( 'atcf_relationship_graph', $edges );
}

/**
 * The post types a group's location rules reach.
 *
 * Read straight off the rules rather than by testing every type against them,
 * because the answer is wanted for a *drawing* and an approximate node list that
 * renders instantly beats an exact one that takes a second.
 *
 * @since 0.1.0
 *
 * @param array $group Canonical group.
 * @return string[] Post type slugs, or `array( '*' )` when the rules do not say.
 */
function atcf_group_post_types( $group ) {
	$types = array();

	foreach ( (array) atcf_arr( $group, 'location', array() ) as $rules ) {
		foreach ( (array) $rules as $rule ) {
			if ( 'post_type' !== (string) atcf_arr( $rule, 'param', '' ) ) {
				continue;
			}

			if ( '==' !== (string) atcf_arr( $rule, 'operator', '==' ) ) {
				continue;
			}

			$value = (string) atcf_arr( $rule, 'value', '' );

			if ( '' !== $value && ! in_array( $value, $types, true ) ) {
				$types[] = $value;
			}
		}
	}

	return $types ? $types : array( '*' );
}

/**
 * Everything one object points at, flattened for the shell.
 *
 * Used by `includes/shell/identity.php` to tell OpenStation what this window's
 * content relates to. Returns references, not objects: the shell only needs a
 * type and an id to draw an edge, and loading forty posts to draw forty lines
 * would make opening a window slower the better connected its content is.
 *
 * @since 0.1.0
 *
 * @param array $ref Object reference.
 * @return array[] `array( 'type', 'id', 'field', 'label' )` entries.
 */
function atcf_outbound_relations( $ref ) {
	$relations = array();
	$context   = atcf_ref_context( $ref );

	foreach ( atcf_groups_for( $context ) as $group ) {
		foreach ( atcf_flatten_fields( $group['fields'] ) as $field ) {
			$type = (string) $field['type'];

			if ( ! in_array( $type, array( 'post_object', 'relationship', 'page_link', 'taxonomy', 'user', 'image', 'file', 'gallery' ), true ) ) {
				continue;
			}

			// Sub-fields inside containers are skipped: their values live under
			// indexed keys this loop has no row context for, and a relations
			// list is a navigation aid rather than an exhaustive audit.
			if ( ! empty( $field['ancestors'] ) ) {
				continue;
			}

			$ids = atcf_to_id_list( atcf_load_value( $field, $ref, '', false ) );

			foreach ( $ids as $id ) {
				$relations[] = array(
					'type'  => atcf_relation_object_type( $field, $id ),
					'id'    => $id,
					'field' => $field['key'],
					'label' => $field['label'],
				);
			}
		}
	}

	return $relations;
}

/**
 * What kind of object a relational field's id refers to.
 *
 * @since 0.1.0
 *
 * @param array $field Canonical field.
 * @param int   $id    The id.
 * @return string The shell's object-type slug.
 */
function atcf_relation_object_type( $field, $id ) {
	switch ( (string) $field['type'] ) {
		case 'user':
			return 'user';

		case 'taxonomy':
			$term = get_term( (int) $id );

			return $term instanceof WP_Term ? 'term/' . $term->taxonomy : 'term';

		case 'image':
		case 'file':
		case 'gallery':
			return 'media';
	}

	// A post reference reports the shell's `post` type rather than the specific
	// post type, because that is the vocabulary the shell's own detection uses
	// for `post.php` — reporting `product` here would put the same object in two
	// different relation groups depending on which window announced it.
	return 'post';
}
