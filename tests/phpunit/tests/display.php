<?php
/**
 * The display layer.
 *
 * Everything here is a *public* surface — the one part of the plugin whose
 * readers are logged out. So alongside "does it render", every test file's
 * other half is "does it refuse": raw markup in a meta row, a private post
 * behind a relationship, an email address behind a user field, a password
 * field anywhere at all.
 *
 * @package AllTerrain_Fields
 */

/**
 * Front-end display, the shortcode, block bindings and REST exposure.
 *
 * @group allterrain-fields
 */
class ATCF_Test_Display extends WP_UnitTestCase {

	/**
	 * Builds the standard group most tests render.
	 *
	 * @param array $frontend Frontend settings to merge.
	 * @param array $extra    Extra fields.
	 * @return array The saved group.
	 */
	private function make_group( $frontend = array(), $extra = array() ) {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$saved = atcf_save_group(
			array(
				'key'      => 'group_display',
				'title'    => 'Spec sheet',
				'location' => array(
					array(
						array(
							'param'    => 'post_type',
							'operator' => '==',
							'value'    => 'post',
						),
					),
				),
				'settings' => array(
					'frontend' => array_merge(
						array(
							'enabled'   => true,
							'placement' => 'after',
							'heading'   => true,
						),
						$frontend
					),
				),
				'fields'   => array_merge(
					array(
						array(
							'key'   => 'field_disp_weight',
							'name'  => 'weight',
							'label' => 'Weight',
							'type'  => 'text',
						),
					),
					$extra
				),
			)
		);

		$this->assertNotWPError( $saved );

		wp_set_current_user( 0 );

		return $saved;
	}

	/**
	 * Runs the content filter the way a theme does: main query, in the loop.
	 *
	 * @param int $post_id The post to visit.
	 * @return string The filtered content.
	 */
	private function rendered( $post_id ) {
		$this->go_to( get_permalink( $post_id ) );

		$content = '';

		while ( have_posts() ) {
			the_post();

			$content = apply_filters( 'the_content', get_the_content() );
		}

		return $content;
	}

	/**
	 * Off by default: a group that never asked stays off the front end.
	 *
	 * @covers ::atcf_display_in_content
	 */
	public function test_nothing_renders_unless_asked() {
		$this->make_group( array( 'enabled' => false ) );

		$post = self::factory()->post->create( array( 'post_content' => 'Body.' ) );

		update_post_meta( $post, 'weight', '12kg' );

		$this->assertStringNotContainsString( 'atcf-display', $this->rendered( $post ) );
	}

	/**
	 * Switched on, the group renders after the content, escaped, labelled.
	 *
	 * The stored value carries markup planted straight into the meta row —
	 * past every save-time sanitiser — because output escaping must hold even
	 * when input sanitising did not.
	 *
	 * @covers ::atcf_display_in_content
	 * @covers ::atcf_display_value_html
	 */
	public function test_renders_after_content_escaped() {
		$this->make_group();

		$post = self::factory()->post->create( array( 'post_content' => 'Body.' ) );

		update_post_meta( $post, 'weight', '<script>alert(1)</script>12kg' );

		$content = $this->rendered( $post );

		$this->assertStringContainsString( 'Body.', $content );
		$this->assertStringContainsString( 'atcf-display', $content );
		$this->assertStringContainsString( 'Spec sheet', $content );
		$this->assertStringContainsString( 'Weight', $content );
		$this->assertStringNotContainsString( '<script>', $content );
		$this->assertStringContainsString( '&lt;script&gt;', $content );
		$this->assertGreaterThan(
			strpos( $content, 'Body.' ),
			strpos( $content, 'atcf-display' ),
			'The section should come after the content.'
		);
		$this->assertTrue( wp_style_is( 'atcf-display', 'enqueued' ), 'The stylesheet rides along.' );
	}

	/**
	 * Placement and heading obey their settings.
	 *
	 * @covers ::atcf_display_in_content
	 */
	public function test_placement_and_heading_settings() {
		$this->make_group(
			array(
				'placement' => 'before',
				'heading'   => false,
			)
		);

		$post = self::factory()->post->create( array( 'post_content' => 'Body.' ) );

		update_post_meta( $post, 'weight', '12kg' );

		$content = $this->rendered( $post );

		$this->assertLessThan( strpos( $content, 'Body.' ), strpos( $content, 'atcf-display' ) );
		$this->assertStringNotContainsString( 'Spec sheet', $content );
	}

	/**
	 * Empty fields take no space, and a wholly empty group renders nothing.
	 *
	 * @covers ::atcf_display_render_default
	 */
	public function test_empty_values_are_skipped() {
		$this->make_group();

		$post = self::factory()->post->create( array( 'post_content' => 'Body.' ) );

		$this->assertStringNotContainsString( 'atcf-display', $this->rendered( $post ) );
	}

