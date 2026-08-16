# Adding a field type

Every built-in type is one `atcf_register_field_type()` call using exactly the
API below. There is no privileged path: if a built-in needs something the
registry cannot express, the registry gets a feature rather than the built-in
reaching around it.

That rule is the only thing that keeps a registry honest. The moment one built-in
is special, the API documents a subset of what the plugin can actually do — and
the test suite asserts it: a field type registered from a test has to reach the
palette, normalise its settings, sanitise on write and format on read with no
special handling anywhere.

## The smallest useful type

```php
add_action( 'init', function () {
    atcf_register_field_type( 'twitter_handle', array(
        'label'       => __( 'Twitter handle', 'my-plugin' ),
        'description' => __( 'A username, stored without the @.', 'my-plugin' ),
        'group'       => 'basic',
        'icon'        => 'dashicons-twitter',
        'value'       => 'string',
        'sanitize'    => function ( $value ) {
            return sanitize_text_field( ltrim( (string) $value, '@' ) );
        },
        'format'      => function ( $value ) {
            return $value ? '@' . $value : '';
        },
        'control'     => 'my_plugin_render_handle',
    ) );
}, 7 );
```

Priority 7, after this plugin registers its own on 6 and before anything on 10
asks what types exist.

## Everything a type can declare

| Key | Type | What it does |
|---|---|---|
| `label` | string | **Required.** The name in the palette. |
| `description` | string | One line explaining when to reach for it. Shown as the palette entry's tooltip. |
| `group` | string | Palette group: `basic`, `content`, `choice`, `relational`, `layout`, `advanced`, or one you add through `atcf_field_type_groups`. Default `basic`. |
| `icon` | string | Dashicons class. |
| `value` | string | What it holds: `string`, `number`, `boolean`, `ids`, `array`, `object`, `none`. Read by the store (whether to unserialize), the bulk editor (whether a column is editable inline) and the REST schema. `none` means the type holds nothing at all — a tab, a message — and **no meta row is ever written for it**. Default `string`. |
| `settings` | array | Type-specific settings as `key => default`. |
| `supports` | string[] | Generic features: `required`, `default`, `instructions`, `conditional`, `wrapper`, `readonly`, `multiple`, `sub_fields`. |
| `accepts` | string[] | What it will take off the desktop: `media`, `post`, `user`, `term`, `text`. See below. |
| `sanitize` | callable | `( mixed $value, array $field ) => mixed`. Runs on **every** write, from any source. |
| `format` | callable | `( mixed $value, array $field, array $ref ) => mixed`. Turns the stored value into what a template gets. |
| `control` | callable | `( array $field, mixed $value, array $context ) => void`. Echoes the edit-screen control. |
| `mount` | bool | Force the JavaScript mount point even with a `control`. |

### `settings` and the inspector

A type declares its settings as `key => default`. That is enough for the store,
and not enough for the inspector — it needs to know whether `min` is a number box
or a dropdown. Rather than make every type repeat a control descriptor, the
shapes are described once in `atcf_setting_controls()` and matched **by key**.

So this:

```php
'settings' => array(
    'min'         => 0,
    'max'         => 100,
    'placeholder' => '',
    'choices'     => array(),
),
```

…gets two number boxes, a text box and the full choice editor, with no code in
the inspector. Reusing a key that already has a descriptor is the point, not a
collision.

A key nothing describes is still offered, as raw text under **Advanced**. Add a
descriptor to give it a real control:

```php
add_filter( 'atcf_setting_controls', function ( $controls ) {
    $controls['handle_style'] = array( 'control' => 'select', 'label' => 'Style' );

    return $controls;
} );
```

### `accepts` — the whole drag bridge, in one line

```php
'accepts' => array( 'media' ),
```

That reaches the DOM as `data-atcf-accepts="media"`, and the drag bridge reads
that attribute **and nothing else**. There is no list of field types anywhere in
the drop code, no `switch` on `image` versus `gallery`.

The consequence: register a type, declare what it takes, and dragging a photo
from WP Explorer onto it works — including across the iframe boundary onto a real
post editor, which is the case the shell forwards as `postMessage` because a
pointer that started in the parent never enters a child frame.

| Value | What lands |
|---|---|
| `media` | Attachments, from WP Explorer, the wallpaper, another field's gallery, or a file dragged straight off the operating system (uploaded on arrival) |
| `post` | Any post-backed entity |
| `user` | People |
| `term` | Terms |
| `text` | Anything, by its title. Deliberately last: a Text field should not win a drop an Image field beside it could have taken |

An empty `accepts` means the field refuses every drop — **visibly**, because the
shell's claimant rule means a target that says no still swallows the drop rather
than letting it fall through to whatever is behind it.

