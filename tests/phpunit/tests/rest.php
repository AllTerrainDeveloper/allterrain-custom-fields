<?php
/**
 * The REST API and the shell integration.
 *
 * The routes are what the windows talk to, so they are exercised by every save
 * anybody makes — but the *permission* boundaries are not, because the builder
 * only ever runs as somebody who has already passed them. These tests are the
 * only place the refusals are checked.
 *
 * @package AllTerrain_Fields
 */

/**
 * Routes and shell surfaces.
 *
 * @group allterrain-fields
 */
class ATCF_Test_Rest extends WP_UnitTestCase {

	/**
	 * The REST server.
	 *
	 * @var WP_REST_Server
	 */
	private $server;

	/**
	 * An administrator id.
	 *
	 * @var int
	 */
	private $admin;

	/**
	 * Boots a REST server.
	 */
	public function set_up() {
		parent::set_up();

		global $wp_rest_server;

		$wp_rest_server = new WP_REST_Server();
		$this->server   = $wp_rest_server;

		do_action( 'rest_api_init' );

		$this->admin = self::factory()->user->create( array( 'role' => 'administrator' ) );

		wp_set_current_user( $this->admin );
	}

	/**
	 * Makes a request.
	 *
	 * @param string $method HTTP method.
	 * @param string $route  Route under this plugin's namespace.
	 * @param array  $body   JSON body or query args.
	 * @return WP_REST_Response The response.
	 */
	private function request( $method, $route, $body = array() ) {
		$request = new WP_REST_Request( $method, '/' . ATCF_REST_NAMESPACE . $route );

		if ( 'GET' === $method ) {
			$request->set_query_params( $body );
		} else {
			$request->set_header( 'content-type', 'application/json' );
			$request->set_body( (string) wp_json_encode( $body ) );
		}

		return $this->server->dispatch( $request );
	}

	/**
	 * The config route describes everything the builder draws itself from.
	 *
	 * @covers ::atcf_rest_config
	 */
	public function test_config_route() {
		$data = $this->request( 'GET', '/config' )->get_data();

		foreach ( array( 'fieldTypes', 'settingControls', 'operators', 'locationParams', 'locationChoices', 'postTypes', 'calcFunctions' ) as $key ) {
			$this->assertArrayHasKey( $key, $data, "The config is missing `{$key}`." );
		}

		$this->assertNotEmpty( $data['fieldTypes'] );
	}

	/**
	 * A group can be created, read, listed and trashed.
	 *
	 * @covers ::atcf_rest_save_group
	 * @covers ::atcf_rest_get_group
	 * @covers ::atcf_rest_delete_group
	 */
	public function test_group_lifecycle() {
		$created = $this->request(
			'POST',
			'/groups',
			array(
				'title'  => 'From REST',
				'fields' => array(
					array(
						'label' => 'One',
						'type'  => 'text',
					),
				),
			)
		);

		$this->assertSame( 200, $created->get_status() );

		$id = $created->get_data()['id'];

		$this->assertGreaterThan( 0, $id );

		$read = $this->request( 'GET', "/groups/{$id}" )->get_data();

		$this->assertSame( 'From REST', $read['title'] );

		$list = $this->request( 'GET', '/groups' )->get_data();

		$this->assertContains( 'From REST', wp_list_pluck( $list, 'title' ) );

		$deleted = $this->request( 'DELETE', "/groups/{$id}" );

		$this->assertTrue( $deleted->get_data()['deleted'] );
	}

