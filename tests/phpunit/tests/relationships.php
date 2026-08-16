<?php
/**
 * Bidirectional relationships.
 *
 * The feature that stops every site with a relationship field also having a
 * second relationship field on the other type, maintained by hand, drifting
 * apart within a month.
 *
 * The tests that matter here are the ones about *not* recursing and about
 * cleaning up, because both failure modes are silent: an infinite loop takes the
 * request down with a stack overflow nobody can read, and a stale id shows up as
 * "Attempt to read property on null" in a template months later.
 *
 * @package AllTerrain_Fields
 */

/**
 * Relationships in both directions.
 *
 * @group allterrain-fields
 */
class ATCF_Test_Relationships extends WP_UnitTestCase {

	/**
	 * The group holding both sides.
	 *
	 * @var array
	 */
	private $group;

	/**
	 * Two posts to join.
	 *
	 * @var int[]
	 */
	private $posts;

	/**
	 * Builds a group with two mirrored relationship fields.
	 */
	public function set_up() {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$this->posts = array( self::factory()->post->create(), self::factory()->post->create() );

		$saved = atcf_save_group(
			array(
				'title'    => 'Related things',
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
						'key'      => 'field_out',
						'label'    => 'Points at',
						'type'     => 'relationship',
						'settings' => array(
							'post_types'    => array( 'post' ),
							'bidirectional' => true,
							'mirror'        => 'field_back',
						),
					),
					array(
						'key'      => 'field_back',
						'label'    => 'Pointed at by',
						'type'     => 'relationship',
						'settings' => array(
							'post_types'    => array( 'post' ),
							'bidirectional' => true,
							'mirror'        => 'field_out',
						),
					),
				),
			)
		);

		$this->assertNotWPError( $saved );

		$this->group = $saved;
	}

	/**
	 * The field definitions, by key.
	 *
	 * @param string $key Field key.
	 * @return array The field.
	 */
	private function field( $key ) {
		foreach ( $this->group['fields'] as $field ) {
			if ( $field['key'] === $key ) {
				return $field;
			}
		}

		return array();
	}

	/**
	 * Adding A→B adds B→A.
	 *
	 * @covers ::atcf_sync_relationships
	 */
	public function test_the_far_side_is_written() {
		list( $a, $b ) = $this->posts;

		atcf_update_field( 'field_out', array( $b ), $a );

		$this->assertSame( array( $a ), atcf_to_id_list( get_post_meta( $b, 'pointed_at_by', true ) ) );
	}

	/**
	 * Removing A→B removes B→A.
	 *
	 * @covers ::atcf_sync_relationships
	 */
	public function test_the_far_side_is_cleared() {
		list( $a, $b ) = $this->posts;

		atcf_update_field( 'field_out', array( $b ), $a );
		atcf_update_field( 'field_out', array(), $a );

		$this->assertSame( array(), atcf_to_id_list( get_post_meta( $b, 'pointed_at_by', true ) ) );
	}

	/**
	 * Writing the far side does not come back round and write this one again.
	 *
	 * The guard is a set of edges already written this request. A depth counter
	 * would also stop the loop and would stop legitimate second-order updates
	 * with it; keying on the edge stops exactly the repeat and nothing else.
	 *
	 * @covers ::atcf_write_mirror
	 */
	public function test_the_sync_does_not_recurse() {
		list( $a, $b ) = $this->posts;

		// If this recursed it would not return at all, so reaching the assertion
		// is most of the test. The assertion checks it also did not write the
		// same edge twice, which is the subtler half.
		atcf_update_field( 'field_out', array( $b ), $a );

		$this->assertSame( array( $a ), atcf_to_id_list( get_post_meta( $b, 'pointed_at_by', true ) ) );
		$this->assertSame( array( $b ), atcf_to_id_list( get_post_meta( $a, 'points_at', true ) ) );
	}

	/**
	 * A post cannot be related to itself.
	 *
	 * A self-edge renders as a card linking to the page you are already on, and
	 * every "related items" loop then has to remember to exclude the current
	 * post — which half of them do not.
	 *
	 * @covers ::atcf_write_mirror
	 */
	public function test_self_edges_are_dropped() {
		list( $a ) = $this->posts;

		atcf_write_mirror( $this->field( 'field_back' ), $a, $a, true );

		$this->assertSame( array(), atcf_to_id_list( get_post_meta( $a, 'pointed_at_by', true ) ) );
	}

	/**
	 * Deleting a post removes it from everything that pointed at it.
	 *
	 * @covers ::atcf_clean_relationships_on_delete
	 */
	public function test_deleting_a_post_cleans_the_far_side() {
		list( $a, $b ) = $this->posts;

		atcf_update_field( 'field_out', array( $b ), $a );

		wp_delete_post( $a, true );

		$this->assertSame( array(), atcf_to_id_list( get_post_meta( $b, 'pointed_at_by', true ) ) );
	}

	/**
	 * A field with no mirror declared does nothing.
	 *
	 * @covers ::atcf_mirror_key
	 */
	public function test_a_one_way_field_writes_nothing_back() {
		$field = atcf_normalize_field(
			array(
				'key'      => 'field_one',
				'label'    => 'One way',
				'type'     => 'relationship',
				'settings' => array( 'post_types' => array( 'post' ) ),
			)
		);

		$this->assertSame( '', atcf_mirror_key( $field ) );
	}

	/**
	 * A relationship field refuses an id of a type it was not pointed at.
	 *
	 * The `post_types` setting is a promise the builder made and the front end
	 * relies on: a template written against "this is always a Product" should
	 * not have to defend itself against a Page arriving through a REST write.
	 *
	 * @covers ::atcf_sanitize_post_refs
	 */
	public function test_post_types_are_enforced() {
		$page  = self::factory()->post->create( array( 'post_type' => 'page' ) );
		$field = $this->field( 'field_out' );

		$this->assertSame( array(), atcf_sanitize_post_refs( array( $page ), $field ) );
	}

	/**
	 * The graph names both ends of every relational field.
	 *
	 * @covers ::atcf_relationship_graph
	 */
	public function test_the_graph_describes_the_edges() {
		$edges = atcf_relationship_graph();
		$keys  = wp_list_pluck( $edges, 'field' );

		$this->assertContains( 'field_out', $keys );

		foreach ( $edges as $edge ) {
			if ( 'field_out' !== $edge['field'] ) {
				continue;
			}

			$this->assertSame( array( 'post' ), $edge['from'] );
			$this->assertSame( array( 'post' ), $edge['to'] );
			$this->assertTrue( $edge['bidirectional'] );
		}
	}

	/**
	 * The outbound relations a window announces include relationship values.
	 *
	 * This is what `includes/shell/identity.php` turns into the ties OpenStation
	 * draws between windows.
	 *
	 * @covers ::atcf_outbound_relations
	 */
	public function test_outbound_relations_include_relationship_targets() {
		list( $a, $b ) = $this->posts;

		atcf_update_field( 'field_out', array( $b ), $a );

		$relations = atcf_outbound_relations(
			array(
				'type' => 'post',
				'id'   => $a,
			)
		);
		$targets   = wp_list_pluck( $relations, 'id' );

		$this->assertContains( $b, $targets );

		foreach ( $relations as $relation ) {
			$this->assertSame( 'post', $relation['type'] );
		}
	}
}
