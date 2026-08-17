<?php
/**
 * Importing from Meta Box.
 *
 * The fixture is a real-shaped Meta Box Builder export — `name` meaning
 * label, `options` meaning choices, fields with no keys, a cloneable group,
 * the Conditional Logic extension's `visible` grammar — because the importer
 * exists exactly for the places the two dialects disagree.
 *
 * @package AllTerrain_Fields
 */

/**
 * The Meta Box importer.
 *
 * @group allterrain-fields
 */
class ATCF_Test_Import_Metabox extends WP_UnitTestCase {

	/**
	 * The fixture, decoded.
	 *
	 * @var array
	 */
	private $export;

	/**
	 * Reads the fixture.
	 */
	public function set_up() {
		parent::set_up();

		$this->export = json_decode(
			(string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/metabox-export.json' ),
			true
		);

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	/**
	 * Converts and saves the first fixture box.
	 *
	 * @return array The saved canonical group.
	 */
	private function import_events_box() {
		$box       = atcf_metabox_from_export_item( $this->export[0] );
		$converted = atcf_convert_metabox( $box );
		$saved     = atcf_save_group( $converted['group'] );

		$this->assertNotWPError( $saved );

		return $saved;
	}

	/**
	 * Finds a field in a saved group by name.
	 *
	 * @param array  $group Saved group.
	 * @param string $name  Field name.
	 * @return array|null The field.
	 */
	private function field( $group, $name ) {
		foreach ( atcf_flatten_fields( $group['fields'] ) as $field ) {
			if ( $field['name'] === $name ) {
				return $field;
			}
		}

		return null;
	}

	/**
	 * Identity: ids become names, names become labels, and the minted keys are
	 * deterministic so a second import updates instead of duplicating.
	 *
	 * The ids are the part that carries the data — `get_post_meta( $id,
	 * 'capacity', true )` is the same row under both plugins for every simple
	 * field — so they must cross verbatim.
	 *
	 * @covers ::atcf_convert_metabox
	 * @covers ::atcf_convert_metabox_field
	 */
	public function test_identity_survives_the_crossing() {
		$saved = $this->import_events_box();

		$this->assertSame( atcf_metabox_group_key( 'event-details' ), $saved['key'] );
		$this->assertSame( 'Event details', $saved['title'] );

		$capacity = $this->field( $saved, 'capacity' );

		$this->assertSame( 'number', $capacity['type'] );
		$this->assertSame( 'Capacity', $capacity['label'] );
		$this->assertSame( atcf_metabox_field_key( 'event-details', 'capacity' ), $capacity['key'] );

		// Deterministic: converting again mints the same keys.
		$again = atcf_convert_metabox( atcf_metabox_from_export_item( $this->export[0] ) );

		$this->assertSame( $saved['key'], $again['group']['key'] );
	}

	/**
	 * The dialect translations land: types, options→choices, std→default.
	 *
	 * @covers ::atcf_convert_metabox_settings
	 * @covers ::atcf_metabox_type_map
	 */
	public function test_dialect_differences_are_translated() {
		$saved = $this->import_events_box();

		$this->assertSame( 'date_picker', $this->field( $saved, 'event_date' )['type'] );
		$this->assertSame( 'When it happens.', $this->field( $saved, 'event_date' )['instructions'] );
		$this->assertTrue( $this->field( $saved, 'event_date' )['required'] );

		$kind       = $this->field( $saved, 'kind' );
		$normalized = atcf_normalize_choices( $kind['settings']['choices'] );

		$this->assertSame( 'select', $kind['type'] );
		$this->assertSame( array( 'concert', 'talk', 'workshop' ), array_values( wp_list_pluck( $normalized, 'value' ) ) );
		$this->assertSame( 'talk', $kind['settings']['default_value'] );

		// checkbox → switch, with the description as its message.
		$online = $this->field( $saved, 'is_online' );

		$this->assertSame( 'true_false', $online['type'] );
		$this->assertTrue( (bool) $online['settings']['default_value'] );

		// post → post_object when single, relationship when multiple.
		$this->assertSame( 'post_object', $this->field( $saved, 'sponsor' )['type'] );
		$this->assertSame( array( 'sponsor' ), $this->field( $saved, 'sponsor' )['settings']['post_types'] );
		$this->assertSame( 'relationship', $this->field( $saved, 'related_events' )['type'] );

		// taxonomy keeps its assign-terms behaviour.
		$topics = $this->field( $saved, 'topics' );

		$this->assertSame( 'taxonomy', $topics['type'] );
		$this->assertSame( 'event_topic', $topics['settings']['taxonomy'] );
		$this->assertTrue( (bool) $topics['settings']['save_terms'] );
		$this->assertTrue( (bool) $topics['settings']['multiple'] );

		// user role filter from query_args.
		$this->assertSame( array( 'editor' ), $this->field( $saved, 'organiser' )['settings']['roles'] );

		// image_advanced → gallery, with the upload cap carried.
		$gallery = $this->field( $saved, 'gallery_shots' );

		$this->assertSame( 'gallery', $gallery['type'] );
		$this->assertSame( 8, $gallery['settings']['max_items'] );
	}

	/**
	 * A cloneable group is a repeater; a cloneable scalar is a one-column
	 * repeater; both say what happened to the old values.
	 *
	 * @covers ::atcf_convert_metabox_field
	 * @covers ::atcf_convert_metabox_settings
	 */
	public function test_cloneables_become_repeaters() {
		$box       = atcf_metabox_from_export_item( $this->export[0] );
		$converted = atcf_convert_metabox( $box );
		$saved     = atcf_save_group( $converted['group'] );

		$speakers = $this->field( $saved, 'speakers' );

		$this->assertSame( 'repeater', $speakers['type'] );
		$this->assertSame( 1, $speakers['settings']['min_items'] );
		$this->assertSame( 12, $speakers['settings']['max_items'] );

		$subs = $speakers['settings']['sub_fields'];

		$this->assertSame( array( 'full_name', 'headshot' ), array_values( wp_list_pluck( $subs, 'name' ) ) );
		$this->assertSame( 'image', $subs[1]['type'] );

		// The cloneable text became a repeater holding one text field.
		$note = $this->field( $saved, 'ticket_note' );

		$this->assertSame( 'repeater', $note['type'] );
		$this->assertSame( 3, $note['settings']['max_items'] );
		$this->assertSame( 'text', $note['settings']['sub_fields'][0]['type'] );

		// And the serialised-storage caveat was said out loud.
		$this->assertNotEmpty(
			array_filter(
				$converted['warnings'],
				static fn( $warning ) => false !== strpos( $warning, 'Speakers' )
			)
		);
	}

	/**
	 * The Conditional Logic grammar converts, ids rewritten to minted keys.
	 *
	 * @covers ::atcf_convert_metabox_conditional
	 */
	public function test_conditional_logic_converts() {
		$saved = $this->import_events_box();
		$venue = $this->field( $saved, 'venue_url' );

		$conditional = $venue['conditional'];

		$this->assertTrue( $conditional['enabled'] );
		$this->assertSame( 'show', $conditional['action'] );
		$this->assertSame( 'all', $conditional['match'] );
		$this->assertCount( 2, $conditional['rules'] );

		// The rule references `is_online` by id; the converted rule points at
		// the key that field was minted — same derivation, no lookup needed.
		$this->assertSame( atcf_metabox_field_key( 'event-details', 'is_online' ), $conditional['rules'][0]['field'] );
		$this->assertSame( 'is_not', $conditional['rules'][0]['operator'] );
		$this->assertSame( 'greater', $conditional['rules'][1]['operator'] );
	}

	/**
	 * Placement settings become location rules.
	 *
	 * @covers ::atcf_convert_metabox_location
	 */
	public function test_placement_becomes_location_rules() {
		$saved = $this->import_events_box();

		$this->assertSame( 'post_type', $saved['location'][0][0]['param'] );
		$this->assertSame( 'event', $saved['location'][0][0]['value'] );
		$this->assertSame( 'seamless', $saved['settings']['style'] );

		// The term box lands on its taxonomy.
		$term_box  = atcf_metabox_from_export_item( $this->export[1] );
		$converted = atcf_convert_metabox( $term_box );

		$this->assertSame( 'taxonomy', $converted['group']['location'][0][0]['param'] );
		$this->assertSame( 'event_topic', $converted['group']['location'][0][0]['value'] );
		$this->assertSame( 'color_picker', $converted['group']['fields'][0]['type'] );
	}

	/**
	 * Headings become messages, unknown types fall back to text, and both are
	 * reported rather than silently shaped.
	 *
	 * @covers ::atcf_convert_metabox_field
	 */
	public function test_the_untranslatable_goes_loudly() {
		$box       = atcf_metabox_from_export_item( $this->export[0] );
		$converted = atcf_convert_metabox( $box );
		$saved     = atcf_save_group( $converted['group'] );

		// The heading is a message field carrying its text.
		$messages = array_filter( atcf_flatten_fields( $saved['fields'] ), static fn( $field ) => 'message' === $field['type'] );

		$this->assertNotEmpty( $messages );
		$this->assertStringContainsString( 'Logistics', reset( $messages )['settings']['message'] );

		// The unknown slider_field fell back to text, loudly, keeping its id.
		$chart = $this->field( $saved, 'seating_chart' );

		$this->assertSame( 'text', $chart['type'] );
		$this->assertNotEmpty(
			array_filter(
				$converted['warnings'],
				static fn( $warning ) => false !== strpos( $warning, 'slider_field' )
			)
		);
	}

	/**
	 * Values Meta Box wrote for simple fields read back through the imported
	 * schema unchanged.
	 *
	 * This is the migration promise for the shapes that share storage: one
	 * meta row under the field id. (Groups and cloneables do not share it,
	 * and the importer says so instead of pretending.)
	 *
	 * @covers ::atcf_convert_metabox
	 */
	public function test_existing_simple_values_are_readable_unchanged() {
		$saved = $this->import_events_box();
		$post  = self::factory()->post->create();

		unset( $saved );

		// What Meta Box itself would have written: one plain row per field.
		update_post_meta( $post, 'capacity', '250' );
		update_post_meta( $post, 'kind', 'concert' );
		update_post_meta( $post, 'event_date', '2026-09-01' );

		$this->assertEquals( 250, atcf_get_field( 'capacity', $post ) );
		$this->assertSame( 'concert', atcf_get_field( 'kind', $post, false ) );
		$this->assertNotEmpty( atcf_get_field( 'event_date', $post, false ) );
	}

	/**
	 * The REST route imports a pasted export, idempotently, and reports
	 * warnings per box.
	 *
	 * @covers ::atcf_rest_metabox_import
	 */
	public function test_rest_import_is_idempotent() {
		global $wp_rest_server;

		$wp_rest_server = new WP_REST_Server();

		do_action( 'rest_api_init' );

		$request = new WP_REST_Request( 'POST', '/' . ATCF_REST_NAMESPACE . '/import/metabox' );

		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( (string) wp_json_encode( array( 'boxes' => $this->export ) ) );

		$first = $wp_rest_server->dispatch( $request )->get_data();

		$this->assertCount( 2, $first['imported'] );
		$this->assertFalse( $first['imported'][0]['updated'] );
		$this->assertNotEmpty( $first['imported'][0]['warnings'] );

		$second = $wp_rest_server->dispatch( $request )->get_data();

		$this->assertTrue( $second['imported'][0]['updated'] );
		$this->assertSame( $first['imported'][0]['id'], $second['imported'][0]['id'] );
	}

	/**
	 * The REST route is closed to non-managers.
	 *
	 * @covers ::atcf_register_metabox_import_routes
	 */
	public function test_rest_import_is_gated() {
		global $wp_rest_server;

		$wp_rest_server = new WP_REST_Server();

		do_action( 'rest_api_init' );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$request = new WP_REST_Request( 'POST', '/' . ATCF_REST_NAMESPACE . '/import/metabox' );

		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( (string) wp_json_encode( array( 'boxes' => $this->export ) ) );

		$this->assertSame( 403, $wp_rest_server->dispatch( $request )->get_status() );
	}

	/**
	 * Builder posts left behind in the database are found and rebuilt.
	 *
	 * @covers ::atcf_metabox_boxes_from_database
	 */
	public function test_database_leftovers_are_rebuilt() {
		self::factory()->post->create(
			array(
				'post_type'    => 'meta-box',
				'post_status'  => 'publish',
				'post_title'   => 'Leftover box',
				'post_name'    => 'leftover-box',
				'post_content' => (string) wp_json_encode(
					array(
						'meta_box' => array(
							'id'         => 'leftover-box',
							'title'      => 'Leftover box',
							'post_types' => array( 'page' ),
							'fields'     => array(
								array(
									'id'   => 'subtitle',
									'name' => 'Subtitle',
									'type' => 'text',
								),
							),
						),
					)
				),
			)
		);

		$found = atcf_metabox_boxes_from_database();

		$this->assertCount( 1, $found );
		$this->assertSame( 'leftover-box', atcf_metabox_box_id( $found[0] ) );

		$converted = atcf_convert_metabox( $found[0] );
		$saved     = atcf_save_group( $converted['group'] );

		$this->assertNotWPError( $saved );
		$this->assertSame( 'subtitle', $saved['fields'][0]['name'] );
		$this->assertSame( 'page', $saved['location'][0][0]['value'] );
	}

	/**
	 * A live `rwmb_meta_boxes` registration is detected when Meta Box is
	 * "active", and code-registered boxes come through it.
	 *
	 * @covers ::atcf_metabox_detected_boxes
	 */
	public function test_live_registrations_are_detected() {
		// Stand in for Meta Box being active.
		if ( ! defined( 'RWMB_VER' ) ) {
			define( 'RWMB_VER', 'test' );
		}

		$register = static function ( $boxes ) {
			$boxes[] = array(
				'id'         => 'from-code',
				'title'      => 'From code',
				'post_types' => array( 'post' ),
				'fields'     => array(
					array(
						'id'   => 'code_note',
						'name' => 'Note',
						'type' => 'text',
					),
				),
			);

			return $boxes;
		};

		add_filter( 'rwmb_meta_boxes', $register );

		$found = atcf_metabox_detected_boxes();

		remove_filter( 'rwmb_meta_boxes', $register );

		$ids = array_map( 'atcf_metabox_box_id', $found );

		$this->assertContains( 'from-code', $ids );
	}
}