	/**
	 * A user who may not manage the content model is refused every schema route.
	 *
	 * @covers ::atcf_rest_can_manage
	 */
	public function test_schema_routes_are_gated() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		foreach ( array( '/config', '/groups', '/model', '/export' ) as $route ) {
			$this->assertSame( 403, $this->request( 'GET', $route )->get_status(), "{$route} was not gated." );
		}
	}

	/**
	 * A bulk write checks the capability per post, not once for the request.
	 *
	 * A user who may edit thirty-nine of forty posts must not get the fortieth
	 * for free — and refusing all forty over one is how people stop using it.
	 *
	 * @covers ::atcf_rest_write_values
	 */
	public function test_bulk_writes_are_checked_per_post() {
		$author = self::factory()->user->create( array( 'role' => 'author' ) );
		$mine   = self::factory()->post->create( array( 'post_author' => $author ) );
		$theirs = self::factory()->post->create( array( 'post_author' => $this->admin ) );

		$saved = atcf_save_group(
			array(
				'title'    => 'Bulk',
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
						'key'   => 'field_note',
						'label' => 'Note',
						'type'  => 'text',
					),
				),
			)
		);

		$this->assertNotWPError( $saved );

		wp_set_current_user( $author );

		$response = $this->request(
			'POST',
			'/values',
			array(
				'writes' => array(
					array(
						'id'    => $mine,
						'field' => 'field_note',
						'value' => 'ok',
					),
					array(
						'id'    => $theirs,
						'field' => 'field_note',
						'value' => 'not ok',
					),
				),
			)
		);

		$data = $response->get_data();

		$this->assertSame( 1, $data['written'] );
		$this->assertSame( array( $theirs ), $data['refused'] );
		$this->assertSame( 'ok', get_post_meta( $mine, 'note', true ) );
		$this->assertSame( '', get_post_meta( $theirs, 'note', true ) );
	}

	/**
	 * An export carries no post ids.
	 *
	 * A post id is meaningless on the site importing the file, and leaving it in
	 * makes an import silently overwrite whatever post holds that id there —
	 * which on a fresh site is routinely somebody's About page.
	 *
	 * @covers ::atcf_rest_export
	 */
	public function test_export_strips_ids() {
		atcf_save_group(
			array(
				'title'  => 'Exportable',
				'fields' => array(
					array(
						'label' => 'A',
						'type'  => 'text',
					),
				),
			)
		);

		foreach ( $this->request( 'GET', '/export' )->get_data() as $group ) {
			$this->assertArrayNotHasKey( 'id', $group );
			$this->assertArrayNotHasKey( 'status', $group );
		}
	}

	/**
	 * Importing the same file twice updates rather than duplicating.
	 *
	 * Which is what makes a file usable as a deployment mechanism rather than as
	 * a one-way door.
	 *
	 * @covers ::atcf_rest_import
	 */
	public function test_import_is_idempotent() {
		$file = array(
			array(
				'key'    => 'group_imported',
				'title'  => 'Imported',
				'fields' => array(
					array(
						'key'   => 'field_i',
						'label' => 'I',
						'type'  => 'text',
					),
				),
			),
		);

		$first = $this->request( 'POST', '/import', array( 'groups' => $file ) )->get_data();

		$this->assertFalse( $first['imported'][0]['updated'] );

		$second = $this->request( 'POST', '/import', array( 'groups' => $file ) )->get_data();

		$this->assertTrue( $second['imported'][0]['updated'] );
		$this->assertSame( $first['imported'][0]['id'], $second['imported'][0]['id'] );

		$matching = array_filter( atcf_get_groups( true ), static fn( $group ) => 'group_imported' === $group['key'] );

		$this->assertCount( 1, $matching );
	}

	/**
	 * The preview route renders through the real renderer.
	 *
	 * A preview built from a second, simplified renderer is a preview that is
	 * wrong exactly where it matters.
	 *
	 * @covers ::atcf_rest_preview
	 */
	public function test_preview_renders_real_markup() {
		$saved = atcf_save_group(
			array(
				'title'  => 'Previewable',
				'fields' => array(
					array(
						'key'   => 'field_p',
						'label' => 'Headline',
						'type'  => 'text',
					),
				),
			)
		);

		$this->assertNotWPError( $saved );

		$data = $this->request( 'GET', "/preview/{$saved['id']}" )->get_data();

		$this->assertSame( 'Previewable', $data['title'] );
		$this->assertStringContainsString( 'data-atcf-field="field_p"', $data['markup'] );
		$this->assertStringContainsString( 'Headline', $data['markup'] );
	}

	/**
	 * The object route refuses somebody who cannot edit the object.
	 *
	 * @covers ::atcf_rest_read_object
	 */
	public function test_object_route_is_gated() {
		$post = self::factory()->post->create();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );

		$this->assertSame(
			403,
			$this->request(
				'GET',
				'/object',
				array(
					'type' => 'post',
					'id'   => $post,
				)
			)->get_status()
		);
	}

	/**
	 * Relationship values reach the shell's content identity as reference links.
	 *
	 * This is what turns a relationship field into a line drawn between two
	 * windows on the desktop, and it is twenty lines of filter.
	 *
	 * @covers ::atcf_extend_content_identity
	 */
	public function test_identity_gains_relationship_links() {
		$saved = atcf_save_group(
			array(
				'title'    => 'Linked',
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
						'key'      => 'field_rel',
						'label'    => 'Related',
						'type'     => 'relationship',
						'settings' => array( 'post_types' => array( 'post' ) ),
					),
				),
			)
		);

		$this->assertNotWPError( $saved );

		$a = self::factory()->post->create();
		$b = self::factory()->post->create();

		atcf_update_field( 'field_rel', array( $b ), $a );

		$identity = atcf_extend_content_identity(
			array(
				'type' => 'post',
				'id'   => $a,
			),
			null
		);

		$this->assertArrayHasKey( 'links', $identity );

		$targets = wp_list_pluck( $identity['links'], 'id' );

		$this->assertContains( $b, $targets );

		foreach ( $identity['links'] as $link ) {
			$this->assertSame( 'references', $link['rel'] );
		}
	}

	/**
	 * The identity is extended, never replaced.
	 *
	 * The shell's own detection has already filled in the post's links, media
	 * and terms; returning a fresh array would throw all of that away to add
	 * three ids, which is how an integration makes the feature it hooked worse.
	 *
	 * @covers ::atcf_extend_content_identity
	 */
	public function test_identity_keeps_what_the_shell_found() {
		$post = self::factory()->post->create();

		$identity = atcf_extend_content_identity(
			array(
				'type'  => 'post',
				'id'    => $post,
				'label' => 'Existing',
				'links' => array(
					array(
						'type' => 'media',
						'id'   => 99,
						'rel'  => 'child',
					),
				),
			),
			null
		);

		$this->assertSame( 'Existing', $identity['label'] );
		$this->assertContains( 99, wp_list_pluck( $identity['links'], 'id' ) );
	}

	/**
	 * A screen showing no single object is left alone.
	 *
	 * @covers ::atcf_extend_content_identity
	 */
	public function test_identity_ignores_identityless_screens() {
		$this->assertNull( atcf_extend_content_identity( null, null ) );
	}

	/**
	 * The same object appearing in two fields is drawn once.
	 *
	 * Two lines between the same pair of windows looks like a rendering bug
	 * rather than like two relationships.
	 *
	 * @covers ::atcf_dedupe_links
	 */
	public function test_links_are_deduplicated() {
		$links = atcf_dedupe_links(
			array(
				array(
					'type' => 'post',
					'id'   => 5,
				),
				array(
					'type' => 'post',
					'id'   => 5,
				),
				array(
					'type' => 'media',
					'id'   => 5,
				),
			)
		);

		$this->assertCount( 2, $links );
	}

	/**
	 * The link list is capped, because the shell caps it too.
	 *
	 * @covers ::atcf_dedupe_links
	 */
	public function test_links_are_capped() {
		$many = array();

		for ( $i = 1; $i <= 60; $i++ ) {
			$many[] = array(
				'type' => 'post',
				'id'   => $i,
			);
		}

		$this->assertCount( 32, atcf_dedupe_links( $many ) );
	}

	/**
	 * Every class the window templates print is one the stylesheet styles.
	 *
	 * A CSS selector that matches nothing is not an error — not in the browser,
	 * not in a build, not in any test that only looks at markup. So a template
	 * that prints `atcflw__work` while the stylesheet says `atcfl__work` renders
	 * with no padding, no scrolling and no dividers, and the only report is
	 * somebody looking at it.
	 *
	 * That has now happened twice — once in the field preview against
	 * `fields.css`, once here — so it is asserted rather than reviewed.
	 *
	 * @covers ::atcf_formula_template
	 */
	public function test_window_templates_only_use_classes_the_stylesheet_styles() {
		$css = (string) file_get_contents( ATCF_PATH . 'assets/css/builder.css' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Reading the plugin's own stylesheet.

		// Every window this plugin registers, so a new one cannot be added
		// without its markup and its stylesheet agreeing.
		$templates = array(
			'atcf_formula_template' => 'atcflw',
			'atcf_builder_template' => 'atcfb',
			'atcf_bulk_template'    => 'atcfk',
			'atcf_tools_template'   => 'atcft',
		);

		foreach ( $templates as $callback => $prefix ) {
			if ( ! function_exists( $callback ) ) {
				continue;
			}

			ob_start();
			$callback();
			$markup = (string) ob_get_clean();

			preg_match_all( '/class="([^"]+)"/', $markup, $matches );

			$classes = array();

			foreach ( $matches[1] as $attribute ) {
				foreach ( preg_split( '/\s+/', $attribute ) as $class ) {
					if ( 0 === strpos( (string) $class, $prefix ) ) {
						$classes[] = (string) $class;
					}
				}
			}

			$this->assertNotEmpty( $classes, "{$callback} printed no {$prefix} classes at all." );

			foreach ( array_unique( $classes ) as $class ) {
				$this->assertStringContainsString(
					'.' . $class,
					$css,
					"{$callback} prints “{$class}”, which builder.css never styles. Check for a typo in one of the two."
				);
			}
		}
	}

	/**
	 * The dock carries one Fields tile, not two.
	 *
	 * OpenStation builds its dock from the admin menu, and this plugin also
	 * registers a system tile of its own — so without this filter the dock showed
	 * two tiles with the same icon and the same name, one of which could not do
	 * half of what the other could.
	 *
	 * The items here carry the **real** shapes: a hook-suffix id like
	 * `toplevel_page_allterrain-fields` and a URL with the slug in its query. The
	 * first version of this test invented `id => 'allterrain-fields'`, which no
	 * dock item has ever had — so it passed while the filter matched nothing and
	 * both tiles stayed in the dock.
	 *
	 * @covers ::atcf_hide_menu_dock_item
	 */
	public function test_the_admin_menu_does_not_become_a_second_dock_tile() {
		$items = atcf_hide_menu_dock_item(
			array(
				array(
					'id'  => 'menu-posts',
					'url' => admin_url( 'edit.php' ),
				),
				array(
					'id'  => 'toplevel_page_allterrain-fields',
					'url' => admin_url( 'admin.php?page=allterrain-fields' ),
				),
				array(
					'id'  => 'fields_page_allterrain-fields-model',
					'url' => admin_url( 'admin.php?page=allterrain-fields-model' ),
				),
				array(
					'id'  => 'menu-media',
					'url' => admin_url( 'upload.php' ),
				),
			)
		);

		$this->assertSame( array( 'menu-posts', 'menu-media' ), wp_list_pluck( $items, 'id' ) );
	}

	/**
	 * The id is a fallback for a shell that gives an item no URL.
	 *
	 * @covers ::atcf_is_our_dock_item
	 */
	public function test_the_slug_is_found_in_the_id_when_there_is_no_url() {
		$this->assertTrue( atcf_is_our_dock_item( array( 'id' => 'toplevel_page_allterrain-fields' ) ) );
		$this->assertTrue( atcf_is_our_dock_item( array( 'id' => 'fields_page_allterrain-fields-tools' ) ) );
		$this->assertFalse( atcf_is_our_dock_item( array( 'id' => 'toplevel_page_allterrain-forms' ) ) );
	}

	/**
	 * A URL wins over an id, because the id is built from a translated title.
	 *
	 * @covers ::atcf_is_our_dock_item
	 */
	public function test_a_translated_hook_suffix_is_still_matched() {
		// What the id looks like when the parent menu title is not in English.
		// Matching the id alone would miss it; the URL is the same everywhere.
		$this->assertTrue(
			atcf_is_our_dock_item(
				array(
					'id'  => 'champs_page_allterrain-fields-bulk',
					'url' => admin_url( 'admin.php?page=allterrain-fields-bulk' ),
				)
			)
		);
	}

	/**
	 * Every page this plugin registers is one the filter knows about.
	 *
	 * Asserted against the **registered menu** rather than against a second copy
	 * of the list, so a page added to `atcf_register_admin_pages()` without an
	 * entry in `atcf_admin_page_slugs()` fails here rather than putting a spare
	 * tile in somebody's dock.
	 *
	 * @covers ::atcf_admin_page_slugs
	 */
	public function test_every_admin_page_is_covered_by_the_dock_filter() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		require_once ABSPATH . 'wp-admin/includes/admin.php';

		global $submenu;

		atcf_register_admin_pages();

		$registered = array( 'allterrain-fields' );

		foreach ( (array) atcf_arr( (array) $submenu, 'allterrain-fields', array() ) as $entry ) {
			$registered[] = (string) $entry[2];
		}

		$known = atcf_admin_page_slugs();

		foreach ( array_unique( $registered ) as $slug ) {
			$this->assertContains(
				$slug,
				$known,
				"{$slug} is registered as an admin page but is not in atcf_admin_page_slugs(), so it will appear twice in the dock."
			);
		}
	}

	/**
	 * Somebody else's menu is left alone.
	 *
	 * @covers ::atcf_hide_menu_dock_item
	 */
	public function test_other_plugins_keep_their_tiles() {
		$items = atcf_hide_menu_dock_item(
			array(
				array(
					'id'  => 'toplevel_page_allterrain-forms',
					'url' => admin_url( 'admin.php?page=allterrain-forms' ),
				),
			)
		);

		$this->assertCount( 1, $items );
	}

	/**
	 * Email addresses are only shown to somebody who could see the Users screen.
	 *
	 * Core's own users endpoint withholds emails from non-admins; a search box
	 * for a user field must not re-expose them to every Contributor.
	 *
	 * @covers ::atcf_rest_search
	 */
	public function test_user_search_hides_emails_from_lower_roles() {
		self::factory()->user->create(
			array(
				'role'       => 'author',
				'user_email' => 'secret@example.com',
			)
		);

		$contributor = self::factory()->user->create( array( 'role' => 'contributor' ) );

		wp_set_current_user( $contributor );

		$results = $this->request( 'GET', '/search', array( 'kind' => 'user' ) )->get_data()['results'];

		$this->assertNotEmpty( $results );
		$this->assertNotContains( 'secret@example.com', wp_list_pluck( $results, 'sub' ) );

		wp_set_current_user( $this->admin );

		$results = $this->request( 'GET', '/search', array( 'kind' => 'user' ) )->get_data()['results'];

		$this->assertContains( 'secret@example.com', wp_list_pluck( $results, 'sub' ) );
	}

	/**
	 * Unpublished work only shows up for somebody who may edit it.
	 *
	 * @covers ::atcf_rest_search
	 */
	public function test_post_search_hides_other_authors_unpublished_work() {
		$contributor = self::factory()->user->create( array( 'role' => 'contributor' ) );

		$their_draft = self::factory()->post->create(
			array(
				'post_status' => 'draft',
				'post_title'  => 'Their secret draft',
				'post_author' => $this->admin,
			)
		);
		$my_draft    = self::factory()->post->create(
			array(
				'post_status' => 'draft',
				'post_title'  => 'My own draft',
				'post_author' => $contributor,
			)
		);
		$published   = self::factory()->post->create(
			array(
				'post_status' => 'publish',
				'post_title'  => 'Public post',
				'post_author' => $this->admin,
			)
		);

		wp_set_current_user( $contributor );

		$ids = wp_list_pluck( $this->request( 'GET', '/search', array( 'kind' => 'post' ) )->get_data()['results'], 'id' );

		$this->assertNotContains( $their_draft, $ids );
		$this->assertContains( $my_draft, $ids );
		$this->assertContains( $published, $ids );
	}

	/**
	 * The bulk read draws the same line: published rows for everyone with the
	 * route, everything else only for somebody who may edit it.
	 *
	 * @covers ::atcf_rest_read_values
	 */
	public function test_bulk_read_skips_other_authors_unpublished_rows() {
		$saved = atcf_save_group(
			array(
				'title'    => 'Bulk read',
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
						'key'   => 'field_bulkread',
						'label' => 'Note',
						'type'  => 'text',
					),
				),
			)
		);

		$this->assertNotWPError( $saved );

		$their_private = self::factory()->post->create(
			array(
				'post_status' => 'private',
				'post_author' => $this->admin,
			)
		);

		update_post_meta( $their_private, 'note', 'internal pricing' );

		$contributor = self::factory()->user->create( array( 'role' => 'contributor' ) );

		wp_set_current_user( $contributor );

		$rows = $this->request(
			'GET',
			'/values',
			array(
				'group'     => (string) $saved['id'],
				'post_type' => 'post',
			)
		)->get_data()['rows'];

		$this->assertNotContains( $their_private, wp_list_pluck( $rows, 'id' ) );

		wp_set_current_user( $this->admin );

		$rows = $this->request(
			'GET',
			'/values',
			array(
				'group'     => (string) $saved['id'],
				'post_type' => 'post',
			)
		)->get_data()['rows'];

		$this->assertContains( $their_private, wp_list_pluck( $rows, 'id' ) );
	}
}
