<?php
/**
 * Teaching the desktop what a relationship field means.
 *
 * OpenStation keeps a per-window *content identity* — what this window is
 * showing, and what that thing points at. From those it derives groups, draws
 * visible ties between windows on the desktop, and fills the title bar's
 * **Related** menu.
 *
 * The shell already works this out for a post: its internal links, its embedded
 * media, its featured image, its terms. What it cannot know is that this site's
 * Product post type has a "Case studies" relationship field pointing at three
 * other posts, because that relationship exists nowhere in the post's content —
 * it exists in three rows of `wp_postmeta`.
 *
 * These two filters are the whole of it. Twenty lines, and the effect is that
 * every relationship anybody has ever modelled on the site becomes a line drawn
 * between two windows and a row in a menu. It is the single highest-leverage
 * integration in this plugin, and it is the one no custom-fields plugin could
 * have had before there was a desktop to draw on.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_filter( 'openstation_window_content_identity', 'atcf_extend_content_identity', 20, 2 );
add_filter( 'desktop_mode_window_content_identity', 'atcf_extend_content_identity', 20, 2 );

/**
 * Adds this site's relationship fields to a window's content identity.
 *
 * Runs inside the iframe's `admin_footer`, in real admin context, so
 * `get_post()` and every capability check work normally.
 *
 * The identity is *extended*, never replaced. The shell's own detection has
 * already filled in the post's links, media and terms, and returning a fresh
 * array would throw all of that away to add three ids — which is how an
 * integration makes the feature it hooked worse.
 *
 * @since 0.1.0
 *
 * @param array|null     $identity The identity so far, or null for a screen
 *                                 showing no single object.
 * @param WP_Screen|null $screen   The screen, or null on the REST recompute.
 * @return array|null The identity.
 */
function atcf_extend_content_identity( $identity, $screen = null ) {
	unset( $screen );

	if ( ! is_array( $identity ) ) {
		return $identity;
	}

	$ref = atcf_identity_ref( $identity );

	if ( ! $ref ) {
		return $identity;
	}

	$links = isset( $identity['links'] ) && is_array( $identity['links'] ) ? $identity['links'] : array();

	foreach ( atcf_outbound_relations( $ref ) as $relation ) {
		$links[] = array(
			'type' => $relation['type'],
			'id'   => $relation['id'],
			// A `reference`, not a `child`. A related product is not *part of*
			// this product — it is something this product points at — and the
			// shell draws the two differently on purpose. Claiming containment
			// for a reference makes the desktop assert an ownership the data
			// does not have.
			'rel'  => 'references',
		);
	}

	// The shell caps `links` at 32 and refuses the whole identity when the array
	// is malformed. Trimming here keeps the excess out of the payload rather
	// than relying on the far side to discard the tail — and a post with more
	// than 32 relations is drawing an unreadable star anyway.
	$identity['links'] = atcf_dedupe_links( $links );

	return $identity;
}

/**
 * Turns a shell identity into an object reference this plugin can read.
 *
 * Only the object types that can hold fields. A `comment` identity is a real
 * thing the shell announces and there are no fields on comments, so it returns
 * null rather than a reference to something with no values.
 *
 * @since 0.1.0
 *
 * @param array $identity The shell identity.
 * @return array|null An object reference, or null.
 */
function atcf_identity_ref( $identity ) {
	$type = (string) atcf_arr( $identity, 'type', '' );
	$id   = atcf_arr( $identity, 'id', 0 );

	if ( in_array( $type, array( 'post', 'page', 'media' ), true ) ) {
		return array(
			'type' => 'post',
			'id'   => (int) $id,
		);
	}

	if ( 'user' === $type ) {
		return array(
			'type' => 'user',
			'id'   => (int) $id,
		);
	}

	if ( 0 === strpos( $type, 'term/' ) || 'term' === $type ) {
		return array(
			'type' => 'term',
			'id'   => (int) $id,
		);
	}

	return null;
}

/**
 * Removes duplicate links and caps the list.
 *
 * A post whose featured image is also in a gallery field arrives here twice, and
 * the shell would draw two lines between the same pair of windows — which looks
 * like a rendering bug rather than like two relationships.
 *
 * @since 0.1.0
 *
 * @param array[] $links Link records.
 * @return array[] Unique links, capped at 32.
 */
function atcf_dedupe_links( $links ) {
	$seen  = array();
	$clean = array();

	foreach ( $links as $link ) {
		if ( ! is_array( $link ) || ! isset( $link['type'], $link['id'] ) ) {
			continue;
		}

		$signature = $link['type'] . ':' . $link['id'];

		if ( isset( $seen[ $signature ] ) ) {
			continue;
		}

		$seen[ $signature ] = true;
		$clean[]            = $link;

		if ( count( $clean ) >= 32 ) {
			break;
		}
	}

	return $clean;
}

