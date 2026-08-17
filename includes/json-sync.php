<?php
/**
 * JSON sync.
 *
 * A field group is the shape of a site's content, which makes it code — and code
 * belongs in version control, not in a database row that only exists on
 * production. So every save writes a JSON file, and the Tools window offers to
 * import a file whose contents differ from the database.
 *
 * **Automatic out, deliberate in.** The write is automatic because a file that
 * lags the database is worse than no file. The *read* is not: a file that
 * silently overwrote the database on every page load would make the builder
 * appear to lose changes on any site where the file is stale, which on a shared
 * host with a checked-in JSON directory is most of them. The Tools window
 * shows the difference and asks.
 *
 * The directory is `atcf-json` in the active theme, and the `atcf_json_dir`
 * filter below moves it anywhere else — including a directory another plugin
 * left behind, so a migrating site can keep its files where they already are.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * Where the JSON files live.
 *
 * @since 0.1.0
 *
 * @return string Absolute path with no trailing slash, or an empty string when
 *                there is nowhere writable.
 */
function atcf_json_dir() {
	$dir = get_stylesheet_directory() . '/atcf-json';

	/**
	 * Filters the directory field group JSON is written to.
	 *
	 * Return an empty string to switch the sync off entirely — which is the
	 * right answer on a site whose theme directory is not writable and whose
	 * deploys do not carry the files anyway.
	 *
	 * @since 0.1.0
	 *
	 * @param string $dir Absolute path.
	 */
	return (string) apply_filters( 'atcf_json_dir', $dir );
}

add_action( 'atcf_group_saved', 'atcf_write_group_json', 10, 1 );

/**
 * Writes a group's JSON file after every save.
 *
 * Failures are silent by design. The sync is a convenience on top of a save that
 * has already succeeded, and a theme directory that is not writable — which is
 * the correct configuration on a hardened host — must not turn every field group
 * save into an error the user cannot act on.
 *
 * @since 0.1.0
 *
 * @param array $group The saved canonical group.
 * @return bool True when a file was written.
 */
function atcf_write_group_json( $group ) {
	$dir = atcf_json_dir();

	if ( '' === $dir || ! is_array( $group ) || '' === (string) atcf_arr( $group, 'key', '' ) ) {
		return false;
	}

	if ( ! is_dir( $dir ) && ! wp_mkdir_p( $dir ) ) {
		return false;
	}

	if ( ! is_writable( $dir ) ) {
		return false;
	}

	// The post id never goes in the file. It is meaningless on any other install,
	// and a file carrying one makes an import overwrite whatever post holds that
	// id there.
	unset( $group['id'], $group['status'], $group['local'] );

	$encoded = wp_json_encode( $group, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

	if ( ! is_string( $encoded ) ) {
		return false;
	}

	// Pretty-printed with a trailing newline, because the file's whole purpose is
	// to be read in a diff. A one-line JSON blob makes every change to any field
	// look like a change to the whole group.
	return false !== file_put_contents( $dir . '/' . $group['key'] . '.json', $encoded . "\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- WP_Filesystem needs credentials this path cannot ask for, and a failed write here is designed to be silent.
}

/**
 * Every group found on disk.
 *
 * @since 0.1.0
 *
 * @return array<string,array> Group key => canonical group.
 */
function atcf_read_group_json() {
	$dir = atcf_json_dir();

	if ( '' === $dir || ! is_dir( $dir ) ) {
		return array();
	}

	$groups = array();

	foreach ( (array) glob( $dir . '/*.json' ) as $file ) {
		$raw = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- A local read of a file this plugin wrote; no HTTP involved.

		if ( ! is_string( $raw ) ) {
			continue;
		}

		$decoded = json_decode( $raw, true );

		if ( ! is_array( $decoded ) || '' === (string) atcf_arr( $decoded, 'key', '' ) ) {
			continue;
		}

		$group = atcf_normalize_group( $decoded );

		$groups[ $group['key'] ] = $group;
	}

	return $groups;
}

/**
 * What differs between the files and the database.
 *
 * Three buckets: on disk and not in the database, in both but different, and in
 * the database with no file. The third is not an error — it is a group created
 * on this site since the last deploy — so it is reported as `unsynced` rather
 * than as a deletion to apply.
 *
 * @since 0.1.0
 *
 * @return array[] The three lists.
 */
function atcf_json_diff() {
	$files    = atcf_read_group_json();
	$stored   = array();
	$new      = array();
	$modified = array();
	$unsynced = array();

	foreach ( atcf_get_groups( true ) as $group ) {
		if ( atcf_arr( $group, 'local', false ) ) {
			continue;
		}

		$stored[ $group['key'] ] = $group;
	}

	foreach ( $files as $key => $group ) {
		if ( ! isset( $stored[ $key ] ) ) {
			$new[] = array(
				'key'    => $key,
				'title'  => $group['title'],
				'fields' => count( atcf_flatten_fields( $group['fields'] ) ),
			);

			continue;
		}

		if ( atcf_group_fingerprint( $group ) !== atcf_group_fingerprint( $stored[ $key ] ) ) {
			$modified[] = array(
				'key'    => $key,
				'id'     => (int) atcf_arr( $stored[ $key ], 'id', 0 ),
				'title'  => $group['title'],
				'fields' => count( atcf_flatten_fields( $group['fields'] ) ),
			);
		}
	}

	foreach ( $stored as $key => $group ) {
		if ( ! isset( $files[ $key ] ) ) {
			$unsynced[] = array(
				'key'   => $key,
				'id'    => (int) atcf_arr( $group, 'id', 0 ),
				'title' => $group['title'],
			);
		}
	}

	return array(
		'new'      => $new,
		'modified' => $modified,
		'unsynced' => $unsynced,
		'dir'      => atcf_json_dir(),
		'writable' => '' !== atcf_json_dir() && is_dir( atcf_json_dir() ) && is_writable( atcf_json_dir() ),
	);
}

/**
 * A stable hash of a group's meaning.
 *
 * The post id, status and local flag are excluded because they are facts about
 * *this install* rather than about the group — a file and a database row that
 * agree completely would otherwise always compare as different.
 *
 * @since 0.1.0
 *
 * @param array $group Canonical group.
 * @return string The fingerprint.
 */
function atcf_group_fingerprint( $group ) {
	unset( $group['id'], $group['status'], $group['local'] );

	return md5( (string) wp_json_encode( $group ) );
}

/**
 * Imports the groups on disk into the database.
 *
 * @since 0.1.0
 *
 * @param string[] $keys Group keys to import. Empty imports everything that
 *                       differs.
 * @return array[] What was imported.
 */
function atcf_sync_from_json( $keys = array() ) {
	$files    = atcf_read_group_json();
	$diff     = atcf_json_diff();
	$wanted   = $keys ? array_map( 'atcf_sanitize_field_key', $keys ) : array_merge(
		wp_list_pluck( $diff['new'], 'key' ),
		wp_list_pluck( $diff['modified'], 'key' )
	);
	$imported = array();

	foreach ( $wanted as $key ) {
		if ( ! isset( $files[ $key ] ) ) {
			continue;
		}

		$group    = $files[ $key ];
		$existing = atcf_group_post_by_key( $key );

		if ( $existing ) {
			$group['id'] = $existing;
		}

		$saved = atcf_save_group( $group );

		if ( is_wp_error( $saved ) ) {
			continue;
		}

		$imported[] = array(
			'key'   => $key,
			'id'    => (int) $saved['id'],
			'title' => $saved['title'],
		);
	}

	return $imported;
}
