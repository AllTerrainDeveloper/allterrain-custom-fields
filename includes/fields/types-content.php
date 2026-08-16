<?php
/**
 * The content types.
 *
 * Rich text, embeds, and the three that hold media: image, file, gallery.
 *
 * Those three are the reason this plugin exists as a desktop app rather than as
 * an admin screen. An Image field has always been a button that opens a modal
 * over the thing you were editing — and a modal is a bad way to pick a photo,
 * because picking a photo is comparing several, which is the one thing a modal
 * covering the page makes impossible. Here the Media Library is a window you
 * leave open beside the editor, and the picture arrives by being dragged.
 *
 * They declare `'accepts' => array( 'media' )`, and that single line is what the
 * whole drag bridge reads to decide whether a photo mid-flight can land.
 *
 * @package AllTerrain_Fields
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'atcf_register_content_types', 6 );

/**
 * Registers the content field types.
 *
 * @since 0.1.0
 *
 * @return void
 */
function atcf_register_content_types() {
	atcf_register_field_type(
		'wysiwyg',
		array(
			'label'       => __( 'Rich text', 'allterrain-fields' ),
			'description' => __( 'The editor, with a toolbar.', 'allterrain-fields' ),
			'group'       => 'content',
			'icon'        => 'dashicons-editor-bold',
			'value'       => 'string',
			'settings'    => array(
				'default_value' => '',
				'toolbar'       => 'full',
				'media_upload'  => true,
				'rows'          => 8,
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			'accepts'     => array( 'media', 'post', 'text' ),
			'sanitize'    => 'atcf_sanitize_rich_text',
			'control'     => 'atcf_control_wysiwyg',
		)
	);

	atcf_register_field_type(
		'oembed',
		array(
			'label'       => __( 'Embed', 'allterrain-fields' ),
			'description' => __( 'A URL that becomes a video, a tweet or a map.', 'allterrain-fields' ),
			'group'       => 'content',
			'icon'        => 'dashicons-video-alt3',
			'value'       => 'string',
			'settings'    => array(
				'width'  => 640,
				'height' => 360,
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper' ),
			'accepts'     => array( 'text' ),
			'sanitize'    => 'atcf_sanitize_url',
			'format'      => 'atcf_format_oembed',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'image',
		array(
			'label'       => __( 'Image', 'allterrain-fields' ),
			'description' => __( 'One picture. Drag one in from anywhere on the desktop.', 'allterrain-fields' ),
			'group'       => 'content',
			'icon'        => 'dashicons-format-image',
			'value'       => 'number',
			'settings'    => array(
				'return_format' => 'array',
				'preview_size'  => 'medium',
				'library'       => 'all',
				'mime_types'    => '',
				'min'           => '',
				'max'           => '',
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper' ),
			'accepts'     => array( 'media' ),
			'sanitize'    => 'atcf_sanitize_attachment',
			'format'      => 'atcf_format_image',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'file',
		array(
			'label'       => __( 'File', 'allterrain-fields' ),
			'description' => __( 'One upload of any kind.', 'allterrain-fields' ),
			'group'       => 'content',
			'icon'        => 'dashicons-media-default',
			'value'       => 'number',
			'settings'    => array(
				'return_format' => 'array',
				'library'       => 'all',
				'mime_types'    => '',
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper' ),
			'accepts'     => array( 'media' ),
			'sanitize'    => 'atcf_sanitize_attachment',
			'format'      => 'atcf_format_file',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'gallery',
		array(
			'label'       => __( 'Gallery', 'allterrain-fields' ),
			'description' => __( 'Several pictures, in an order you drag.', 'allterrain-fields' ),
			'group'       => 'content',
			'icon'        => 'dashicons-format-gallery',
			'value'       => 'ids',
			'settings'    => array(
				'return_format' => 'array',
				'preview_size'  => 'thumbnail',
				'library'       => 'all',
				'mime_types'    => '',
				'min_items'     => 0,
				'max_items'     => 0,
			),
			'supports'    => array( 'required', 'instructions', 'conditional', 'wrapper' ),
			'accepts'     => array( 'media' ),
			'sanitize'    => 'atcf_sanitize_attachments',
			'format'      => 'atcf_format_gallery',
			'mount'       => true,
		)
	);

	atcf_register_field_type(
		'code',
		array(
			'label'       => __( 'Code', 'allterrain-fields' ),
			'description' => __( 'Monospaced text stored exactly as typed.', 'allterrain-fields' ),
			'group'       => 'content',
			'icon'        => 'dashicons-editor-code',
			'value'       => 'string',
			'settings'    => array(
				'default_value' => '',
				'rows'          => 10,
				'language'      => 'html',
			),
			'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
			// Stored verbatim: a code field whose contents were sanitised would
			// be a code field that cannot hold code. It is never echoed
			// unescaped — `atcf_the_field()` escapes it, and a theme that wants
			// it raw has to say so.
			'sanitize'    => 'atcf_sanitize_code',
			'mount'       => true,
		)
	);
}

/**
 * Sanitises rich text.
 *
 * `wp_kses_post()`, which is the same ceiling the post content itself has —
 * anyone who may write a post may write the same HTML into a field on it, and
 * nobody may write more.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return string Clean HTML.
 */
function atcf_sanitize_rich_text( $value ) {
	return wp_kses_post( is_scalar( $value ) ? (string) $value : '' );
}

/**
 * Stores code exactly as it was typed, minus the null bytes.
 *
 * A code field that ran its contents through `wp_kses` would strip the very
 * thing it exists to hold. The safety is at the other end: nothing echoes this
 * unescaped by default.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return string The value.
 */
function atcf_sanitize_code( $value ) {
	return str_replace( "\0", '', is_scalar( $value ) ? (string) $value : '' );
}

/**
 * Sanitises one attachment id.
 *
 * The id has to point at something that is actually an attachment. A relationship
 * to a deleted photo is a broken image on the front end, and it is cheaper to
 * find out here than in a template.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @return int Attachment id, or 0.
 */
function atcf_sanitize_attachment( $value ) {
	$ids = atcf_to_id_list( $value );

	foreach ( $ids as $id ) {
		if ( 'attachment' === get_post_type( $id ) ) {
			return $id;
		}
	}

	return 0;
}

/**
 * Sanitises a list of attachment ids, order preserved.
 *
 * Order is the value here as much as the ids are — a gallery is a sequence, and
 * sorting or de-duplicating it into a different order silently rearranges
 * somebody's photo essay.
 *
 * @since 0.1.0
 *
 * @param mixed $value Raw value.
 * @param array $field The field definition.
 * @return int[] Attachment ids.
 */
function atcf_sanitize_attachments( $value, $field = array() ) {
	$ids   = atcf_to_id_list( $value );
	$clean = array();

	foreach ( $ids as $id ) {
		if ( 'attachment' === get_post_type( $id ) ) {
			$clean[] = $id;
		}
	}

	$max = (int) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'max_items', 0 );

	if ( $max > 0 && count( $clean ) > $max ) {
		$clean = array_slice( $clean, 0, $max );
	}

	return $clean;
}

/**
 * Everything a theme could want about one attachment.
 *
 * Built once and reused by the image, file and gallery formatters, because a
 * gallery is a list of exactly this and three near-identical builders is three
 * places for the `alt` text to go missing from.
 *
 * @since 0.1.0
 *
 * @param int $id Attachment id.
 * @return array|null The record, or null when the attachment is gone.
 */
function atcf_attachment_record( $id ) {
	$id   = (int) $id;
	$post = $id ? get_post( $id ) : null;

	if ( ! $post || 'attachment' !== $post->post_type ) {
		return null;
	}

	$meta  = wp_get_attachment_metadata( $id );
	$path  = (string) get_attached_file( $id );
	$sizes = array();

	foreach ( (array) atcf_arr( (array) $meta, 'sizes', array() ) as $size => $info ) {
		$src = wp_get_attachment_image_src( $id, $size );

		if ( $src ) {
			$sizes[ $size ] = array(
				'url'    => $src[0],
				'width'  => (int) $src[1],
				'height' => (int) $src[2],
			);
		}
	}

	return array(
		'ID'          => $id,
		'id'          => $id,
		'title'       => $post->post_title,
		'filename'    => wp_basename( $path ),
		'url'         => wp_get_attachment_url( $id ),
		'alt'         => (string) get_post_meta( $id, '_wp_attachment_image_alt', true ),
		'caption'     => $post->post_excerpt,
		'description' => $post->post_content,
		'mime_type'   => $post->post_mime_type,
		'type'        => strtok( (string) $post->post_mime_type, '/' ),
		// Guarded rather than trusted: an attachment row can outlive its file —
		// a half-finished migration, an offloaded uploads directory — and
		// `filesize()` on a path that is not there emits a warning and returns
		// false, which is a PHP notice on the front end of somebody's site.
		'filesize'    => ( '' !== $path && file_exists( $path ) ) ? (int) filesize( $path ) : 0,
		'width'       => (int) atcf_arr( (array) $meta, 'width', 0 ),
		'height'      => (int) atcf_arr( (array) $meta, 'height', 0 ),
		'sizes'       => $sizes,
		'date'        => $post->post_date,
		'author'      => (int) $post->post_author,
	);
}

/**
 * Formats an image field for a template.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored attachment id.
 * @param array $field The field definition.
 * @return array|string|int|null Depending on `return_format`.
 */
function atcf_format_image( $value, $field = array() ) {
	$id     = (int) $value;
	$format = (string) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'return_format', 'array' );

	if ( ! $id ) {
		return 'id' === $format ? 0 : ( 'url' === $format ? '' : null );
	}

	if ( 'id' === $format ) {
		return $id;
	}

	if ( 'url' === $format ) {
		$size = (string) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'preview_size', 'full' );
		$size = '' === $size ? 'full' : $size;
		$src  = wp_get_attachment_image_src( $id, $size );

		return $src ? $src[0] : '';
	}

	return atcf_attachment_record( $id );
}

/**
 * Formats a file field for a template.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored attachment id.
 * @param array $field The field definition.
 * @return array|string|int|null Depending on `return_format`.
 */
function atcf_format_file( $value, $field = array() ) {
	$id     = (int) $value;
	$format = (string) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'return_format', 'array' );

	if ( ! $id ) {
		return 'id' === $format ? 0 : ( 'url' === $format ? '' : null );
	}

	if ( 'id' === $format ) {
		return $id;
	}

	if ( 'url' === $format ) {
		return (string) wp_get_attachment_url( $id );
	}

	return atcf_attachment_record( $id );
}

/**
 * Formats a gallery for a template.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored attachment ids.
 * @param array $field The field definition.
 * @return array The list, shaped by `return_format`.
 */
function atcf_format_gallery( $value, $field = array() ) {
	$ids    = atcf_to_id_list( $value );
	$format = (string) atcf_arr( (array) atcf_arr( $field, 'settings', array() ), 'return_format', 'array' );

	if ( 'id' === $format ) {
		return $ids;
	}

	if ( 'url' === $format ) {
		return array_values( array_filter( array_map( 'wp_get_attachment_url', $ids ) ) );
	}

	return array_values( array_filter( array_map( 'atcf_attachment_record', $ids ) ) );
}

/**
 * Turns a stored embed URL into its embed HTML.
 *
 * `wp_oembed_get()` and not the raw URL, because a template echoing the raw URL
 * is what people write when the field hands them one, and that is a link where a
 * video was wanted.
 *
 * @since 0.1.0
 *
 * @param mixed $value Stored URL.
 * @param array $field The field definition.
 * @return string Embed HTML, or an empty string when the provider is unknown.
 */
function atcf_format_oembed( $value, $field = array() ) {
	$url = (string) $value;

	if ( '' === $url ) {
		return '';
	}

	$settings = (array) atcf_arr( $field, 'settings', array() );
	$html     = wp_oembed_get(
		$url,
		array(
			'width'  => (int) atcf_arr( $settings, 'width', 640 ),
			'height' => (int) atcf_arr( $settings, 'height', 360 ),
		)
	);

	return is_string( $html ) ? $html : '';
}
