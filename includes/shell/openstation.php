<?php
/**
 * OpenStation integration.
 *
 * Everything here sits behind a `function_exists()` gate resolved through
 * `shell-api.php`. With no shell installed none of it runs and AllTerrain Fields
 * is a custom-fields plugin with an admin menu. With the shell installed it
 * becomes a desktop app: four native windows, a wallpaper icon, a dock tile with
 * a hover menu, a desktop widget and four entries in the command palette.
 *
 * Every window is **native** rather than an iframe, and that is the decision the
 * rest of the plugin's most interesting behaviour hangs off. Rendering into the
 * shell's own DOM is what gives a window `wp.os.dragManager` — one pointer
 * pipeline shared with the wallpaper's file tiles, WP Explorer, and every other
 * plugin's windows. So:
 *
 * - a field can be dragged from the palette onto the canvas, and from one
 *   builder window into a second one;
 * - a field group tile can be dragged onto a post type in the Content Model and
 *   the location rule is written;
 * - an image dragged out of WP Explorer can be dropped onto an Image field —
 *   including one on a **post editor in an iframe window**, which is the one
 *   case that needs the cross-frame bridge and is set up in `identity.php`;
 * - a relationship value dragged out of a field carries the payload type
 *   `allterrain-fields/value`, so any other plugin can accept it.
 *
 * None of that is reachable from inside an iframe.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

/**
 * The drag payload types this plugin emits.
 *
 * Exported as constants and documented, so another plugin can register a drop
 * target that accepts one without knowing anything else about this plugin.
 *
 * @since 0.1.0
 */
const ATCF_DRAG_FIELD = 'allterrain-fields/field';
const ATCF_DRAG_GROUP = 'allterrain-fields/group';
const ATCF_DRAG_VALUE = 'allterrain-fields/value';

/**
 * The window ids, so nothing has to spell them twice.
 *
 * @since 0.1.0
 */
const ATCF_WINDOW_BUILDER = 'allterrain-fields';
const ATCF_WINDOW_MODEL   = 'allterrain-fields-model';
const ATCF_WINDOW_BULK    = 'allterrain-fields-bulk';
const ATCF_WINDOW_TOOLS   = 'allterrain-fields-tools';
const ATCF_WINDOW_PREVIEW = 'allterrain-fields-preview';

/**
 * The tab values inside the main window.
 *
 * The builder is the window's own `main` tab; these three are registered with
 * `register_window_tab()` and swapped in place by the shell.
 *
 * @since 0.1.0
 */
const ATCF_TAB_MODEL = 'model';
const ATCF_TAB_BULK  = 'bulk';
const ATCF_TAB_TOOLS = 'tools';

/**
 * The formula window.
 *
 * Paired with the builder rather than replacing it — see `shell/formula.php`.
 *
 * @since 0.1.0
 */
const ATCF_WINDOW_FORMULA = 'allterrain-fields-formula';

add_action( 'plugins_loaded', 'atcf_maybe_init_openstation', 20 );

/**
 * Wires up the shell integrations, if there is a shell to wire into.
 *
 * On `plugins_loaded` rather than at file scope: plugins load alphabetically, so
 * `allterrain-fields` runs before `desktop-mode` and none of the shell's
 * functions exist yet when this file is first read. Checking then would fail on
 * every site, every time.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_maybe_init_openstation() {
	if ( ! atcf_shell_has( 'register_window' ) ) {
		return;
	}

	add_action( 'init', 'atcf_register_shell_surfaces', 25 );

	// Registered against both spellings of the hook. Which one fires depends on
	// the shell's version, and a listener for a hook that never fires costs
	// nothing — far less than deciding at boot which shell is present, since the
	// answer can change between `plugins_loaded` and the hook firing.
	foreach ( atcf_shell_hooks( 'mode_init' ) as $hook ) {
		add_action( $hook, 'atcf_enqueue_in_shell' );
	}

	add_action( 'admin_enqueue_scripts', 'atcf_enqueue_shell_styles', 20 );

	// One tile, not two. See `atcf_hide_menu_dock_item()`.
	foreach ( atcf_shell_hooks( 'dock_items' ) as $hook ) {
		add_filter( $hook, 'atcf_hide_menu_dock_item' );
	}
}

/**
 * Takes this plugin's admin menu back out of the dock.
 *
 * OpenStation builds its dock **from the admin menu**, and this plugin also
 * registers a system tile of its own — so the dock carried two Fields tiles,
 * side by side, with the same icon.
 *
 * The system tile is the one to keep. It opens the native windows directly, it
 * carries the constellation submenu that reaches all four of them plus *New
 * custom post type…*, and it knows which of them are open. The menu-derived tile
 * can do none of that: it is a link to `admin.php?page=allterrain-fields`, which
 * `registerNativeUrlRemap()` then has to intercept and turn into the window the
 * other tile would have opened directly.
 *
 * Removing the *menu page* instead would be the wrong fix twice over — the admin
 * page is the plugin's whole no-shell experience, and the dock is built from the
 * menu precisely so that a plugin which has done nothing special still appears.
 * Opting out is for the ones that have.
 *
 * @since 0.1.0
 *
 * @param array[] $items The dock items.
 * @return array[] The items, without this plugin's menu entry.
 */
