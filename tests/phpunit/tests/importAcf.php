<?php
/**
 * Importing from ACF.
 *
 * The fixture is a real-shaped ACF export — the choices map, the layouts map,
 * the OR-of-ANDs conditional grammar, `min`/`max` where this plugin says
 * `min_items`/`max_items` — because the whole point of the importer is the
 * corners where the two dialects disagree. A fixture written in this plugin's
 * own shapes would test nothing.
 *
 * @package AllTerrain_Fields
 */

/**
 * The ACF importer.
 *
 * @group allterrain-fields
 */
class ATCF_Test_Import_Acf extends WP_UnitTestCase {

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
			(string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/acf-export.json' ),
			true
		);

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	/**
	 * Converts and saves the fixture group, once per test.
	 *
	 * @return array The saved canonical group.
	 */
	private function import_fixture() {
		$converted = atcf_convert_acf_group( $this->export[0] );
		$saved     = atcf_save_group( $converted['group'] );

		$this->assertNotWPError( $saved );

		return $saved;
	}

	/**
	 * Finds a field in a saved group by key.
	 *
	 * @param array  $group Saved group.
	 * @param string $key   Field key.
	 * @return array|null The field.
	 */
	private function field( $group, $key ) {
		foreach ( atcf_flatten_fields( $group['fields'] ) as $field ) {
			if ( $field['key'] === $key ) {
				return $field;
			}
		}

		return null;
	}

	/**
	 * Keys, names and identical type slugs come across verbatim.
	 *
	 * Verbatim is the contract: the keys are what `_hero_title` reference rows
	 * all over a migrating site's database already hold, and the names are the
	 * meta keys the values live under. Change either and the import produces a
	 * working schema pointing at nothing.
	 *
	 * @covers ::atcf_convert_acf_group
	 * @covers ::atcf_convert_acf_field
	 */
	public function test_identity_survives_the_crossing() {
		$saved = $this->import_fixture();

		$this->assertSame( 'group_acf_property', $saved['key'] );
		$this->assertSame( 'Property details', $saved['title'] );

		$price = $this->field( $saved, 'field_acf_price' );

		$this->assertSame( 'price', $price['name'] );
		$this->assertSame( 'number', $price['type'] );
		$this->assertTrue( $price['required'] );
		$this->assertSame( 50, $price['wrapper']['width'] );
		$this->assertSame( 'price-cell', $price['wrapper']['class'] );
	}

	/**
	 * The renamed types and settings land under their names here.
	 *
	 * @covers ::atcf_convert_acf_field
	 * @covers ::atcf_convert_acf_settings
	 */
	public function test_dialect_differences_are_translated() {
		$saved = $this->import_fixture();

		// google_map → location.
		$this->assertSame( 'location', $this->field( $saved, 'field_acf_map' )['type'] );

		// Repeater min/max → min_items/max_items.
		$rooms = $this->field( $saved, 'field_acf_rooms' );

		$this->assertSame( 1, $rooms['settings']['min_items'] );
		$this->assertSame( 20, $rooms['settings']['max_items'] );
		$this->assertCount( 2, $rooms['settings']['sub_fields'] );

		// Relationship post_type → post_types, max → max_items.
		$related = $this->field( $saved, 'field_acf_related' );

		$this->assertSame( array( 'property' ), $related['settings']['post_types'] );
		$this->assertSame( 4, $related['settings']['max_items'] );
		$this->assertArrayNotHasKey( 'post_type', $related['settings'] );

		// User role → roles.
		$this->assertSame( array( 'editor', 'author' ), $this->field( $saved, 'field_acf_agent' )['settings']['roles'] );

		// Taxonomy field_type → multiple.
		$areas = $this->field( $saved, 'field_acf_areas' );

		$this->assertTrue( (bool) $areas['settings']['multiple'] );
		$this->assertSame( 'post_tag', $areas['settings']['taxonomy'] );
	}

	/**
	 * A choices map becomes the list form, with values and labels intact.
	 *
	 * @covers ::atcf_convert_acf_settings
	 */
	public function test_choices_survive() {
		$saved  = $this->import_fixture();
		$status = $this->field( $saved, 'field_acf_status' );

		// The map form is carried as-is — it is a native dialect here, read by
		// the same normaliser every render goes through.
		$normalized = atcf_normalize_choices( $status['settings']['choices'] );

		$this->assertSame( array( 'for_sale', 'sold', 'withdrawn' ), array_values( wp_list_pluck( $normalized, 'value' ) ) );
		$this->assertContains( 'For sale', wp_list_pluck( $normalized, 'label' ) );
	}

