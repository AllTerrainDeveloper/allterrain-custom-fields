<?php
/**
 * Naming the shell.
 *
 * The desktop shell was called Desktop Mode and is now called OpenStation, and
 * the rename went all the way down: `desktop_mode_register_window()` became
 * `openstation_register_window()`, and every hook and constant with it.
 * AllTerrain Fields ships to sites running either version and cannot know which,
 * so it asks for a capability by its bare name and this file resolves the
 * spelling.
 *
 * Deliberately a lookup rather than a version check. A site mid-upgrade, a fork,
 * or a shell that renames itself again all degrade to "no desktop integration"
 * instead of a fatal error on every request -- which is the same promise the
 * rest of this plugin makes to sites with no shell at all.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Prefixes to try, current first.
 *
 * @since 0.1.0
 */
const ATCF_SHELL_PREFIXES = array( 'openstation_', 'desktop_mode_' );

/**
 * Resolves a shell function to whichever name this install has.
 *
 * @since 0.1.0
 *
 * @param string $name Bare function name, e.g. `register_window`.
 * @return string The callable name, or an empty string when no shell provides it.
 */
function atcf_shell_function( $name ) {
	foreach ( ATCF_SHELL_PREFIXES as $prefix ) {
		if ( function_exists( $prefix . $name ) ) {
			return $prefix . $name;
		}
	}

	return '';
}

/**
 * Whether the shell offers a capability at all.
 *
 * @since 0.1.0
 *
 * @param string $name Bare function name.
 * @return bool True when some spelling of it exists.
 */
function atcf_shell_has( $name ) {
	return '' !== atcf_shell_function( $name );
}

/**
 * Calls a shell function by its bare name.
 *
 * @since 0.1.0
 *
 * @param string $name    Bare function name.
 * @param mixed  ...$args Arguments to pass through.
 * @return mixed The return value, or null when no shell provides it.
 */
function atcf_shell_call( $name, ...$args ) {
	$fn = atcf_shell_function( $name );

	return $fn ? call_user_func_array( $fn, $args ) : null;
}

/**
 * Every spelling of a shell hook.
 *
 * Returned as a list so callers can register against all of them. A listener for
 * a hook that never fires costs nothing, and it is far cheaper than deciding at
 * boot which shell is present -- the answer can change between `plugins_loaded`
 * and the hook actually firing.
 *
 * @since 0.1.0
 *
 * @param string $name Bare hook name, e.g. `mode_init`.
 * @return string[] Hook names.
 */
function atcf_shell_hooks( $name ) {
	$hooks = array();

	foreach ( ATCF_SHELL_PREFIXES as $prefix ) {
		$hooks[] = $prefix . $name;
	}

	return $hooks;
}

/**
 * Determines whether the shell is installed *and* switched on for this user.
 *
 * Two separate questions, and both matter. `atcf_shell_has()` answers "is the
 * plugin active"; `openstation_is_enabled()` answers "has this particular user
 * opted in", since the shell is a per-user preference rather than a site-wide
 * one.
 *
 * @since 0.1.0
 *
 * @return bool True when the desktop shell is active for the current user.
 */
function atcf_shell_is_active() {
	if ( ! atcf_shell_has( 'register_window' ) || ! atcf_shell_has( 'is_enabled' ) ) {
		return false;
	}

	return (bool) atcf_shell_call( 'is_enabled' );
}

/**
 * Whether the current request is an admin page rendering inside a shell window.
 *
 * This one matters far more here than it does in a plugin whose UI is all
 * native: the *field runtime* renders on the post editor, and the post editor
 * inside OpenStation is a chromeless iframe. Knowing that is what lets the
 * runtime install the cross-frame drop bridge, so an image dragged off the
 * wallpaper can land in an Image field two frames away.
 *
 * @since 0.1.0
 *
 * @return bool True when rendering inside a shell window iframe.
 */
function atcf_shell_is_chromeless() {
	if ( ! atcf_shell_has( 'is_chromeless_request' ) ) {
		return false;
	}

	return (bool) atcf_shell_call( 'is_chromeless_request' );
}