### `control` versus `mount`

Give a `control` when the field is a plain input. It runs server-side and works
with JavaScript switched off:

```php
function my_plugin_render_handle( $field, $value, $context ) {
    printf(
        '<input type="text" value="%s" %s />',
        esc_attr( (string) $value ),
        atcf_control_attributes( $field, $context ) // phpcs:ignore -- escaped as built
    );
}
```

`$context` carries `id`, `name`, `prefix`, `ref` and `describedby`.
`atcf_control_attributes()` builds the id, name, `aria-describedby`, `required`,
`readonly`, `placeholder`, `maxlength` and `pattern` for you — using it is what
keeps a third-party control's accessibility identical to a built-in's.

Omit `control` (or set `mount => true`) when the field genuinely cannot be a
plain input. PHP then renders a mount point and your bundle fills it:

```js
window.allTerrainFields.registerMount( 'twitter_handle', ( { host, field, value, set } ) => {
    const input = document.createElement( 'input' );

    input.value = String( value ?? '' );
    input.addEventListener( 'change', () => set( input.value ) );

    host.append( input );

    return () => input.remove();   // optional teardown
} );
```

`registerMount` is published on `window.allTerrainFields` rather than exported as
a module, because a plugin distributed as a zip has no build-time relationship
with this one and a global is the only seam a separate IIFE has.

**What `set()` does, and why the indirection matters.** It writes JSON into a
hidden input that PHP printed beside your mount, and dispatches a bubbling
`atcf:changed`. That is what makes the whole runtime safe to fail: if your mount
throws, never runs, or is for a type no bundle registered, the hidden input still
holds what was there — so the worst outcome is a field that cannot be *edited*
this page load, never one that is silently emptied by saving.

### Receiving drops in a mount

`drops.ts` decides whether a payload is something your field can hold, and then
dispatches on your mount host. You listen:

```js
host.addEventListener( 'atcf:media-dropped', ( event ) => {
    // event.detail.ids — attachment ids
} );

host.addEventListener( 'atcf:entities-dropped', ( event ) => {
    // event.detail.ids / .titles / .urls
} );

host.addEventListener( 'atcf:text-dropped', ( event ) => {
    // event.detail.text
} );
```

An event rather than a callback, because your control may not have mounted yet —
a repeater row added a frame ago is still rendering — and because it means a
third-party control listens for exactly what the built-in ones do.

## Containers

A type that holds other fields has to say so:

```php
add_filter( 'atcf_container_types', function ( $types ) {
    $types[] = 'my_accordion_set';

    return $types;
} );
```

Without that the store never walks into it, so its sub-values are never written
and never read — and nothing anywhere reports the problem.

`atcf_field_sub_fields()` is asked for the sub-fields; it reads
`settings.sub_fields` for everything except flexible content, which keeps one
list per layout.

## Formatting: what a theme actually gets

`format` is where the difference between a usable field and an annoying one
lives.

- Return **a number for a number**. `get_post_meta()` hands back strings, so a
  theme doing `get_field( 'rating' ) > 4` was comparing a string to an integer.
- Return **a real boolean for a switch**, not `'1'`.
- Return **everything about an attachment** rather than an id, because the fields
  people want — the URL, the `alt`, the sizes — are spread across three different
  core functions.
- Do **not** return a `WP_User`. A template echoing one gets an
  object-to-string error, and the fields people want are spread across `WP_User`,
  `get_avatar_url()` and `get_author_posts_url()`.

## Sanitising: the rules that are not obvious

- **An empty number stays an empty string, not zero.** "Nobody has filled this
  in" and "somebody said zero" are different, and collapsing them is how a price
  field on an unedited post starts reading "Free".
- **A boolean stores as `'1'` or `'0'`, never as PHP's `false`.** `false`
  serialises to an empty string, which is indistinguishable from "never set" —
  and a site querying `meta_value = '0'` for every post with the switch off needs
  the row to exist and to say so.
- **Clamp rather than reject** for ranges and lengths. The control already
  enforces them live, so a value outside came from an import, and failing a whole
  import over one long string helps nobody.
- **A date stores sortably.** A field holding `3 March 2026` is a field nobody
  can order by, and `meta_query` with `type => DATE` assumes `Y-m-d`.
- **A type with no sanitiser gets `sanitize_text_field()`**, never nothing. An
  unsanitised default would mean a plugin that forgot the callback had built an
  unfiltered write into every screen its field appears on.

## Unregistering

```php
atcf_unregister_field_type( 'twitter_handle' );
```

Fields already using it keep their values — the store never consults the registry
to *read* a raw meta row — and render as an unknown type, which says so on the
screen rather than silently dropping the value on the next save.
