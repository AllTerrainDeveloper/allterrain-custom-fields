<?php
/**
 * Field groups as blocks.
 *
 * Tick a box on a field group and it becomes a Gutenberg block whose attributes
 * are its fields. This was the headline feature of the paid tier for years, and
 * it is one `register_block_type()` call plus a render callback.
 *
 * Values live in the block's own attributes rather than in post meta, because a
 * block can appear twice in one post and meta cannot hold two of anything under
 * one key. That is also why the block's fields are read with
 * `atcf_block_field()` rather than `atcf_get_field()` inside a template: the
 * value is in the block, not on the post.
 *
 * The editor renders the block through the same PHP render callback the front
 * end uses (`ServerSideRender`), so what an author sees while editing is what a
 * visitor gets — rather than a second, JavaScript rendering of the same block
 * that drifts from the first one.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'atcf_register_group_blocks', 30 );

/**
 * Registers a block for every group that asks for one.
 *
 * Priority 30, after the groups themselves are registerable and after any plugin
 * adding groups on `init` at 20 has run.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_group_blocks() {
	if ( ! function_exists( 'register_block_type' ) ) {
		return;
	}

	foreach ( atcf_get_groups() as $group ) {
		$block = (array) $group['settings']['block'];

		if ( ! $block['enabled'] || '' === $block['name'] ) {
			continue;
		}

		$attributes = array(
			// One attribute holding every field value, rather than one attribute
			// per field. Fields are added and renamed constantly; a block whose
			// attribute *schema* changed every time somebody renamed a field
			// would invalidate every existing instance of it in every post.
			'data' => array(
				'type'    => 'object',
				'default' => new stdClass(),
			),
		);

		register_block_type(
			'acf/' . $block['name'],
			array(
				'title'           => '' !== $block['title'] ? $block['title'] : $group['title'],
				'description'     => $block['description'],
				'category'        => $block['category'],
				'icon'            => $block['icon'],
				'keywords'        => $block['keywords'],
				'attributes'      => $attributes,
				'supports'        => array(
					'align'  => '' !== $block['align'],
					'anchor' => true,
					'html'   => false,
				),
				'render_callback' => 'atcf_render_group_block',
			)
		);
	}
}

/**
 * The block currently rendering, so `atcf_block_field()` can read it.
 *
 * A stack, because a block template can nest one of these blocks inside another
 * — an inner block reading its parent's values would be a subtle and extremely
 * confusing bug to be handed.
 *
 * @since 0.1.0
 *
 * @param array|null $push Block context to push.
 * @param bool       $pop  Whether to pop.
 * @return array[] The stack.
 */
function atcf_block_stack( $push = null, $pop = false ) {
	static $stack = array();

	if ( is_array( $push ) ) {
		$stack[] = $push;
	}

	if ( $pop && $stack ) {
		array_pop( $stack );
	}

	return $stack;
}

/**
 * Renders one field-group block.
 *
 * @since 0.1.0
 *
 * @param array  $attributes The block attributes.
 * @param string $content    Inner content, unused.
 * @param mixed  $block      The block instance.
 * @return string The markup.
 */