	/**
	 * Conditional logic keeps its meaning where the grammar allows it.
	 *
	 * One ACF group of two rules is an AND; two ACF groups of one rule each are
	 * an OR. Both exist in the fixture and both must come across saying the
	 * same thing they said before.
	 *
	 * @covers ::atcf_convert_acf_conditional
	 */
	public function test_conditional_logic_keeps_its_meaning() {
		$saved = $this->import_fixture();

		$and = $this->field( $saved, 'field_acf_sold_note' )['conditional'];

		$this->assertTrue( $and['enabled'] );
		$this->assertSame( 'all', $and['match'] );
		$this->assertCount( 2, $and['rules'] );
		$this->assertSame( 'field_acf_status', $and['rules'][0]['field'] );
		$this->assertSame( 'is', $and['rules'][0]['operator'] );
		$this->assertSame( 'greater', $and['rules'][1]['operator'] );

		$or = $this->field( $saved, 'field_acf_highlight' )['conditional'];

		$this->assertSame( 'any', $or['match'] );
		$this->assertCount( 2, $or['rules'] );
	}

	/**
	 * Flexible content's layout map becomes the list form, insides converted.
	 *
	 * @covers ::atcf_convert_acf_settings
	 */
	public function test_flexible_layouts_convert() {
		$saved    = $this->import_fixture();
		$sections = $this->field( $saved, 'field_acf_sections' );
		$layouts  = $sections['settings']['layouts'];

		$this->assertCount( 2, $layouts );
		$this->assertSame( array( 'hero', 'quote' ), array_values( wp_list_pluck( $layouts, 'name' ) ) );
		$this->assertSame( 1, $layouts[0]['max'] );
		$this->assertSame( 'heading', $layouts[0]['sub_fields'][0]['name'] );
	}

	/**
	 * Location rules translate, and the untranslatable ones go loudly.
	 *
	 * @covers ::atcf_convert_acf_location
	 */
	public function test_location_rules_translate() {
		$converted = atcf_convert_acf_group( $this->export[0] );
		$location  = $converted['group']['location'];

		// The first ACF group: post_type == property AND page_template != …,
		// with page_template renamed on the way through.
		$this->assertSame( 'post_type', $location[0][0]['param'] );
		$this->assertSame( 'post_template', $location[0][1]['param'] );
		$this->assertSame( '!=', $location[0][1]['operator'] );

		// The second ACF group only held current_user_role, which does not
		// exist here — the whole group goes, and a warning says so.
		$this->assertCount( 1, $location );
		$this->assertNotEmpty(
			array_filter(
				$converted['warnings'],
				static fn( $warning ) => false !== strpos( $warning, 'current_user_role' )
			)
		);
	}

	/**
	 * An unknown field type falls back to text rather than vanishing.
	 *
	 * The stored value keeps its meta key either way; a dropped field would
	 * orphan it invisibly.
	 *
	 * @covers ::atcf_convert_acf_field
	 */
	public function test_unknown_type_falls_back_to_text_with_a_warning() {
		$converted = atcf_convert_acf_group( $this->export[0] );
		$saved     = atcf_save_group( $converted['group'] );
		$star      = $this->field( $saved, 'field_acf_star' );

		$this->assertSame( 'text', $star['type'] );
		$this->assertSame( 'star_rating', $star['name'] );
		$this->assertNotEmpty(
			array_filter(
				$converted['warnings'],
				static fn( $warning ) => false !== strpos( $warning, 'star_rating_field' )
			)
		);
	}

	/**
	 * Group settings map across, including the renamed metabox position.
	 *
	 * @covers ::atcf_convert_acf_group
	 */
	public function test_group_settings_map() {
		$saved = $this->import_fixture();

		$this->assertSame( 'after_title', $saved['settings']['position'] );
		$this->assertSame( 'seamless', $saved['settings']['style'] );
		$this->assertSame( 'left', $saved['settings']['label_placement'] );
		$this->assertSame( 'field', $saved['settings']['instruction_placement'] );
		$this->assertSame( 3, $saved['settings']['menu_order'] );
		$this->assertSame( array( 'the_content' ), $saved['settings']['hide_on_screen'] );
		$this->assertSame( 'Everything a listing carries.', $saved['settings']['description'] );
	}

	/**
	 * Values written under ACF are readable through the imported schema.
	 *
	 * This is the migration promise in one test: the meta rows an ACF site
	 * already has, read back through `atcf_get_field()` with no value
	 * migration in between.
	 *
	 * @covers ::atcf_convert_acf_group
	 */
	public function test_existing_acf_values_are_readable_unchanged() {
		$saved = $this->import_fixture();
		$post  = self::factory()->post->create();

		unset( $saved );

		// What ACF itself would have written: the value row and the key row,
		// repeater count under the field name, rows as name_index_sub.
		update_post_meta( $post, 'price', '250000' );
		update_post_meta( $post, '_price', 'field_acf_price' );
		update_post_meta( $post, 'rooms', '2' );
		update_post_meta( $post, '_rooms', 'field_acf_rooms' );
		update_post_meta( $post, 'rooms_0_name', 'Kitchen' );
		update_post_meta( $post, '_rooms_0_name', 'field_acf_room_name' );
		update_post_meta( $post, 'rooms_0_size', '12' );
		update_post_meta( $post, '_rooms_0_size', 'field_acf_room_size' );
		update_post_meta( $post, 'rooms_1_name', 'Bedroom' );
		update_post_meta( $post, '_rooms_1_name', 'field_acf_room_name' );
		update_post_meta( $post, 'rooms_1_size', '14' );
		update_post_meta( $post, '_rooms_1_size', 'field_acf_room_size' );

		$this->assertEquals( 250000, atcf_get_field( 'price', $post ) );

		$rooms = atcf_get_field( 'rooms', $post, false );

		$this->assertCount( 2, $rooms );
		$this->assertSame( 'Kitchen', $rooms[0]['name'] );
		$this->assertEquals( 14, $rooms[1]['size'] );
	}

