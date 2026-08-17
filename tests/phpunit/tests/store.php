<?php
/**
 * Where values live.
 *
 * The storage convention is the most valuable thing about this plugin and the
 * easiest to break by accident, so it is asserted directly against
 * `get_post_meta()` rather than through the plugin's own reader. A test that
 * only used `atcf_get_field()` would pass on a storage layout nothing else on
 * the site could read.
 *
 * @package AllTerrain_Fields
 */

/**
 * The store.
 *
 * @group allterrain-fields
 */
class ATCF_Test_Store extends WP_UnitTestCase {

	/**
	 * A post to hang values off.
	 *
	 * @var int
	 */
	private $post;

	/**
	 * Sets an administrator and a post.
	 */
	public function set_up() {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$this->post = self::factory()->post->create();
	}

	/**
	 * A reference to the test post.
	 *
	 * @return array The reference.
	 */
	private function ref() {
		return array(
			'type' => 'post',
			'id'   => $this->post,
		);
	}

	/**
	 * A value is a plain meta row keyed by the field's name.
	 *
	 * This is the whole promise: `get_post_meta( $id, 'hero_title', true )` works
	 * with no plugin API at all, so every export tool, WP-CLI command and
	 * `meta_query` that already exists keeps working.
	 *
	 * @covers ::atcf_save_value
	 */
	public function test_value_is_ordinary_meta() {
		$field = atcf_normalize_field(
			array(
				'key'   => 'field_hero',
				'label' => 'Hero title',
				'type'  => 'text',
			)
		);

		atcf_save_value( $field, $this->ref(), 'The big one' );

		$this->assertSame( 'The big one', get_post_meta( $this->post, 'hero_title', true ) );
	}

	/**
	 * The companion row records which field wrote the value.
	 *
	 * Without it, `42` in a meta row says nothing about whether it is a post id,
	 * an attachment id or the number forty-two.
	 *
	 * @covers ::atcf_save_value
	 */
	public function test_reference_row_is_written() {
		$field = atcf_normalize_field(
			array(
				'key'   => 'field_hero',
				'label' => 'Hero title',
				'type'  => 'text',
			)
		);

		atcf_save_value( $field, $this->ref(), 'x' );

		$this->assertSame( 'field_hero', get_post_meta( $this->post, '_hero_title', true ) );
	}

	/**
	 * A default applies only to a field that has never been written.
	 *
	 * Applying it to a stored empty string makes clearing a field impossible:
	 * every save puts the default straight back.
	 *
	 * @covers ::atcf_load_value
	 */
	public function test_default_does_not_resurrect_a_cleared_field() {
		$field = atcf_normalize_field(
			array(
				'key'      => 'field_x',
				'label'    => 'Sub',
				'type'     => 'text',
				'settings' => array( 'default_value' => 'Fallback' ),
			)
		);

		$this->assertSame( 'Fallback', atcf_load_value( $field, $this->ref(), '', false ) );

		atcf_save_value( $field, $this->ref(), '' );

		$this->assertSame( '', atcf_load_value( $field, $this->ref(), '', false ) );
	}

	/**
	 * A repeater stores its count and one row of meta per index.
	 *
	 * @covers ::atcf_save_repeater
	 * @covers ::atcf_load_repeater
	 */
	public function test_repeater_layout() {
		$field = atcf_normalize_field(
			array(
				'key'      => 'field_team',
				'label'    => 'Team',
				'type'     => 'repeater',
				'settings' => array(
					'sub_fields' => array(
						array(
							'key'   => 'field_name',
							'label' => 'Name',
							'type'  => 'text',
						),
						array(
							'key'   => 'field_role',
							'label' => 'Role',
							'type'  => 'text',
						),
					),
				),
			)
		);

		atcf_save_value(
			$field,
			$this->ref(),
			array(
				array(
					'name' => 'Ada',
					'role' => 'Engineer',
				),
				array(
					'name' => 'Grace',
					'role' => 'Admiral',
				),
			)
		);

		$this->assertSame( '2', get_post_meta( $this->post, 'team', true ) );
		$this->assertSame( 'Ada', get_post_meta( $this->post, 'team_0_name', true ) );
		$this->assertSame( 'Admiral', get_post_meta( $this->post, 'team_1_role', true ) );

		$read = atcf_load_value( $field, $this->ref(), '', false );

		$this->assertCount( 2, $read );
		$this->assertSame( 'Grace', $read[1]['name'] );
	}