function atcf_hide_menu_dock_item( $items ) {
	return array_values(
		array_filter(
			(array) $items,
			static function ( $item ) {
				return ! atcf_is_our_dock_item( (array) $item );
			}
		)
	);
}

/**
 * Whether a dock item is this plugin's admin menu.
 *
 * Matched on the **`page` query argument of the item's URL**, not on its id.
 *
 * The id is the screen's hook suffix — `toplevel_page_allterrain-fields`, and
 * `fields_page_allterrain-fields-model` for the submenus — which is built from
 * the *translated* parent menu title. Matching it means matching a string that
 * is different on a site in French, and the first version of this filter matched
 * the bare slug instead and therefore matched nothing at all, leaving both tiles
 * in the dock.
 *
 * The URL carries the slug itself and carries it the same way in every language,
 * which is the same reason `atcf_enqueue_admin_pages()` reads `$_GET['page']`
 * rather than the hook suffix.
 *
 * @since 0.1.0
 *
 * @param array $item A dock item.
 * @return bool True when it is one of this plugin's pages.
 */
function atcf_is_our_dock_item( $item ) {
	$url  = (string) atcf_arr( $item, 'url', '' );
	$page = '';

	if ( '' !== $url ) {
		$query = (string) wp_parse_url( $url, PHP_URL_QUERY );

		if ( '' !== $query ) {
			parse_str( $query, $args );

			$page = isset( $args['page'] ) ? (string) $args['page'] : '';
		}
	}

	// The id, as a fallback for a shell that gives an item no URL. Its suffix is
	// the slug whatever the prefix turns out to be.
	if ( '' === $page ) {
		$id = (string) atcf_arr( $item, 'id', '' );

		foreach ( atcf_admin_page_slugs() as $slug ) {
			if ( $id === $slug || substr( $id, -strlen( '_' . $slug ) ) === '_' . $slug ) {
				return true;
			}
		}

		return false;
	}

	return in_array( $page, atcf_admin_page_slugs(), true );
}

/**
 * The admin pages this plugin registers.
 *
 * One list, read by the dock filter and asserted against the registered menu in
 * `tests/phpunit/tests/rest.php` — a fifth page added without an entry here
 * would put a fifth tile in the dock beside the one that already reaches it.
 *
 * @since 0.1.0
 *
 * @return string[] Page slugs.
 */
function atcf_admin_page_slugs() {
	return array(
		'allterrain-fields',
		'allterrain-fields-model',
		'allterrain-fields-bulk',
		'allterrain-fields-tools',
	);
}

