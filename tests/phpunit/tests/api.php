<?php
/**
 * The template API and the save path.
 *
 * Nine functions a theme author ever needs, plus the one function that turns a
 * submission into writes. The submission tests are the important half: all three
 * of its rules — the schema decides, a hidden field is not cleared, absent is not
 * empty — fail silently and destructively when they are broken.
 *
 * @package AllTerrain_Fields
 */

/**
 * Reading and writing values.
 *
 * @group allterrain-fields
 */
class ATCF_Test_Api extends WP_UnitTestCase {

	/**
	 * The group under test.
	 *
	 * @var array
	 */
	private $group;

	/**
	 * A post to hang values off.
	 *
	 * @var int
	 */
	private $post;

	/**
	 * Builds a group on posts.
	 */
	public function set_up() {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$this->post = self::factory()->post->create();

		$saved = atcf_save_group(
			array(
				'title'    => 'Article extras',
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
						'key'   => 'field_standfirst',
						'label' => 'Standfirst',
						'type'  => 'textarea',
					),
					array(
						'key'   => 'field_rating',
						'label' => 'Rating',
						'type'  => 'number',
					),
					array(
						'key'   => 'field_featured',
						'label' => 'Featured',
						'type'  => 'true_false',
					),
					array(
						'key'      => 'field_team',
						'label'    => 'Team',
						'type'     => 'repeater',
						'settings' => array(
							'sub_fields' => array(
								array(
									'key'   => 'field_member',
									'label' => 'Member',
									'type'  => 'text',
								),
							),
						),
					),
				),
			)
		);

		$this->assertNotWPError( $saved );

		$this->group = $saved;
	}

	/**
	 * The second argument accepts everything that identifies an object.
	 *
	 * A theme's template partial does not know whether it is being included from
	 * a single post, a term archive or an options panel, and making it find out
	 * is how `get_field( 'x' )` returns nothing in a widget.
	 *
	 * @covers ::atcf_resolve_ref
	 */
	public function test_selectors_resolve() {
		$user = self::factory()->user->create();
		$term = self::factory()->term->create();

		$this->assertSame(
			array(
				'type' => 'post',
				'id'   => 12,
			),
			atcf_resolve_ref( 12 )
		);
		$this->assertSame(
			array(
				'type' => 'post',
				'id'   => $this->post,
			),
			atcf_resolve_ref( get_post( $this->post ) )
		);
		$this->assertSame(
			array(
				'type' => 'user',
				'id'   => $user,
			),
			atcf_resolve_ref( get_userdata( $user ) )
		);
		$this->assertSame(
			array(
				'type' => 'term',
				'id'   => $term,
			),
			atcf_resolve_ref( get_term( $term ) )
		);
		$this->assertSame(
			array(
				'type' => 'option',
				'id'   => 'options',
			),
			atcf_resolve_ref( 'option' )
		);
		$this->assertSame(
			array(
				'type' => 'user',
				'id'   => 3,
			),
			atcf_resolve_ref( 'user_3' )
		);
		$this->assertSame(
			array(
				'type' => 'option',
				'id'   => 'footer',
			),
			atcf_resolve_ref( 'footer' )
		);
	}

	/**
	 * A value written through the API reads back through the API.
	 *
	 * @covers ::atcf_update_field
	 * @covers ::atcf_get_field
	 */
	public function test_round_trip() {
		atcf_update_field( 'standfirst', 'The best of times.', $this->post );

		$this->assertSame( 'The best of times.', atcf_get_field( 'standfirst', $this->post, false ) );
	}

	/**
	 * A number comes back as a number, not as the string meta gave.
	 *
	 * A theme doing `atcf_get_field( 'rating' ) > 4` was otherwise comparing a
	 * string to an integer.
	 *
	 * @covers ::atcf_format_number
	 */
	public function test_numbers_return_as_numbers() {
		atcf_update_field( 'rating', '5', $this->post );

		$this->assertSame( 5, atcf_get_field( 'rating', $this->post ) );

		atcf_update_field( 'rating', '4.5', $this->post );

		$this->assertSame( 4.5, atcf_get_field( 'rating', $this->post ) );
	}

	/**
	 * A switch comes back as a real boolean.
	 *
	 * @covers ::atcf_format_bool
	 */
	public function test_switches_return_as_booleans() {
		atcf_update_field( 'featured', true, $this->post );

		$this->assertTrue( atcf_get_field( 'featured', $this->post ) );

		atcf_update_field( 'featured', false, $this->post );

		$this->assertFalse( atcf_get_field( 'featured', $this->post ) );
	}

	/**
	 * The row loop is shaped like `have_posts()`.
	 *
	 * Somebody who has written a WordPress loop has already written a repeater
	 * loop, which is the whole reason for the shape.
	 *
	 * @covers ::atcf_have_rows
	 * @covers ::atcf_the_row
	 * @covers ::atcf_get_sub_field
	 */
	public function test_row_loop() {
		atcf_update_field(
			'team',
			array( array( 'member' => 'Ada' ), array( 'member' => 'Grace' ) ),
			$this->post
		);

		$names = array();

		while ( atcf_have_rows( 'team', $this->post ) ) {
			atcf_the_row();

			$names[] = atcf_get_sub_field( 'member' );
		}

		$this->assertSame( array( 'Ada', 'Grace' ), $names );

		// And the loop closed itself, so a second one starts clean.
		$this->assertNull( atcf_current_row() );
	}

	/**
	 * A row count does not have to load every row.
	 *
	 * @covers ::atcf_count_rows
	 */
	public function test_row_count() {
		atcf_update_field( 'team', array( array( 'member' => 'A' ), array( 'member' => 'B' ) ), $this->post );

		$this->assertSame( 2, atcf_count_rows( 'team', $this->post ) );
	}

	/**
	 * `atcf_the_field()` escapes what it echoes.
	 *
	 * The difference between a template helper and a cross-site-scripting hole.
	 *
	 * @covers ::atcf_the_field
	 */
	public function test_the_field_escapes() {
		atcf_update_field( 'rating', '5', $this->post );

		$field = atcf_get_field_by_key( 'field_standfirst' );

		atcf_save_value(
			$field,
			array(
				'type' => 'post',
				'id'   => $this->post,
			),
			'<script>alert(1)</script>'
		);

		ob_start();
		atcf_the_field( 'standfirst', $this->post );
		$output = (string) ob_get_clean();

		$this->assertStringNotContainsString( '<script>', $output );
	}

	/**
	 * A submission writes only the fields that belong on the object.
	 *
	 * The submission is walked by iterating the schema and looking each field up
	 * in the payload, never the other way round — which is what stops a crafted
	 * POST setting a field an author cannot see.
	 *
	 * @covers ::atcf_save_submission
	 */
	public function test_submission_ignores_fields_not_on_this_screen() {
		$other = atcf_save_group(
			array(
				'title'    => 'Somewhere else',
				'location' => array(
					array(
						array(
							'param'    => 'post_type',
							'operator' => '==',
							'value'    => 'page',
						),
					),
				),
				'fields'   => array(
					array(
						'key'   => 'field_secret',
						'label' => 'Secret',
						'type'  => 'text',
					),
				),
			)
		);

		$this->assertNotWPError( $other );

		atcf_save_submission(
			array(
				'type' => 'post',
				'id'   => $this->post,
			),
			array(
				'field_standfirst' => 'Written',
				'field_secret'     => 'Should not land',
			)
		);

		$this->assertSame( 'Written', get_post_meta( $this->post, 'standfirst', true ) );
		$this->assertSame( '', get_post_meta( $this->post, 'secret', true ) );
	}

	/**
	 * A key absent from the payload leaves the stored value alone.
	 *
	 * "This control was not on the form" and "somebody cleared it" are different,
	 * and collapsing them is how a metabox that failed to render deletes a site's
	 * content.
	 *
	 * @covers ::atcf_save_fields
	 */
	public function test_absent_is_not_empty() {
		atcf_update_field( 'standfirst', 'Keep me', $this->post );

		atcf_save_submission(
			array(
				'type' => 'post',
				'id'   => $this->post,
			),
			array( 'field_rating' => 3 )
		);

		$this->assertSame( 'Keep me', get_post_meta( $this->post, 'standfirst', true ) );
	}

	/**
	 * A key present and empty clears the value.
	 *
	 * The other half of the same rule: a field somebody deliberately emptied has
	 * to actually empty.
	 *
	 * @covers ::atcf_save_fields
	 */
	public function test_present_and_empty_clears() {
		atcf_update_field( 'standfirst', 'Remove me', $this->post );

		atcf_save_submission(
			array(
				'type' => 'post',
				'id'   => $this->post,
			),
			array( 'field_standfirst' => '' )
		);

		$this->assertSame( '', get_post_meta( $this->post, 'standfirst', true ) );
	}

	/**
	 * A field the logic hides is skipped, not cleared.
	 *
	 * Otherwise every save of a post wipes the fields that were merely not
	 * applicable that day.
	 *
	 * @covers ::atcf_save_fields
	 */
	public function test_hidden_fields_are_not_cleared() {
		$group = atcf_save_group(
			array(
				'title'    => 'Conditional',
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
						'key'   => 'field_mode',
						'label' => 'Mode',
						'type'  => 'text',
					),
					array(
						'key'         => 'field_extra',
						'label'       => 'Extra',
						'type'        => 'text',
						'conditional' => array(
							'enabled' => true,
							'action'  => 'show',
							'match'   => 'all',
							'rules'   => array(
								array(
									'field'    => 'field_mode',
									'operator' => 'is',
									'value'    => 'full',
								),
							),
						),
					),
				),
			)
		);

		$this->assertNotWPError( $group );

		atcf_save_submission(
			array(
				'type' => 'post',
				'id'   => $this->post,
			),
			array(
				'field_mode'  => 'full',
				'field_extra' => 'Filled in',
			)
		);

		$this->assertSame( 'Filled in', get_post_meta( $this->post, 'extra', true ) );

		// The mode changes, so the extra field is no longer shown. Its submitted
		// value is empty — the control was disabled — and it must be left alone.
		atcf_save_submission(
			array(
				'type' => 'post',
				'id'   => $this->post,
			),
			array(
				'field_mode'  => 'brief',
				'field_extra' => '',
			)
		);

		$this->assertSame( 'Filled in', get_post_meta( $this->post, 'extra', true ) );
	}

	/**
	 * A submission by somebody who cannot edit the object is refused.
	 *
	 * @covers ::atcf_save_submission
	 */
	public function test_submission_is_gated() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );

		$errors = atcf_save_submission(
			array(
				'type' => 'post',
				'id'   => $this->post,
			),
			array( 'field_standfirst' => 'Nope' )
		);

		$this->assertNotEmpty( $errors );
		$this->assertSame( '', get_post_meta( $this->post, 'standfirst', true ) );
	}

	/**
	 * The drop-in template names forward to ours.
	 *
	 * Hundreds of thousands of themes call `get_field()`. A plugin that made all
	 * of that stop working would be a plugin with a migration guide instead of
	 * users.
	 *
	 * @covers ::get_field
	 */
	public function test_drop_in_template_names() {
		if ( ! function_exists( 'get_field' ) ) {
			$this->markTestSkipped( 'Another plugin owns get_field() on this install, which is the correct behaviour.' );
		}

		atcf_update_field( 'standfirst', 'Compatible', $this->post );

		$this->assertSame( 'Compatible', get_field( 'standfirst', $this->post, false ) );
		$this->assertSame( 'Compatible', get_fields( $this->post, false )['standfirst'] );
	}

	/**
	 * Reading a field by key skips the location lookup entirely.
	 *
	 * @covers ::atcf_locate_field
	 */
	public function test_key_lookup() {
		atcf_update_field( 'field_standfirst', 'By key', $this->post );

		$this->assertSame( 'By key', atcf_get_field( 'field_standfirst', $this->post, false ) );
	}

	/**
	 * A field object carries both the formatted and the raw value.
	 *
	 * @covers ::atcf_get_field_object
	 */
	public function test_field_object() {
		atcf_update_field( 'rating', '7', $this->post );

		$object = atcf_get_field_object( 'rating', $this->post );

		$this->assertSame( 'Rating', $object['label'] );
		$this->assertSame( 7, $object['value'] );
		$this->assertSame( '7', $object['raw'] );
	}
}