	/**
	 * Shrinking a repeater deletes the rows it dropped.
	 *
	 * A repeater cut from three rows to one that left rows two and three behind
	 * would resurrect both the moment somebody added a row back.
	 *
	 * @covers ::atcf_save_repeater
	 */
	public function test_shrinking_a_repeater_deletes_the_tail() {
		$field = atcf_normalize_field(
			array(
				'key'      => 'field_team',
				'label'    => 'Team',
				'type'     => 'repeater',
				'settings' => array(
					'sub_fields' => array(
						array(
							'key'   => 'field_name',
							'label' => 'Name',
							'type'  => 'text',
						),
					),
				),
			)
		);

		atcf_save_value(
			$field,
			$this->ref(),
			array( array( 'name' => 'One' ), array( 'name' => 'Two' ), array( 'name' => 'Three' ) )
		);

		atcf_save_value( $field, $this->ref(), array( array( 'name' => 'One' ) ) );

		$this->assertSame( '1', get_post_meta( $this->post, 'team', true ) );
		$this->assertSame( '', get_post_meta( $this->post, 'team_1_name', true ) );
		$this->assertSame( '', get_post_meta( $this->post, '_team_2_name', true ) );
	}

	/**
	 * A repeater inside a repeater takes its own rows with it.
	 *
	 * Nested rows left behind are invisible from every screen, so nobody finds
	 * them until `wp_postmeta` has grown by a million rows.
	 *
	 * @covers ::atcf_delete_row
	 */
	public function test_nested_repeaters_are_cleaned_up() {
		$field = atcf_normalize_field(
			array(
				'key'      => 'field_outer',
				'label'    => 'Outer',
				'type'     => 'repeater',
				'settings' => array(
					'sub_fields' => array(
						array(
							'key'      => 'field_inner',
							'label'    => 'Inner',
							'type'     => 'repeater',
							'settings' => array(
								'sub_fields' => array(
									array(
										'key'   => 'field_leaf',
										'label' => 'Leaf',
										'type'  => 'text',
									),
								),
							),
						),
					),
				),
			)
		);

		atcf_save_value(
			$field,
			$this->ref(),
			array( array( 'inner' => array( array( 'leaf' => 'deep' ) ) ) )
		);

		$this->assertSame( 'deep', get_post_meta( $this->post, 'outer_0_inner_0_leaf', true ) );

		atcf_save_value( $field, $this->ref(), array() );

		$this->assertSame( '', get_post_meta( $this->post, 'outer_0_inner_0_leaf', true ) );
	}

	/**
	 * A group's sub-values are addressed without an index.
	 *
	 * @covers ::atcf_save_group_value
	 */
	public function test_group_layout() {
		$field = atcf_normalize_field(
			array(
				'key'      => 'field_address',
				'label'    => 'Address',
				'type'     => 'group',
				'settings' => array(
					'sub_fields' => array(
						array(
							'key'   => 'field_city',
							'label' => 'City',
							'type'  => 'text',
						),
					),
				),
			)
		);

		atcf_save_value( $field, $this->ref(), array( 'city' => 'Málaga' ) );

		$this->assertSame( 'Málaga', get_post_meta( $this->post, 'address_city', true ) );
	}