/**
 * Registers the windows, the icon, the widget and the commands.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_shell_surfaces() {
	if ( ! atcf_can_manage() && ! current_user_can( 'edit_posts' ) ) {
		return;
	}

	// One window, four tabs. The surfaces used to be four sibling windows and
	// clicking a tab *opened another window* — the opposite of what a tab
	// promises. Now the builder window owns the family: its own template is the
	// main tab, and the other three surfaces register as `<os-tabpanel>` tabs
	// the shell swaps in place, exactly like the submenu tabs an admin-page
	// window wears. A second window for side-by-side work is still one
	// `openNewWindow()` away.
	$windows = array(
		ATCF_WINDOW_BUILDER => array(
			'title'          => __( 'AllTerrain Custom Fields', 'allterrain-fields' ),
			'icon'           => 'dashicons-index-card',
			'template'       => 'atcf_builder_template',
			'script'         => 'allterrain-fields-builder',
			'style'          => 'allterrain-fields-builder',
			'main_tab_label' => __( 'Field Groups', 'allterrain-fields' ),
			'width'          => 1360,
			'height'         => 860,
			'min_width'      => 780,
			'min_height'     => 520,
		),
	);

	$tabs = array(
		ATCF_TAB_MODEL => array(
			'label'    => __( 'Content Model', 'allterrain-fields' ),
			'template' => 'atcf_model_template',
			'script'   => 'allterrain-fields-model',
			'position' => 20,
		),
		ATCF_TAB_BULK  => array(
			'label'    => __( 'Bulk Editor', 'allterrain-fields' ),
			'template' => 'atcf_bulk_template',
			'script'   => 'allterrain-fields-bulk',
			'position' => 30,
		),
		ATCF_TAB_TOOLS => array(
			'label'    => __( 'Field Tools', 'allterrain-fields' ),
			'template' => 'atcf_tools_template',
			'script'   => 'allterrain-fields-tools',
			'position' => 40,
		),
	);

	$registered = array();

	foreach ( $windows as $id => $window ) {
		$result = atcf_shell_call(
			'register_window',
			$id,
			array_merge(
				$window,
				array(
					// 'none', not 'dock'. All four windows are reached through a
					// single dock tile with a hover menu, registered in
					// `dock.ts` — four tiles for one plugin is four claims on
					// the same corner of the user's attention.
					'placement'    => 'none',
					'capabilities' => array( ATCF_MANAGE_CAP ),
					// Shipped on the registration rather than through
					// `wp_localize_script()`, because the lazy-load path bypasses
					// `wp_print_scripts()` entirely — a window opened for the
					// first time mid-session would otherwise boot with no config
					// at all.
					'config'       => atcf_window_config( $id ),
				)
			)
		);

		if ( ! is_wp_error( $result ) ) {
			$registered[] = $id;
		}
	}

	// The tabs, on the window that made it. A shell too old to know
	// `register_window_tab` simply leaves the window single-pane — the other
	// surfaces stay reachable through their admin pages.
	if ( in_array( ATCF_WINDOW_BUILDER, $registered, true ) && atcf_shell_has( 'register_window_tab' ) ) {
		foreach ( $tabs as $value => $tab ) {
			atcf_shell_call(
				'register_window_tab',
				ATCF_WINDOW_BUILDER,
				array_merge(
					$tab,
					array(
						'value'        => $value,
						'capabilities' => array( ATCF_MANAGE_CAP ),
					)
				)
			);
		}
	}

	// A `WP_Error` from the registration must not take the rest down: a shell
	// whose validation differs about the window's arguments should still give
	// the user the icon-free surfaces.
	if ( in_array( ATCF_WINDOW_BUILDER, $registered, true ) ) {
		atcf_register_shell_icon();
		atcf_register_shell_titlebar();
	}

	atcf_register_shell_widget();
	atcf_register_shell_commands( $registered );
}

/**
 * The per-window configuration blob.
 *
 * @since 0.1.0
 *
 * @param string $id Window id.
 * @return array The config.
 */
function atcf_window_config( $id ) {
	return array_merge(
		atcf_runtime_config(),
		array(
			'window' => $id,
			'i18n'   => atcf_runtime_strings(),
		)
	);
}

