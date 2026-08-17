<?php
/**
 * The normaliser.
 *
 * One function decides what a field group *is*, and everything else in the
 * plugin is allowed to assume the shape it produces. These tests are that
 * assumption written down.
 *
 * @package AllTerrain_Fields
 */

/**
 * Schema normalisation.
 *
 * @group allterrain-fields
 */
class ATCF_Test_Schema extends WP_UnitTestCase {

	/**
	 * Sets an administrator, since saving a group is gated on `manage_options`.
	 */
	public function set_up() {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	/**
	 * An empty array normalises to a complete group.
	 *
	 * Every consumer of a group reads `$group['settings']['position']` without
	 * checking; this is what makes that safe.
	 *
	 * @covers ::atcf_normalize_group
	 */
	public function test_empty_group_gains_every_key() {
		$group = atcf_normalize_group( array() );

		$this->assertArrayHasKey( 'key', $group );
		$this->assertArrayHasKey( 'title', $group );
		$this->assertArrayHasKey( 'fields', $group );
		$this->assertArrayHasKey( 'location', $group );
		$this->assertArrayHasKey( 'settings', $group );

		foreach ( array( 'active', 'position', 'style', 'label_placement', 'instruction_placement', 'menu_order', 'hide_on_screen', 'show_in_rest', 'block' ) as $key ) {
			$this->assertArrayHasKey( $key, $group['settings'], "settings.{$key} is missing." );
		}

		$this->assertStringStartsWith( 'group_', $group['key'] );
	}

	/**
	 * A field with no name takes one from its label.
	 *
	 * Which is what somebody typing "Hero title" expects to find in
	 * `get_post_meta()`.
	 *
	 * @covers ::atcf_normalize_field
	 */
	public function test_name_is_derived_from_the_label() {
		$field = atcf_normalize_field(
			array(
				'label' => 'Hero Title!',
				'type'  => 'text',
			)
		);

		$this->assertSame( 'hero_title', $field['name'] );
	}

	/**
	 * Two fields with one name cannot both write to the same meta row.
	 *
	 * The symptom of the bug this prevents is "my field keeps losing its value",
	 * which points at everything except the real cause.
	 *
	 * @covers ::atcf_normalize_group
	 */
	public function test_duplicate_names_are_made_unique() {
		$group = atcf_normalize_group(
			array(
				'fields' => array(
					array(
						'label' => 'Title',
						'type'  => 'text',
					),
					array(
						'label' => 'Title',
						'type'  => 'text',
					),
					array(
						'label' => 'Title',
						'type'  => 'text',
					),
				),
			)
		);

		$this->assertSame( array( 'title', 'title_2', 'title_3' ), wp_list_pluck( $group['fields'], 'name' ) );
	}

	/**
	 * Two repeaters may each hold a field called `title`.
	 *
	 * Their stored keys are `team_0_title` and `links_0_title`, so deduplicating
	 * them against the outer scope would rename one for no reason and orphan its
	 * values.
	 *
	 * @covers ::atcf_normalize_group
	 */
	public function test_sub_fields_have_their_own_name_scope() {
		$group = atcf_normalize_group(
			array(
				'fields' => array(
					array(
						'label'    => 'Team',
						'type'     => 'repeater',
						'settings' => array(
							'sub_fields' => array(
								array(
									'label' => 'Title',
									'type'  => 'text',
								),
							),
						),
					),
					array(
						'label'    => 'Links',
						'type'     => 'repeater',
						'settings' => array(
							'sub_fields' => array(
								array(
									'label' => 'Title',
									'type'  => 'text',
								),
							),
						),
					),
				),
			)
		);

		$this->assertSame( 'title', $group['fields'][0]['settings']['sub_fields'][0]['name'] );
		$this->assertSame( 'title', $group['fields'][1]['settings']['sub_fields'][0]['name'] );
	}

	/**
	 * A field's key survives a rename of its name.
	 *
	 * Conditional logic joins on the key, which is what makes renaming a field
	 * safe. Joining on the name is the mistake every rewrite of this makes once.
	 *
	 * @covers ::atcf_normalize_field
	 */
	public function test_key_is_stable_across_renames() {
		$first  = atcf_normalize_field(
			array(
				'label' => 'Sub heading',
				'type'  => 'text',
			)
		);
		$second = atcf_normalize_field(
			array_merge(
				$first,
				array(
					'label' => 'Standfirst',
					'name'  => 'standfirst',
				)
			)
		);

		$this->assertSame( $first['key'], $second['key'] );
		$this->assertNotSame( $first['name'], $second['name'] );
	}

	/**
	 * A field type's settings are filled in from its registration.
	 *
	 * @covers ::atcf_normalize_field
	 */
	public function test_settings_default_from_the_registry() {
		$field = atcf_normalize_field(
			array(
				'label' => 'Bio',
				'type'  => 'textarea',
			)
		);

		$this->assertArrayHasKey( 'rows', $field['settings'] );
		$this->assertSame( 5, $field['settings']['rows'] );
	}

	/**
	 * A conditional block that arrives with rules and no flag is switched on.
	 *
	 * An import has no flag to give, and treating it as off would silently
	 * disable every condition in the file.
	 *
	 * @covers ::atcf_normalize_conditional
	 */
	public function test_conditional_enables_itself_when_it_has_rules() {
		$block = atcf_normalize_conditional(
			array(
				'rules' => array(
					array(
						'field'    => 'field_a',
						'operator' => 'is',
						'value'    => 'x',
					),
				),
			)
		);

		$this->assertTrue( $block['enabled'] );
	}

	/**
	 * A rule with no field is dropped.
	 *
	 * @covers ::atcf_normalize_conditional
	 */
	public function test_conditional_drops_ruleless_rules() {
		$block = atcf_normalize_conditional(
			array(
				'rules' => array(
					array(
						'operator' => 'is',
						'value'    => 'x',
					),
				),
			)
		);

		$this->assertSame( array(), $block['rules'] );
	}

	/**
	 * A name never starts with an underscore.
	 *
	 * WordPress treats a leading underscore as "protected" and hides the row
	 * from the Custom Fields metabox, which is not a decision a field name
	 * should be able to make by accident.
	 *
	 * @covers ::atcf_sanitize_field_name
	 */
	public function test_names_are_never_protected() {
		$this->assertSame( 'hidden', atcf_sanitize_field_name( '_hidden' ) );
		$this->assertSame( 'a_b', atcf_sanitize_field_name( 'a  b' ) );
		$this->assertSame( 'cafe', atcf_sanitize_field_name( 'Café' ) );
	}

	/**
	 * Saving a group round-trips it exactly.
	 *
	 * @covers ::atcf_save_group
	 * @covers ::atcf_get_group
	 */
	public function test_save_and_read_back() {
		$saved = atcf_save_group(
			array(
				'title'    => 'Product details',
				'fields'   => array(
					array(
						'label' => 'SKU',
						'type'  => 'text',
					),
				),
				'location' => array(
					array(
						array(
							'param'    => 'post_type',
							'operator' => '==',
							'value'    => 'post',
						),
					),
				),
			)
		);

		$this->assertNotWPError( $saved );

		$read = atcf_get_group( $saved['id'] );

		$this->assertSame( 'Product details', $read['title'] );
		$this->assertSame( 'sku', $read['fields'][0]['name'] );
		$this->assertSame( $saved['key'], $read['key'] );
		$this->assertSame( 'post', $read['location'][0][0]['value'] );
	}

	/**
	 * A save by somebody who may not manage the model is refused.
	 *
	 * @covers ::atcf_save_group
	 */
	public function test_save_is_gated() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$result = atcf_save_group( array( 'title' => 'Nope' ) );

		$this->assertWPError( $result );
		$this->assertSame( 'atcf_forbidden', $result->get_error_code() );
	}

