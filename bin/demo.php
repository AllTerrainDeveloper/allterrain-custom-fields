<?php
/**
 * A demo content model, for looking at.
 *
 * Run through WP-CLI against a development site:
 *
 *     wp eval-file wp-content/plugins/allterrain-fields/bin/demo.php
 *
 * It registers two post types, three field groups and a bidirectional
 * relationship between them, then fills in a few posts — enough that the Content
 * Model window has a graph to draw and the builder has something in it.
 *
 * Deliberately not a plugin feature. Demo data is a *development* convenience,
 * and a plugin that can write several hundred posts into a site is a plugin one
 * mis-click away from doing it to a live one. A file you have to run from a
 * shell is the right amount of friction.
 *
 * @package AllTerrain_Fields
 */

if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	echo "Run this through WP-CLI.\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

	return;
}

/**
 * Builds the demo content model.
 *
 * Wrapped in a function so that nothing in it is a global variable — a seed
 * script that leaks two dozen names into the global scope is a seed script that
 * will one day collide with something WordPress itself defines.
 *
 * @return void
 */
function atcf_demo_seed() {
	wp_set_current_user( 1 );

	// The demo post types are registered here rather than persisted, so the site is
	// left exactly as it was found once the mu-plugin below is removed.
	$mu = WPMU_PLUGIN_DIR . '/atcf-demo-types.php';

	if ( ! is_dir( WPMU_PLUGIN_DIR ) ) {
		wp_mkdir_p( WPMU_PLUGIN_DIR );
	}

	file_put_contents( // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		$mu,
		'<?php
	add_action( "init", function () {
		register_post_type( "product", array(
			"label"        => "Products",
			"public"       => true,
			"show_in_rest" => true,
			"menu_icon"    => "dashicons-cart",
			"supports"     => array( "title", "editor", "thumbnail", "excerpt" ),
		) );

		register_post_type( "case_study", array(
			"label"        => "Case Studies",
			"public"       => true,
			"show_in_rest" => true,
			"menu_icon"    => "dashicons-awards",
			"supports"     => array( "title", "editor", "thumbnail" ),
		) );

		register_taxonomy( "industry", array( "case_study" ), array(
			"label"        => "Industries",
			"public"       => true,
			"show_in_rest" => true,
			"hierarchical" => true,
		) );
	}, 1 );
	'
	);

	WP_CLI::log( 'Registered the demo post types as a mu-plugin.' );

	// The types have to exist in *this* request as well, because the location rules
	// below name them. Registered directly rather than by re-firing `init`: that
	// hook has already run, and running it twice re-registers every core block and
	// fills the output with "already registered" notices.
	register_post_type(
		'product',
		array(
			'label'        => 'Products',
			'public'       => true,
			'show_in_rest' => true,
			'menu_icon'    => 'dashicons-cart',
			'supports'     => array( 'title', 'editor', 'thumbnail', 'excerpt' ),
		)
	);

	register_post_type(
		'case_study',
		array(
			'label'        => 'Case Studies',
			'public'       => true,
			'show_in_rest' => true,
			'menu_icon'    => 'dashicons-awards',
			'supports'     => array( 'title', 'editor', 'thumbnail' ),
		)
	);

	register_taxonomy(
		'industry',
		array( 'case_study' ),
		array(
			'label'        => 'Industries',
			'public'       => true,
			'show_in_rest' => true,
			'hierarchical' => true,
		)
	);

	$product_group = atcf_save_group(
		array(
			'key'      => 'group_atcf_demo_product',
			'title'    => 'Product details',
			'location' => array(
				array(
					array(
						'param'    => 'post_type',
						'operator' => '==',
						'value'    => 'product',
					),
				),
			),
			'settings' => array( 'description' => 'Everything a product page needs beyond its copy.' ),
			'fields'   => array(
				array(
					'key'      => 'field_atcf_sku',
					'label'    => 'SKU',
					'name'     => 'sku',
					'type'     => 'text',
					'required' => true,
					'settings' => array( 'unique' => true ),
				),
				array(
					'key'      => 'field_atcf_price',
					'label'    => 'Price',
					'name'     => 'price',
					'type'     => 'number',
					'wrapper'  => array( 'width' => 50 ),
					'settings' => array(
						'prepend' => '£',
						'min'     => 0,
						'step'    => '0.01',
					),
				),
				array(
					'key'      => 'field_atcf_vat',
					'label'    => 'VAT rate',
					'name'     => 'vat',
					'type'     => 'number',
					'wrapper'  => array( 'width' => 50 ),
					'settings' => array(
						'append' => '%',
						'min'    => 0,
						'max'    => 100,
					),
				),
				array(
					'key'      => 'field_atcf_total',
					'label'    => 'Price with VAT',
					'name'     => 'price_with_vat',
					'type'     => 'computed',
					'settings' => array(
						'formula'  => 'round({price} * (1 + {vat} / 100), 2)',
						'decimals' => 2,
						'prepend'  => '£',
					),
				),
				array(
					'key'      => 'field_atcf_stocked',
					'label'    => 'In stock',
					'name'     => 'in_stock',
					'type'     => 'true_false',
					'settings' => array( 'default_value' => true ),
				),
				array(
					'key'         => 'field_atcf_lead',
					'label'       => 'Lead time',
					'name'        => 'lead_time',
					'type'        => 'text',
					'conditional' => array(
						'enabled' => true,
						'action'  => 'show',
						'match'   => 'all',
						'rules'   => array(
							array(
								'field'    => 'field_atcf_stocked',
								'operator' => 'is',
								'value'    => '0',
							),
						),
					),
				),
				array(
					'key'   => 'field_atcf_shots',
					'label' => 'Photography',
					'name'  => 'photography',
					'type'  => 'gallery',
				),
				array(
					'key'      => 'field_atcf_cases',
					'label'    => 'Case studies',
					'name'     => 'case_studies',
					'type'     => 'relationship',
					'settings' => array(
						'post_types'    => array( 'case_study' ),
						'bidirectional' => true,
						'mirror'        => 'field_atcf_product',
					),
				),
				array(
					'key'      => 'field_atcf_specs',
					'label'    => 'Specifications',
					'name'     => 'specifications',
					'type'     => 'repeater',
					'settings' => array(
						'button_label' => 'Add a specification',
						'sub_fields'   => array(
							array(
								'key'     => 'field_atcf_spec_name',
								'label'   => 'Name',
								'name'    => 'name',
								'type'    => 'text',
								'wrapper' => array( 'width' => 50 ),
							),
							array(
								'key'     => 'field_atcf_spec_value',
								'label'   => 'Value',
								'name'    => 'value',
								'type'    => 'text',
								'wrapper' => array( 'width' => 50 ),
							),
						),
					),
				),
			),
		)
	);

	$case_group = atcf_save_group(
		array(
			'key'      => 'group_atcf_demo_case',
			'title'    => 'Case study details',
			'location' => array(
				array(
					array(
						'param'    => 'post_type',
						'operator' => '==',
						'value'    => 'case_study',
					),
				),
			),
			'fields'   => array(
				array(
					'key'   => 'field_atcf_client',
					'label' => 'Client',
					'name'  => 'client',
					'type'  => 'text',
				),
				array(
					'key'      => 'field_atcf_industry',
					'label'    => 'Industry',
					'name'     => 'industry',
					'type'     => 'taxonomy',
					'settings' => array( 'taxonomy' => 'industry' ),
				),
				array(
					'key'   => 'field_atcf_owner',
					'label' => 'Written by',
					'name'  => 'written_by',
					'type'  => 'user',
				),
				array(
					'key'      => 'field_atcf_product',
					'label'    => 'Products',
					'name'     => 'products',
					'type'     => 'relationship',
					'settings' => array(
						'post_types'    => array( 'product' ),
						'bidirectional' => true,
						'mirror'        => 'field_atcf_cases',
					),
				),
				array(
					'key'      => 'field_atcf_quote',
					'label'    => 'Pull quote',
					'name'     => 'pull_quote',
					'type'     => 'textarea',
					'settings' => array( 'rows' => 3 ),
				),
				array(
					'key'   => 'field_atcf_published',
					'label' => 'Published on',
					'name'  => 'published_on',
					'type'  => 'date_picker',
				),
			),
		)
	);

	$site_group = atcf_save_group(
		array(
			'key'      => 'group_atcf_demo_site',
			'title'    => 'Site details',
			'location' => array(
				array(
					array(
						'param'    => 'options_page',
						'operator' => '==',
						'value'    => 'site',
					),
				),
			),
			'fields'   => array(
				array(
					'key'   => 'field_atcf_phone',
					'label' => 'Telephone',
					'name'  => 'telephone',
					'type'  => 'text',
				),
				array(
					'key'   => 'field_atcf_where',
					'label' => 'Where we are',
					'name'  => 'where_we_are',
					'type'  => 'location',
				),
				array(
					'key'   => 'field_atcf_brand',
					'label' => 'Brand colour',
					'name'  => 'brand_colour',
					'type'  => 'color_picker',
				),
			),
		)
	);

	foreach ( array( $product_group, $case_group, $site_group ) as $group ) {
		if ( is_wp_error( $group ) ) {
			WP_CLI::error( $group->get_error_message() );
		}

		WP_CLI::log( 'Saved field group: ' . $group['title'] );
	}

	$products = array(
		array( 'Trailhead Pack 40L', 'TH-40', 189.0, 20 ),
		array( 'Ridgeline Jacket', 'RL-JK', 249.5, 20 ),
		array( 'Beacon Head Torch', 'BC-HT', 44.0, 20 ),
	);

	$product_ids = array();

	foreach ( $products as $row ) {
		list( $title, $sku, $price, $vat ) = $row;

		$id = wp_insert_post(
			array(
				'post_type'    => 'product',
				'post_title'   => $title,
				'post_status'  => 'publish',
				'post_content' => 'A short description of the ' . $title . '.',
			)
		);

		atcf_update_field( 'field_atcf_sku', $sku, $id );
		atcf_update_field( 'field_atcf_price', $price, $id );
		atcf_update_field( 'field_atcf_vat', $vat, $id );
		atcf_update_field( 'field_atcf_stocked', 'BC-HT' !== $sku, $id );
		atcf_update_field(
			'field_atcf_specs',
			array(
				array(
					'name'  => 'Weight',
					'value' => '1.2kg',
				),
				array(
					'name'  => 'Warranty',
					'value' => 'Lifetime',
				),
			),
			$id
		);

		$product_ids[] = $id;
	}

	$cases = array(
		array( 'Three seasons on the Cape Wrath Trail', 'Highland Outfitters' ),
		array( 'Kitting out a mountain rescue team', 'Snowdonia MRT' ),
	);

	$case_ids = array();

	foreach ( $cases as $index => $row ) {
		list( $title, $client ) = $row;

		$id = wp_insert_post(
			array(
				'post_type'   => 'case_study',
				'post_title'  => $title,
				'post_status' => 'publish',
			)
		);

		atcf_update_field( 'field_atcf_client', $client, $id );
		atcf_update_field( 'field_atcf_quote', 'It did not let us down once.', $id );
		atcf_update_field( 'field_atcf_published', '2026-0' . ( $index + 3 ) . '-14', $id );
		atcf_update_field( 'field_atcf_owner', 1, $id );

		// Writing one side writes the other, which is the whole demonstration: the
		// products now point back at these case studies without anybody saying so.
		atcf_update_field( 'field_atcf_product', array_slice( $product_ids, $index, 2 ), $id );

		$case_ids[] = $id;
	}

	atcf_add_options_page(
		array(
			'slug'       => 'site',
			'page_title' => 'Site details',
			'menu_title' => 'Site details',
			'icon'       => 'dashicons-info',
		)
	);

	WP_CLI::success(
		sprintf(
			'%d products and %d case studies, joined both ways. Open Fields → Content Model to see the graph.',
			count( $product_ids ),
			count( $case_ids )
		)
	);
}

atcf_demo_seed();
