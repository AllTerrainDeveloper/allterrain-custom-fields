<?php
/**
 * The display layer — fields on the front of the site.
 *
 * Every plugin in this category can *store* a value. Showing one has always
 * been the site owner's problem: edit a template, buy a views builder, or
 * paste a shortcode that the biggest plugin in the category now disables by
 * default because of how it handled escaping. This file is the answer to
 * "and how do visitors see it?", four ways, all free:
 *
 * 1. **Zero-code display.** A group with *Show on the front end* switched on
 *    renders on the post's own page — before or after the content — through a
 *    theme-overridable template. No template edit, no block, no shortcode.
 * 2. **Block bindings.** A binding source for WordPress 6.5+, so a core
 *    paragraph, heading, image or button can carry a field's value natively.
 * 3. **A shortcode that is safe by default.** `[atcf field="price"]` escapes
 *    per field type, refuses password fields outright, and will not read
 *    another post unless that post is publicly viewable.
 * 4. **REST exposure.** Groups with *Expose in the REST API* switched on add
 *    an `atcf` object to the post's REST response, values formatted.
 *
 * One rule runs through all four: **this is a public surface.** Values are
 * escaped per type on the way out, password fields never appear, related
 * posts only render when a visitor could reach them anyway, and users render
 * as display names — never as email addresses.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

// ————— Zero-code display —————

add_filter( 'the_content', 'atcf_display_in_content', 20 );

/**
 * Renders the groups that asked to appear on the front end.
 *
 * Priority 20: after `wpautop` and `do_shortcode`, so the sections attach to
 * the finished content rather than being run through either. Main query,
 * singular, in the loop — the same three guards every well-behaved content
 * filter uses, because an archive of twenty excerpts each dragging a field
 * table behind it is nobody's design.
 *
 * @since 0.2.0
 *
 * @param string $content The post content.
 * @return string The content, with field sections attached.
 */
function atcf_display_in_content( $content ) {
	if ( ! is_singular() || ! in_the_loop() || ! is_main_query() ) {
		return $content;
	}

	$post = get_post();

	if ( ! $post ) {
		return $content;
	}

	$before = '';
	$after  = '';

	foreach ( atcf_display_groups( $post ) as $group ) {
		$markup = atcf_display_group( $group, $post );

		if ( 'before' === $group['settings']['frontend']['placement'] ) {
			$before .= $markup;
		} else {
			$after .= $markup;
		}
	}

	return $before . $content . $after;
}

/**
 * The groups that display on a given post.
 *
 * @since 0.2.0
 *
 * @param WP_Post $post The post.
 * @return array[] Canonical groups with frontend display enabled.
 */
function atcf_display_groups( $post ) {
	$groups = array();

	foreach ( atcf_groups_for( atcf_post_context( $post ) ) as $group ) {
		if ( ! empty( $group['settings']['frontend']['enabled'] ) ) {
			$groups[] = $group;
		}
	}

	/**
	 * Filters which groups render on the front of a post.
	 *
	 * @since 0.2.0
	 *
	 * @param array[] $groups The groups that asked to display.
	 * @param WP_Post $post   The post they would display on.
	 */
	return (array) apply_filters( 'atcf_display_groups', $groups, $post );
}

/**
 * Renders one group's front-end section.
 *
 * The theme gets the first word: `allterrain-fields/group-{key}.php`, then
 * `allterrain-fields/group.php`, resolved through `locate_template()` so a
 * child theme overrides a parent. No file, and the built-in renderer below
 * draws a definition list — which is not a design statement, it is the most
 * accessible shape a set of label/value pairs has.
 *
 * @since 0.2.0
 *
 * @param array   $group Canonical group.
 * @param WP_Post $post  The post.
 * @return string The markup.
 */
function atcf_display_group( $group, $post ) {
	$ref = array(
		'type' => 'post',
		'id'   => (int) $post->ID,
	);

	$template = locate_template(
		array(
			'allterrain-fields/group-' . $group['key'] . '.php',
			'allterrain-fields/group.php',
		)
	);

	ob_start();

	if ( $template ) {
		// The template sees `$group`, `$post` and `$fields` — the group's
		// fields with a `value` key already loaded, so the common template is
		// a foreach and an echo.
		$fields = array();

		foreach ( $group['fields'] as $field ) {
			$field['value'] = atcf_load_value( $field, $ref, '', true );
			$fields[]       = $field;
		}

		include $template;
	} else {
		atcf_display_render_default( $group, $ref );
	}

	$markup = (string) ob_get_clean();

	/**
	 * Filters a group's rendered front-end section.
	 *
	 * @since 0.2.0
	 *
	 * @param string  $markup The markup.
	 * @param array   $group  The group.
	 * @param WP_Post $post   The post it renders on.
	 */
	return (string) apply_filters( 'atcf_display_markup', $markup, $group, $post );
}