	/**
	 * A repeater renders as nested rows.
	 *
	 * @covers ::atcf_display_value_html
	 */
	public function test_repeater_renders_rows() {
		$this->make_group(
			array(),
			array(
				array(
					'key'      => 'field_disp_team',
					'name'     => 'team',
					'label'    => 'Team',
					'type'     => 'repeater',
					'settings' => array(
						'sub_fields' => array(
							array(
								'key'   => 'field_disp_member',
								'name'  => 'member',
								'label' => 'Member',
								'type'  => 'text',
							),
						),
					),
				),
			)
		);

		$post = self::factory()->post->create( array( 'post_content' => 'Body.' ) );

		update_post_meta( $post, 'team', '2' );
		update_post_meta( $post, 'team_0_member', 'Ada' );
		update_post_meta( $post, 'team_1_member', 'Grace' );

		$content = $this->rendered( $post );

		$this->assertStringContainsString( 'atcf-display__rows', $content );
		$this->assertStringContainsString( 'Ada', $content );
		$this->assertStringContainsString( 'Grace', $content );
	}

	/**
	 * The public surface refuses what it must: private posts do not link,
	 * users render as names rather than emails, passwords never render.
	 *
	 * @covers ::atcf_display_value_html
	 */
	public function test_the_public_surface_refuses() {
		$this->make_group(
			array(),
			array(
				array(
					'key'   => 'field_disp_rel',
					'name'  => 'related',
					'label' => 'Related',
					'type'  => 'relationship',
				),
				array(
					'key'   => 'field_disp_owner',
					'name'  => 'owner',
					'label' => 'Owner',
					'type'  => 'user',
				),
				array(
					'key'   => 'field_disp_secret',
					'name'  => 'secret',
					'label' => 'Secret',
					'type'  => 'password',
				),
			)
		);

		$public  = self::factory()->post->create(
			array(
				'post_title'  => 'Public friend',
				'post_status' => 'publish',
			)
		);
		$private = self::factory()->post->create(
			array(
				'post_title'  => 'Hidden friend',
				'post_status' => 'private',
			)
		);
		$user    = self::factory()->user->create(
			array(
				'display_name' => 'Sam Editor',
				'user_email'   => 'sam@example.com',
			)
		);

		$post = self::factory()->post->create( array( 'post_content' => 'Body.' ) );

		update_post_meta( $post, 'weight', '12kg' );
		update_post_meta( $post, 'related', array( $public, $private ) );
		update_post_meta( $post, 'owner', $user );
		update_post_meta( $post, 'secret', 'hunter2' );

		$content = $this->rendered( $post );

		$this->assertStringContainsString( 'Public friend', $content );
		$this->assertStringNotContainsString( 'Hidden friend', $content );
		$this->assertStringContainsString( 'Sam Editor', $content );
		$this->assertStringNotContainsString( 'sam@example.com', $content );
		$this->assertStringNotContainsString( 'hunter2', $content );
	}

