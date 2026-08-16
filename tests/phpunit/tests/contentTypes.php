<?php
/**
 * Content types made through the plugin.
 *
 * The riskiest thing in the plugin, because it calls `register_post_type()` with
 * arguments a person typed. A slug that is too long, already taken, or one of
 * WordPress's own is a broken site rather than a validation message — so every
 * one of those is a test.
 *
 * @package AllTerrain_Fields
 */

/**
 * Tests the content type registry.
 *
 * @group allterrain-fields
 * @group content-types
 */
class ATCF_Test_Content_Types extends WP_UnitTestCase {

	/**
	 * Somebody allowed to change the site's shape.
	 */
	public function set_up() {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	/**
	 * Unregisters anything a test registered.
	 *
	 * The database rolls back between tests; `$wp_post_types` does not. Without
	 * this, the first test to make a `recipe` leaves it registered and every
	 * later test that tries is told the slug is taken — which is a real behaviour
	 * of the plugin being reported as a test failure.
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
	 * Two words are enough to get a working post type.
	 *
	 * @covers ::atcf_save_content_type
	 */
	public function test_two_words_make_a_post_type() {
		$type = atcf_save_content_type(
			array(
				'singular' => 'Recipe',
				'plural'   => 'Recipes',
			)
		);

		$this->assertNotWPError( $type );
		$this->assertSame( 'recipe', $type['slug'] );
		$this->assertTrue( post_type_exists( 'recipe' ) );

		$object = get_post_type_object( 'recipe' );

		$this->assertSame( 'Recipes', $object->labels->name );
		$this->assertSame( 'Recipe', $object->labels->singular_name );
		$this->assertSame( 'Add Recipe', $object->labels->add_new_item );
		$this->assertTrue( $object->public );

		// Asked of the registry rather than of `$object->supports`, which
		// `WP_Post_Type` does not keep — the supports list is moved into
		// `$_wp_post_type_features` at registration and this is how it is read.
		$this->assertTrue( post_type_supports( 'recipe', 'custom-fields' ) );
		$this->assertTrue( post_type_supports( 'recipe', 'editor' ) );
	}

	/**
	 * A type with no name is refused, in words somebody can act on.
	 *
	 * @covers ::atcf_save_content_type
	 */
	public function test_a_nameless_type_is_refused() {
		$result = atcf_save_content_type( array( 'singular' => '' ) );

		$this->assertWPError( $result );
		$this->assertSame( 'atcf_type_no_name', $result->get_error_code() );
	}

	/**
	 * A name with nothing sluggable in it is refused rather than saved empty.
	 *
	 * @covers ::atcf_save_content_type
	 */
	public function test_a_name_with_no_letters_is_refused() {
		$result = atcf_save_content_type( array( 'singular' => '!!!' ) );

		$this->assertWPError( $result );
		$this->assertSame( 'atcf_type_no_slug', $result->get_error_code() );
	}

	/**
	 * WordPress's own post types cannot be taken over.
	 *
	 * @covers ::atcf_save_content_type
	 * @dataProvider data_reserved
	 *
	 * @param string $name A name that resolves to a reserved slug.
	 */
	public function test_reserved_slugs_are_refused( $name ) {
		$result = atcf_save_content_type( array( 'singular' => $name ) );

		$this->assertWPError( $result );
		$this->assertSame( 'atcf_type_reserved', $result->get_error_code() );
	}

	/**
	 * Reserved names.
	 *
	 * @return array[] Names.
	 */
	public function data_reserved() {
		return array(
			'post'       => array( 'Post' ),
			'page'       => array( 'Page' ),
			'attachment' => array( 'Attachment' ),
			'own'        => array( 'atcf_field_group' ),
		);
	}

	/**
	 * A slug another plugin already registered is refused.
	 *
	 * @covers ::atcf_save_content_type
	 */
	public function test_a_slug_someone_else_registered_is_refused() {
		register_post_type( 'gallery', array( 'public' => false ) );

		$result = atcf_save_content_type( array( 'singular' => 'Gallery' ) );

		$this->assertWPError( $result );
		$this->assertSame( 'atcf_type_exists', $result->get_error_code() );

		unregister_post_type( 'gallery' );
	}

	/**
	 * A long name is truncated to something `register_post_type()` accepts.
	 *
	 * Over twenty characters and WordPress refuses with a `_doing_it_wrong()`
	 * nobody sees — so the failure would be a content type that saved and never
	 * appeared.
	 *
	 * @covers ::atcf_content_type_slug
	 */
	public function test_a_long_name_still_registers() {
		$type = atcf_save_content_type(
			array( 'singular' => 'Continuing professional development record' )
		);

		$this->assertNotWPError( $type );
		$this->assertLessThanOrEqual( 20, strlen( $type['slug'] ) );
		$this->assertTrue( post_type_exists( $type['slug'] ) );
	}

	/**
	 * Spaces and punctuation become a usable slug.
	 *
	 * @covers ::atcf_content_type_slug
	 */
	public function test_slugs_are_made_from_whatever_was_typed() {
		$this->assertSame( 'case_study', atcf_content_type_slug( 'Case Study' ) );
		$this->assertSame( 'case_study', atcf_content_type_slug( 'Case-Study' ) );
		$this->assertSame( 'menu_item', atcf_content_type_slug( 'Menu item!' ) );
	}

	/**
	 * The switches reach `register_post_type()`.
	 *
	 * @covers ::atcf_content_type_args
	 */
	public function test_the_switches_change_the_registration() {
		$args = atcf_content_type_args(
			atcf_normalize_content_type(
				array(
					'singular'     => 'Record',
					'public'       => false,
					'editor'       => false,
					'thumbnail'    => false,
					'hierarchical' => true,
					'excerpt'      => true,
				)
			)
		);

		$this->assertFalse( $args['public'] );
		$this->assertTrue( $args['exclude_from_search'] );
		$this->assertTrue( $args['hierarchical'] );
		$this->assertFalse( $args['has_archive'] );
		$this->assertFalse( $args['rewrite'] );
		$this->assertNotContains( 'editor', $args['supports'] );
		$this->assertNotContains( 'thumbnail', $args['supports'] );
		$this->assertContains( 'excerpt', $args['supports'] );
		$this->assertContains( 'custom-fields', $args['supports'] );
	}

	/**
	 * A plural nobody supplied falls back to the singular rather than to nothing.
	 *
	 * @covers ::atcf_normalize_content_type
	 */
	public function test_a_missing_plural_falls_back() {
		$type = atcf_normalize_content_type( array( 'singular' => 'Sheep' ) );

		$this->assertSame( 'Sheep', $type['plural'] );
	}

	/**
	 * Deleting a type leaves everything stored in it alone.
	 *
	 * This is the behaviour somebody relies on without knowing they do: removing
	 * a content type is usually a change of mind about the name, and a delete
	 * that took two hundred entries with it is a delete nobody dares press.
	 *
	 * @covers ::atcf_delete_content_type
	 */
	public function test_deleting_a_type_keeps_its_entries() {
		$type = atcf_save_content_type( array( 'singular' => 'Case study' ) );

		$this->assertNotWPError( $type );

		$entry = self::factory()->post->create(
			array(
				'post_type'  => $type['slug'],
				'post_title' => 'The one about the bridge',
			)
		);

		$this->assertTrue( atcf_delete_content_type( $type['id'] ) );
		$this->assertSame( 'The one about the bridge', get_post( $entry )->post_title );
		$this->assertSame( array(), atcf_get_content_types() );
	}

	/**
	 * Deleting something that is not a content type says so.
	 *
	 * @covers ::atcf_delete_content_type
	 */
	public function test_deleting_a_stranger_is_an_error() {
		$result = atcf_delete_content_type( self::factory()->post->create() );

		$this->assertWPError( $result );
		$this->assertSame( 'atcf_no_content_type', $result->get_error_code() );
	}

	/**
	 * The list survives a round trip through storage.
	 *
	 * @covers ::atcf_get_content_types
	 */
	public function test_types_are_read_back() {
		atcf_save_content_type(
			array(
				'singular' => 'Recipe',
				'icon'     => 'dashicons-food',
			)
		);
		atcf_save_content_type(
			array(
				'singular' => 'Venue',
				'public'   => false,
			)
		);

		$types = atcf_get_content_types();

		$this->assertCount( 2, $types );

		$byslug = array_column( $types, null, 'slug' );

		$this->assertSame( 'dashicons-food', $byslug['recipe']['icon'] );
		$this->assertFalse( $byslug['venue']['public'] );
	}

	/**
	 * A site can change how its types are registered.
	 *
	 * @covers ::atcf_content_type_args
	 */
	public function test_registration_arguments_are_filterable() {
		$filter = static function ( $args ) {
			$args['menu_position'] = 3;

			return $args;
		};

		add_filter( 'atcf_content_type_args', $filter );

		$args = atcf_content_type_args( atcf_normalize_content_type( array( 'singular' => 'Thing' ) ) );

		$this->assertSame( 3, $args['menu_position'] );

		remove_filter( 'atcf_content_type_args', $filter );
	}

	/**
	 * A type made here appears on the content model, marked as ours.
	 *
	 * @covers ::atcf_rest_model
	 */
	public function test_a_new_type_appears_on_the_model() {
		$type = atcf_save_content_type( array( 'singular' => 'Recipe' ) );

		$this->assertNotWPError( $type );

		$nodes = array_column( atcf_rest_model()->get_data()['nodes'], null, 'id' );

		$this->assertArrayHasKey( 'recipe', $nodes );
		$this->assertSame( $type['id'], $nodes['recipe']['own'] );
		$this->assertSame( 0, $nodes['recipe']['fields'] );

		// And the plugin's own storage types are never drawn.
		$this->assertArrayNotHasKey( ATCF_CONTENT_TYPE, $nodes );
		$this->assertArrayNotHasKey( ATCF_GROUP_TYPE, $nodes );
	}

	/**
	 * A node carries the fields the groups on it declare.
	 *
	 * @covers ::atcf_model_attachments
	 */
	public function test_a_node_counts_the_fields_attached_to_it() {
		atcf_save_content_type( array( 'singular' => 'Recipe' ) );

		$group = atcf_save_group(
			array(
				'title'    => 'Recipe fields',
				'location' => array(
					array(
						array(
							'param'    => 'post_type',
							'operator' => '==',
							'value'    => 'recipe',
						),
					),
				),
				'fields'   => array(
					array(
						'key'   => 'field_a',
						'name'  => 'serves',
						'label' => 'Serves',
						'type'  => 'number',
					),
					array(
						'key'   => 'field_b',
						'name'  => 'method',
						'label' => 'Method',
						'type'  => 'textarea',
					),
				),
			)
		);

		$this->assertNotWPError( $group );

		$nodes = array_column( atcf_rest_model()->get_data()['nodes'], null, 'id' );

		$this->assertSame( 2, $nodes['recipe']['fields'] );
		$this->assertSame( 'Recipe fields', $nodes['recipe']['groups'][0]['title'] );
		$this->assertSame( array( 'serves', 'method' ), wp_list_pluck( $nodes['recipe']['list'], 'name' ) );
		$this->assertSame( 'Number', $nodes['recipe']['list'][0]['type'] );
	}

	/**
	 * The box lists meta keys and types, and skips the furniture.
	 *
	 * A tab holds no value, so it is not part of the shape of the data. A box
	 * listing "Tab" as though it were a field describes the edit screen rather
	 * than the model.
	 *
	 * @covers ::atcf_model_field_list
	 */
	public function test_the_field_list_skips_layout_furniture() {
		$list = atcf_model_field_list(
			array(
				array(
					'key'   => 'field_t',
					'name'  => 'details',
					'label' => 'Details',
					'type'  => 'tab',
				),
				array(
					'key'   => 'field_a',
					'name'  => 'serves',
					'label' => 'Serves',
					'type'  => 'number',
				),
				array(
					'key'   => 'field_m',
					'name'  => 'note',
					'label' => 'Note',
					'type'  => 'message',
				),
			)
		);

		$this->assertSame( array( 'serves' ), wp_list_pluck( $list, 'name' ) );
	}

	/**
	 * A repeater's own fields are listed under it, once.
	 *
	 * One level and no more. A repeater inside a group inside a repeater is a
	 * tree, and a box on a diagram is not where a tree goes.
	 *
	 * @covers ::atcf_model_field_list
	 */
	public function test_the_field_list_shows_one_level_of_nesting() {
		$list = atcf_model_field_list(
			array(
				array(
					'key'      => 'field_r',
					'name'     => 'ingredients',
					'label'    => 'Ingredients',
					'type'     => 'repeater',
					'settings' => array(
						'sub_fields' => array(
							array(
								'key'   => 'field_a',
								'name'  => 'amount',
								'label' => 'Amount',
								'type'  => 'text',
							),
							array(
								'key'      => 'field_g',
								'name'     => 'source',
								'label'    => 'Source',
								'type'     => 'group',
								'settings' => array(
									'sub_fields' => array(
										array(
											'key'   => 'field_f',
											'name'  => 'farm',
											'label' => 'Farm',
											'type'  => 'text',
										),
									),
								),
							),
						),
					),
				),
			)
		);

		$this->assertSame(
			array( 'ingredients', '· amount', '· source' ),
			wp_list_pluck( $list, 'name' ),
			'The third level should not be listed.'
		);

		$this->assertFalse( $list[0]['sub'] );
		$this->assertTrue( $list[1]['sub'] );
	}

	/**
	 * A box names at most ten fields, and says how many it did not.
	 *
	 * @covers ::atcf_model_node
	 */
	public function test_a_long_group_is_truncated_on_the_box() {
		atcf_save_content_type( array( 'singular' => 'Record' ) );

		$fields = array();

		for ( $i = 0; $i < 14; $i++ ) {
			$fields[] = array(
				'key'   => 'field_' . $i,
				'name'  => 'field_' . $i,
				'label' => 'Field ' . $i,
				'type'  => 'text',
			);
		}

		atcf_save_group(
			array(
				'title'    => 'Lots',
				'location' => array(
					array(
						array(
							'param'    => 'post_type',
							'operator' => '==',
							'value'    => 'record',
						),
					),
				),
				'fields'   => $fields,
			)
		);

		$nodes = array_column( atcf_rest_model()->get_data()['nodes'], null, 'id' );

		$this->assertSame( 14, $nodes['record']['fields'] );
		$this->assertCount( 10, $nodes['record']['list'] );
	}
}