function atcf_render_group_block( $attributes, $content = '', $block = null ) {
	unset( $content );

	$name  = $block && isset( $block->name ) ? (string) $block->name : '';
	$group = atcf_group_for_block( $name );

	if ( ! $group ) {
		return '';
	}

	$data = (array) atcf_arr( (array) $attributes, 'data', array() );

	// Block values live in post_content rather than in meta, so they never pass
	// through the save pipeline's per-type sanitisers. Running them here gives a
	// block value the same treatment a meta value gets on its way in — the
	// template author downstream is owed the same contract either way.
	foreach ( $group['fields'] as $field ) {
		$field_name = (string) atcf_arr( $field, 'name', '' );

		if ( '' !== $field_name && array_key_exists( $field_name, $data ) ) {
			$data[ $field_name ] = atcf_sanitize_value( $data[ $field_name ], $field );
		}
	}

	atcf_block_stack(
		array(
			'group' => $group,
			'data'  => $data,
		)
	);

	$template = (string) $group['settings']['block']['template'];

	ob_start();

	if ( '' !== $template && atcf_block_template_path( $template ) ) {
		// `include` of a theme file, resolved through `locate_template()` so a
		// child theme can override it — the same lookup every other template
		// part in WordPress gets.
		include atcf_block_template_path( $template );
	} else {
		atcf_render_block_default( $group, $data );
	}

	$markup = (string) ob_get_clean();

	atcf_block_stack( null, true );

	/**
	 * Filters a field-group block's rendered markup.
	 *
	 * @since 0.1.0
	 *
	 * @param string $markup The markup.
	 * @param array  $group  The group behind the block.
	 * @param array  $data   The block's field values.
	 */
	return (string) apply_filters( 'atcf_block_markup', $markup, $group, $data );
}

/**
 * Resolves a block template name to a readable file inside the theme.
 *
 * The path is confined to the theme directories on purpose. A template name is
 * stored in a field group, a field group is editable over REST by anybody with
 * `manage_options`, and an unconfined `include` of a stored string is a file
 * inclusion vulnerability wearing a feature's clothes.
 *
 * @since 0.1.0
 *
 * @param string $template The stored template name.
 * @return string The absolute path, or an empty string when it does not resolve.
 */
function atcf_block_template_path( $template ) {
	$template = ltrim( str_replace( array( '..', "\0" ), '', (string) $template ), '/' );

	if ( '' === $template || '.php' !== substr( $template, -4 ) ) {
		return '';
	}

	$found = locate_template( array( $template ), false, false );

	return is_string( $found ) ? $found : '';
}

/**
 * The group a block name belongs to.
 *
 * @since 0.1.0
 *
 * @param string $name Full block name, e.g. `acf/hero`.
 * @return array|null The group, or null.
 */
function atcf_group_for_block( $name ) {
	$slug = str_replace( 'acf/', '', (string) $name );

	foreach ( atcf_get_groups() as $group ) {
		if ( (string) $group['settings']['block']['name'] === $slug ) {
			return $group;
		}
	}

	return null;
}

/**
 * Renders a block with no template of its own.
 *
 * A definition list of label and value. Not pretty, and deliberately not
 * pretending to be: a block with no template has no design, and inventing one
 * would make the first thing a developer does be undoing it.
 *
 * @since 0.1.0
 *
 * @param array $group Canonical group.
 * @param array $data  The block's values.
 * @return void
 */
function atcf_render_block_default( $group, $data ) {
	printf( '<div class="atcf-block atcf-block--%s">', esc_attr( $group['settings']['block']['name'] ) );
	echo '<dl class="atcf-block__fields">';

	foreach ( $group['fields'] as $field ) {
		$value = atcf_arr( $data, $field['name'], '' );

		if ( ! is_scalar( $value ) || '' === (string) $value ) {
			continue;
		}

		printf( '<dt>%s</dt><dd>%s</dd>', esc_html( $field['label'] ), esc_html( (string) $value ) );
	}

	echo '</dl></div>';
}

/**
 * Reads a field inside a block template.
 *
 * @since 0.1.0
 *
 * @param string $selector  Field name or key.
 * @param bool   $formatted Whether to run the type's formatter.
 * @return mixed The value, or null outside a block render.
 */
function atcf_block_field( $selector, $formatted = true ) {
	$stack = atcf_block_stack();

	if ( ! $stack ) {
		return null;
	}

	$top   = $stack[ count( $stack ) - 1 ];
	$group = $top['group'];

	foreach ( $group['fields'] as $field ) {
		if ( $field['name'] !== $selector && $field['key'] !== $selector ) {
			continue;
		}

		$value = atcf_arr( (array) $top['data'], $field['name'], null );

		return $formatted ? atcf_format_value( $value, $field ) : $value;
	}

	return null;
}
