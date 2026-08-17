<?php
/**
 * The compatible function names themselves.
 *
 * A separate file from `compat.php` because every definition here is inside
 * a `function_exists()` guard, and a file of nothing but guarded definitions is
 * easier to audit than the same definitions mixed in with the logic that decides
 * whether to load them.
 *
 * Each one is a one-line forward. There is no second implementation to keep in
 * step: `get_field()` *is* `atcf_get_field()`, so a fix to one is a fix to both.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/*
 * Every function below is deliberately unprefixed, which is the whole point of
 * the file: these are the names existing themes already call. The
 * `function_exists()` guard around each one is what makes claiming them safe, and
 * the sniff has no way to see that.
 */
// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound

if ( ! function_exists( 'get_field' ) ) {
	/**
	 * Reads a field's value.
	 *
	 * @since 0.1.0
	 *
	 * @param string $selector  Field name or key.
	 * @param mixed  $post_id   Anything identifying an object.
	 * @param bool   $formatted Whether to format the value.
	 * @return mixed The value.
	 */
	function get_field( $selector, $post_id = false, $formatted = true ) {
		return atcf_get_field( $selector, $post_id, $formatted );
	}
}

if ( ! function_exists( 'the_field' ) ) {
	/**
	 * Echoes a field's value, escaped.
	 *
	 * @since 0.1.0
	 *
	 * @param string $selector Field name or key.
	 * @param mixed  $post_id  Anything identifying an object.
	 * @return void
	 */
	function the_field( $selector, $post_id = false ) {
		atcf_the_field( $selector, $post_id );
	}
}

if ( ! function_exists( 'get_fields' ) ) {
	/**
	 * Reads every field on an object.
	 *
	 * @since 0.1.0
	 *
	 * @param mixed $post_id   Anything identifying an object.
	 * @param bool  $formatted Whether to format the values.
	 * @return array Name => value.
	 */
	function get_fields( $post_id = false, $formatted = true ) {
		return atcf_get_fields( $post_id, $formatted );
	}
}

if ( ! function_exists( 'get_field_object' ) ) {
	/**
	 * Reads a field's definition with its value attached.
	 *
	 * @since 0.1.0
	 *
	 * @param string $selector Field name or key.
	 * @param mixed  $post_id  Anything identifying an object.
	 * @return array|null The field.
	 */
	function get_field_object( $selector, $post_id = false ) {
		return atcf_get_field_object( $selector, $post_id );
	}
}

if ( ! function_exists( 'update_field' ) ) {
	/**
	 * Writes a field's value.
	 *
	 * @since 0.1.0
	 *
	 * @param string $selector Field name or key.
	 * @param mixed  $value    The value.
	 * @param mixed  $post_id  Anything identifying an object.
	 * @return bool Whether it was written.
	 */
	function update_field( $selector, $value, $post_id = false ) {
		return atcf_update_field( $selector, $value, $post_id );
	}
}

if ( ! function_exists( 'delete_field' ) ) {
	/**
	 * Deletes a field's value.
	 *
	 * @since 0.1.0
	 *
	 * @param string $selector Field name or key.
	 * @param mixed  $post_id  Anything identifying an object.
	 * @return bool Whether anything was deleted.
	 */
	function delete_field( $selector, $post_id = false ) {
		return atcf_delete_field( $selector, $post_id );
	}
}

if ( ! function_exists( 'have_rows' ) ) {
	/**
	 * Opens or advances a row loop.
	 *
	 * @since 0.1.0
	 *
	 * @param string $selector Field name or key.
	 * @param mixed  $post_id  Anything identifying an object.
	 * @return bool Whether there are rows left.
	 */
	function have_rows( $selector, $post_id = false ) {
		return atcf_have_rows( $selector, $post_id );
	}
}

if ( ! function_exists( 'the_row' ) ) {
	/**
	 * Advances to the next row.
	 *
	 * @since 0.1.0
	 *
	 * @return array The row.
	 */
	function the_row() {
		return atcf_the_row();
	}
}

if ( ! function_exists( 'get_sub_field' ) ) {
	/**
	 * Reads a sub-field in the current row.
	 *
	 * @since 0.1.0
	 *
	 * @param string $selector  Sub-field name or key.
	 * @param bool   $formatted Whether to format the value.
	 * @return mixed The value.
	 */
	function get_sub_field( $selector, $formatted = true ) {
		return atcf_get_sub_field( $selector, $formatted );
	}
}

if ( ! function_exists( 'the_sub_field' ) ) {
	/**
	 * Echoes a sub-field, escaped.
	 *
	 * @since 0.1.0
	 *
	 * @param string $selector Sub-field name or key.
	 * @return void
	 */
	function the_sub_field( $selector ) {
		atcf_the_sub_field( $selector );
	}
}

if ( ! function_exists( 'get_row_layout' ) ) {
	/**
	 * The layout name of the current flexible-content row.
	 *
	 * @since 0.1.0
	 *
	 * @return string The layout name, or an empty string.
	 */
	function get_row_layout() {
		$loop = atcf_current_row();

		if ( ! $loop ) {
			return '';
		}

		$row = isset( $loop['rows'][ $loop['index'] ] ) ? $loop['rows'][ $loop['index'] ] : array();

		return (string) atcf_arr( (array) $row, 'atcf_layout', '' );
	}
}

// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound
