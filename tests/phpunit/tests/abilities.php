<?php
/**
 * The WordPress Abilities the plugin ships.
 *
 * These exist so an agent can work with the site's content model the way a
 * person can, and there was no test file for them — which is how all five came
 * to be registered on **`abilities_api_init`**, a hook that does not exist. Core
 * fires `wp_abilities_api_init`. Nothing errored, nothing warned, and the
 * plugin's entire agent surface was simply absent from every site it was
 * installed on until somebody happened to look.
 *
 * The first test in this file is the one that would have caught it, and it
 * deliberately asserts through `wp_get_ability()` rather than by inspecting our
 * own registration function: what matters is not that we called the API, but
 * that the API has them afterwards.
 *
 * @package AllTerrain_Fields
 */

/**
 * Tests the abilities.
 *
 * @group allterrain-fields
 * @group abilities
 */
class ATCF_Test_Abilities extends WP_UnitTestCase {

	/**
	 * Somebody allowed to change the site's shape.
	 */
	public function set_up() {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	/**
	 * Skips the file whole where the Abilities API is not installed.
	 */
	public function tear_down() {
		foreach ( atcf_get_content_types() as $type ) {
			if ( post_type_exists( $type['slug'] ) ) {
				unregister_post_type( $type['slug'] );
			}
		}

		atcf_flush_content_type_cache();

		parent::tear_down();
	}

	/**
	 * Fails the test when the API is not present, rather than passing quietly.
	 */
	private function require_api() {
		if ( ! function_exists( 'wp_get_ability' ) ) {
			$this->markTestSkipped( 'The Abilities API is not installed.' );
		}
	}

	/**
	 * Every ability this plugin claims to ship is actually registered.
	 *
	 * @covers ::atcf_register_abilities
	 * @dataProvider data_ability_names
	 *
	 * @param string $name The ability name.
	 */
	public function test_every_ability_is_registered( $name ) {
		$this->require_api();

		$this->assertNotNull(
			wp_get_ability( $name ),
			"{$name} is not registered. Check the hook name — Core fires `wp_abilities_api_init`."
		);
	}

	/**
	 * The abilities.
	 *
	 * @return array[] Names.
	 */
	public function data_ability_names() {
		return array(
			'list-groups'                => array( 'allterrain-fields/list-groups' ),
			'describe-model'             => array( 'allterrain-fields/describe-model' ),
			'describe-group'             => array( 'allterrain-fields/describe-group' ),
			'read-values'                => array( 'allterrain-fields/read-values' ),
			'write-value'                => array( 'allterrain-fields/write-value' ),
			'find-by-value'              => array( 'allterrain-fields/find-by-value' ),
			'list-templates'             => array( 'allterrain-fields/list-templates' ),
			'create-group-from-template' => array( 'allterrain-fields/create-group-from-template' ),
			'create-content-type'        => array( 'allterrain-fields/create-content-type' ),
			'evaluate-formula'           => array( 'allterrain-fields/evaluate-formula' ),
		);
	}

	/**
	 * Every one of them describes itself.
	 *
	 * An ability with no description is an ability a model will not choose,
	 * because the description is the only thing it has to choose on.
	 *
	 * @covers ::atcf_register_abilities
	 * @dataProvider data_ability_names
	 *
	 * @param string $name The ability name.
	 */
	public function test_every_ability_describes_itself( $name ) {
		$this->require_api();

		$ability = wp_get_ability( $name );

		$this->assertNotEmpty( $ability->get_label(), "{$name} has no label." );
		$this->assertNotEmpty( $ability->get_description(), "{$name} has no description." );
		$this->assertGreaterThan(
			40,
			strlen( $ability->get_description() ),
			"{$name}'s description is too short to choose on."
		);
	}

	/**
	 * They are all in this plugin's category.
	 *
	 * @covers ::atcf_register_ability_category
	 * @dataProvider data_ability_names
	 *
	 * @param string $name The ability name.
	 */
	public function test_every_ability_is_categorised( $name ) {
		$this->require_api();

		$this->assertSame( 'allterrain-fields', wp_get_ability( $name )->get_category(), "{$name} is uncategorised." );
	}

	/**
	 * A formula can be tried without storing anything.
	 *
	 * @covers ::atcf_ability_evaluate_formula
	 */
	public function test_a_formula_can_be_tried() {
		$this->require_api();

		$result = wp_get_ability( 'allterrain-fields/evaluate-formula' )->execute(
			array(
				'formula' => 'round(pct({sold}, {total}), 1)',
				'values'  => array(
					'sold'  => 7,
					'total' => 9,
				),
			)
		);

		$this->assertSame( 77.8, $result['result'] );
		$this->assertTrue( $result['usable'] );
		$this->assertSame( array( 'sold', 'total' ), $result['reads'] );
		$this->assertSame( array(), $result['missing'] );
	}

	/**
	 * A formula naming something it was not given says which name.
	 *
	 * @covers ::atcf_ability_evaluate_formula
	 */
	public function test_a_formula_names_what_it_is_missing() {
		$this->require_api();

		$result = wp_get_ability( 'allterrain-fields/evaluate-formula' )->execute(
			array(
				'formula' => '{price} * {quantity}',
				'values'  => array( 'price' => 10 ),
			)
		);

		$this->assertSame( array( 'quantity' ), $result['missing'] );
	}

	/**
	 * A formula that will not parse reports itself unusable rather than zero.
	 *
	 * Zero is a legitimate answer. An agent told `0` for a broken formula would
	 * store it.
	 *
	 * @covers ::atcf_ability_evaluate_formula
	 */
	public function test_a_broken_formula_is_not_zero() {
		$this->require_api();

		$result = wp_get_ability( 'allterrain-fields/evaluate-formula' )->execute(
			array( 'formula' => 'round({price}' )
		);

		$this->assertFalse( $result['usable'] );
		$this->assertNull( $result['result'] );
	}

	/**
	 * A template becomes a real group.
	 *
	 * @covers ::atcf_ability_create_from_template
	 */
	public function test_a_template_can_be_applied() {
		$this->require_api();

		$result = wp_get_ability( 'allterrain-fields/create-group-from-template' )->execute(
			array( 'template' => 'recipe' )
		);

		$this->assertNotWPError( $result );
		$this->assertGreaterThan( 0, $result['id'] );
		$this->assertGreaterThan( 0, $result['fields'] );
	}

	/**
	 * An unknown template is an error, not an empty group.
	 *
	 * @covers ::atcf_ability_create_from_template
	 */
	public function test_an_unknown_template_is_refused() {
		$this->require_api();

		$result = wp_get_ability( 'allterrain-fields/create-group-from-template' )->execute(
			array( 'template' => 'nope' )
		);

		$this->assertWPError( $result );
	}

	/**
	 * A content type can be made.
	 *
	 * @covers ::atcf_ability_create_content_type
	 */
	public function test_a_content_type_can_be_made() {
		$this->require_api();

		$result = wp_get_ability( 'allterrain-fields/create-content-type' )->execute(
			array(
				'singular' => 'Recipe',
				'plural'   => 'Recipes',
			)
		);

		$this->assertNotWPError( $result );
		$this->assertSame( 'recipe', $result['slug'] );
		$this->assertTrue( post_type_exists( 'recipe' ) );
	}

	/**
	 * A group describes its own schema, which is what an agent needs first.
	 *
	 * @covers ::atcf_ability_describe_group
	 */
	public function test_a_group_describes_itself() {
		$this->require_api();

		$group = atcf_save_group(
			array(
				'title'    => 'Listing',
				'location' => array(
					array(
						array(
							'param'    => 'post_type',
							'operator' => '==',
							'value'    => 'post',
						),
					),
				),
				'fields'   => array(
					array(
						'key'      => 'field_p',
						'name'     => 'price',
						'label'    => 'Price',
						'type'     => 'number',
						'required' => true,
					),
					array(
						'key'      => 'field_t',
						'name'     => 'total',
						'label'    => 'Total',
						'type'     => 'computed',
						'settings' => array( 'formula' => '{price} * 1.21' ),
					),
				),
			)
		);

		$this->assertNotWPError( $group );

		$described = wp_get_ability( 'allterrain-fields/describe-group' )->execute(
			array( 'group' => $group['key'] )
		);

		$this->assertSame( 'Listing', $described['title'] );
		$this->assertCount( 2, $described['fields'] );
		$this->assertSame( 'price', $described['fields'][0]['name'] );
		$this->assertTrue( $described['fields'][0]['required'] );
		$this->assertSame( '{price} * 1.21', $described['fields'][1]['formula'] );
		$this->assertNotEmpty( $described['location'] );
	}

	/**
	 * Asked about a group that is not there, it says so.
	 *
	 * @covers ::atcf_ability_describe_group
	 */
	public function test_an_unknown_group_is_refused() {
		$this->require_api();

		$result = wp_get_ability( 'allterrain-fields/describe-group' )->execute( array( 'group' => 'group_nope' ) );

		$this->assertWPError( $result );
		$this->assertSame( 'atcf_no_group', $result->get_error_code() );
	}

	/**
	 * The templates are listed with what each one teaches.
	 *
	 * @covers ::atcf_ability_list_templates
	 */
	public function test_templates_are_listed() {
		$this->require_api();

		$templates = wp_get_ability( 'allterrain-fields/list-templates' )->execute( array() );

		$this->assertSame( array( 'recipe', 'property', 'event', 'product' ), wp_list_pluck( $templates, 'slug' ) );
		$this->assertNotEmpty( $templates[0]['teaches'] );
	}

	/**
	 * Somebody who cannot manage the site cannot reshape it.
	 *
	 * @covers ::atcf_register_abilities
	 */
	public function test_reshaping_the_site_needs_the_capability() {
		$this->require_api();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );

		foreach ( array( 'create-content-type', 'create-group-from-template', 'describe-group' ) as $one ) {
			$this->assertNotTrue(
				wp_get_ability( "allterrain-fields/{$one}" )->check_permissions( array() ),
				"An author should not be able to run {$one}."
			);
		}
	}

	/**
	 * Trying a formula is deliberately not gated that high.
	 *
	 * It stores nothing, reads nothing and touches no post. Gating it on
	 * `manage_options` would stop an agent checking its own arithmetic before
	 * writing a value it *is* allowed to write.
	 *
	 * @covers ::atcf_ability_evaluate_formula
	 */
	public function test_trying_a_formula_is_open_to_authors() {
		$this->require_api();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );

		$this->assertTrue(
			wp_get_ability( 'allterrain-fields/evaluate-formula' )->check_permissions( array() )
		);
	}
}