/**
 * The built-in front-end renderer.
 *
 * @since 0.2.0
 *
 * @param array $group Canonical group.
 * @param array $ref   Object reference.
 * @return void
 */
function atcf_display_render_default( $group, $ref ) {
	$rows = '';

	foreach ( $group['fields'] as $field ) {
		$rows .= atcf_display_row( $field, atcf_load_value( $field, $ref, '', false ) );
	}

	if ( '' === $rows ) {
		return;
	}

	atcf_display_enqueue_style();

	echo '<section class="atcf-display">';

	if ( ! empty( $group['settings']['frontend']['heading'] ) ) {
		echo '<h2 class="atcf-display__title">' . esc_html( $group['title'] ) . '</h2>';
	}

	echo '<dl class="atcf-display__list">';
	echo $rows; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Every branch of atcf_display_value_html() escapes for its own shape.
	echo '</dl>';
	echo '</section>';
}

/**
 * One field as a definition-list row, or nothing.
 *
 * @since 0.2.0
 *
 * @param array $field Canonical field.
 * @param mixed $value Raw stored value.
 * @return string The row.
 */
function atcf_display_row( $field, $value ) {
	$html = atcf_display_value_html( $field, $value );

	if ( '' === $html ) {
		return '';
	}

	return '<div class="atcf-display__row">'
		. '<dt class="atcf-display__label">' . esc_html( (string) $field['label'] ) . '</dt>'
		. '<dd class="atcf-display__value">' . $html . '</dd>'
		. '</div>';
}

/**
 * A field's value as front-end HTML, escaped for its own shape.
 *
 * The raw value and the definition, not the formatted value: formatters obey
 * `return_format`, which is a *template* preference, and a renderer that
 * changed output because a developer once picked "URL" over "array" would be
 * spooky at a distance. Passwords and JSON never render — one is a secret and
 * the other is developer data. An empty value returns an empty string, so an
 * unfilled field takes no space rather than printing a labelled blank.
 *
 * @since 0.2.0
 *
 * @param array $field Canonical field.
 * @param mixed $value Raw stored value.
 * @return string Escaped HTML, or an empty string.
 */