/**
 * Puts a Fields shortcut on the wallpaper.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_shell_icon() {
	if ( ! atcf_shell_has( 'register_icon' ) ) {
		return;
	}

	atcf_shell_call(
		'register_icon',
		'allterrain-fields',
		array(
			'title'        => __( 'AllTerrain Custom Fields', 'allterrain-fields' ),
			'icon'         => 'dashicons-index-card',
			'window'       => ATCF_WINDOW_BUILDER,
			'position'     => 34,
			'capabilities' => array( ATCF_MANAGE_CAP ),
		)
	);
}

/**
 * Declares the builder bundle as a title-bar button provider.
 *
 * Registering the *script* here is what makes the eye button paint for a session
 * that was already open when this plugin was activated — without it, the button
 * only appears after a reload, which is exactly when nobody is looking for it.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_shell_titlebar() {
	if ( atcf_shell_has( 'register_titlebar_button_script' ) ) {
		atcf_shell_call( 'register_titlebar_button_script', 'allterrain-fields-builder' );
	}
}

/**
 * Registers the Field Inspector widget.
 *
 * The widget is the piece of this plugin that only exists because the desktop
 * does. It sits on the wallpaper, watches which window has focus, and shows the
 * custom fields of whatever that window is looking at — editable, live, without
 * the post editor being the thing you are looking at.
 *
 * Nothing about that is expressible in a browser tab, because a tab has one
 * focus and it is the page.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_shell_widget() {
	if ( ! atcf_shell_has( 'register_widget' ) ) {
		return;
	}

	atcf_shell_call(
		'register_widget',
		'allterrain-fields/inspector',
		array(
			'label'          => __( 'Field Inspector', 'allterrain-fields' ),
			'description'    => __( 'The custom fields of whatever window has focus, live and editable.', 'allterrain-fields' ),
			'icon'           => 'dashicons-index-card',
			'script'         => 'allterrain-fields-widget',
			'movable'        => true,
			'resizable'      => true,
			'min_width'      => 260,
			'min_height'     => 220,
			'default_width'  => 340,
			'default_height' => 420,
			'capabilities'   => array( 'edit_posts' ),
		)
	);
}

/**
 * Adds this plugin's windows to the command palette.
 *
 * @since 0.1.0
 *
 * @param string[] $registered Which windows registered successfully.
 * @return void
 */
function atcf_register_shell_commands( $registered ) {
	if ( ! atcf_shell_has( 'register_command' ) ) {
		return;
	}

	$commands = array(
		ATCF_WINDOW_BUILDER => array(
			'label'       => __( 'Fields: open the field group builder', 'allterrain-fields' ),
			'description' => __( 'Build a field group by dragging fields onto a canvas.', 'allterrain-fields' ),
			'icon'        => 'dashicons-index-card',
			'script'      => 'allterrain-fields-builder',
		),
		ATCF_WINDOW_MODEL   => array(
			'label'       => __( 'Fields: open the content model', 'allterrain-fields' ),
			'description' => __( 'See every post type, taxonomy and the relationships between them, and draw new ones.', 'allterrain-fields' ),
			'icon'        => 'dashicons-networking',
			'script'      => 'allterrain-fields-model',
		),
		ATCF_WINDOW_BULK    => array(
			'label'       => __( 'Fields: open the bulk editor', 'allterrain-fields' ),
			'description' => __( 'Edit one field across every post at once, as a spreadsheet.', 'allterrain-fields' ),
			'icon'        => 'dashicons-editor-table',
			'script'      => 'allterrain-fields-bulk',
		),
		ATCF_WINDOW_TOOLS   => array(
			'label'       => __( 'Fields: import, export and sync', 'allterrain-fields' ),
			'description' => __( 'Move field groups between sites, and reconcile them with the JSON on disk.', 'allterrain-fields' ),
			'icon'        => 'dashicons-admin-tools',
			'script'      => 'allterrain-fields-tools',
		),
	);

	// All four surfaces live in the one registered window now, so every
	// command stands or falls with it rather than with a window of its own.
	if ( ! in_array( ATCF_WINDOW_BUILDER, $registered, true ) ) {
		return;
	}

	foreach ( $commands as $slug => $command ) {
		atcf_shell_call( 'register_command', array_merge( array( 'slug' => $slug ), $command ) );
	}
}

