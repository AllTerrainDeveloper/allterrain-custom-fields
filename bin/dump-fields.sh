#!/usr/bin/env bash
#
# Dumps the real edit-screen markup for a field group into `bin/fields-sample.html`,
# so `harness.html?window=fields` can mount the field runtime against it.
#
# The point of dumping rather than hand-writing the markup: a hand-written
# approximation passes while the real renderer drifts away from it, which is the
# one thing a harness must not do.
#
# Usage:  bin/dump-fields.sh [group-key]
set -euo pipefail

KEY="${1:-group_atcf_demo_product}"

npx wp-env run cli wp eval "
\$group = null;
foreach ( atcf_get_groups( true ) as \$candidate ) {
	if ( '${KEY}' === \$candidate['key'] ) {
		\$group = \$candidate;
	}
}

if ( ! \$group ) {
	WP_CLI::error( 'No field group with the key ${KEY}. Run bin/demo.php first.' );
}

\$types = atcf_group_post_types( \$group );
\$posts = get_posts( array( 'post_type' => \$types, 'numberposts' => 1, 'fields' => 'ids' ) );

ob_start();
atcf_render_group_fields( \$group, array( 'type' => 'post', 'id' => \$posts ? \$posts[0] : 0 ) );

file_put_contents(
	ABSPATH . 'wp-content/plugins/allterrain-fields/bin/fields-sample.html',
	ob_get_clean()
);

WP_CLI::success( 'Dumped ${KEY}. Open harness.html?window=fields.' );
"