function atcf_display_value_html( $field, $value ) {
	$type     = (string) atcf_arr( $field, 'type', 'text' );
	$settings = (array) atcf_arr( $field, 'settings', array() );

	/**
	 * Filters a value's front-end HTML before the built-in rendering runs.
	 *
	 * Return a non-null string — escaped, it is printed as-is — to take the
	 * rendering over for one field or one type entirely.
	 *
	 * @since 0.2.0
	 *
	 * @param string|null $html  Null to let the built-in renderer decide.
	 * @param array       $field Canonical field.
	 * @param mixed       $value Raw stored value.
	 */
	$html = apply_filters( 'atcf_display_value_html', null, $field, $value );

	if ( null !== $html ) {
		return (string) $html;
	}

	if ( in_array( $type, array( 'password', 'json', 'message', 'tab', 'accordion' ), true ) ) {
		return '';
	}

	switch ( $type ) {
		case 'textarea':
			return '' === (string) $value ? '' : nl2br( esc_html( (string) $value ) );

		case 'wysiwyg':
			return '' === (string) $value ? '' : wp_kses_post( (string) $value );

		case 'oembed':
			$url = (string) $value;

			if ( '' === $url ) {
				return '';
			}

			$embed = wp_oembed_get( $url );

			return $embed ? $embed : '<a href="' . esc_url( $url ) . '">' . esc_html( $url ) . '</a>';

		case 'url':
			return '' === (string) $value ? '' : '<a href="' . esc_url( (string) $value ) . '">' . esc_html( (string) $value ) . '</a>';

		case 'email':
			return '' === (string) $value ? '' : '<a href="' . esc_url( 'mailto:' . $value ) . '">' . esc_html( (string) $value ) . '</a>';

		case 'image':
			$id = (int) $value;

			return $id ? (string) wp_get_attachment_image( $id, 'medium', false, array( 'class' => 'atcf-display__image' ) ) : '';

		case 'file':
			$id = (int) $value;

			if ( ! $id ) {
				return '';
			}

			$url = (string) wp_get_attachment_url( $id );

			return '' === $url ? '' : '<a href="' . esc_url( $url ) . '">' . esc_html( get_the_title( $id ) ) . '</a>';

		case 'gallery':
			$images = '';

			foreach ( atcf_to_id_list( $value ) as $id ) {
				$images .= (string) wp_get_attachment_image( $id, 'thumbnail', false, array( 'class' => 'atcf-display__image' ) );
			}

			return '' === $images ? '' : '<div class="atcf-display__gallery">' . $images . '</div>';

		case 'select':
		case 'radio':
		case 'button_group':
		case 'checkbox':
			$labels  = array();
			$choices = array();

			foreach ( atcf_normalize_choices( atcf_arr( $settings, 'choices', array() ) ) as $choice ) {
				$choices[ $choice['value'] ] = $choice['label'];
			}

			foreach ( (array) ( is_array( $value ) ? $value : array( $value ) ) as $one ) {
				$one = (string) $one;

				if ( '' !== $one ) {
					$labels[] = isset( $choices[ $one ] ) ? $choices[ $one ] : $one;
				}
			}

			return esc_html( implode( ', ', $labels ) );

		case 'true_false':
			return '' === (string) $value
				? ''
				: esc_html( $value ? __( 'Yes', 'allterrain-fields' ) : __( 'No', 'allterrain-fields' ) );

		case 'link':
			$link = is_array( $value ) ? $value : array();
			$url  = (string) atcf_arr( $link, 'url', '' );

			if ( '' === $url ) {
				return '';
			}

			$target = '_blank' === (string) atcf_arr( $link, 'target', '' ) ? ' target="_blank" rel="noopener"' : '';
			$title  = (string) atcf_arr( $link, 'title', $url );

			return '<a href="' . esc_url( $url ) . '"' . $target . '>' . esc_html( '' === $title ? $url : $title ) . '</a>';

		case 'post_object':
		case 'page_link':
		case 'relationship':
			$links = array();

			foreach ( atcf_to_id_list( $value ) as $id ) {
				// A public page must not become a directory of things the
				// visitor cannot reach. Core's own question, asked per post.
				if ( ! is_post_publicly_viewable( $id ) ) {
					continue;
				}

				$links[] = '<a href="' . esc_url( (string) get_permalink( $id ) ) . '">' . esc_html( get_the_title( $id ) ) . '</a>';
			}

			return implode( ', ', $links );

		case 'taxonomy':
			$names = array();

			foreach ( atcf_to_id_list( $value ) as $id ) {
				$term = get_term( $id );

				if ( ! $term instanceof WP_Term ) {
					continue;
				}

				$link    = get_term_link( $term );
				$names[] = is_wp_error( $link )
					? esc_html( $term->name )
					: '<a href="' . esc_url( $link ) . '">' . esc_html( $term->name ) . '</a>';
			}

			return implode( ', ', $names );

		case 'user':
			$names = array();

			foreach ( atcf_to_id_list( $value ) as $id ) {
				$user = get_userdata( $id );

				if ( $user ) {
					// The display name and nothing else. An email address on
					// a public page is a harvest, not a byline.
					$names[] = esc_html( $user->display_name );
				}
			}

			return implode( ', ', $names );

		case 'location':
			$address = is_array( $value ) ? (string) atcf_arr( $value, 'address', '' ) : '';

			return esc_html( $address );

		case 'table':
			return atcf_display_table_html( $value, $field );

		case 'group':
			return atcf_display_rows_html( atcf_field_sub_fields( $field ), is_array( $value ) ? $value : array() );

		case 'clone':
			// A clone's fields live wherever it points, not in its settings.
			return atcf_display_rows_html( atcf_resolve_clone_fields( $field ), is_array( $value ) ? $value : array() );

		case 'repeater':
			$rows = '';

			foreach ( (array) ( is_array( $value ) ? $value : array() ) as $row ) {
				$inner = atcf_display_rows_html( atcf_field_sub_fields( $field ), is_array( $row ) ? $row : array() );

				if ( '' !== $inner ) {
					$rows .= '<li class="atcf-display__item">' . $inner . '</li>';
				}
			}

			return '' === $rows ? '' : '<ul class="atcf-display__rows">' . $rows . '</ul>';

		case 'flexible_content':
			$rows = '';

			foreach ( (array) ( is_array( $value ) ? $value : array() ) as $row ) {
				$layout = atcf_flexible_layout( $field, (string) atcf_arr( (array) $row, 'acf_fc_layout', '' ) );

				if ( ! $layout ) {
					continue;
				}

				$inner = atcf_display_rows_html( (array) atcf_arr( $layout, 'sub_fields', array() ), (array) $row );

				if ( '' !== $inner ) {
					$rows .= '<li class="atcf-display__item">' . $inner . '</li>';
				}
			}

			return '' === $rows ? '' : '<ul class="atcf-display__rows">' . $rows . '</ul>';
	}

	// Everything scalar and calm: text, number, range, dates, colour, icon,
	// computed, and any type a plugin registered without a display opinion.
	if ( ! is_scalar( $value ) || '' === (string) $value ) {
		return '';
	}

	return esc_html( (string) $value );
}

