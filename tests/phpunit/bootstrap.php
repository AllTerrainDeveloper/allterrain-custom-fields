<?php
/**
 * PHPUnit bootstrap.
 *
 * Loads the WordPress test library, then loads this plugin as a must-use plugin
 * so it is present before the test suite's own `init` fires — which matters,
 * because the post types register on `init` at priority 5 and a plugin loaded
 * afterwards would have a test suite where no field group can exist.
 *
 * @package AllTerrain_Fields
 */

$atcf_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( ! $atcf_tests_dir ) {
	$atcf_tests_dir = rtrim( sys_get_temp_dir(), '/\\' ) . '/wordpress-tests-lib';
}

if ( ! file_exists( $atcf_tests_dir . '/includes/functions.php' ) ) {
	echo "Could not find the WordPress test library at {$atcf_tests_dir}.\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo "Set WP_TESTS_DIR, or run the suite through wp-env with `npm run test:php`.\n";

	exit( 1 );
}

require_once $atcf_tests_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function () {
		require dirname( __DIR__, 2 ) . '/allterrain-fields.php';
	}
);

require $atcf_tests_dir . '/includes/bootstrap.php';
