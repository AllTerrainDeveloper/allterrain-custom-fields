# A field type of your own

A rating field: five stars, stored as a number, and it accepts a number dragged
in from anywhere on the desktop.

## The registration

```php
add_action( 'init', function () {
    atcf_register_field_type( 'stars', array(
        'label'       => __( 'Star rating', 'my-plugin' ),
        'description' => __( 'One to five stars.', 'my-plugin' ),
        'group'       => 'advanced',
        'icon'        => 'dashicons-star-filled',
        'value'       => 'number',
        'settings'    => array(
            'max'           => 5,
            'default_value' => 0,
        ),
        'supports'    => array( 'required', 'default', 'instructions', 'conditional', 'wrapper' ),
        'accepts'     => array( 'text' ),
        'sanitize'    => 'my_plugin_sanitize_stars',
        'format'      => 'my_plugin_format_stars',
        'mount'       => true,
    ) );
}, 7 );

/**
 * Clamps to the declared range rather than refusing.
 *
 * The control enforces it live, so a value outside came from an import — and
 * failing a whole import over one number helps nobody.
 */
function my_plugin_sanitize_stars( $value, $field ) {
    $max = (int) ( $field['settings']['max'] ?? 5 );

    return max( 0, min( $max, (int) $value ) );
}

/** Hands a template the number *and* the stars, because it will want both. */
function my_plugin_format_stars( $value, $field ) {
    $max = (int) ( $field['settings']['max'] ?? 5 );

    return array(
        'value' => (int) $value,
        'max'   => $max,
        'stars' => str_repeat( '★', (int) $value ) . str_repeat( '☆', $max - (int) $value ),
    );
}
```

Priority 7, after this plugin registers its own types on 6 and before anything on
10 asks what types exist.

`max` is deliberately a key `atcf_setting_controls()` already describes, so the
inspector draws a number box for it with no further code. Reusing a key is the
point, not a collision.

## The control

`mount => true` means PHP renders a mount point and your bundle fills it.

```js
window.allTerrainFields.registerMount( 'stars', ( { host, field, value, set } ) => {
    const max = Number( field.settings.max ?? 5 );
    let current = Number( value ?? 0 );

    const group = document.createElement( 'div' );

    group.className = 'my-stars';
    group.setAttribute( 'role', 'radiogroup' );
    group.setAttribute( 'aria-label', field.label );

    const buttons = [];

    const paint = () => buttons.forEach( ( button, index ) => {
        button.textContent = index < current ? '★' : '☆';
        button.setAttribute( 'aria-checked', String( index + 1 === current ) );
        button.tabIndex = index + 1 === current || ( ! current && index === 0 ) ? 0 : -1;
    } );

    for ( let star = 1; star <= max; star++ ) {
        const button = document.createElement( 'button' );

        button.type = 'button';
        button.setAttribute( 'role', 'radio' );
        button.setAttribute( 'aria-label', `${ star }` );

        button.addEventListener( 'click', () => {
            // Clicking the star you are already on clears it, which is the only
            // way back to "unrated" once you have picked something.
            current = current === star ? 0 : star;
            set( current );
            paint();
        } );

        buttons.push( button );
        group.append( button );
    }

    // Arrow keys, because a radiogroup that needs the mouse is a radiogroup half
    // the people who need it cannot use.
    group.addEventListener( 'keydown', ( event ) => {
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

        if ( ! step ) {
            return;
        }

        event.preventDefault();
        current = Math.max( 1, Math.min( max, current + step ) );
        set( current );
        paint();
        buttons[ current - 1 ].focus();
    } );

    // Anything dropped on the field arrives here, already filtered against the
    // `accepts` list. The control never has to know what a wallpaper tile is.
    host.addEventListener( 'atcf:text-dropped', ( event ) => {
        const dropped = parseInt( event.detail.text, 10 );

        if ( dropped >= 0 && dropped <= max ) {
            current = dropped;
            set( current );
            paint();
        }
    } );

    host.append( group );
    paint();
} );
```

`registerMount` lives on `window.allTerrainFields` rather than being a module
export, because a plugin distributed as a zip has no build-time relationship with
this one and a global is the only seam a separate IIFE has.

`set()` writes JSON into the hidden input PHP printed beside your mount and
dispatches a bubbling `atcf:changed`, which is what makes conditional logic and
any computed field beside it recalculate.

## A plain-input type instead

If your field really is an input, give it a `control` and it works with
JavaScript switched off:

```php
'control' => function ( $field, $value, $context ) {
    printf(
        '<input type="text" value="%s" %s />',
        esc_attr( (string) $value ),
        atcf_control_attributes( $field, $context ) // phpcs:ignore -- escaped as built
    );
},
```

`atcf_control_attributes()` builds the id, name, `aria-describedby`, `required`,
`readonly`, `placeholder`, `maxlength` and `pattern`. Using it is what keeps a
third-party control's accessibility identical to a built-in's.

## In a template

```php
$rating = get_field( 'rating' );

printf(
    '<span aria-label="%d out of %d">%s</span>',
    $rating['value'],
    $rating['max'],
    esc_html( $rating['stars'] )
);
```