/**
 * Sub-fields of one container row, rendered as nested label/value pairs.
 *
 * The container's value is name-addressed and already loaded, so each
 * sub-value is handed straight to the same renderer — recursion is what makes
 * a repeater inside a group inside a repeater cost nothing extra here.
 *
 * @since 0.2.0
 *
 * @param array[] $subs Sub-field definitions.
 * @param array   $row  The row's values, keyed by sub-field name.
 * @return string The rows.
 */
function atcf_display_rows_html( $subs, $row ) {
	$out = '';

	foreach ( (array) $subs as $sub ) {
		$out .= atcf_display_row( $sub, atcf_arr( $row, (string) atcf_arr( $sub, 'name', '' ), null ) );
	}

	return '' === $out ? '' : '<dl class="atcf-display__list">' . $out . '</dl>';
}

/**
 * A table field's value as a table.
 *
 * With the header row the field declared, when it declared one — a spec sheet
 * without its column names is two anonymous columns of trivia.
 *
 * @since 0.2.0
 *
 * @param mixed $value Raw stored value.
 * @param array $field Canonical field, for the column labels.
 * @return string The table.
 */
function atcf_display_table_html( $value, $field = array() ) {
	if ( ! is_array( $value ) ) {
		return '';
	}

	$settings = (array) atcf_arr( $field, 'settings', array() );
	$head     = '';

	if ( atcf_arr( $settings, 'header', false ) ) {
		$cells = '';

		foreach ( (array) atcf_arr( $settings, 'columns', array() ) as $column ) {
			$label = is_array( $column )
				? (string) atcf_arr( $column, 'label', (string) atcf_arr( $column, 'key', '' ) )
				: (string) $column;

			if ( '' !== $label ) {
				$cells .= '<th scope="col">' . esc_html( $label ) . '</th>';
			}
		}

		if ( '' !== $cells ) {
			$head = '<thead><tr>' . $cells . '</tr></thead>';
		}
	}

	$rows = '';

	foreach ( $value as $row ) {
		if ( ! is_array( $row ) ) {
			continue;
		}

		$cells = '';

		foreach ( $row as $cell ) {
			$cells .= '<td>' . esc_html( is_scalar( $cell ) ? (string) $cell : '' ) . '</td>';
		}

		if ( '' !== $cells ) {
			$rows .= '<tr>' . $cells . '</tr>';
		}
	}

	return '' === $rows ? '' : '<table class="atcf-display__table">' . $head . '<tbody>' . $rows . '</tbody></table>';
}

add_action( 'init', 'atcf_display_register_style' );

/**
 * Registers the display stylesheet.
 *
 * Registered always, enqueued only when a section actually renders — a site
 * with the feature switched off ships zero extra bytes to its visitors.
 *
 * @since 0.2.0
 *
 * @return void
 */
function atcf_display_register_style() {
	wp_register_style( 'atcf-display', ATCF_URL . 'assets/css/display.css', array(), ATCF_VERSION );
}

/**
 * Enqueues the display stylesheet, late but legally.
 *
 * @since 0.2.0
 *
 * @return void
 */
function atcf_display_enqueue_style() {
	if ( ! wp_style_is( 'atcf-display', 'enqueued' ) ) {
		wp_enqueue_style( 'atcf-display' );
	}
}

