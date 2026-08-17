<?php
/**
 * The small shared vocabulary.
 *
 * Capability questions, key sanitisation, and the two or three conversions that
 * would otherwise be written slightly differently in nine files.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Whether the current user may change the site's content model.
 *
 * Adding a field to a post type is a structural change: it changes what every
 * post of that type is, for everybody. That is an administrator's decision, and
 * `manage_options` is the capability WordPress already uses for it.
 *
 * Filterable, because a site with an editorial lead who owns the content model
 * and an administrator who owns the servers is a real and common shape, and the
 * two are not the same person.
 *
 * @since 0.1.0
 *
 * @return bool True when the user may create, edit and delete field groups.
 */
function atcf_can_manage() {
	/**
	 * Filters whether the current user may edit field groups.
	 *
	 * @since 0.1.0
	 *
	 * @param bool $can Whether the user may manage the content model.
	 */
	return (bool) apply_filters( 'atcf_can_manage', current_user_can( ATCF_MANAGE_CAP ) );
}

/**
 * Whether the current user may edit the values held by a given object.
 *
 * The question every value read and every value write asks. It is answered by
 * WordPress's own capability for the object, never by this plugin's own — a
 * field value belongs to the post, term, user or site option it hangs off, and
 * whoever may edit that may edit the fields on it.
 *
 * @since 0.1.0
 *
 * @param string     $object_type One of `post`, `term`, `user`, `option`.
 * @param int|string $object_id   The object's id. Ignored for `option`.
 * @return bool True when the user may write to this object's fields.
 */
function atcf_can_edit_values( $object_type, $object_id = 0 ) {
	switch ( $object_type ) {
		case 'post':
			$can = current_user_can( 'edit_post', (int) $object_id );
			break;

		case 'term':
			$term = get_term( (int) $object_id );
			$can  = ! is_wp_error( $term ) && $term instanceof WP_Term
				? current_user_can( 'edit_term', $term->term_id )
				: false;
			break;

		case 'user':
			$can = current_user_can( 'edit_user', (int) $object_id );
			break;

		case 'option':
			$can = current_user_can( 'manage_options' );
			break;

		default:
			$can = false;
	}

	/**
	 * Filters whether the current user may write field values on an object.
	 *
	 * @since 0.1.0
	 *
	 * @param bool       $can         Whether the write is allowed.
	 * @param string     $object_type One of `post`, `term`, `user`, `option`.
	 * @param int|string $object_id   The object's id.
	 */
	return (bool) apply_filters( 'atcf_can_edit_values', $can, $object_type, $object_id );
}

/**
 * Sanitises a field *name* — the key a value is stored under.
 *
 * A name becomes a meta key, and a meta key becomes something a theme author
 * types into `get_post_meta()`. So it is lowercase, alphanumeric and
 * underscores, and it never starts with an underscore: WordPress treats a
 * leading underscore as "protected" and hides the row from the Custom Fields
 * metabox and from `is_protected_meta()`-aware code, which is not a decision a
 * field name should be able to make by accident.
 *
 * @since 0.1.0
 *
 * @param string $name Raw name.
 * @return string Sanitised name, or an empty string when nothing survived.
 */
function atcf_sanitize_field_name( $name ) {
	$name = strtolower( remove_accents( (string) $name ) );
	$name = preg_replace( '/[^a-z0-9_]+/', '_', $name );
	$name = preg_replace( '/_+/', '_', (string) $name );

	return trim( (string) $name, '_' );
}

/**
 * Sanitises a field *key* — the identity a field keeps for its whole life.
 *
 * Names change: somebody renames "Sub heading" to "Standfirst" and every value
 * already written under the old name would be orphaned. Keys do not, which is
 * why the schema is joined by key and only the storage layer knows about names.
 *
 * The `field_` prefix is the one existing sites already hold, and keeping it
 * is not sentiment: a site migrating in has thousands of `_meta_key` rows
 * containing `field_xxx` strings, and a plugin that spells its keys
 * differently cannot read them.
 *
 * @since 0.1.0
 *
 * @param string $key Raw key.
 * @return string Sanitised key, or an empty string when nothing survived.
 */
function atcf_sanitize_field_key( $key ) {
	$key = strtolower( (string) $key );
	$key = preg_replace( '/[^a-z0-9_]+/', '', $key );

	return (string) $key;
}

/**
 * Mints a new field key.
 *
 * @since 0.1.0
 *
 * @return string A key of the form `field_` plus 13 hex characters.
 */
function atcf_new_field_key() {
	return 'field_' . substr( md5( uniqid( (string) wp_rand(), true ) ), 0, 13 );
}

/**
 * Mints a new field-group key.
 *
 * @since 0.1.0
 *
 * @return string A key of the form `group_` plus 13 hex characters.
 */
function atcf_new_group_key() {
	return 'group_' . substr( md5( uniqid( (string) wp_rand(), true ) ), 0, 13 );
}

/**
 * Whether OpenStation's per-user developer mode is on.
 *
 * A *preference*, never an authorisation. It decides whether a developer surface
 * is shown — the raw meta key beside each field, the schema JSON tab. Everything
 * it reveals is checked again on the server against a real capability.
 *
 * @since 0.1.0
 *
 * @return bool True when the shell reports developer mode on for this user.
 */
function atcf_dev_mode() {
	if ( atcf_shell_has( 'is_dev_mode' ) ) {
		return (bool) atcf_shell_call( 'is_dev_mode' );
	}

	return defined( 'WP_DEBUG' ) && WP_DEBUG;
}

/**
 * Coerces anything into a flat list of positive integers.
 *
 * Relationship, gallery, user and taxonomy values all arrive as "some ids", from
 * a REST body, a `$_POST`, a JSON import or a drag payload, in every shape those
 * four can produce: an array, a comma-joined string, a single scalar, or an
 * array of objects each carrying an `id`.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return int[] Unique positive integers, in the order first seen.
 */
function atcf_to_id_list( $value ) {
	if ( is_string( $value ) && '' !== $value ) {
		$value = explode( ',', $value );
	}

	if ( ! is_array( $value ) ) {
		$value = null === $value || '' === $value ? array() : array( $value );
	}

	$ids = array();

	foreach ( $value as $item ) {
		if ( is_array( $item ) && isset( $item['id'] ) ) {
			$item = $item['id'];
		} elseif ( is_object( $item ) && isset( $item->ID ) ) {
			$item = $item->ID;
		} elseif ( is_object( $item ) && isset( $item->term_id ) ) {
			$item = $item->term_id;
		}

		$id = (int) $item;

		if ( $id > 0 && ! in_array( $id, $ids, true ) ) {
			$ids[] = $id;
		}
	}

	return $ids;
}

/**
 * Reads a key out of an array with a default, without the isset dance.
 *
 * @since 0.1.0
 *
 * @param array  $source  The array.
 * @param string $key     Key to read.
 * @param mixed  $default Value when the key is absent or null.
 * @return mixed The value, or the default.
 */
function atcf_arr( $source, $key, $default = '' ) {
	if ( ! is_array( $source ) || ! array_key_exists( $key, $source ) || null === $source[ $key ] ) {
		return $default;
	}

	return $source[ $key ];
}
