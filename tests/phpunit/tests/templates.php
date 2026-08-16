<?php
/**
 * Starter templates.
 *
 * These are the first thing a new site sees, which makes them the one part of
 * the plugin where a mistake is guaranteed to be somebody's first impression.
 * So they are tested harder than their size suggests: every field type they name
 * has to be registered, every formula has to name a field that exists, every
 * conditional has to point at a real key *after* remapping, and applying one
 * twice has to produce two groups that do not know about each other.
 *
 * @package AllTerrain_Fields
 */

/**
 * Tests the starter templates.
 *
 * @group allterrain-fields
 * @group templates
 */
class ATCF_Test_Templates extends WP_UnitTestCase {

	/**
	 * Sets up an author who is allowed to save a group.
	 */
	public function set_up() {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	/**
	 * Every template is summarised, and the summary carries no field definitions.
	 *
	 * @covers ::atcf_template_summaries
	 */
	public function test_summaries_cover_every_template_without_the_schema() {
		$summaries = atcf_template_summaries();

		$this->assertCount( count( atcf_field_group_templates() ), $summaries );

		foreach ( $summaries as $summary ) {
			$this->assertArrayHasKey( 'slug', $summary );
			$this->assertArrayHasKey( 'label', $summary );
			$this->assertArrayHasKey( 'icon', $summary );
			$this->assertNotEmpty( $summary['teaches'] );
			$this->assertGreaterThan( 0, $summary['fields'] );
			$this->assertArrayNotHasKey( 'group', $summary, 'The picker does not need the schema to draw a card.' );
		}
	}

	/**
	 * An unknown slug is a 404, not a fatal and not an empty group.
	 *
	 * @covers ::atcf_group_from_template
	 */
	public function test_unknown_template_is_an_error() {
		$result = atcf_group_from_template( 'no-such-template' );

		$this->assertWPError( $result );
		$this->assertSame( 'atcf_no_template', $result->get_error_code() );
		$this->assertSame( 404, $result->get_error_data()['status'] );
	}

	/**
	 * Every template saves, and comes back with its fields intact.
	 *
	 * @covers ::atcf_group_from_template
	 * @dataProvider data_template_slugs
	 *
	 * @param string $slug Template slug.
	 */
	public function test_every_template_saves( $slug ) {
		$group = atcf_group_from_template( $slug );

		$this->assertIsArray( $group, "{$slug} did not build." );

		$saved = atcf_save_group( $group );

		$this->assertNotWPError( $saved, is_wp_error( $saved ) ? $saved->get_error_message() : '' );
		$this->assertNotEmpty( $saved['fields'] );
		$this->assertSame(
			count( atcf_flatten_fields( $group['fields'] ) ),
			count( atcf_flatten_fields( $saved['fields'] ) ),
			"{$slug} lost fields on the way through the normaliser."
		);
	}

	/**
	 * Every type a template names is a type that exists.
	 *
	 * The normaliser falls back to `text` for a type it does not know, so a typo
	 * here would not throw — it would quietly turn a gallery into a text box, and
	 * the only symptom would be a template that looks wrong.
	 *
	 * @covers ::atcf_field_group_templates
	 * @dataProvider data_template_slugs
	 *
	 * @param string $slug Template slug.
	 */
	public function test_every_field_type_is_registered( $slug ) {
		$templates = atcf_field_group_templates();

		foreach ( atcf_flatten_fields( $templates[ $slug ]['group']['fields'] ) as $field ) {
			$this->assertNotNull(
				atcf_get_field_type( $field['type'] ),
				"{$slug} names the field type “{$field['type']}”, which is not registered."
			);
		}
	}

	/**
	 * Every formula names a field that is actually in the same group.
	 *
	 * @covers ::atcf_field_group_templates
	 * @dataProvider data_template_slugs
	 *
	 * @param string $slug Template slug.
	 */
	public function test_every_formula_names_a_sibling( $slug ) {
		$templates = atcf_field_group_templates();
		$fields    = atcf_flatten_fields( $templates[ $slug ]['group']['fields'] );
		$names     = wp_list_pluck( $fields, 'name' );

		foreach ( $fields as $field ) {
			$formula = (string) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'formula', '' );

			if ( '' === $formula ) {
				continue;
			}

			preg_match_all( '/\{([a-z0-9_]+)\}/', $formula, $matches );

			foreach ( $matches[1] as $referenced ) {
				$this->assertContains(
					$referenced,
					$names,
					"{$slug} has a formula referencing “{$referenced}”, which is not a field in that group."
				);
			}
		}
	}