// ————— The shortcode —————

add_shortcode( 'atcf', 'atcf_shortcode' );

/**
 * `[atcf field="price"]`, escaped by default.
 *
 * The category's cautionary tale is a shortcode that echoed whatever the meta
 * row held; this one goes through the same per-type renderer as the front-end
 * display, so a text value is `esc_html`'d, rich text is kses'd, and an
 * attachment renders as an image rather than as a number.
 *
 * Reading *another* post is allowed only when that post is publicly viewable.
 * Anyone who can get a shortcode into content can otherwise read fields off
 * every draft and private post on the site by id — which is exactly the
 * disclosure the REST routes refuse, and the front door should not be looser
 * than the API.
 *
 * @since 0.2.0
 *
 * @param array|string $atts Shortcode attributes.
 * @return string The rendered value.
 */
function atcf_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'field'   => '',
			'post'    => 0,
			'default' => '',
		),
		$atts,
		'atcf'
	);

	$name = atcf_sanitize_field_name( (string) $atts['field'] );

	if ( '' === $name ) {
		return '';
	}

	$post_id = (int) $atts['post'];
	$current = (int) get_the_ID();

	if ( $post_id > 0 && $post_id !== $current && ! is_post_publicly_viewable( $post_id ) ) {
		return '';
	}

	$post = get_post( $post_id > 0 ? $post_id : $current );

	if ( ! $post ) {
		return '';
	}

	$ref   = array(
		'type' => 'post',
		'id'   => (int) $post->ID,
	);
	$field = null;

	foreach ( atcf_groups_for( atcf_post_context( $post ) ) as $group ) {
		foreach ( atcf_flatten_fields( $group['fields'] ) as $one ) {
			if ( $one['name'] === $name && ! $one['ancestors'] ) {
				$field = $one;

				break 2;
			}
		}
	}

	if ( $field && 'password' === (string) $field['type'] ) {
		// No value and no default either: a secret's fallback text would
		// still confirm the secret exists.
		return '';
	}

	$html = $field ? atcf_display_value_html( $field, atcf_load_value( $field, $ref, '', false ) ) : '';

	return '' === $html ? esc_html( (string) $atts['default'] ) : $html;
}

// ————— Block bindings —————

add_action( 'init', 'atcf_register_binding_source' );

/**
 * Registers the block bindings source, on WordPress 6.5 and up.
 *
 * With it, a core paragraph, heading, button or image carries a field's value
 * natively — the block markup names the field, the value stays in meta, and
 * editing the field updates every block bound to it:
 *
 *     <!-- wp:paragraph {"metadata":{"bindings":{"content":
 *         {"source":"allterrain-fields/field","args":{"field":"price"}}}}} -->
 *
 * @since 0.2.0
 *
 * @return void
 */
function atcf_register_binding_source() {
	if ( ! function_exists( 'register_block_bindings_source' ) ) {
		return;
	}

	// The registry warns loudly on a duplicate, and `init` is a hook other
	// code re-fires more often than anyone admits.
	if ( function_exists( 'get_block_bindings_source' ) && get_block_bindings_source( 'allterrain-fields/field' ) ) {
		return;
	}

	register_block_bindings_source(
		'allterrain-fields/field',
		array(
			'label'              => __( 'AllTerrain field', 'allterrain-fields' ),
			'get_value_callback' => 'atcf_binding_value',
			'uses_context'       => array( 'postId' ),
		)
	);
}

/**
 * Resolves one binding to a value.
 *
 * The answer depends on which attribute asked. A URL-shaped attribute gets a
 * URL — an image field resolves to the attachment's file, a link field to its
 * target — and everything else gets text at the `wp_kses_post()` ceiling.
 *
 * @since 0.2.0
 *
 * @param array    $args      The binding's args. `field` names the field.
 * @param WP_Block $block     The block asking.
 * @param string   $attribute Which attribute is being bound.
 * @return string|null The value, or null to leave the block's fallback alone.
 */
