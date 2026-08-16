<?php
/**
 * The formula window.
 *
 * A computed field holds an expression over its siblings, and getting one right
 * is the only piece of the builder that is genuinely *work* — you write
 * something, you want to see what it comes to, you change it. That is a task
 * with its own shape, and it does not fit in a 220px settings column.
 *
 * It was a dialog first, and a dialog was the wrong instrument for a reason that
 * only shows up in use: a modal takes the builder away. You cannot see the field
 * you are writing the formula for, you cannot glance at the names of its
 * siblings, and every time you want to check one you close, look, and reopen.
 *
 * A window pairs instead. The builder stays open and usable beside it, the two
 * can be tiled, the formula window can be left open across several fields, and
 * the shell's own chrome — the title bar, the traffic lights, the taskbar entry —
 * does all the work a hand-rolled overlay was doing badly.
 *
 * ### How it talks to the builder
 *
 * Not through a shared global, and not by the builder reaching into the window's
 * DOM. Both are the same mistake in different clothes: they assume one builder
 * and one formula window, and OpenStation cheerfully gives you two of each.
 *
 * Instead there is a **session** — a token minted by whichever builder pressed
 * the button, carried in the window's parameters, and quoted in every message.
 * The window announces itself when it boots, the builder that recognises the
 * token replies with the field list, and the formula comes back the same way.
 * Two builders open on two field groups can each have their own formula window
 * and neither hears the other's messages.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'atcf_register_formula_window', 26 );

/**
 * Registers the formula window.
 *
 * Registered separately from the four main windows, like the preview, so that a
 * shell which refuses it still gives the user a builder — the button checks for
 * the window before offering itself, and the in-page editor is always there.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_formula_window() {
	if ( ! atcf_shell_has( 'register_window' ) || ! atcf_can_manage() ) {
		return;
	}

	atcf_shell_call(
		'register_window',
		ATCF_WINDOW_FORMULA,
		array(
			'title'        => __( 'Formula', 'allterrain-fields' ),
			'icon'         => 'dashicons-calculator',
			'template'     => 'atcf_formula_template',
			// The builder bundle. The window is the same editor, the same
			// tokeniser and the same calculator the builder already has loaded;
			// a bundle of its own would either duplicate all three or need a
			// fourth shared chunk for a window nobody opens without the builder.
			'script'       => 'allterrain-fields-builder',
			'style'        => 'allterrain-fields-builder',
			'width'        => 900,
			'height'       => 700,
			'min_width'    => 460,
			'min_height'   => 420,
			'placement'    => 'none',
			'capabilities' => array( ATCF_MANAGE_CAP ),
			'config'       => atcf_window_config( ATCF_WINDOW_FORMULA ),
		)
	);
}

/**
 * The formula window's body markup.
 *
 * Empty but for its root and its two panes. Everything in it depends on which
 * field the builder is asking about, and that is not known until the window has
 * announced itself and been answered — so rendering anything here beyond the
 * shape would be rendering something that is about to be replaced.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_formula_template() {
	?>
	<div class="atcfb atcflw" data-atcf-formula-root>
		<div class="atcflw__waiting" data-atcflw-waiting>
			<p><?php esc_html_e( 'Waiting for the field group…', 'allterrain-fields' ); ?></p>
		</div>
		<div class="atcflw__panes" data-atcflw-panes hidden>
			<div class="atcflw__work" data-atcflw-work></div>
			<div class="atcflw__manual" data-atcflw-manual></div>
		</div>
		<div class="atcflw__foot" data-atcflw-foot hidden></div>
	</div>
	<?php
}

add_filter( 'atcf_runtime_config', 'atcf_add_formula_config' );

/**
 * Tells the bundles whether the formula window is available.
 *
 * Read by `formula-editor.ts` before it decides what its Editor button does.
 * Offering a button that opens a window the shell refused would be worse than
 * the in-page editor it replaces.
 *
 * @since 0.1.0
 *
 * @param array $config The runtime config.
 * @return array The config.
 */
function atcf_add_formula_config( $config ) {
	$config['formulaWindow'] = ATCF_WINDOW_FORMULA;

	return $config;
}