	/**
	 * Flattening reaches every field at every depth, with its ancestry.
	 *
	 * @covers ::atcf_flatten_fields
	 */
	public function test_flatten_reaches_everything() {
		$group = atcf_normalize_group(
			array(
				'fields' => array(
					array(
						'label' => 'Title',
						'type'  => 'text',
					),
					array(
						'label'    => 'Team',
						'type'     => 'repeater',
						'settings' => array(
							'sub_fields' => array(
								array(
									'label' => 'Name',
									'type'  => 'text',
								),
								array(
									'label'    => 'Links',
									'type'     => 'repeater',
									'settings' => array(
										'sub_fields' => array(
											array(
												'label' => 'URL',
												'type'  => 'url',
											),
										),
									),
								),
							),
						),
					),
				),
			)
		);

		$flat = atcf_flatten_fields( $group['fields'] );

		$this->assertCount( 5, $flat );

		$deepest = end( $flat );

		$this->assertSame( 'url', $deepest['name'] );
		$this->assertCount( 2, $deepest['ancestors'] );
	}

	/**
	 * A group registered in code behaves like a stored one.
	 *
	 * @covers ::atcf_register_field_group
	 */
	public function test_code_registered_group_appears() {
		atcf_register_field_group(
			array(
				'key'      => 'group_fromcode',
				'title'    => 'From code',
				'fields'   => array(
					array(
						'key'   => 'field_fromcode',
						'label' => 'Code field',
						'type'  => 'text',
					),
				),
				'location' => array(
					array(
						array(
							'param'    => 'post_type',
							'operator' => '==',
							'value'    => 'page',
						),
					),
				),
			)
		);

		$keys = wp_list_pluck( atcf_get_groups( true ), 'key' );

		$this->assertContains( 'group_fromcode', $keys );

		$page = self::factory()->post->create( array( 'post_type' => 'page' ) );

		$this->assertContains( 'group_fromcode', wp_list_pluck( atcf_groups_for( atcf_post_context( $page ) ), 'key' ) );
	}

