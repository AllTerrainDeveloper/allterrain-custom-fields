<?php
/**
 * Location rules.
 *
 * The engine that decides where a field group appears. Its failure modes are all
 * quiet: a rule that never matches shows nothing and says nothing, and a rule
 * that always matches puts a group on every screen on the site.
 *
 * @package AllTerrain_Fields
 */

/**
 * Where a field group appears.
 *
 * @group allterrain-fields
 */
class ATCF_Test_Location extends WP_UnitTestCase {

	/**
	 * Sets an administrator.
	 */
	public function set_up() {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	/**
	 * A group with no rules appears everywhere.
	 *
	 * The honest reading of "the author has not said where this goes yet", and
	 * what makes a brand new group visible while it is being built.
	 *
	 * @covers ::atcf_location_matches
	 */
	public function test_no_rules_matches_everything() {
		$this->assertTrue( atcf_location_matches( array(), atcf_post_context( self::factory()->post->create() ) ) );
	}

	/**
	 * A single rule matches its post type and nothing else.
	 *
	 * @covers ::atcf_location_matches
	 */
	public function test_post_type_rule() {
		$rules = array(
			array(
				array(
					'param'    => 'post_type',
					'operator' => '==',
					'value'    => 'page',
				),
			),
		);

		$page = self::factory()->post->create( array( 'post_type' => 'page' ) );
		$post = self::factory()->post->create();

		$this->assertTrue( atcf_location_matches( $rules, atcf_post_context( $page ) ) );
		$this->assertFalse( atcf_location_matches( $rules, atcf_post_context( $post ) ) );
	}

	/**
	 * `!=` is the exact negation of `==`.
	 *
	 * Applied by the caller rather than inside each test, so the two cannot
	 * disagree about the "not applicable" case — where `!=` should be true and
	 * usually gets written as false.
	 *
	 * @covers ::atcf_location_matches
	 */
	public function test_not_equals_is_the_negation() {
		$post = atcf_post_context( self::factory()->post->create() );

		$is    = array(
			array(
				array(
					'param'    => 'post_type',
					'operator' => '==',
					'value'    => 'page',
				),
			),
		);
		$isnot = array(
			array(
				array(
					'param'    => 'post_type',
					'operator' => '!=',
					'value'    => 'page',
				),
			),
		);

		$this->assertNotSame( atcf_location_matches( $is, $post ), atcf_location_matches( $isnot, $post ) );
	}

	/**
	 * Rules inside a clause are ANDed; clauses are ORed.
	 *
	 * The shape of the sentence people actually say: "on Products, and also on
	 * Pages using the landing template".
	 *
	 * @covers ::atcf_location_matches
	 */
	public function test_or_of_ands() {
		$page = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_status' => 'draft',
			)
		);

		$both = array(
			array(
				array(
					'param'    => 'post_type',
					'operator' => '==',
					'value'    => 'page',
				),
				array(
					'param'    => 'post_status',
					'operator' => '==',
					'value'    => 'publish',
				),
			),
		);

		$this->assertFalse( atcf_location_matches( $both, atcf_post_context( $page ) ) );

		$either = array(
			array(
				array(
					'param'    => 'post_type',
					'operator' => '==',
					'value'    => 'post',
				),
			),
			array(
				array(
					'param'    => 'post_type',
					'operator' => '==',
					'value'    => 'page',
				),
			),
		);