add_filter( 'openstation_window_related_entities', 'atcf_related_entities', 20, 3 );
add_filter( 'desktop_mode_window_related_entities', 'atcf_related_entities', 20, 3 );

/**
 * Adds a Related-menu row per relationship field.
 *
 * Grouped by the field, so the menu reads the way the content model does:
 *
 *     Case studies
 *       The Northwind rebuild
 *       Baker & Sons, three years on
 *     Written by
 *       Ada Lovelace
 *
 * The group label is the field's own label — the words the site's own author
 * chose — rather than a generic "Related posts", which is the difference between
 * a menu that explains the site and one that lists it.
 *
 * @since 0.1.0
 *
 * @param array          $related  The rows so far.
 * @param array          $identity The resolved content identity.
 * @param WP_Screen|null $screen   The screen, or null on the REST recompute.
 * @return array The rows.
 */
function atcf_related_entities( $related, $identity, $screen = null ) {
	unset( $screen );

	$ref = atcf_identity_ref( (array) $identity );

	if ( ! $ref ) {
		return $related;
	}

	$related = is_array( $related ) ? $related : array();
	$added   = 0;

	foreach ( atcf_outbound_relations( $ref ) as $relation ) {
		// The shell hard-caps the final list at 64 and truncates silently. A
		// budget of 24 from this plugin leaves the built-in comments, terms and
		// media rows room to survive — they are the ones a user is looking for
		// when they open the menu out of habit.
		if ( $added >= 24 ) {
			break;
		}

		$row = atcf_related_row( $relation );

		if ( ! $row ) {
			continue;
		}

		$related[] = $row;

		++$added;
	}

	return $related;
}

/**
 * Builds one Related-menu row for a relation.
 *
 * Returns null when the target has gone or the user may not open it. A menu row
 * pointing at a screen that will refuse the user is worse than a shorter menu.
 *
 * @since 0.1.0
 *
 * @param array $relation One outbound relation.
 * @return array|null The row.
 */
function atcf_related_row( $relation ) {
	$id    = (int) $relation['id'];
	$type  = (string) $relation['type'];
	$field = (string) $relation['field'];

	if ( 'user' === $type ) {
		$user = get_userdata( $id );

		if ( ! $user || ! current_user_can( 'edit_user', $id ) ) {
			return null;
		}

		return atcf_related_row_shape( $field, $id, $relation['label'], $user->display_name, admin_url( 'user-edit.php?user_id=' . $id ), 'dashicons-admin-users' );
	}

	if ( 0 === strpos( $type, 'term' ) ) {
		$term = get_term( $id );

		if ( ! $term instanceof WP_Term ) {
			return null;
		}

		return atcf_related_row_shape(
			$field,
			$id,
			$relation['label'],
			$term->name,
			admin_url( 'term.php?taxonomy=' . rawurlencode( $term->taxonomy ) . '&tag_ID=' . $id ),
			'dashicons-tag'
		);
	}

	$post = get_post( $id );

	if ( ! $post || ! current_user_can( 'edit_post', $id ) ) {
		return null;
	}

	// The Media Library's grid detail for an attachment, and the editor for
	// everything else — which is what the shell's own built-in rows link to, so
	// a row added here opens the same kind of window as the row above it.
	$url = 'attachment' === $post->post_type
		? admin_url( 'upload.php?item=' . $id )
		: (string) get_edit_post_link( $post, 'raw' );

	$title = '' === $post->post_title ? __( '(no title)', 'allterrain-fields' ) : $post->post_title;

	return atcf_related_row_shape( $field, $id, $relation['label'], $title, $url, 'dashicons-admin-post' );
}

/**
 * The row shape the shell expects.
 *
 * @since 0.1.0
 *
 * @param string $field       Field key, which namespaces the group.
 * @param int    $id          Target id.
 * @param string $group_label The field's label.
 * @param string $label       The target's name.
 * @param string $url         Where the row opens.
 * @param string $icon        Dashicons class.
 * @return array The row.
 */
function atcf_related_row_shape( $field, $id, $group_label, $label, $url, $icon ) {
	return array(
		// Unique within the list, and namespaced — the shell drops the whole
		// identity when two rows share an id, so a post appearing in two
		// different relationship fields has to key on both.
		'id'         => 'allterrain-fields/' . $field . '-' . $id,
		'group'      => 'allterrain-fields/' . $field,
		'groupLabel' => $group_label,
		'label'      => $label,
		'icon'       => $icon,
		'url'        => $url,
	);
}
