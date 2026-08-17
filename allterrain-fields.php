<?php
/**
 * Plugin Name:       AllTerrain Fields
 * Plugin URI:        https://github.com/allterraindeveloper/fields
 * Description:       Custom fields for WordPress with every premium feature free — a field group builder, a content model graph, bidirectional relationships and a bulk value editor, built as an OpenStation desktop app.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            AllTerrain
 * Author URI:        https://github.com/allterraindeveloper
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       allterrain-fields
 * Domain Path:       /languages
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * The plugin version.
 *
 * Also the cache-buster on every enqueued asset, which is why it is a constant
 * rather than read from the header at runtime: `get_plugin_data()` reads and
 * parses this file, and doing that on every admin request to learn a string this
 * file already contains is a strange way to spend an I/O.
 *
 * @since 0.1.0
 */
const ATCF_VERSION = '0.1.0';

/**
 * Absolute path to this plugin's directory, with a trailing slash.
 *
 * @since 0.1.0
 */
define( 'ATCF_PATH', plugin_dir_path( __FILE__ ) );

/**
 * URL of this plugin's directory, with a trailing slash.
 *
 * @since 0.1.0
 */
define( 'ATCF_URL', plugin_dir_url( __FILE__ ) );

/**
 * This file, for `register_activation_hook()` and friends.
 *
 * @since 0.1.0
 */
define( 'ATCF_FILE', __FILE__ );

/**
 * The capability that gates editing the *schema* — field groups themselves.
 *
 * Deliberately separate from the capability that gates editing a *value*. Those
 * are two different acts: changing what fields a post type has is a structural
 * change to the site, and filling one in is authoring. A contributor should be
 * able to write into a field on their own draft without being able to add a
 * field to every post on the site, and every capability check in this plugin
 * keeps that line.
 *
 * Values are never gated on this constant. They are gated on the capability of
 * the object holding them — `edit_post`, `edit_term`, `edit_user`,
 * `manage_options` — which is the check WordPress would have made anyway.
 *
 * @since 0.1.0
 */
const ATCF_MANAGE_CAP = 'manage_options';

require_once ATCF_PATH . 'includes/shell-api.php';
require_once ATCF_PATH . 'includes/helpers.php';
require_once ATCF_PATH . 'includes/post-types.php';
require_once ATCF_PATH . 'includes/schema.php';
require_once ATCF_PATH . 'includes/fields/registry.php';
require_once ATCF_PATH . 'includes/fields/types-basic.php';
require_once ATCF_PATH . 'includes/fields/types-choice.php';
require_once ATCF_PATH . 'includes/fields/types-content.php';
require_once ATCF_PATH . 'includes/fields/types-relational.php';
require_once ATCF_PATH . 'includes/fields/types-layout.php';
require_once ATCF_PATH . 'includes/fields/types-advanced.php';
require_once ATCF_PATH . 'includes/logic.php';
require_once ATCF_PATH . 'includes/calc.php';
require_once ATCF_PATH . 'includes/location.php';
require_once ATCF_PATH . 'includes/templates.php';
require_once ATCF_PATH . 'includes/content-types.php';
require_once ATCF_PATH . 'includes/store.php';
require_once ATCF_PATH . 'includes/relationships.php';
require_once ATCF_PATH . 'includes/api.php';
require_once ATCF_PATH . 'includes/compat.php';
require_once ATCF_PATH . 'includes/render/controls.php';
require_once ATCF_PATH . 'includes/render/metabox.php';
require_once ATCF_PATH . 'includes/render/term.php';
require_once ATCF_PATH . 'includes/render/user.php';
require_once ATCF_PATH . 'includes/render/options.php';
require_once ATCF_PATH . 'includes/save.php';
require_once ATCF_PATH . 'includes/validation.php';
require_once ATCF_PATH . 'includes/assets.php';
require_once ATCF_PATH . 'includes/rest.php';
require_once ATCF_PATH . 'includes/import-acf.php';
require_once ATCF_PATH . 'includes/json-sync.php';
require_once ATCF_PATH . 'includes/blocks.php';
require_once ATCF_PATH . 'includes/abilities.php';
require_once ATCF_PATH . 'includes/admin-page.php';
require_once ATCF_PATH . 'includes/shell/openstation.php';
require_once ATCF_PATH . 'includes/shell/identity.php';
require_once ATCF_PATH . 'includes/shell/explorer.php';
require_once ATCF_PATH . 'includes/shell/preview.php';
require_once ATCF_PATH . 'includes/shell/formula.php';

add_action( 'init', 'atcf_load_textdomain' );

/**
 * Loads translations.
 *
 * On `init` rather than `plugins_loaded`, which is where this used to go and
 * where WordPress 6.7 now warns about it: translations for a text domain cannot
 * be loaded before the domain's locale is known, and `init` is the first hook at
 * which it is.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_load_textdomain() {
	load_plugin_textdomain( 'allterrain-fields', false, dirname( plugin_basename( ATCF_FILE ) ) . '/languages' );
}

register_activation_hook( ATCF_FILE, 'atcf_activate' );

/**
 * Runs on activation.
 *
 * Registers the post type before flushing, because `flush_rewrite_rules()`
 * rebuilds from whatever is registered *now* — flushing first and registering
 * afterwards produces a rule set with no trace of this plugin in it, which is
 * the single most common way a plugin's own permalinks 404 until somebody visits
 * the Permalinks screen.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_activate() {
	atcf_register_post_types();
	flush_rewrite_rules();

	// The default group ships with nothing in it. A site that activates this
	// plugin and opens the builder should see an empty canvas with a palette
	// beside it, not an empty *list* with no way in — so the first run creates
	// one group and the builder opens on it.
	if ( ! get_option( 'atcf_bootstrapped' ) ) {
		update_option( 'atcf_bootstrapped', ATCF_VERSION, false );
	}
}

register_deactivation_hook( ATCF_FILE, 'atcf_deactivate' );

/**
 * Runs on deactivation.
 *
 * Only the rewrite flush. Nothing is deleted here — a deactivation is routinely
 * a debugging step, and a plugin that takes a site's content model with it when
 * somebody toggles it off is a plugin nobody dares toggle. Deleting belongs in
 * `uninstall.php`, which only runs on an explicit delete.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_deactivate() {
	flush_rewrite_rules();
}
