<?php
/**
 * The drop-in layer.
 *
 * There are hundreds of thousands of WordPress themes calling `get_field()`.
 * Every agency has a boilerplate built on it, every tutorial written since 2012
 * teaches it, and a plugin that made all of that stop working would be a plugin
 * with a migration guide instead of users.
 *
 * So when nothing else has claimed those names, this plugin answers to them. A
 * theme written against ACF runs unchanged: same function names, same argument
 * order, same return shapes, same storage convention underneath, so even the
 * values are already where it looks.
 *
 * **It never fights.** Every definition is behind a `function_exists()` check
 * made on `plugins_loaded` at priority 99 — after every plugin has loaded. With
 * ACF active, ACF owns those names and this file defines nothing. Two plugins
 * racing to define `get_field()` is a fatal error on every request, and the only
 * safe way to offer a compatible name is to offer it last and only when it is
 * free.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'plugins_loaded', 'atcf_maybe_load_acf_compat', 99 );

/**
 * Defines the compatible function names, if they are going spare.
 *
 * Checked one at a time rather than all-or-nothing on `get_field`. A site can
 * have a theme that defined `the_field()` itself years ago and nothing else, and
 * skipping the whole layer over one collision would be a strange way to react to
 * that.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_maybe_load_acf_compat() {
	/**
	 * Filters whether to define the ACF-compatible function names.
	 *
	 * Return false on a site that would rather keep the namespace clear —
	 * because it is mid-migration and wants the fatal error that tells it a
	 * template was missed, rather than the silence that hides it.
	 *
	 * @since 0.1.0
	 *
	 * @param bool $enabled Whether to define them.
	 */
	if ( ! apply_filters( 'atcf_acf_compatibility', true ) ) {
		return;
	}

	require_once ATCF_PATH . 'includes/compat-acf-functions.php';
}