/**
 * Loads the boot-time bundles into the shell.
 *
 * `openstation_mode_init` fires while the shell is rendering, which is the
 * documented place for a plugin to enqueue shell-level code. Naming the handle
 * on the window registration is not enough on its own: the shell enqueues the
 * handle but never runs this plugin's `wp_add_inline_script()`, so the bundle
 * would boot with no `window.allTerrainFields` to read.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_enqueue_in_shell() {
	if ( ! atcf_can_manage() && ! current_user_can( 'edit_posts' ) ) {
		return;
	}

	atcf_print_runtime_config();

	wp_enqueue_script( 'allterrain-fields-dock' );
	wp_enqueue_style( 'allterrain-fields-builder' );

	// The Content Model pane's stylesheet used to travel on its own window
	// registration; as a tab it has none, so it loads with the shell.
	wp_enqueue_style( 'allterrain-fields-model' );
}

/**
 * Puts the stylesheets on shell pages before anything renders.
 *
 * Separate from the enqueue above because the *widget* also needs this CSS, and
 * a widget's bundle loads lazily — possibly after first paint. Registering the
 * style on the widget would not help: the shell injects a stylesheet link for a
 * window's `style` handle, but a widget card that mounts before its CSS arrives
 * renders as unstyled text for a frame.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_enqueue_shell_styles() {
	if ( ! atcf_shell_is_active() || atcf_shell_is_chromeless() ) {
		return;
	}

	if ( ! atcf_can_manage() && ! current_user_can( 'edit_posts' ) ) {
		return;
	}

	atcf_print_runtime_config();

	wp_enqueue_style( 'allterrain-fields-builder' );
	wp_enqueue_style( 'allterrain-fields-model' );
	wp_enqueue_script( 'allterrain-fields-dock' );
}

/**
 * The builder window's body markup.
 *
 * The shell clones this into the window before calling the JavaScript render
 * callback, so the callback enhances existing markup rather than building from
 * nothing — which means the window paints its three panes and a loading state
 * immediately instead of flashing empty while the bundle boots.
 *
 * Shared with the admin page, so the two are the same builder rather than two
 * that look alike.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_builder_template() {
	?>
	<div class="atcfb" data-atcfb-root>
		<div class="atcfb__bar" data-atcfb-bar>
			<os-spinner preset="inline"></os-spinner>
			<span class="atcfb__loading"><?php esc_html_e( 'Loading your field groups…', 'allterrain-fields' ); ?></span>
		</div>
		<div class="atcfb__body">
			<aside class="atcfb__groups" data-atcfb-groups aria-label="<?php esc_attr_e( 'Field groups', 'allterrain-fields' ); ?>"></aside>
			<aside class="atcfb__palette" data-atcfb-palette aria-label="<?php esc_attr_e( 'Field palette', 'allterrain-fields' ); ?>"></aside>
			<main class="atcfb__canvas" data-atcfb-canvas aria-label="<?php esc_attr_e( 'Fields in this group', 'allterrain-fields' ); ?>"></main>
			<aside class="atcfb__inspector" data-atcfb-inspector aria-label="<?php esc_attr_e( 'Field settings', 'allterrain-fields' ); ?>"></aside>
		</div>
	</div>
	<?php
}

/**
 * The content model window's body markup.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_model_template() {
	?>
	<div class="atcfm" data-atcfm-root>
		<div class="atcfm__bar" data-atcfm-bar>
			<os-spinner preset="inline"></os-spinner>
			<span class="atcfm__loading"><?php esc_html_e( 'Reading the content model…', 'allterrain-fields' ); ?></span>
		</div>
		<div class="atcfm__body">
			<div class="atcfm__canvas" data-atcfm-canvas aria-label="<?php esc_attr_e( 'Content model', 'allterrain-fields' ); ?>"></div>
			<aside class="atcfm__side" data-atcfm-side aria-label="<?php esc_attr_e( 'Selected relationship', 'allterrain-fields' ); ?>"></aside>
		</div>
	</div>
	<?php
}

/**
 * The bulk editor window's body markup.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_bulk_template() {
	?>
	<div class="atcfk" data-atcfk-root>
		<div class="atcfk__bar" data-atcfk-bar>
			<os-spinner preset="inline"></os-spinner>
			<span class="atcfk__loading"><?php esc_html_e( 'Loading values…', 'allterrain-fields' ); ?></span>
		</div>
		<div class="atcfk__body" data-atcfk-body></div>
	</div>
	<?php
}

/**
 * The tools window's body markup.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_tools_template() {
	?>
	<div class="atcft" data-atcft-root>
		<div class="atcft__bar" data-atcft-bar>
			<os-spinner preset="inline"></os-spinner>
			<span class="atcft__loading"><?php esc_html_e( 'Checking what is on disk…', 'allterrain-fields' ); ?></span>
		</div>
		<div class="atcft__body" data-atcft-body></div>
	</div>
	<?php
}