	/**
	 * Conditional rules survive remapping and point at real fields.
	 *
	 * @covers ::atcf_rewrite_template_rules
	 * @dataProvider data_template_slugs
	 *
	 * @param string $slug Template slug.
	 */
	public function test_conditional_rules_point_at_real_keys( $slug ) {
		$templates = atcf_field_group_templates();
		$before    = 0;

		foreach ( atcf_flatten_fields( $templates[ $slug ]['group']['fields'] ) as $field ) {
			$before += count( (array) atcf_arr( (array) atcf_arr( $field, 'conditional', array() ), 'rules', array() ) );
		}

		$group  = atcf_group_from_template( $slug );
		$fields = atcf_flatten_fields( $group['fields'] );
		$keys   = wp_list_pluck( $fields, 'key' );
		$after  = 0;

		foreach ( $fields as $field ) {
			foreach ( (array) atcf_arr( (array) atcf_arr( $field, 'conditional', array() ), 'rules', array() ) as $rule ) {
				++$after;

				$this->assertContains(
					$rule['field'],
					$keys,
					"{$slug} has a rule pointing at a key that is not in the group."
				);
			}
		}

		$this->assertSame( $before, $after, "{$slug} dropped a conditional rule during remapping." );
	}

	/**
	 * Applying a template twice gives two groups that share nothing.
	 *
	 * The bug this guards against is the quiet one: two groups whose conditionals
	 * cross over, so a field in one hides according to a switch in the other.
	 *
	 * @covers ::atcf_remap_template_keys
	 */
	public function test_applying_a_template_twice_gives_independent_groups() {
		$first  = atcf_group_from_template( 'recipe' );
		$second = atcf_group_from_template( 'recipe' );

		$this->assertNotSame( $first['key'], $second['key'] );

		$first_keys  = wp_list_pluck( atcf_flatten_fields( $first['fields'] ), 'key' );
		$second_keys = wp_list_pluck( atcf_flatten_fields( $second['fields'] ), 'key' );

		$this->assertSame( array(), array_intersect( $first_keys, $second_keys ) );

		foreach ( atcf_flatten_fields( $second['fields'] ) as $field ) {
			foreach ( (array) atcf_arr( (array) atcf_arr( $field, 'conditional', array() ), 'rules', array() ) as $rule ) {
				$this->assertNotContains(
					$rule['field'],
					$first_keys,
					'The second copy has a rule pointing into the first copy.'
				);
			}
		}
	}

	/**
	 * No template leaves a symbolic key behind.
	 *
	 * @covers ::atcf_remap_template_keys
	 * @dataProvider data_template_slugs
	 *
	 * @param string $slug Template slug.
	 */
	public function test_no_symbolic_keys_survive( $slug ) {
		foreach ( atcf_flatten_fields( atcf_group_from_template( $slug )['fields'] ) as $field ) {
			$this->assertMatchesRegularExpression(
				'/^field_[a-f0-9]+$/',
				$field['key'],
				"{$slug} shipped the symbolic key “{$field['key']}” straight through."
			);
		}
	}

	/**
	 * Every template has somewhere to appear.
	 *
	 * @covers ::atcf_template_location
	 * @dataProvider data_template_slugs
	 *
	 * @param string $slug Template slug.
	 */
	public function test_every_template_has_a_location( $slug ) {
		$saved = atcf_save_group( atcf_group_from_template( $slug ) );

		$this->assertNotWPError( $saved );
		$this->assertNotEmpty( $saved['location'], "{$slug} would appear nowhere." );
	}

	/**
	 * A site can add its own template.
	 *
	 * @covers ::atcf_field_group_templates
	 */
	public function test_templates_are_filterable() {
		$filter = static function ( $templates ) {
			$templates['garage'] = array(
				'slug'        => 'garage',
				'label'       => 'Garage',
				'description' => 'Cars.',
				'icon'        => 'dashicons-car',
				'teaches'     => array( 'Nothing' ),
				'group'       => array(
					'title'    => 'Garage',
					'location' => atcf_template_location(),
					'fields'   => array( atcf_template_field( 'field_garage_make', 'Make', 'text' ) ),
				),
			);

			return $templates;
		};

		add_filter( 'atcf_field_group_templates', $filter );

		$this->assertContains( 'garage', wp_list_pluck( atcf_template_summaries(), 'slug' ) );

		$group = atcf_group_from_template( 'garage' );

		$this->assertIsArray( $group );
		$this->assertSame( 'make', $group['fields'][0]['name'] );

		remove_filter( 'atcf_field_group_templates', $filter );
	}

	/**
	 * The template slugs.
	 *
	 * @return array[] Slugs.
	 */
	public function data_template_slugs() {
		return array(
			'recipe'   => array( 'recipe' ),
			'property' => array( 'property' ),
			'event'    => array( 'event' ),
		);
	}
}
