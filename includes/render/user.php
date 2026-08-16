<?php
/**
 * Fields on users.
 *
 * Three screens, one renderer. `user_new_form` is Add User, `show_user_profile`
 * is your own profile, and `edit_user_profile` is somebody else's — and location
 * rules can tell them apart, because "a field only on your own profile" and "a
 * field only an administrator fills in about somebody" are both real.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'show_user_profile', 'atcf_render_own_profile_fields' );
add_action( 'edit_user_profile', 'atcf_render_other_profile_fields' );
add_action( 'user_new_form', 'atcf_render_new_user_fields' );

/**
 * Renders the fields on your own profile.
 *
 * @since 0.1.0
 *
 * @param WP_User $user The user.
 * @return void
 */
function atcf_render_own_profile_fields( $user ) {
	atcf_render_user_fields( $user, 'profile' );
}

/**
 * Renders the fields when editing somebody else.
 *
 * @since 0.1.0
 *
 * @param WP_User $user The user.
 * @return void
 */
function atcf_render_other_profile_fields( $user ) {
	atcf_render_user_fields( $user, 'edit' );
}

/**
 * Renders the fields on the Add User form.
 *
 * @since 0.1.0
 *
 * @param string $type Which form; `add-existing-user` on multisite.
 * @return void
 */
function atcf_render_new_user_fields( $type ) {
	// The multisite "add an existing user" form creates no user object and
	// submits to a different handler entirely, so fields on it would render and
	// then be thrown away.
	if ( 'add-new-user' !== $type ) {
		return;
	}

	atcf_render_user_fields( null, 'add' );
}

/**
 * Renders the field groups for one user screen.
 *
 * @since 0.1.0
 *
 * @param WP_User|null $user The user, or null on the Add form.
 * @param string       $form Which form: `add`, `edit` or `profile`.
 * @return void
 */
function atcf_render_user_fields( $user, $form ) {
	$user_id = $user instanceof WP_User ? (int) $user->ID : 0;
	$groups  = atcf_groups_for( atcf_user_context( $user_id, $form ) );

	if ( ! $groups ) {
		return;
	}

	atcf_render_form_marker();

	foreach ( $groups as $group ) {
		printf( '<h2 class="atcf-user-group__title">%s</h2>', esc_html( $group['title'] ) );

		// The profile screen is a sequence of `<table class="form-table">`
		// blocks, and a group renders as one of them so its fields line up with
		// core's own rows rather than sitting in a column of their own.
		echo '<table class="form-table atcf-user-group" role="presentation"><tbody><tr><td>';

		atcf_render_group_fields(
			$group,
			array(
				'type' => 'user',
				'id'   => $user_id,
			)
		);

		echo '</td></tr></tbody></table>';
	}
}

add_action( 'personal_options_update', 'atcf_save_user_fields' );
add_action( 'edit_user_profile_update', 'atcf_save_user_fields' );
add_action( 'user_register', 'atcf_save_user_fields' );

/**
 * Writes the fields when a user is saved.
 *
 * @since 0.1.0
 *
 * @param int $user_id The user.
 * @return void
 */
function atcf_save_user_fields( $user_id ) {
	if ( ! atcf_has_submission() ) {
		return;
	}

	if ( ! current_user_can( 'edit_user', (int) $user_id ) ) {
		return;
	}

	atcf_save_submission(
		array(
			'type' => 'user',
			'id'   => (int) $user_id,
		),
		atcf_submitted_payload(),
		atcf_user_context( (int) $user_id, get_current_user_id() === (int) $user_id ? 'profile' : 'edit' )
	);
}
