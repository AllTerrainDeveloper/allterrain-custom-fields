<?php
/**
 * Deleting the plugin.
 *
 * This file runs on an explicit **Delete**, never on a deactivation. That
 * distinction is the whole design: deactivating is routinely a debugging step,
 * and a plugin that took a site's content model with it when somebody toggled it
 * off is a plugin nobody dares toggle.
 *
 * Even here, the default is to delete the **schema** and keep the **values**.
 *
 * A field group is this plugin's; the values are the site's. `hero_title` on a
 * hundred posts is content somebody wrote, stored in ordinary meta rows that any
 * theme can still read with `get_post_meta()` — and a site removing this plugin
 * to move to another one needs those rows exactly where they are. Deleting them
 * would turn "I tried a different plugin" into "I lost a year of copy".
 *
 * A site that genuinely wants everything gone sets one constant in `wp-config.php`
 * before deleting:
 *
 *     define( 'ATCF_DELETE_ALL_DATA', true );
 *
 * @package AllTerrain_Fields
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;

// The post types are not registered during an uninstall — the plugin's files are
// not loaded — so the deletion works on the raw post type strings rather than on
// the constants that would normally name them.
$atcf_types = array( 'atcf_field_group', 'atcf_options_page' );

$atcf_ids = $wpdb->get_col(
	$wpdb->prepare(
		"SELECT ID FROM {$wpdb->posts} WHERE post_type IN ( %s, %s )",
		$atcf_types[0],
		$atcf_types[1]
	)
);

foreach ( $atcf_ids as $atcf_id ) {
	// `wp_delete_post()` is unavailable in the sense that it would leave the
	// post's meta behind on a force-delete of an unregistered type, so the rows
	// go directly. Every query here is prepared, and object caching is
	// meaningless for rows that are about to stop existing.
	$wpdb->delete( $wpdb->postmeta, array( 'post_id' => (int) $atcf_id ), array( '%d' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	$wpdb->delete( $wpdb->posts, array( 'ID' => (int) $atcf_id ), array( '%d' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
}

delete_option( 'atcf_bootstrapped' );

// Everything below this line only runs when the site has explicitly asked for
// it, and it is not reversible.
if ( ! defined( 'ATCF_DELETE_ALL_DATA' ) || ! ATCF_DELETE_ALL_DATA ) {
	return;
}

/*
 * The reference rows are the only trace of this plugin left on a value.
 *
 * `_hero_title` holds the field key that wrote `hero_title`. Deleting the
 * references and the shadow rows removes the plugin's own bookkeeping while
 * leaving every value a theme reads — which is what "delete all data" means
 * here, because the values belong to the site rather than to the plugin even
 * when the site has asked for a clean sweep.
 */
$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
	"DELETE FROM {$wpdb->postmeta} WHERE meta_key LIKE '\_atcf\_rel\_%'"
);

$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
	"DELETE FROM {$wpdb->termmeta} WHERE meta_key LIKE '\_atcf\_rel\_%'"
);

$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
	"DELETE FROM {$wpdb->usermeta} WHERE meta_key LIKE '\_atcf\_rel\_%'"
);