		$this->assertTrue( atcf_location_matches( $either, atcf_post_context( $page ) ) );
	}

	/**
	 * `all` matches anything set, and nothing when nothing is.
	 *
	 * @covers ::atcf_location_equals
	 */
	public function test_all_matches_anything_present() {
		$this->assertTrue( atcf_location_equals( 'post', 'all' ) );
		$this->assertFalse( atcf_location_equals( '', 'all' ) );
		$this->assertFalse( atcf_location_equals( '0', 'all' ) );
	}

	/**
	 * A group with no page template matches the `default` rule.
	 *
	 * "Pages using no special template" is a rule people write constantly, and
	 * an empty stored value has to be read as `default` for it to work.
	 *
	 * @covers ::atcf_location_test
	 */
	public function test_default_template() {
		$page  = self::factory()->post->create( array( 'post_type' => 'page' ) );
		$rules = array(
			array(
				array(
					'param'    => 'post_template',
					'operator' => '==',
					'value'    => 'default',
				),
			),
		);

		$this->assertTrue( atcf_location_matches( $rules, atcf_post_context( $page ) ) );
	}

	/**
	 * A term rule matches by `taxonomy:slug`, not by a bare slug.
	 *
	 * A bare slug collides between taxonomies — `news` is plausibly both a
	 * category and a tag.
	 *
	 * @covers ::atcf_post_context
	 */
	public function test_post_taxonomy_rule() {
		$post = self::factory()->post->create();
		$term = self::factory()->term->create(
			array(
				'taxonomy' => 'category',
				'slug'     => 'news',
			)
		);

		wp_set_object_terms( $post, array( $term ), 'category' );

		$rules = array(
			array(
				array(
					'param'    => 'post_taxonomy',
					'operator' => '==',
					'value'    => 'category:news',
				),
			),
		);

		$this->assertTrue( atcf_location_matches( $rules, atcf_post_context( $post ) ) );
	}

	/**
	 * A parameter nothing tests never matches.
	 *
	 * The alternative — treating an unknown parameter as true — would put a
	 * group everywhere the moment somebody deactivated the plugin that added it.
	 *
	 * @covers ::atcf_location_test
	 */
	public function test_unknown_parameter_never_matches() {
		$rules = array(
			array(
				array(
					'param'    => 'made_up',
					'operator' => '==',
					'value'    => 'x',
				),
			),
		);

		$this->assertFalse( atcf_location_matches( $rules, atcf_post_context( self::factory()->post->create() ) ) );
	}

	/**
	 * A plugin can add a parameter through the filter.
	 *
	 * @covers ::atcf_location_test
	 */
	public function test_filter_can_add_a_parameter() {
		add_filter(
			'atcf_location_test',
			static function ( $match, $rule ) {
				return 'is_tuesday' === $rule['param'] ? true : $match;
			},
			10,
			2
		);

		$rules = array(
			array(
				array(
					'param'    => 'is_tuesday',
					'operator' => '==',
					'value'    => '1',
				),
			),
		);

		$this->assertTrue( atcf_location_matches( $rules, atcf_post_context( self::factory()->post->create() ) ) );
	}

	/**
	 * A user-form rule tells the three user screens apart.
	 *
	 * @covers ::atcf_user_context
	 */
	public function test_user_form_rule() {
		$user  = self::factory()->user->create();
		$rules = array(
			array(
				array(
					'param'    => 'user_form',
					'operator' => '==',
					'value'    => 'profile',
				),
			),
		);

		$this->assertTrue( atcf_location_matches( $rules, atcf_user_context( $user, 'profile' ) ) );
		$this->assertFalse( atcf_location_matches( $rules, atcf_user_context( $user, 'edit' ) ) );
	}

	/**
	 * Every parameter the builder offers names a choice list that exists.
	 *
	 * A parameter whose choices key resolves to nothing gives the rule editor an
	 * empty second dropdown, which reads as a broken screen.
	 *
	 * @covers ::atcf_location_params
	 * @covers ::atcf_location_choices
	 */
	public function test_offered_parameters_have_choices() {
		$choices = atcf_location_choices();

		// `posts` and `terms` are deliberately absent — a site with fifty
		// thousand posts cannot ship them as a dropdown, and those parameters
		// use the search route instead.
		$searched = array( 'posts', 'terms' );

		foreach ( atcf_location_params() as $group ) {
			foreach ( $group['params'] as $param ) {
				if ( in_array( $param['choices'], $searched, true ) ) {
					continue;
				}

				$this->assertArrayHasKey(
					$param['choices'],
					$choices,
					"The `{$param['param']}` parameter names a choice list nothing provides."
				);
			}
		}
	}

	/**
	 * The plugin's own post types never receive field groups.
	 *
	 * A group whose rule said "any post type" would otherwise appear on the
	 * screen that edits field groups, which is a hall of mirrors.
	 *
	 * @covers ::atcf_post_type_choices
	 */
	public function test_own_post_types_are_not_offered() {
		$choices = atcf_post_type_choices();

		$this->assertArrayNotHasKey( ATCF_GROUP_TYPE, $choices );
		$this->assertArrayNotHasKey( ATCF_OPTIONS_TYPE, $choices );
	}
}
