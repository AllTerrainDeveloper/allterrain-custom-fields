=== AllTerrain Fields ===
Contributors: allterraindeveloper
Tags: custom fields, repeater, relationships, content model
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Custom fields with every premium feature free — repeaters, flexible content, options pages, blocks and relationships that hold in both directions.

== Description ==

A custom-fields plugin. You drag fields onto a canvas, say where they appear, and
fill them in on the post. Themes read them with `get_field()`.

**Nothing is behind a paywall.** Repeaters, flexible content, galleries, options
pages, Gutenberg blocks, clone fields, bidirectional relationships, conditional
logic and JSON sync are the paid tier of every other plugin in this category.
None of them is technically hard. A repeater is a list. They are all here.

**Your values stay yours.** A field value is an ordinary meta row keyed by the
field's name, so `get_post_meta( $id, 'hero_title', true )` works with no plugin
loaded at all. Every export tool, WP-CLI command and `meta_query` that already
exists keeps working — and a site can move *off* this plugin without a data
migration.

**It answers to `get_field()`.** When nothing else has claimed those names, the
familiar functions work unchanged: same argument order, same return shapes, same
storage underneath. If another plugin already owns those names, it keeps them
and this plugin defines nothing.

= The field palette =

* **Basic** — text, paragraph, number, slider, email, URL, password
* **Content** — rich text, embed, image, file, gallery, code
* **Choice** — dropdown, radios, checkboxes, button group, switch
* **Relational** — post, relationship, page link, taxonomy, user, link
* **Layout** — message, tab, accordion, group, repeater, flexible content, clone
* **Advanced** — date, date & time, time, colour, icon, location, table, JSON, computed

= Relationships that hold in both directions =

A relationship field points one way, so every site with one also has a second
field on the other type, maintained by hand, drifting apart within a month. Turn
on **Mirror on the other side** and the plugin keeps the two consistent: adding
A→B adds B→A, removing it removes it, and deleting either post cleans up whatever
pointed at it. No `save_post` hook anywhere.

= Computed fields without eval() =

A computed field holds an expression over its siblings — `{price} * {quantity} *
(1 + {vat})` — evaluated as you type and again on save. It is a real parser over
a closed set of operators and functions, not `eval()`: it cannot call anything it
was not given, cannot name a variable that is not a field, and cannot loop.

= Showing values without touching a template =

Storing a value is the easy half; every plugin in this category then leaves
"and how do visitors see it?" to your theme, a paid views builder, or a
shortcode with a security history. Here it is built in, four ways:

* **Show on the front end** — switch it on per group and the fields render on
  the post's own page, before or after the content, escaped, themable via
  `allterrain-fields/group.php`. No code at all.
* **Block bindings** — bind a core paragraph, heading, button or image to a
  field (WordPress 6.5+), so the value lives in meta and the layout in blocks.
* **`[atcf field="price"]`** — a shortcode that escapes by default, refuses
  password fields, and will not read a post the visitor could not open.
* **REST** — groups that opt in add an `atcf` object of formatted values to
  the post's REST response, for headless front ends.

= A bulk editor =

One field group, one post type, every post, as a grid. Edit a cell, press Tab,
paste a column in from a spreadsheet. Permission is checked per row, so a user
who may edit thirty-nine of forty posts writes thirty-nine and is told about the
fortieth.

= Better with OpenStation, complete without it =