function atcf_binding_value( $args, $block, $attribute ) {
	$name    = atcf_sanitize_field_name( (string) atcf_arr( (array) $args, 'field', '' ) );
	$post_id = isset( $block->context['postId'] ) ? (int) $block->context['postId'] : (int) get_the_ID();

	if ( '' === $name || $post_id <= 0 ) {
		return null;
	}

	$post = get_post( $post_id );

	if ( ! $post ) {
		return null;
	}

	$ref   = array(
		'type' => 'post',
		'id'   => $post_id,
	);
	$field = null;

	foreach ( atcf_groups_for( atcf_post_context( $post ) ) as $group ) {
		foreach ( atcf_flatten_fields( $group['fields'] ) as $one ) {
			if ( $one['name'] === $name && ! $one['ancestors'] ) {
				$field = $one;

				break 2;
			}
		}
	}

	if ( ! $field || 'password' === (string) $field['type'] ) {
		return null;
	}

	$value = atcf_load_value( $field, $ref, '', false );
	$type  = (string) $field['type'];

	if ( in_array( $attribute, array( 'url', 'src', 'href' ), true ) ) {
		if ( 'image' === $type || 'file' === $type ) {
			$url = (string) wp_get_attachment_url( (int) $value );
		} elseif ( 'link' === $type ) {
			$url = (string) atcf_arr( (array) $value, 'url', '' );
		} elseif ( in_array( $type, array( 'post_object', 'page_link' ), true ) ) {
			$id  = (int) $value;
			$url = $id && is_post_publicly_viewable( $id ) ? (string) get_permalink( $id ) : '';
		} else {
			$url = is_scalar( $value ) ? (string) $value : '';
		}

		return '' === $url ? null : esc_url( $url );
	}

	if ( 'alt' === $attribute && 'image' === $type ) {
		return (string) get_post_meta( (int) $value, '_wp_attachment_image_alt', true );
	}

	if ( ! is_scalar( $value ) || '' === (string) $value ) {
		return null;
	}

	return wp_kses_post( (string) $value );
}

// ————— REST exposure —————

add_action( 'rest_api_init', 'atcf_register_rest_value_fields' );

/**
 * Adds an `atcf` object to the REST response of every covered post type.
 *
 * What the group's *Expose in the REST API* switch has always promised. The
 * values are formatted — an image is its record, a relationship its posts —
 * because a headless front end asking the REST API is exactly the reader the
 * formatters exist for. Read-only: writes go through this plugin's own
 * routes, where the per-object capability checks live.
 *
 * @since 0.2.0
 *
 * @return void
 */
function atcf_register_rest_value_fields() {
	$types = array();

	foreach ( atcf_get_groups() as $group ) {
		if ( empty( $group['settings']['show_in_rest'] ) ) {
			continue;
		}

		foreach ( atcf_group_post_types( $group ) as $type ) {
			if ( '*' === $type ) {
				foreach ( get_post_types( array( 'show_in_rest' => true ) ) as $any ) {
					$types[ $any ] = true;
				}
			} else {
				$types[ $type ] = true;
			}
		}
	}

	foreach ( array_keys( $types ) as $type ) {
		register_rest_field(
			$type,
			'atcf',
			array(
				'get_callback' => 'atcf_rest_field_values',
				'schema'       => array(
					'description' => __( 'Field values, formatted, keyed by field name.', 'allterrain-fields' ),
					'type'        => 'object',
					'readonly'    => true,
				),
			)
		);
	}
}

/**
 * One post's exposed values.
 *
 * @since 0.2.0
 *
 * @param array $prepared The prepared post data.
 * @return array Field name => formatted value.
 */
function atcf_rest_field_values( $prepared ) {
	$post = get_post( (int) atcf_arr( $prepared, 'id', 0 ) );

	if ( ! $post ) {
		return array();
	}

	$ref    = array(
		'type' => 'post',
		'id'   => (int) $post->ID,
	);
	$values = array();

	foreach ( atcf_groups_for( atcf_post_context( $post ) ) as $group ) {
		if ( empty( $group['settings']['show_in_rest'] ) ) {
			continue;
		}

		foreach ( $group['fields'] as $field ) {
			if ( 'password' === (string) $field['type'] ) {
				continue;
			}

			if ( 'none' === (string) atcf_arr( (array) atcf_get_field_type( $field['type'] ), 'value', 'string' ) ) {
				continue;
			}

			$values[ $field['name'] ] = atcf_load_value( $field, $ref, '', true );
		}
	}

	/**
	 * Filters the values a post exposes over REST.
	 *
	 * @since 0.2.0
	 *
	 * @param array   $values Field name => formatted value.
	 * @param WP_Post $post   The post.
	 */
	return (array) apply_filters( 'atcf_rest_field_values', $values, $post );
}
