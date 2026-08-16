=== AllTerrain Fields ===
Contributors: allterraindeveloper
Tags: custom fields, acf, repeater, relationships, content model
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
storage underneath. With Advanced Custom Fields active, ACF owns them and this
plugin defines nothing.

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

== Installation ==

1. Upload the plugin to `wp-content/plugins/`, or install it through **Plugins →
   Add New**.
2. Activate it.
3. Open **Fields → Field Groups** and add a group — or, with OpenStation
   installed, open the Fields tile in the dock.

== Frequently Asked Questions ==

= Can I use this alongside Advanced Custom Fields? =

Yes. The plugin never defines a function another plugin has already defined, and
the check happens after every plugin has loaded. With ACF active you use ACF's
`get_field()`; this plugin's own `atcf_get_field()` is always available either
way.

= Will my existing ACF values work? =

They are stored in exactly the same place, so yes for values. Field *groups* need
importing: export them from ACF as JSON and paste them into **Fields → Tools**.

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