	/**
	 * A field cannot be named after a meta key WordPress itself reads.
	 *
	 * `wp_capabilities` on a user is the row roles live in; a field with that
	 * name would turn "fill in a field" into "grant a role".
	 *
	 * @covers ::atcf_normalize_field
	 * @covers ::atcf_is_reserved_field_name
	 */
	public function test_reserved_meta_names_are_refused() {
		global $wpdb;

		foreach ( array( 'wp_capabilities', 'session_tokens', $wpdb->prefix . 'capabilities' ) as $reserved ) {
			$field = atcf_normalize_field(
				array(
					'key'   => 'field_reserved',
					'name'  => $reserved,
					'label' => 'Innocent looking',
					'type'  => 'text',
				)
			);

			$this->assertSame( 'field_reserved', $field['name'], $reserved . ' should fall back to the key' );
		}

		// An ordinary name is left alone.
		$field = atcf_normalize_field(
			array(
				'key'   => 'field_ok',
				'name'  => 'hero_title',
				'label' => 'Hero title',
				'type'  => 'text',
			)
		);

		$this->assertSame( 'hero_title', $field['name'] );
	}

	/**
	 * Instructions and the message setting are capped at `wp_kses_post()` on the
	 * way in, not just on the way out.
	 *
	 * @covers ::atcf_normalize_field
	 */
	public function test_markup_bearing_strings_are_ksesed_at_the_door() {
		$field = atcf_normalize_field(
			array(
				'key'          => 'field_kses',
				'label'        => 'Message',
				'type'         => 'message',
				'instructions' => 'Fine <em>emphasis</em><script>alert(1)</script>',
				'settings'     => array(
					'message' => '<strong>Bold</strong><script>alert(2)</script>',
				),
			)
		);

		$this->assertStringNotContainsString( '<script>', $field['instructions'] );
		$this->assertStringContainsString( '<em>emphasis</em>', $field['instructions'] );
		$this->assertStringNotContainsString( '<script>', $field['settings']['message'] );
		$this->assertStringContainsString( '<strong>Bold</strong>', $field['settings']['message'] );
	}
}