With the [OpenStation](https://wordpress.org/plugins/desktop-mode/) desktop shell
installed, this plugin becomes a desktop app:

* A **Content Model** window drawing your post types, taxonomies and every
  relationship between them as a graph — draggable, and editable by dragging.
* **Drag a photo** from the Media window straight into an Image field on the post
  you are writing.
* Relationships drawn as **lines between windows**, and listed in the title bar's
  Related menu under the field's own name.
* A **preview** of the edit screen your field group is about to create, paired
  beside the builder and updating as you edit.
* A **Field Inspector** on the wallpaper showing the fields of whichever window
  has focus.

Without it, everything above except the desktop affordances works under **Fields**
in the admin menu. There is deliberately no `Requires Plugins:` header.

= Accessibility =

Every control has a real label bound by `for`; grouped controls are in a
fieldset with a legend. Required is announced with `required`, not with an
asterisk. A field hidden by conditional logic is disabled as well as hidden, so
the browser never asks you to fill in something you cannot see. Dragging is never
the only way to do anything. `prefers-reduced-motion` and `forced-colors` are
both honoured, and the fields work with JavaScript switched off.

== External services ==

The **Location** field talks to OpenStreetMap, and nothing else in the plugin
talks to anyone:

* **Nominatim** (`nominatim.openstreetmap.org`) — when you type an address into
  a Location field in the admin, the text you typed is sent to Nominatim to be
  turned into coordinates. No account, cookie or key is involved.
* **OpenStreetMap embeds** (`www.openstreetmap.org`) — the field's map preview
  is an embedded OpenStreetMap frame loaded for the stored coordinates, with
  `referrerpolicy="no-referrer"`.

Both requests happen only on admin screens, only for the Location field, and
only when someone uses it. See the
[OpenStreetMap privacy policy](https://osmfoundation.org/wiki/Privacy_Policy)
and the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).

== Installation ==

1. Upload the plugin to `wp-content/plugins/`, or install it through **Plugins →
   Add New**.
2. Activate it.
3. Open **Fields → Field Groups** and add a group — or, with OpenStation
   installed, open the Fields tile in the dock.

== Frequently Asked Questions ==

= Can I use this alongside another custom-fields plugin? =

Yes. The plugin never defines a function another plugin has already defined, and
the check happens after every plugin has loaded. When another plugin is active
its `get_field()` wins; this plugin's own `atcf_get_field()` is always available
either way.

= Will values written by another custom-fields plugin work? =

Values stored as ordinary post meta keyed by field name — the convention most
custom-fields plugins use — are readable as-is; nothing in the database is
rewritten. Field *groups* come across through **Fields → Tools → Import from
ACF**, which reads them from the running ACF plugin, from the rows ACF left in
the database after being deactivated, or from a pasted `acf-export-*.json`
file. Groups are matched on key, so importing twice updates rather than
duplicates, and anything that would not convert is reported rather than
dropped silently.

= Can I migrate from Meta Box? =

Yes — **Fields → Tools → Import from Meta Box** reads definitions from the
running Meta Box plugin, from the Builder posts it leaves in the database after
being deactivated, or from a pasted Builder export. Field ids become field
names, so every simple field's values are already where this plugin looks.
Groups and cloneable fields are the exception — Meta Box stores those as one
serialised row — and the import names each one rather than letting you find
out from an empty repeater.

= How do I show a field on the site? =

Five ways, from no code to full control: switch on **Show on the front end**
in the group's settings (renders on the post's page, themable via
`allterrain-fields/group.php`); make the group a **block** and place it in the
content; **bind** a core paragraph, heading, image or button to a field
(WordPress 6.5+); drop **`[atcf field="price"]`** into the content; or call
`get_field( 'price' )` in a template like it is 2012. All of the built-in
paths escape output by default.

= What happens to my data if I delete the plugin? =

The field groups go; the values stay. `hero_title` on a hundred posts is content
somebody wrote, and it stays in ordinary meta rows any theme can still read. A
site that genuinely wants everything gone sets `ATCF_DELETE_ALL_DATA` in
`wp-config.php` before deleting.

= Where are field groups stored? =

As posts, with the schema in one meta row. Nothing lives in a custom table, so
revisions, the trash, search, WP-CLI and every backup plugin already work on your
content model.

= Does the map field need a Google Maps API key? =

No. Geocoding uses OpenStreetMap's Nominatim and the map is a static embed, so
there is no billing account and nothing to expire. Coordinates can always be
typed by hand.

== Screenshots ==

1. The field group builder, with the palette, the canvas and the inspector.
2. Conditional logic drawn as curves between the fields it joins.
3. The Content Model — post types, taxonomies and every relationship between them.
4. Fields on a post editor, with a photo being dragged in from the Media window.
5. The Bulk Editor: one field group across every post, as a grid.

== Changelog ==

= 0.1.0 =
* First release.