	/**
	 * The shortcode renders escaped, falls back, and refuses.
	 *
	 * @covers ::atcf_shortcode
	 */
	public function test_shortcode() {
		$this->make_group( array( 'enabled' => false ) );

		$post = self::factory()->post->create();

		update_post_meta( $post, 'weight', '<em>12</em>kg' );

		$GLOBALS['post'] = get_post( $post ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Simulating the loop.
		setup_postdata( $GLOBALS['post'] );

		// Escaped by default: markup in the row comes out as text.
		$this->assertSame( '&lt;em&gt;12&lt;/em&gt;kg', do_shortcode( '[atcf field="weight"]' ) );

		// The default shows only when the field is empty.
		$this->assertSame( 'n/a', do_shortcode( '[atcf field="missing_thing" default="n/a"]' ) );

		wp_reset_postdata();
	}

	/**
	 * The shortcode will not read another post unless anyone could.
	 *
	 * @covers ::atcf_shortcode
	 */
	public function test_shortcode_cross_post_gate() {
		$this->make_group( array( 'enabled' => false ) );

		$private = self::factory()->post->create( array( 'post_status' => 'private' ) );
		$public  = self::factory()->post->create( array( 'post_status' => 'publish' ) );

		update_post_meta( $private, 'weight', 'private weight' );
		update_post_meta( $public, 'weight', 'public weight' );

		$host = self::factory()->post->create();

		$GLOBALS['post'] = get_post( $host ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Simulating the loop.
		setup_postdata( $GLOBALS['post'] );

		$this->assertSame( '', do_shortcode( '[atcf field="weight" post="' . $private . '"]' ) );
		$this->assertSame( 'public weight', do_shortcode( '[atcf field="weight" post="' . $public . '"]' ) );

		wp_reset_postdata();
	}

	/**
	 * The bindings source registers and resolves — and refuses passwords.
	 *
	 * @covers ::atcf_register_binding_source
	 * @covers ::atcf_binding_value
	 */
	public function test_block_bindings() {
		if ( ! function_exists( 'register_block_bindings_source' ) ) {
			$this->markTestSkipped( 'Block bindings need WordPress 6.5.' );
		}

		$this->make_group(
			array( 'enabled' => false ),
			array(
				array(
					'key'   => 'field_disp_secret',
					'name'  => 'secret',
					'label' => 'Secret',
					'type'  => 'password',
				),
				array(
					'key'      => 'field_disp_cta',
					'name'     => 'cta',
					'label'    => 'Call to action',
					'type'     => 'link',
					'settings' => array(),
				),
			)
		);

		// Registered under our name (an idempotent re-run must not fatal).
		atcf_register_binding_source();

		$this->assertNotNull( get_block_bindings_source( 'allterrain-fields/field' ) );

		$post = self::factory()->post->create();

		update_post_meta( $post, 'weight', '12kg' );
		update_post_meta( $post, 'secret', 'hunter2' );
		update_post_meta(
			$post,
			'cta',
			array(
				'url'    => 'https://example.com/buy',
				'title'  => 'Buy',
				'target' => '',
			)
		);

		// A hand-built block does not inherit `postId` context the way the
		// real renderer provides it (core merges the source's uses_context in
		// during rendering), so this exercises the loop fallback instead.
		$GLOBALS['post'] = get_post( $post ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Simulating the loop.
		setup_postdata( $GLOBALS['post'] );

		$block = new WP_Block(
			array(
				'blockName' => 'core/paragraph',
				'attrs'     => array(),
			)
		);

		$this->assertSame( '12kg', atcf_binding_value( array( 'field' => 'weight' ), $block, 'content' ) );
		$this->assertSame( 'https://example.com/buy', atcf_binding_value( array( 'field' => 'cta' ), $block, 'url' ) );
		$this->assertNull( atcf_binding_value( array( 'field' => 'secret' ), $block, 'content' ) );
		$this->assertNull( atcf_binding_value( array( 'field' => 'nothing_here' ), $block, 'content' ) );

		wp_reset_postdata();
	}

	/**
	 * The REST response carries an `atcf` object when the group opted in —
	 * formatted, password-free — and nothing when it opted out.
	 *
	 * @covers ::atcf_register_rest_value_fields
	 * @covers ::atcf_rest_field_values
	 */
	public function test_rest_exposure() {
		$this->make_group(
			array( 'enabled' => false ),
			array(
				array(
					'key'   => 'field_disp_secret',
					'name'  => 'secret',
					'label' => 'Secret',
					'type'  => 'password',
				),
			)
		);

		$post = self::factory()->post->create( array( 'post_status' => 'publish' ) );

		update_post_meta( $post, 'weight', '12kg' );
		update_post_meta( $post, 'secret', 'hunter2' );

		global $wp_rest_server;

		$wp_rest_server = new WP_REST_Server();

		do_action( 'rest_api_init' );

		$data = $wp_rest_server->dispatch( new WP_REST_Request( 'GET', '/wp/v2/posts/' . $post ) )->get_data();

		$this->assertArrayHasKey( 'atcf', $data );
		$this->assertSame( '12kg', $data['atcf']['weight'] );
		$this->assertArrayNotHasKey( 'secret', $data['atcf'] );

		// Opting out empties the object.
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$group = atcf_get_group( atcf_group_post_by_key( 'group_display' ) );

		$group['settings']['show_in_rest'] = false;

		atcf_save_group( $group );
		wp_set_current_user( 0 );

		$data = $wp_rest_server->dispatch( new WP_REST_Request( 'GET', '/wp/v2/posts/' . $post ) )->get_data();

		$this->assertSame( array(), (array) atcf_arr( $data, 'atcf', array() ) );
	}

	/**
	 * The frontend settings normalise with safe defaults.
	 *
	 * @covers ::atcf_normalize_frontend_settings
	 */
	public function test_frontend_settings_normalise() {
		$settings = atcf_normalize_frontend_settings( 'nonsense' );

		$this->assertFalse( $settings['enabled'] );
		$this->assertSame( 'after', $settings['placement'] );
		$this->assertTrue( $settings['heading'] );

		$settings = atcf_normalize_frontend_settings(
			array(
				'enabled'   => 1,
				'placement' => 'sideways',
				'heading'   => 0,
			)
		);

		$this->assertTrue( $settings['enabled'] );
		$this->assertSame( 'after', $settings['placement'] );
		$this->assertFalse( $settings['heading'] );
	}
}
