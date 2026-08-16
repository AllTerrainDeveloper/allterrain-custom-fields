<?php
/**
 * The server half of the conditional-logic parity suite.
 *
 * Every case in `tests/fixtures/logic-cases.json` runs here and again in
 * `tests/vitest/logic.test.ts`. The point is not that the engine is tested
 * twice; it is that the two engines are tested against **one table**, so they
 * cannot drift apart. A case added in either language is a case both have to
 * pass.
 *
 * @package AllTerrain_Fields
 */

/**
 * Conditional logic.
 *
 * @group allterrain-fields
 */
class ATCF_Test_Logic extends WP_UnitTestCase {

	/**
	 * The shared case table.
	 *
	 * @return array The decoded fixture.
	 */
	private function fixture() {
		static $data = null;

		if ( null === $data ) {
			$path = dirname( __DIR__, 2 ) . '/fixtures/logic-cases.json';
			$data = json_decode( (string) file_get_contents( $path ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- A local fixture read in a test.

			$this->assertIsArray( $data, 'The shared logic fixture did not decode.' );
		}

		return $data;
	}

	/**
	 * Every rule in the shared table evaluates the same way here as in the browser.
	 *
	 * @covers ::atcf_logic_test
	 */
	public function test_shared_rule_table() {
		foreach ( $this->fixture()['rules'] as $case ) {
			$this->assertSame(
				$case['result'],
				atcf_logic_test( $case['value'], $case['operator'], $case['expected'] ),
				$case['name']
			);
		}
	}

	/**
	 * Every visibility case in the shared table resolves the same way.
	 *
	 * @covers ::atcf_logic_visible
	 */
	public function test_shared_visibility_table() {
		foreach ( $this->fixture()['visibility'] as $case ) {
			$this->assertSame(
				$case['visible'],
				atcf_logic_visible( $case['conditional'], $case['values'] ),
				$case['name']
			);
		}
	}

	/**
	 * The string zero is a value, not an absence.
	 *
	 * The single most common bug in a hand-rolled emptiness check, and the one
	 * that silently breaks every "show this when the count is zero" rule.
	 *
	 * @covers ::atcf_logic_is_empty
	 */
	public function test_zero_is_not_empty() {
		$this->assertFalse( atcf_logic_is_empty( '0' ) );
		$this->assertFalse( atcf_logic_is_empty( 0 ) );
		$this->assertTrue( atcf_logic_is_empty( '' ) );
		$this->assertTrue( atcf_logic_is_empty( null ) );
		$this->assertTrue( atcf_logic_is_empty( array() ) );
	}

	/**
	 * An unknown operator falls back to `is` rather than being dropped.
	 *
	 * Dropping the rule turns a condition into "always true", so a field that
	 * was meant to be hidden appears — which is the failure mode that leaks a
	 * field onto a screen it was deliberately kept off.
	 *
	 * @covers ::atcf_normalize_operator
	 */
	public function test_unknown_operator_falls_back() {
		$this->assertSame( 'is', atcf_normalize_operator( 'nonsense' ) );
		$this->assertSame( 'is', atcf_normalize_operator( '==' ) );
		$this->assertSame( 'is_not', atcf_normalize_operator( '!=' ) );
		$this->assertSame( 'greater_equal', atcf_normalize_operator( '>=' ) );
	}

	/**
	 * A hidden container hides everything inside it.
	 *
	 * The reason this matters is validation: a required field inside a hidden
	 * group must not be validated, and `atcf_visible_fields()` is what makes
	 * that impossible to get wrong.
	 *
	 * @covers ::atcf_visible_fields
	 */
	public function test_hidden_group_hides_its_children() {
		$group = atcf_normalize_field(
			array(
				'key'         => 'field_group',
				'name'        => 'address',
				'type'        => 'group',
				'conditional' => array(
					'enabled' => true,
					'action'  => 'show',
					'match'   => 'all',
					'rules'   => array(
						array(
							'field'    => 'field_toggle',
							'operator' => 'is',
							'value'    => 'yes',
						),
					),
				),
				'settings'    => array(
					'sub_fields' => array(
						array(
							'key'  => 'field_city',
							'name' => 'city',
							'type' => 'text',
						),
					),
				),
			)
		);

		$this->assertCount( 0, atcf_visible_fields( array( $group ), array( 'field_toggle' => 'no' ) ) );
		$this->assertCount( 1, atcf_visible_fields( array( $group ), array( 'field_toggle' => 'yes' ) ) );
	}

	/**
	 * The operator list the browser is given is the one the evaluator knows.
	 *
	 * A builder that offers an operator the engine has never heard of produces a
	 * rule that always fails, which reads as the condition being ignored.
	 *
	 * @covers ::atcf_logic_operators
	 */
	public function test_every_offered_operator_is_evaluable() {
		foreach ( array_keys( atcf_logic_operators() ) as $operator ) {
			$this->assertSame(
				$operator,
				atcf_normalize_operator( $operator ),
				"The builder offers `{$operator}` and the evaluator does not know it."
			);
		}
	}
}
