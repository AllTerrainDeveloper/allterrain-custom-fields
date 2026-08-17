<div align="center">

# AllTerrain Fields

**Custom fields for WordPress with every premium feature free — built as an
[OpenStation](https://wordpress.org/plugins/desktop-mode/) desktop app, where a
relationship is a line drawn between two windows and a photo arrives by being
dragged.**

[![WordPress 6.0+](https://img.shields.io/badge/WordPress-6.0%2B-21759b)](https://wordpress.org)
[![PHP 7.4+](https://img.shields.io/badge/PHP-7.4%2B-777bb4)](https://php.net)
[![Tests](https://img.shields.io/badge/tests-104%20PHP%20%2B%20147%20JS-brightgreen)](#testing)
[![License](https://img.shields.io/badge/license-GPL--2.0--or--later-blue)](LICENSE)

</div>

---

## What it is

A custom-fields plugin. You drag fields onto a canvas, say where they appear, and
fill them in on the post. Themes read them with `get_field()`.

Three decisions shape everything else.

### Nothing is behind a paywall

Repeaters, flexible content, galleries, options pages, blocks, clone fields,
bidirectional relationships, conditional logic, JSON sync — the paid tier of
every other plugin in this category. None of them is technically hard. A repeater
is a list. They are all here, in the free plugin, and the only reason they were
ever sold separately is that somebody could.

### A field group is a schema, not a form

A custom-fields plugin has always been *a form builder pointed at a post*, and
that framing is why every one of them stops at the edit screen. A field group is
really a **schema**. A relationship field is really an **edge in a graph**. A
field value is really a **thing you should be able to drag**.

None of those three are expressible in a browser tab. All three are first-class
in OpenStation.

### Everything is a post, and values are ordinary meta

A field group is a post. Its schema is one meta row. A value is a normal meta row
keyed by the field's **name** — so `get_post_meta( $id, 'hero_title', true )`
works with no plugin loaded at all.

That flat convention is kept deliberately and exactly, because it is the most
valuable thing a custom-fields plugin can offer that has nothing to do with its UI: every
export tool, WP-CLI command, `meta_query` and migration script that already
exists keeps working, and **a site can move off this plugin without a data
migration.**

**OpenStation is optional.** Every shell call sits behind a `function_exists()`
gate. Without the shell this is a complete custom-fields plugin under **Fields**
in wp-admin. There is deliberately no `Requires Plugins:` header.

---

## What the desktop buys

| Shell framework | What it becomes here |
|---|---|
| **Relations** | Every relationship value is announced to the shell, so the post you are editing and the posts it points at are **tied on the desktop** and listed in the title bar's Related menu. Twenty lines of filter, and every relationship anybody has ever modelled becomes navigable. |
| **Drag** | Drag a photo from WP Explorer onto an Image field **on the real post editor** — across an iframe boundary, over the cross-frame bridge. Drag a post onto a Relationship field. Drag a field between two builder windows. Drag a field group onto a post type in the Content Model and its location rule is written. |
| **Preview** | The eye in the builder's title bar opens the group's fields **rendered by the real edit-screen renderer, against a real post**, paired beside the builder. Widen a field, watch it reflow. |
| **Native windows** | The builder, the Content Model graph, the Bulk Editor and Tools are windows, not admin pages — which is what gives them one shared pointer pipeline. |
| **Dock constellation** | One tile, four rows. Not four tiles. |
| **os-controls** | Every control resolves through `<os-*>` when the kit has upgraded, and through the platform when it has not. |
| **Widgets** | A **Field Inspector** on the wallpaper that follows whichever window has focus and edits its fields live. |
| **Abilities** | Five typed abilities, so an AI client can read and write field values with exactly the capability ceiling its user has. |

---

## The Content Model

Every custom-fields plugin lets you build a content model and none of them lets
you **see** one. You get a list of field groups, each with a location rule
written in a sentence, and the shape of the thing exists only in the head of
whoever built it — until they leave.

This window draws it. Post types, taxonomies and people are nodes. Every
relational field is an edge, labelled with the field's own name, with one
arrowhead or two depending on whether it mirrors. It is read straight out of what
is already stored; there is nothing to maintain.

And it is editable, which is the part that needs a desktop:

- **Drag a field group onto a node** and it is assigned there.
- **Drag from one node to another** and a relationship field is created joining
  them — bidirectionally if you say so, in which case the mirror on the far side
  is created at the same time.
- **Click an edge** and the field it represents opens in the builder, in its own
  window, beside this one.

---

## Relationships that hold in both directions

A relationship field points one way. Somebody sets "Related products" and the
other product knows nothing about it — so every site with a relationship field
also has a second one on the other type, maintained by hand, and the two drift
apart within a month. Everybody knows this. It gets fixed by writing a
`save_post` hook, in every project, again.

Here, a field with `bidirectional` on names a `mirror` field on the far side, and
the plugin keeps the two consistent: adding A→B adds B→A, removing it removes it,
and deleting either post cleans up whatever pointed at it. Writing the far side
does not come back round and rewrite this one, because the guard is a set of
*edges already written this request* rather than a depth counter — which would
also stop legitimate second-order updates.

```php
// Setting one side is all it takes.
atcf_update_field( 'case_studies', array( 42, 43 ), $product_id );

// Post 42 now points back, with no save_post hook anywhere.
get_post_meta( 42, 'products', true ); // [ $product_id ]
```

---

## Three worked examples, on the first screen

"Custom fields" is an abstraction with nothing in it until you have seen one.
A blank canvas beside a palette of forty types tells a newcomer nothing about
which of them to reach for — or that a repeater is how you do ingredients, or
that a total can work itself out.

So the builder opens on three real field groups rather than on nothing:

| | What it teaches |
|---|---|
| **Recipes** | Repeaters — ingredients and method as rows. A total time that adds itself up. An allergen field that appears only when the switch beside it is on. |
| **Property listings** | A computed price per square metre over two other fields. A map, a gallery, and the agent who is selling it. |
| **Events** | Dates and times, a capacity that works out the places left, and a ticket price that disappears when the event is free. |

Between them they use twelve field types, three formulas, two conditionals and a
repeater each. Opening one and reading it is the fastest route to knowing what
this plugin does, because it is the real builder with a real group in it —
everything in it can be renamed, rearranged or thrown away, and nothing about the
result remembers it came from a template.

They stay reachable from **Templates** in the group rail, and a plugin can add
its own with
[`atcf_field_group_templates`](docs/hooks-reference.md#atcf_field_group_templates--stable).

---

## Make the post type before you describe it

Every other custom-fields plugin starts one step too late. It assumes a Recipes
post type already exists — that somebody wrote a `register_post_type()` call, or
installed a second plugin to write one. If you have not done that, there is
nothing to attach fields *to*, and nothing in the interface says so.

So there is a **New post type** button — in the Content Model's toolbar, and as
**New custom post type…** in the Fields tile's dock menu, because creating one is
the step *before* everything else in that menu. Two words — "Recipe",
"Recipes" — and four questions phrased about the thing rather than about
WordPress:

- *Visitors can see these on the site* → `public`, `publicly_queryable`, `exclude_from_search`
- *They have a main body of text* → `supports: editor`
- *They have a main image* → `supports: thumbnail`
- *They nest inside each other* → `hierarchical`

The slug, the seventeen labels, the archive and the rewrite rules are worked out
from the two words. It is registered inside the same request, so it is on the
graph before you have finished reading the notice, and in the admin menu on the
next page load.

Removing one **never removes what is stored in it**. The entries stay in
`wp_posts`; remake the type with the same name and they all come back.

---

## The field palette

**Basic** — text, paragraph, number, slider, email, URL, password
**Content** — rich text, embed, image, file, gallery, code
**Choice** — dropdown, radios, checkboxes, button group, switch
**Relational** — post, relationship, page link, taxonomy, user, link
**Layout** — message, tab, accordion, group, repeater, flexible content, clone
**Advanced** — date, date & time, time, colour, icon, location, table, JSON,
computed

Every one is a single `atcf_register_field_type()` call using exactly the API a
third-party plugin would use. There is no privileged path: if a built-in needs
something the registry cannot express, the registry gets a feature rather than
the built-in reaching around it. The test suite proves it — a field type
registered from outside has to reach the palette, normalise its settings,
sanitise on write and format on read with no special handling anywhere.

A field type declares what it will accept off the desktop:

```php
atcf_register_field_type( 'image', array(
    'label'   => __( 'Image' ),
    'accepts' => array( 'media' ),   // ← the whole drag bridge reads this line
    // …
) );
```

`accepts` reaches the DOM as `data-atcf-accepts`, and the drag bridge reads that
attribute and nothing else. There is no list of field types anywhere in the drop
code. Register a type, declare what it takes, and dragging works.

---

## Computed fields without `eval()`

A computed field holds an expression over its siblings — `{price} * {quantity} *
(1 + {vat})`. Every plugin that has grown one implemented it with `eval()`, and
every one of those is a **stored program** that runs as PHP on every save of
every post, settable by an importer, a REST call or a compromised admin session.

This one is a tokeniser and a shunting-yard parser over a closed set: numbers,
the sibling fields it was given, twelve operators and eighteen functions. It cannot
call anything else, cannot name a variable that is not a field, cannot assign and
cannot loop. There is no path from an expression to a PHP callable, because no
part of the file ever builds one.

It is recalculated on **every** write path — a form save, `atcf_update_field()`,
a REST write, the bulk editor, an import, an AI agent's ability call — because a
total that is only correct after somebody opens the editor and presses Save is a
total nobody can rely on.

### The vocabulary

| | |
|---|---|
| **Arithmetic** | `+` `−` `*` `/` `%` `^` and brackets |
| **Comparison** | `>` `<` `>=` `<=` `==` `!=`, joined with `&&` and `\|\|` |
| **Pick one** | `min` `max` `median` `clamp` `if` |
| **Combine** | `sum` `avg` `product` |
| **Round** | `round` `floor` `ceil` `int` |
| **Shape** | `abs` `sign` `sqrt` `pow` `mod` `pct` |
| **Count** | `count` |

Three of those exist because the hand-written version is a trap.
`pct(part, whole)` is `part / whole * 100` guarded against a zero denominator —
the unguarded form is how a price list fills with `INF` the first time something
has no list price. `clamp(n, low, high)` swaps its bounds if you give them the
wrong way round, rather than silently returning the floor forever. And `int(n)`
truncates *toward zero*, so `int(−4.9)` is `−4` where `floor(−4.9)` is `−5` —
which is what "drop the decimals" means to everybody not thinking about negative
numbers.

Argument counts are checked at parse time. `if({a} > 1, {b})` with no else branch
used to evaluate to *something* — a number, stored, indistinguishable from a
right answer. It is now refused like any other malformed expression.

### What a formula can read

The question everybody asks first, and the one a list of functions cannot answer:

| | |
|---|---|
| A number field in this group | `{price}` — the field's **name**, not its label |
| A switch | `{in_stock}` — on is 1, off is 0, so `{price} * {in_stock}` is the price or nothing |
| Another computed field | `{subtotal}` — worked out first, then used |
| **A whole repeater column** | `{lines.amount}` — the Amount field from *every row* |
| A field inside a group | `{address.postcode}` — same dotted form; a group is one row |
| Anything that is not a number | Counts as 0. Nothing breaks; the sum is just smaller |

That fourth row is the one that was missing, and it is the shape people reach for
first — a repeater is a list of line items, and the thing you want from a list of
line items is its total:

```
sum({lines.amount})                                  the column, added up
round(sum({lines.amount}) / count({lines.amount}), 2) the average line
avg({reviews.stars})                                  the average rating
```

A column used on its own is its **total**, so `{lines.amount}` and
`sum({lines.amount})` give the same answer — whichever way somebody guesses, they
are right. `count()` gives the number of rows, which is how you get the per-row
figures `avg()` does not.

### Writing one

The formula box **tokenises as you type**. A name the engine will resolve draws
itself as a chip the moment it is complete; a name it will not draws as a chip
that is visibly wrong, with a sentence underneath saying which name it could not
find. Nothing is rewritten or autocompleted — the text stays exactly what was
typed, so the box is safe to hold a half-finished thought.

Beside it, a palette of the fields in scope and every function, each explaining
itself under the box on hover *and* on focus.

**Editor…** opens the full editor **as its own window, paired with the builder** —
the same convention OpenStation uses for previewing a post. It holds the two
things a 220px sidebar cannot: **the answer** and **the manual**. Put a sample
value against each field and the result recalculates as you type, in the same
engine that will run on the server.

That matters more than it sounds: a computed field is the only field whose value
nobody can see until there is a post to see it on, so getting one right used to
mean guess, save, open a post, fill three fields, save, look.

A window rather than a modal, and the difference shows up immediately in use — a
modal takes the builder away, so you cannot see the field you are writing the
formula *for*, or glance at what its siblings are called. Tile the two instead,
and leave the formula window open across several fields. It does not close when
you press **Use this formula**; it says so and waits. Off the desktop the same
editor opens as a dialog.

The manual names **every parameter** of every function, with a worked example and
a *Try it* button that loads it. `if(test, then, otherwise)` on its own says
nothing about what may go in `test`, and that is exactly where people give up.

---

## The canvas shows the edit screen

A field builder's canvas is usually a list of *descriptions* of fields — an icon,
the label as static text, the type name underneath — with everything about how a
field will look living in an inspector on the right. So it never answers the one
question you opened the builder to answer: **what will this edit screen look
like?**

Every card draws its control instead. A dropdown shows its first option, a choice
field shows its choices, a repeater shows its rows and its own *Add row* wording,
a media field shows a drop target.

Two things stop this drifting from what actually ships:

- **The stylesheet is the real one.** `builder.css` is registered with
  `fields.css` as a dependency, so `.atcf-input`, `.atcf-label` and `.atcf-choice`
  are already defined by the same rules the edit screen uses. Nothing about the
  look is reimplemented.
- **The shapes are a small closed set**, and a test asserts that *every*
  registered type has one — from both sides, against a fixture the PHP suite
  checks against the live registry. A field type added in PHP and forgotten in
  the preview fails a test rather than rendering as a blank card on somebody's
  canvas.

A computed field is drawn as an **answer, not a box to type into**, because the
single most common misunderstanding about computed fields is that somebody fills
them in. Its card carries the formula it is worked out from, the fields it reads,
and an **Edit formula** button — reaching that used to mean selecting the card,
finding the Formula row in the inspector, and pressing Editor. Three steps to the
one thing the field is made of.

What it does not attempt is pixel fidelity for the elaborate types. A location, a
flexible-content block, a gallery render as a labelled placeholder saying what
they are. Claiming to be a faithful preview and being subtly wrong is worse than
being visibly a summary.

---

## Conditional logic you can see

A `LOGIC` badge tells you a field has a condition and nothing about what it is.
To find out you had to select the field, scroll the inspector and read three
dropdowns — and even then you learned about that one field, not about the shape
of the group.

So every card states its condition, and the controller is joined to what it
controls by a labelled curve. Hovering a card dims every curve it does not touch,
which turns *"what does this field affect?"* from a search into a glance.
Computed fields get dashed curves for the same reason: a formula reading
`{price}` is as much a dependency as a condition, and it was previously the only
one nothing visualised.

The condition is drawn as **separated parts**, never as a sentence:

> `SHOWN WHEN` · **In stock?** · *is* · `No, back-ordered`

Both the question and the answer are text somebody typed, so the question ends in
a question mark and the answer contains a comma — the punctuation a sentence
would rely on for structure is inside the content. Chips remove the parsing. A
rule pointing at a deleted field is drawn in red, because that group is genuinely
stuck and it was previously invisible.

---

## The Bulk Editor

One field group, one post type, every post, as a grid. Edit a cell, press Tab,
edit the next one. Paste a column in from a spreadsheet and it fills down.

This screen does not exist anywhere else in the category, and the absence is
strange: the whole promise of structured content is that a field means the same
thing on every post, and the one thing you cannot do with that is *look at the
field across every post*. Filling in forty SKUs means opening forty editors.

Nothing saves until you say so. Permission is checked **per row**, so a user who
may edit thirty-nine of forty posts writes thirty-nine and is told about the
fortieth — refusing all forty over one is how people stop using a tool.

---

## Abilities, so an agent can use it too

The plugin registers ten [WordPress Abilities](https://developer.wordpress.org/plugins/abilities-api/),
in their own `allterrain-fields` category:

| | |
|---|---|
| `list-groups` · `describe-group` | the schema — every field, its meta key, its type, its formula |
| `describe-model` | the whole content model, types and relationships |
| `read-values` · `write-value` · `find-by-value` | the values on a post |
| `list-templates` · `create-group-from-template` | the starter groups |
| `create-content-type` | a custom post type |
| `evaluate-formula` | what a formula comes to, storing nothing |

Two are worth calling out. `describe-group` exists because an agent asked to
"set the price on post 42" cannot guess that the field is named `price`, that it
is a number, or that it lives on posts — and none of that is in the request.
`evaluate-formula` runs the **same** `atcf_calc()` that runs on save, so an agent
can check its own arithmetic before writing; it is deliberately gated at
`edit_posts` rather than `manage_options`, because trying a formula stores
nothing and touches no post.

Everything that reshapes the site — content types, templates, group schemas —
needs `manage_options`, the same capability the builder needs. Reading and
writing a *value* is gated on the capability of the object holding it, which is
the check WordPress would have made anyway.

## Drop-in compatible

There are hundreds of thousands of themes calling `get_field()`. When nothing
else has claimed those names, this plugin answers to them — same argument order,
same return shapes, same storage underneath, so even the values are already where
a theme looks.

Every definition is behind a `function_exists()` check made on `plugins_loaded`
at priority 99. **If another plugin already defines those names, it keeps them
and this file defines nothing.** Two plugins racing to define `get_field()` is a fatal error on every
request; the only safe way to offer a compatible name is to offer it last and
only when it is free.

---

## Accessibility

Not a section that says "we care about accessibility". The things that were
actually done:

- Every control has a real `<label>` bound by `for`. Grouped controls (radios,
  checkboxes, button groups) are in a `<fieldset>` with a `<legend>`, because a
  `<label>` may only point at one control and one above six radios is bound to
  none of them.
- Required is announced with `required`, not with an asterisk — the asterisk is
  `aria-hidden`, because "asterisk" tells a screen-reader user nothing.
- A field hidden by conditional logic is **disabled as well as hidden**.
  Otherwise a required control that is merely invisible still blocks the
  browser's own validation, and the user is told to fill in a field they cannot
  see or reach.
- Every error region exists on render rather than being created when an error
  appears, because a live region has to be in the DOM before the text lands in it.
- Dragging is never the only way to do anything: every palette entry is a
  `<button>` that adds its field, `Alt`+`↑`/`↓` moves a card or a repeater row,
  and the Content Model's nodes are focusable.
- Tabs are a real `role="tablist"` with arrow-key navigation; accordions are
  `<details>`, which the browser's find-in-page can already open.
- `prefers-reduced-motion` and `forced-colors` are both honoured.
- The fields work with JavaScript switched off: a real `POST`, real server
  validation, and every mount point carries the value it already had, so the
  worst case is a field that cannot be *edited* — never one that is silently
  emptied by saving.

---

## Install

```bash
git clone https://github.com/allterraindeveloper/fields.git allterrain-fields
cd allterrain-fields
npm install
npm run build
```

Drop the directory into `wp-content/plugins/` and activate it. With OpenStation
installed the builder appears as a desktop window, a wallpaper icon and a dock
tile; without it, under **Fields** in the admin menu.

Read a value in a template:

```php
the_field( 'hero_title' );                       // escaped
$photo = get_field( 'photography' );             // an array of attachments

while ( have_rows( 'specifications' ) ) {
    the_row();
    printf( '<dt>%s</dt><dd>%s</dd>', esc_html( get_sub_field( 'name' ) ), esc_html( get_sub_field( 'value' ) ) );
}
```

…or the namespaced spellings (`atcf_get_field()`, `atcf_have_rows()`), which are
always available whether or not another custom-fields plugin is installed beside you.

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Builds every bundle, dev and minified, then mirrors into the dev site at 8889 |
| `npm run dev` | Rebuilds the builder bundle on save |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest — the shared conformance suites |
| `npm run env:start` | Starts the **test** environment via `wp-env`, with OpenStation mounted beside it |
| `npm run test:php:site` | PHPUnit inside the dev site's own containers — no second WordPress |
| `npm run test:php` | PHPUnit inside `wp-env` |
| `npm run test:php:local` | PHPUnit against a `WP_TESTS_DIR` you already have |
| `npm run plugin:build` | Typecheck, test, build — everything a release needs |
| `npm run plugin:package` | The above, then `dist/allterrain-fields.zip` |

### Development

There are two WordPresses here and they do different jobs. Confusing them wastes
an afternoon, so:

| | Where | What it is for |
|---|---|---|
| **The dev site** | `../wordpress-alcazaba`, at **http://localhost:8889** | Where you actually look at the plugin. It has OpenStation and the other AllTerrain apps installed, which is the only place the desktop half is real. |
| **The test environment** | `wp-env`, at ports 8920/8921 | A throwaway for `npm run test:php`. Started on demand, stopped the rest of the time. |

Most of the time you do not need the second one. `npm run test:php:site` runs the
suite inside the dev site's *own* PHP container: it is a wordpress-develop
checkout, so it already has the Core test library, a `wp-tests-config.php` and a
`wordpress_develop_tests` database. The plugin is copied in rather than mounted,
so the suite dropping tables cannot reach the working tree or the running site.
`npm run test:php` and `wp-env` remain for CI and for anyone without that
checkout.

`npm run build` ends by mirroring the built tree into the dev site, so every
change reaches http://localhost:8889 with no separate step. Override the
destination with `ATCF_DEPLOY_TARGET`, or skip it with `ATCF_SKIP_DEPLOY=1` — on
CI it finds nothing, says so, and exits successfully.

`npm run env:start` brings up the *test* environment. `.wp-env.json` also mounts
a sibling `../alcazaba-plugin` checkout so the shell is there — without it you
get the plugin's admin-page fallback, which is a complete custom-fields plugin
and not the interesting half.

Then seed something worth looking at:

```bash
# In the test environment:
npx wp-env run cli wp eval-file wp-content/plugins/allterrain-fields/bin/demo.php

# Or on the dev site:
( cd ../wordpress-alcazaba && docker compose run --rm cli \
    wp eval-file wp-content/plugins/allterrain-fields/bin/demo.php )
```

Two post types, three field groups, a bidirectional relationship and a computed
price — enough that the Content Model has a graph to draw.

It registers its post types as an mu-plugin, so think before running it against a
site with real content in it.

Demo data is a *development* convenience and deliberately not a plugin feature. A
plugin that can write posts into a site is a plugin one mis-click away from doing
it to a live one; a file you have to run from a shell is the right amount of
friction.

### Looking at a window without an admin around it

```
http://localhost:8920/wp-content/plugins/allterrain-fields/bin/harness.html
```

A bench that mounts one bundle against canned REST responses — the builder, the
content model, the bulk editor, tools, or the field runtime. No login, no field
groups in a database, and a reload away from any change to the TypeScript.

The field-runtime stage is the one worth knowing about: it mounts against markup
**PHP actually produced**, dumped by `bin/dump-fields.sh`, rather than against a
hand-written approximation. An approximation passes while the real renderer
drifts away from it, which is the one thing a harness must not do.

It lives in `bin/`, which never ships.

---

## Testing

The conditional-logic and formula engines exist **twice** — once in PHP, once in
TypeScript — because the browser hides and shows fields as you type and the
server decides what was actually required. If they disagree, the user is shown a
form they cannot save, with an error about a field they cannot see; or a total
that changes when they press Save.

So they are not tested twice. `tests/fixtures/logic-cases.json` and
`calc-cases.json` hold one table each, and both suites run it:

```
tests/fixtures/logic-cases.json ──┬── tests/vitest/logic.test.ts
                                  └── tests/phpunit/tests/logic.php

tests/fixtures/calc-cases.json  ──┬── tests/vitest/calc.test.ts
                                  └── tests/phpunit/tests/calc.php
```

A case added to one language is a case added to both. This is not theoretical:
writing the tables caught two genuine divergences on the first run — unary minus
parsed as a subtraction, so `3 * -2` was `-2`; and `round( 1.005, 2 )` giving
`1.00` in JavaScript where PHP gives `1.01`. Both were fixed in both engines,
and both have a case in the table now.

```bash
npm test               # 150 TypeScript tests
npm run test:php:site  # 126 PHP tests, 913 assertions, in the dev site's containers
npm run test:php       # the same suite inside wp-env
```

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — how it fits together
- [`docs/hooks-reference.md`](docs/hooks-reference.md) — every action and filter
- [`docs/field-types.md`](docs/field-types.md) — adding a field type
- [`docs/javascript.md`](docs/javascript.md) — the bundles, the mount registry, the drag payloads
- [`docs/openstation.md`](docs/openstation.md) — what this plugin asked of the shell, what it got, and what is still missing
- [`docs/examples/`](docs/examples/) — copy-paste recipes

## Licence

GPL-2.0-or-later.