	/**
	 * Flexible content records each row's layout, spelled the way templates read it.
	 *
	 * @covers ::atcf_save_flexible
	 * @covers ::atcf_load_flexible
	 */
	public function test_flexible_content_layout() {
		$field = atcf_normalize_field(
			array(
				'key'      => 'field_blocks',
				'label'    => 'Blocks',
				'type'     => 'flexible_content',
				'settings' => array(
					'layouts' => array(
						array(
							'name'       => 'hero',
							'label'      => 'Hero',
							'sub_fields' => array(
								array(
									'key'   => 'field_head',
									'label' => 'Heading',
									'type'  => 'text',
								),
							),
						),
					),
				),
			)
		);

		atcf_save_value(
			$field,
			$this->ref(),
			array(
				array(
					'atcf_layout' => 'hero',
					'heading'     => 'Welcome',
				),
			)
		);

		$read = atcf_load_value( $field, $this->ref(), '', false );

		$this->assertSame( 'hero', $read[0]['atcf_layout'] );
		$this->assertSame( 'Welcome', $read[0]['heading'] );
		$this->assertSame( 'Welcome', get_post_meta( $this->post, 'blocks_0_heading', true ) );
	}

	/**
	 * A value that looks like serialized data is not inflated.
	 *
	 * Calling `maybe_unserialize()` on every value would happily inflate a
	 * string a person typed — a data-integrity bug and, historically, the shape
	 * of a PHP object-injection vulnerability.
	 *
	 * @covers ::atcf_maybe_unserialize_value
	 */
	public function test_text_that_looks_serialized_stays_text() {
		$field = atcf_normalize_field(
			array(
				'key'   => 'field_note',
				'label' => 'Note',
				'type'  => 'text',
			)
		);
		$nasty = 'a:1:{i:0;s:4:"boom";}';

		atcf_save_value( $field, $this->ref(), $nasty );

		$this->assertSame( $nasty, atcf_load_value( $field, $this->ref(), '', false ) );
	}

	/**
	 * Backslashes survive repeated saves.
	 *
	 * `update_post_meta()` unslashes what it is given, so a value containing a
	 * backslash — a Windows path, a regular expression — loses one on every save
	 * without the matching `wp_slash()`.
	 *
	 * @covers ::atcf_write_raw
	 */
	public function test_backslashes_survive() {
		$field = atcf_normalize_field(
			array(
				'key'   => 'field_re',
				'label' => 'Pattern',
				'type'  => 'text',
			)
		);
		$value = 'C:\\Users\\ada';

		atcf_save_value( $field, $this->ref(), $value );
		atcf_save_value( $field, $this->ref(), atcf_load_value( $field, $this->ref(), '', false ) );
		atcf_save_value( $field, $this->ref(), atcf_load_value( $field, $this->ref(), '', false ) );

		$this->assertSame( $value, atcf_load_value( $field, $this->ref(), '', false ) );
	}

	/**
	 * A layout-only field never writes a row.
	 *
	 * A group with six tabs and four messages would otherwise put ten empty rows
	 * on every post, forever.
	 *
	 * @covers ::atcf_save_value
	 */
	public function test_furniture_stores_nothing() {
		$field = atcf_normalize_field(
			array(
				'key'   => 'field_tab',
				'label' => 'Details',
				'type'  => 'tab',
			)
		);

		atcf_save_value( $field, $this->ref(), 'anything' );

		$this->assertSame( array(), get_post_meta( $this->post, 'details' ) );
	}

	/**
	 * Options values land under the conventional `options_` names.
	 *
	 * Which is what makes a site migrating in find its values already in place.
	 *
	 * @covers ::atcf_option_name
	 */
	public function test_option_names_match_the_convention() {
		$field = atcf_normalize_field(
			array(
				'key'   => 'field_phone',
				'label' => 'Phone',
				'type'  => 'text',
			)
		);

		atcf_save_value(
			$field,
			array(
				'type' => 'option',
				'id'   => 'options',
			),
			'01234'
		);

		$this->assertSame( '01234', get_option( 'options_phone' ) );

		atcf_save_value(
			$field,
			array(
				'type' => 'option',
				'id'   => 'footer',
			),
			'99999'
		);

		$this->assertSame( '99999', get_option( 'footer_phone' ) );
	}
}
