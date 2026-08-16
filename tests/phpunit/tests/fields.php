<?php
/**
 * The field type registry, its sanitisers, and validation.
 *
 * The registry's rule is that there is no privileged path: every built-in type
 * is one `atcf_register_field_type()` call using exactly the API a third-party
 * plugin would use. The test for that rule is the one at the bottom — a
 * third-party type registered in a test has to behave like a built-in one all
 * the way through the store.
 *
 * @package AllTerrain_Fields
 */

/**
 * Field types.
 *
 * @group allterrain-fields
 */
class ATCF_Test_Fields extends WP_UnitTestCase {

	/**
	 * Sets an administrator.
	 */
	public function set_up() {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	/**
	 * Removes anything a test registered, so the registry does not leak.
	 */
	public function tear_down() {
		atcf_unregister_field_type( 'atcf_test_type' );

		parent::tear_down();
	}

	/**
	 * Every built-in type is registered and complete.
	 *
	 * @covers ::atcf_get_field_types
	 */
	public function test_every_builtin_registers() {
		$types = atcf_get_field_types();

		$expected = array(
			'text',
			'textarea',
			'number',
			'range',
			'email',
			'url',
			'password',
			'select',
			'radio',
			'checkbox',
			'button_group',
			'true_false',
			'wysiwyg',
			'oembed',
			'image',
			'file',
			'gallery',
			'code',
			'post_object',
			'relationship',
			'page_link',
			'taxonomy',
			'user',
			'link',
			'message',
			'tab',
			'accordion',
			'group',
			'repeater',
			'flexible_content',
			'clone',
			'date_picker',
			'date_time_picker',
			'time_picker',
			'color_picker',
			'icon',
			'location',
			'table',
			'json',
			'computed',
		);

		foreach ( $expected as $type ) {
			$this->assertArrayHasKey( $type, $types, "The `{$type}` field type is not registered." );
			$this->assertNotSame( '', $types[ $type ]['label'], "`{$type}` has no label." );
			$this->assertIsArray( $types[ $type ]['settings'] );
			$this->assertIsArray( $types[ $type ]['supports'] );
			$this->assertIsArray( $types[ $type ]['accepts'] );
		}
	}

	/**
	 * A type declares a palette group the builder knows about.
	 *
	 * A type in a group nothing declared lands under "Other", which is a bug
	 * report rather than a feature.
	 *
	 * @covers ::atcf_field_type_palette
	 */
	public function test_builtin_types_are_in_declared_groups() {
		$groups = array_keys( atcf_field_groups_list() );

		foreach ( atcf_get_field_types() as $type ) {
			$this->assertContains( $type['group'], $groups, "`{$type['type']}` is in the undeclared group `{$type['group']}`." );
		}
	}

	/**
	 * The palette never carries a callback.
	 *
	 * A closure cannot cross `wp_json_encode()` at all, and a string callback
	 * that could would tell the browser the name of a PHP function it can never
	 * call.
	 *
	 * @covers ::atcf_field_type_palette
	 */
	public function test_palette_is_serializable() {
		foreach ( atcf_field_type_palette() as $type ) {
			$this->assertArrayNotHasKey( 'sanitize', $type );
			$this->assertArrayNotHasKey( 'format', $type );
			$this->assertArrayNotHasKey( 'control', $type );
		}

		$this->assertIsString( wp_json_encode( atcf_field_type_palette() ) );
	}

	/**
	 * A choice value not on the list is dropped.
	 *
	 * The whole point of a choice field is that the legal set is declared, so
	 * anything else is an import error or somebody editing a `<select>` in
	 * devtools.
	 *
	 * @covers ::atcf_sanitize_choice
	 */
	public function test_choices_are_constrained() {
		$field = atcf_normalize_field(
			array(
				'key'      => 'field_status',
				'label'    => 'Status',
				'type'     => 'select',
				'settings' => array(
					'choices' => array(
						array(
							'value' => 'a',
							'label' => 'A',
						),
					),
				),
			)
		);

		$this->assertSame( 'a', atcf_sanitize_choice( 'a', $field ) );
		$this->assertSame( '', atcf_sanitize_choice( 'z', $field ) );
	}

	/**
	 * The three shapes of a `choices` setting all normalise.
	 *
	 * @covers ::atcf_normalize_choices
	 */
	public function test_choices_accept_every_shape() {
		$expected = array(
			array(
				'value' => 'a',
				'label' => 'A',
			),
			array(
				'value' => 'b',
				'label' => 'B',
			),
		);

		$this->assertSame( $expected, atcf_normalize_choices( $expected ) );
		$this->assertSame(
			$expected,
			atcf_normalize_choices(
				array(
					'a' => 'A',
					'b' => 'B',
				)
			)
		);
		$this->assertSame( $expected, atcf_normalize_choices( "a : A\nb : B" ) );
	}

	/**
	 * A boolean stores as a string so its row exists.
	 *
	 * PHP's `false` serialises to an empty string, which is indistinguishable
	 * from "never set" — and a site querying `meta_value = '0'` for every post
	 * with the switch off needs the row to exist and to say so.
	 *
	 * @covers ::atcf_sanitize_bool
	 */
	public function test_booleans_store_as_one_and_zero() {
		$this->assertSame( '1', atcf_sanitize_bool( true ) );
		$this->assertSame( '0', atcf_sanitize_bool( false ) );
		$this->assertSame( '0', atcf_sanitize_bool( '0' ) );
		$this->assertSame( '0', atcf_sanitize_bool( 'false' ) );
		$this->assertSame( '1', atcf_sanitize_bool( 'yes' ) );
	}

	/**
	 * An empty number stays empty rather than becoming zero.
	 *
	 * "Nobody has filled this in" and "somebody said zero" are different, and
	 * collapsing them is how a price field on an unedited post starts reading
	 * "Free".
	 *
	 * @covers ::atcf_sanitize_number
	 */
	public function test_empty_number_is_not_zero() {
		$this->assertSame( '', atcf_sanitize_number( '' ) );
		$this->assertSame( 0, atcf_sanitize_number( '0' ) );
		$this->assertSame( 4.5, atcf_sanitize_number( '4.5' ) );
	}

	/**
	 * A number is clamped to its declared range rather than refused.
	 *
	 * @covers ::atcf_sanitize_number
	 */
	public function test_numbers_clamp() {
		$field = array(
			'settings' => array(
				'min' => 1,
				'max' => 10,
			),
		);

		$this->assertSame( 1, atcf_sanitize_number( -5, $field ) );
		$this->assertSame( 10, atcf_sanitize_number( 500, $field ) );
	}

	/**
	 * A date stores sortably whatever it arrived as.
	 *
	 * A field storing `3 March 2026` is a field nobody can order by, and
	 * `meta_query` with `type => DATE` assumes `Y-m-d`.
	 *
	 * @covers ::atcf_sanitize_date
	 */
	public function test_dates_store_sortably() {
		$this->assertSame( '2026-03-03', atcf_sanitize_date( '3 March 2026' ) );
		$this->assertSame( '2026-03-03', atcf_sanitize_date( '2026-03-03' ) );
		$this->assertSame( '', atcf_sanitize_date( 'not a date at all' ) );
		$this->assertSame( '', atcf_sanitize_date( '' ) );
	}

	/**
	 * A bare time is anchored so it does not read as a date.
	 *
	 * @covers ::atcf_sanitize_time
	 */
	public function test_bare_times_parse() {
		$this->assertSame( '14:30:00', atcf_sanitize_time( '14:30' ) );
	}

	/**
	 * An attachment id has to point at an attachment.
	 *
	 * @covers ::atcf_sanitize_attachment
	 */
	public function test_attachment_ids_are_checked() {
		$post = self::factory()->post->create();

		$this->assertSame( 0, atcf_sanitize_attachment( $post ) );
		$this->assertSame( 0, atcf_sanitize_attachment( 999999 ) );
	}

	/**
	 * A colour that is not a colour stores empty.
	 *
	 * The value ends up in a `style` attribute, and something that is not a
	 * colour there is either broken CSS or, with the right punctuation, an
	 * escape from it.
	 *
	 * @covers ::atcf_sanitize_color
	 */
	public function test_colours_are_constrained() {
		$this->assertSame( '#abc', atcf_sanitize_color( '#ABC' ) );
		$this->assertSame( '#aabbcc', atcf_sanitize_color( 'aabbcc' ) );
		$this->assertSame( '', atcf_sanitize_color( 'red; background: url(x)' ) );
	}

	/**
	 * A coordinate outside the planet is clamped.
	 *
	 * @covers ::atcf_sanitize_location
	 */
	public function test_locations_are_clamped() {
		$value = atcf_sanitize_location(
			array(
				'lat'     => 999,
				'lng'     => -999,
				'address' => 'Nowhere',
			)
		);

		$this->assertSame( 90.0, $value['lat'] );
		$this->assertSame( -180.0, $value['lng'] );
	}

	/**
	 * Invalid JSON is not stored.
	 *
	 * Storing it would put the field in a state where every read returns null,
	 * which is much harder to notice than a refusal.
	 *
	 * @covers ::atcf_sanitize_json
	 */
	public function test_invalid_json_is_refused() {
		$this->assertSame( '{"a":1}', atcf_sanitize_json( '{"a":1}' ) );
		$this->assertSame( '', atcf_sanitize_json( '{a:1}' ) );
	}

	/**
	 * A required field that logic hides is not required.
	 *
	 * The single most reported bug in every custom-fields plugin that shipped
	 * conditional logic and server validation separately.
	 *
	 * @covers ::atcf_validate_submission
	 */
	public function test_hidden_required_field_is_not_validated() {
		$group = atcf_normalize_group(
			array(
				'fields' => array(
					array(
						'key'   => 'field_toggle',
						'label' => 'Show it',
						'type'  => 'true_false',
					),
					array(
						'key'         => 'field_needed',
						'label'       => 'Needed',
						'type'        => 'text',
						'required'    => true,
						'conditional' => array(
							'enabled' => true,
							'action'  => 'show',
							'match'   => 'all',
							'rules'   => array(
								array(
									'field'    => 'field_toggle',
									'operator' => 'is',
									'value'    => '1',
								),
							),
						),
					),
				),
			)
		);

		$hidden = atcf_validate_submission(
			array( $group ),
			array(
				'field_toggle' => '0',
				'field_needed' => '',
			)
		);
		$shown  = atcf_validate_submission(
			array( $group ),
			array(
				'field_toggle' => '1',
				'field_needed' => '',
			)
		);

		$this->assertSame( array(), $hidden );
		$this->assertArrayHasKey( 'field_needed', $shown );
	}

	/**
	 * A required field gets one message, not two.
	 *
	 * Telling somebody a field is empty *and* that its value is not a valid
	 * email is two sentences about one blank box.
	 *
	 * @covers ::atcf_validate_field
	 */
	public function test_one_message_per_field() {
		$field = atcf_normalize_field(
			array(
				'key'      => 'field_e',
				'label'    => 'Email',
				'type'     => 'email',
				'required' => true,
			)
		);

		$this->assertCount( 1, atcf_validate_field( $field, '' ) );
	}

	/**
	 * A minimum item count is enforced on a list.
	 *
	 * @covers ::atcf_validate_count
	 */
	public function test_item_counts_are_enforced() {
		$settings = array(
			'min_items' => 2,
			'max_items' => 3,
		);

		$this->assertNotSame( '', atcf_validate_count( array( 1 ), $settings ) );
		$this->assertSame( '', atcf_validate_count( array( 1, 2 ), $settings ) );
		$this->assertNotSame( '', atcf_validate_count( array( 1, 2, 3, 4 ), $settings ) );
	}

	/**
	 * A third-party field type behaves exactly like a built-in one.
	 *
	 * This is the registry's whole promise, and the only test that can prove it:
	 * a type registered from outside has to reach the palette, normalise its
	 * settings, sanitise on write and format on read, with no special handling
	 * anywhere.
	 *
	 * @covers ::atcf_register_field_type
	 */
	public function test_a_third_party_type_is_not_second_class() {
		atcf_register_field_type(
			'atcf_test_type',
			array(
				'label'    => 'Shouty',
				'group'    => 'basic',
				'value'    => 'string',
				'settings' => array( 'suffix' => '!' ),
				'accepts'  => array( 'text' ),
				'sanitize' => static function ( $value, $field ) {
					return strtoupper( (string) $value ) . (string) atcf_arr( (array) $field['settings'], 'suffix', '' );
				},
				'format'   => static function ( $value ) {
					return '<em>' . $value . '</em>';
				},
			)
		);

		$this->assertArrayHasKey( 'atcf_test_type', atcf_get_field_types() );
		$this->assertContains( 'atcf_test_type', wp_list_pluck( atcf_field_type_palette(), 'type' ) );

		$field = atcf_normalize_field(
			array(
				'key'   => 'field_shout',
				'label' => 'Shout',
				'type'  => 'atcf_test_type',
			)
		);

		// The registry's defaults were filled in.
		$this->assertSame( '!', $field['settings']['suffix'] );

		$post = self::factory()->post->create();
		$ref  = array(
			'type' => 'post',
			'id'   => $post,
		);

		atcf_save_value( $field, $ref, 'hello' );

		$this->assertSame( 'HELLO!', get_post_meta( $post, 'shout', true ) );
		$this->assertSame( '<em>HELLO!</em>', atcf_load_value( $field, $ref, '', true ) );
	}

	/**
	 * A type nothing registers renders as unknown rather than dropping its value.
	 *
	 * A field whose type came from a deactivated plugin must not silently lose
	 * its data on the next save.
	 *
	 * @covers ::atcf_render_field
	 */
	public function test_unknown_type_keeps_its_value() {
		$field = atcf_normalize_field(
			array(
				'key'   => 'field_gone',
				'label' => 'Gone',
				'type'  => 'nothing_registers_this',
			)
		);

		ob_start();
		atcf_render_field( $field, 'kept' );
		$markup = (string) ob_get_clean();

		$this->assertStringContainsString( 'atcf-field--unknown', $markup );
		$this->assertStringContainsString( 'Gone', $markup );
	}

	/**
	 * The shape fixture the JavaScript preview reads names every registered type.
	 *
	 * The two lists live in different languages: types are registered in PHP, and
	 * `src/builder/field-preview.ts` decides what each one *looks like* on the
	 * canvas. A type added here and forgotten there renders as a blank card, and
	 * nothing anywhere reports it — so the fixture is asserted from both sides.
	 * This is the PHP half; `tests/vitest/field-preview.test.ts` is the other.
	 *
	 * @covers ::atcf_get_field_types
	 */
	public function test_the_preview_fixture_matches_the_registry() {
		$path = dirname( __DIR__, 2 ) . '/fixtures/field-types.json';

		$this->assertFileExists( $path, 'The field-type fixture is missing.' );

		$fixture = json_decode( (string) file_get_contents( $path ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading a test fixture off disk.
		$live    = array_keys( atcf_get_field_types() );

		sort( $fixture );
		sort( $live );

		$this->assertSame(
			$live,
			$fixture,
			'tests/fixtures/field-types.json is out of date. Regenerate it, and give any new type a shape in src/builder/field-preview.ts.'
		);
	}

	/**
	 * The table sanitiser reads every column dialect that exists.
	 *
	 * The builder's column editor writes `value`/`label`; hand-written
	 * registrations write `key`/`label` or plain strings. The sanitiser read
	 * only `key` — so every builder-made table sanitised against an *empty*
	 * column list, which blanked every cell on every save. The data was one
	 * spelling away the whole time.
	 *
	 * @covers ::atcf_sanitize_table
	 */
	public function test_table_sanitizer_reads_every_column_dialect() {
		$rows = array(
			array(
				'spec'  => 'Weight',
				'value' => '1.2kg',
			),
		);

		$dialects = array(
			'builder'      => array(
				array(
					'value' => 'spec',
					'label' => 'Spec',
				),
				array(
					'value' => 'value',
					'label' => 'Value',
				),
			),
			'hand-written' => array(
				array(
					'key'   => 'spec',
					'label' => 'Spec',
				),
				array(
					'key'   => 'value',
					'label' => 'Value',
				),
			),
			'plain'        => array( 'spec', 'value' ),
		);

		foreach ( $dialects as $name => $columns ) {
			$clean = atcf_sanitize_table(
				$rows,
				array( 'settings' => array( 'columns' => $columns ) )
			);

			$this->assertSame(
				array(
					array(
						'spec'  => 'Weight',
						'value' => '1.2kg',
					),
				),
				$clean,
				"The {$name} column dialect lost its cells."
			);
		}
	}
}
