<?php
/**
 * The server half of the formula parity suite.
 *
 * Every case in `tests/fixtures/calc-cases.json` runs here and again in
 * `tests/vitest/calc.test.ts`. The browser shows the total as you type and the
 * server decides what is stored; a disagreement between them is a number that
 * changes when you press Save.
 *
 * @package AllTerrain_Fields
 */

/**
 * The formula evaluator.
 *
 * @group allterrain-fields
 */
class ATCF_Test_Calc extends WP_UnitTestCase {

	/**
	 * Sets an administrator, since the computed-field test saves a group.
	 */
	public function set_up() {
		parent::set_up();

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	/**
	 * The shared case table.
	 *
	 * @return array The decoded fixture.
	 */
	private function fixture() {
		static $data = null;

		if ( null === $data ) {
			$path = dirname( __DIR__, 2 ) . '/fixtures/calc-cases.json';
			$data = json_decode( (string) file_get_contents( $path ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- A local fixture read in a test.

			$this->assertIsArray( $data, 'The shared calc fixture did not decode.' );
		}

		return $data;
	}

	/**
	 * Every formula in the shared table evaluates the same way here as in the browser.
	 *
	 * @covers ::atcf_calc
	 */
	public function test_shared_formula_table() {
		foreach ( $this->fixture()['cases'] as $case ) {
			$result = atcf_calc( $case['formula'], $case['values'] );

			if ( '' === $case['result'] ) {
				$this->assertSame( '', $result, $case['name'] );

				continue;
			}

			$this->assertEqualsWithDelta( (float) $case['result'], (float) $result, 0.000000001, $case['name'] );
		}
	}

	/**
	 * The variables a formula names are the same on both sides.
	 *
	 * @covers ::atcf_calc_variables
	 */
	public function test_shared_variable_table() {
		foreach ( $this->fixture()['variables'] as $case ) {
			$this->assertSame( $case['names'], atcf_calc_variables( $case['formula'] ), $case['formula'] );
		}
	}

	/**
	 * The evaluator cannot reach a PHP function.
	 *
	 * The whole safety argument rests on this. A stored expression is a stored
	 * program, and a stored program that an importer or a compromised admin
	 * session can set is a remote code execution waiting for its moment — which
	 * is what every `eval()`-based implementation of this feature is.
	 *
	 * @covers ::atcf_calc
	 */
	public function test_cannot_call_php() {
		$attempts = array(
			'phpinfo()',
			'system("ls")',
			'exec(1)',
			'file_get_contents("/etc/passwd")',
			'eval("1")',
			'`ls`',
			'$GLOBALS',
			'include("x")',
		);

		foreach ( $attempts as $attempt ) {
			$this->assertSame( '', atcf_calc( $attempt ), "`{$attempt}` was not refused." );
		}
	}

	/**
	 * Nothing it can be handed produces a value that cannot be stored.
	 *
	 * `INF` and `NAN` both serialise into meta as strings, and every read of
	 * that field afterwards is broken.
	 *
	 * @covers ::atcf_calc
	 */
	public function test_never_stores_a_non_number() {
		$this->assertSame( 0.0, atcf_calc( '1 / 0' ) );
		$this->assertSame( 0.0, atcf_calc( 'sqrt(-1)' ) );
		$this->assertSame( '', atcf_calc( '10 ^ 400' ) );
	}

	/**
	 * A computed field recalculates rather than trusting what was submitted.
	 *
	 * The browser shows a live total and that is a *display*. Storing whatever
	 * it submitted would make the total settable by anybody who can open
	 * devtools, which for a field feeding a price is the whole game.
	 *
	 * @covers ::atcf_compute_field
	 */
	public function test_computed_field_ignores_the_submitted_value() {
		$field = atcf_normalize_field(
			array(
				'key'      => 'field_total',
				'name'     => 'total',
				'type'     => 'computed',
				'settings' => array(
					'formula'  => '{price} * {qty}',
					'decimals' => 2,
				),
			)
		);

		$price = atcf_normalize_field(
			array(
				'key'  => 'field_price',
				'name' => 'price',
				'type' => 'number',
			)
		);
		$qty   = atcf_normalize_field(
			array(
				'key'  => 'field_qty',
				'name' => 'qty',
				'type' => 'number',
			)
		);

		// The values arrive keyed by field key; the formula names them by field
		// name. `atcf_compute_field()` is what joins the two.
		$group = atcf_save_group(
			array(
				'title'  => 'Pricing',
				'fields' => array( $price, $qty, $field ),
			)
		);

		$this->assertNotWPError( $group );

		$values = array(
			$group['fields'][0]['key'] => 5,
			$group['fields'][1]['key'] => 3,
			$group['fields'][2]['key'] => 9999,
		);

		$this->assertSame( 15.0, atcf_compute_field( $group['fields'][2], $values ) );
	}
}
