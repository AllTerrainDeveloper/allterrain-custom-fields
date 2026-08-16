<?php
/**
 * Fields on taxonomy terms.
 *
 * Terms are the place custom fields are most obviously missing from core and
 * most awkward to add: the taxonomy screens are two different forms with two
 * different markup conventions — the Add form is a stack of `<div class="form-field">`
 * and the Edit form is a `<table class="form-table">` — and a plugin that
 * renders the same markup into both looks broken in one of them.
 *
 * So both are rendered, each in its own idiom, from the same field renderer. The
 * wrapper differs; nothing else does.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'registered_taxonomy', 'atcf_hook_taxonomy_forms' );
add_action( 'init', 'atcf_hook_existing_taxonomy_forms', 20 );

/**
 * Hooks the two term forms for a taxonomy as it is registered.
 *
 * @since 0.1.0
 *
 * @param string $taxonomy Taxonomy slug.
 * @return void
 */
function atcf_hook_taxonomy_forms( $taxonomy ) {
	add_action( $taxonomy . '_add_form_fields', 'atcf_render_term_add_form' );
	add_action( $taxonomy . '_edit_form_fields', 'atcf_render_term_edit_form' );
}

/**
 * Hooks the taxonomies that were registered before this file loaded.
 *
 * Core's own taxonomies are registered on `init` at priority 0, long before a
 * plugin's `registered_taxonomy` listener exists — so without this pass,
 * categories and tags are exactly the two taxonomies that never get fields.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_hook_existing_taxonomy_forms() {
	foreach ( get_taxonomies( array(), 'names' ) as $taxonomy ) {
		atcf_hook_taxonomy_forms( $taxonomy );
	}
}

/**
 * Renders the fields on the Add Term form.
 *
 * @since 0.1.0
 *
 * @param string $taxonomy Taxonomy slug.
 * @return void
 */
function atcf_render_term_add_form( $taxonomy ) {
	$groups = atcf_groups_for(
		array(
			'screen'   => 'term',
			'taxonomy' => $taxonomy,
			'term_id'  => 0,
		)
	);

	if ( ! $groups ) {
		return;
	}

	atcf_render_form_marker();

	foreach ( $groups as $group ) {
		echo '<div class="atcf-term-group form-field">';
		atcf_render_group_fields(
			$group,
			array(
				'type' => 'term',
				'id'   => 0,
			)
		);
		echo '</div>';
	}
}

/**
 * Renders the fields on the Edit Term form.
 *
 * @since 0.1.0
 *
 * @param WP_Term $term The term.
 * @return void
 */
function atcf_render_term_edit_form( $term ) {
	if ( ! $term instanceof WP_Term ) {
		return;
	}

	$groups = atcf_groups_for( atcf_term_context( $term ) );

	if ( ! $groups ) {
		return;
	}

	atcf_render_form_marker();

	foreach ( $groups as $group ) {
		// The Edit form is a table, so the group has to be a row. A `<div>` here
		// is silently reparented out of the `<tbody>` by the HTML parser and the
		// fields end up above the form entirely.
		printf(
			'<tr class="form-field atcf-term-group"><th scope="row">%s</th><td>',
			esc_html( $group['title'] )
		);

		atcf_render_group_fields(
			$group,
			array(
				'type' => 'term',
				'id'   => (int) $term->term_id,
			)
		);

		echo '</td></tr>';
	}
}

add_action( 'created_term', 'atcf_save_term_fields', 10, 3 );
add_action( 'edited_term', 'atcf_save_term_fields', 10, 3 );

/**
 * Writes the fields when a term is saved.
 *
 * @since 0.1.0
 *
 * @param int    $term_id  The term.
 * @param int    $tt_id    Term taxonomy id, unused.
 * @param string $taxonomy Taxonomy slug.
 * @return void
 */
function atcf_save_term_fields( $term_id, $tt_id, $taxonomy ) {
	unset( $tt_id );

	if ( ! atcf_has_submission() ) {
		return;
	}

	if ( ! current_user_can( 'edit_term', (int) $term_id ) ) {
		return;
	}

	atcf_save_submission(
		array(
			'type' => 'term',
			'id'   => (int) $term_id,
		),
		atcf_submitted_payload(),
		array(
			'screen'   => 'term',
			'taxonomy' => $taxonomy,
			'term_id'  => (int) $term_id,
		)
	);
}

add_action( 'delete_term', 'atcf_delete_term_fields', 10, 3 );

/**
 * Removes a deleted term's field values.
 *
 * Term meta is not cleaned up by core when the term goes — `wp_termmeta` rows
 * outlive their term — so a site that adds and deletes terms regularly
 * accumulates rows nothing can ever read or find.
 *
 * @since 0.1.0
 *
 * @param int    $term_id  The term.
 * @param int    $tt_id    Term taxonomy id, unused.
 * @param string $taxonomy Taxonomy slug.
 * @return void
 */
function atcf_delete_term_fields( $term_id, $tt_id, $taxonomy ) {
	unset( $tt_id );

	$ref = array(
		'type' => 'term',
		'id'   => (int) $term_id,
	);

	foreach ( atcf_groups_for(
		array(
			'screen'   => 'term',
			'taxonomy' => $taxonomy,
			'term_id'  => (int) $term_id,
		)
	) as $group ) {
		atcf_delete_row( $group['fields'], $ref, '' );
	}
}