	/**
	 * The REST route imports a pasted export, idempotently.
	 *
	 * @covers ::atcf_rest_acf_import
	 */
	public function test_rest_import_is_idempotent() {
		global $wp_rest_server;

		$wp_rest_server = new WP_REST_Server();

		do_action( 'rest_api_init' );

		$request = new WP_REST_Request( 'POST', '/' . ATCF_REST_NAMESPACE . '/import/acf' );

		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( (string) wp_json_encode( array( 'groups' => $this->export ) ) );

		$first = $wp_rest_server->dispatch( $request )->get_data();

		$this->assertFalse( $first['imported'][0]['updated'] );
		$this->assertNotEmpty( $first['imported'][0]['warnings'] );

		$second = $wp_rest_server->dispatch( $request )->get_data();

		$this->assertTrue( $second['imported'][0]['updated'] );
		$this->assertSame( $first['imported'][0]['id'], $second['imported'][0]['id'] );
	}

	/**
	 * The REST route is closed to non-managers.
	 *
	 * @covers ::atcf_register_acf_import_routes
	 */
	public function test_rest_import_is_gated() {
		global $wp_rest_server;

		$wp_rest_server = new WP_REST_Server();

		do_action( 'rest_api_init' );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$request = new WP_REST_Request( 'POST', '/' . ATCF_REST_NAMESPACE . '/import/acf' );

		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( (string) wp_json_encode( array( 'groups' => $this->export ) ) );

		$this->assertSame( 403, $wp_rest_server->dispatch( $request )->get_status() );
	}

	/**
	 * Groups left behind in the database by a deactivated ACF are found and
	 * rebuilt, nesting included.
	 *
	 * @covers ::atcf_acf_groups_from_database
	 * @covers ::atcf_acf_fields_from_posts
	 */
	public function test_database_leftovers_are_rebuilt() {
		$group_id = self::factory()->post->create(
			array(
				'post_type'    => 'acf-field-group',
				'post_status'  => 'publish',
				'post_title'   => 'Leftover group',
				'post_name'    => 'group_leftover',
				'post_content' => serialize( // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.serialize_serialize -- Building the exact rows ACF writes.
					array(
						'location'   => array(
							array(
								array(
									'param'    => 'post_type',
									'operator' => '==',
									'value'    => 'page',
								),
							),
						),
						'menu_order' => 0,
						'position'   => 'normal',
						'active'     => true,
					)
				),
			)
		);

		$repeater_id = self::factory()->post->create(
			array(
				'post_type'    => 'acf-field',
				'post_status'  => 'publish',
				'post_parent'  => $group_id,
				'post_title'   => 'Team',
				'post_excerpt' => 'team',
				'post_name'    => 'field_leftover_team',
				'menu_order'   => 0,
				'post_content' => serialize( // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.serialize_serialize
					array(
						'type' => 'repeater',
						'min'  => 0,
						'max'  => 6,
					)
				),
			)
		);

		self::factory()->post->create(
			array(
				'post_type'    => 'acf-field',
				'post_status'  => 'publish',
				'post_parent'  => $repeater_id,
				'post_title'   => 'Member',
				'post_excerpt' => 'member',
				'post_name'    => 'field_leftover_member',
				'menu_order'   => 0,
				'post_content' => serialize( // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.serialize_serialize
					array( 'type' => 'text' )
				),
			)
		);

		$found = atcf_acf_groups_from_database();

		$this->assertCount( 1, $found );
		$this->assertSame( 'group_leftover', $found[0]['key'] );
		$this->assertSame( 'repeater', $found[0]['fields'][0]['type'] );
		$this->assertSame( 'member', $found[0]['fields'][0]['sub_fields'][0]['name'] );

		$converted = atcf_convert_acf_group( $found[0] );
		$saved     = atcf_save_group( $converted['group'] );

		$this->assertNotWPError( $saved );
		$this->assertSame( 6, $this->field( $saved, 'field_leftover_team' )['settings']['max_items'] );
		$this->assertSame( 'member', $this->field( $saved, 'field_leftover_member' )['name'] );
	}
}
