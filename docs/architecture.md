# Architecture

## The shape of it

```
                         ┌──────────────────────────────────────┐
 the builder ───REST───▶ │  schema.php   the normaliser         │
 an import   ───REST───▶ │  atcf_normalize_group()              │
 a plugin  ──in code───▶ │                                      │
                         └──────────────┬───────────────────────┘
                                        │ one canonical shape
                    ┌───────────────────┼────────────────────┐
                    ▼                   ▼                    ▼
            location.php          render/*.php           blocks.php
          where it appears      what it looks like     registered blocks
                    │                   │
                    └─────────┬─────────┘
                              ▼
                          save.php ──▶ validation.php ──▶ store.php
                       one submission        refuse           ordinary meta
                              │                                    │
                              ▼                                    ▼
                     relationships.php                        api.php
                   the other side of the edge            get_field() et al
```

Two ideas carry most of the weight.

## One normaliser, and everything downstream trusts it

`atcf_normalize_group()` decides what a field group *is*. The builder posts
whatever it likes, an import brings whatever another plugin wrote five years ago, and
`atcf_register_field_group()` brings a hand-written array — all three arrive at
the same structure, with every key present and correctly typed.

Everything downstream reads `$group['settings']['position']` without checking,
and that is safe because of this one function. The alternative — every consumer
defending itself with `isset()` — is how a plugin ends up with forty subtly
different opinions about whether `required` can be the string `"0"`.

The filter `atcf_normalize_group` runs on **every read and every write**, so a
filter added today reaches groups stored last year. That is what makes it usable
for adding a field to somebody else's group without editing their JSON.

## Two identifiers, and the difference is load-bearing

| | Example | Changes? | Who joins on it |
|---|---|---|---|
| **key** | `field_a1b2c3` | Never | Conditional logic, clones, bidirectional mirrors, JSON sync, the submitted form |
| **name** | `hero_title` | Whenever somebody renames the field | The store, and only the store |

Names change: somebody renames "Sub heading" to "Standfirst" and every value
already written under the old name would be orphaned if anything but the store
cared. Keys do not.

**The form is keyed by key.** Inputs are named `atcf[field_a1b2c3]`, and the save
handler walks the schema and reads by key — so renaming a field between rendering
a page and pressing Save cannot land a value in the wrong row.

**The store is keyed by name.** `team_0_name` is what a template author reads,
and nothing below the store has ever heard of `field_a1b2c3`.

The translation happens in exactly two functions — `atcf_value_for_client()` on
the way out and `atcf_unwrap_row()` on the way back. Getting that pair
asymmetric is how a repeater renders its rows correctly and then saves them all
empty.

## Storage

A value is an ordinary meta row keyed by the field's **name**, with a companion
row keyed `_name` holding the field's **key**.

```
wp_postmeta
  hero_title        "The big one"
  _hero_title       "field_a1b2c3"
  team              "2"                ← a repeater's row count
  team_0_name       "Ada"
  team_1_name       "Grace"
  address_city      "Málaga"           ← a group has no index
  blocks            a:1:{i:0;s:4:"hero";}   ← flexible content's layout list
  blocks_0_heading  "Welcome"
```

Two rows per value looks wasteful until you need the second one, and you always
do: the value row says `42` and nothing else on earth says whether that is a post
id, an attachment id or the number forty-two.

This convention is kept deliberately, and the reasons are all about what
*else* keeps working:

- `get_post_meta( $id, 'hero_title', true )` works with no plugin loaded.
- `meta_query` finds posts by field value, with no join table.
- Every export tool, WP-CLI command and REST meta route already works.
- A site can move **off** this plugin without a data migration.

The nesting layout is the same convention, and it means a repeater with forty
rows is forty small rows rather than one 400KB serialized blob where changing one
name rewrites all of it.

### What is never inflated

`maybe_unserialize()` is called only on the types that actually store an array.
Calling it on every value would happily inflate *a string a person typed* that
happens to look like serialized data — a data-integrity bug and, historically,
the shape of a PHP object-injection vulnerability. When it is called, it is with
`allowed_classes => false`.

## Two capability ceilings, and they are different on purpose

| | Capability | Why |
|---|---|---|
| **Schema** — creating and editing field groups | `manage_options`, filtered by `atcf_can_manage` | Adding a field to a post type is a *structural* change to the site, for everybody |
| **Values** — filling a field in | The capability of the object: `edit_post`, `edit_term`, `edit_user`, `manage_options` | A value belongs to the post, term, user or option it hangs off |

A contributor should be able to write into a field on their own draft without
being able to add a field to every post on the site. Every check in the plugin
keeps that line, and the bulk-write route checks **per object** rather than once
for the request.

## The request lifecycle

```
init@5    post types register (before anything asks what fields a type has)
init@6    field types register
init@20   the shell's windows, icon, widget and commands register
init@30   blocks register from groups that asked for one

admin screen
  add_meta_boxes  → atcf_groups_for( atcf_post_context( $post ) )
                  → one metabox per matching group
                  → atcf_render_group_fields() emits plain HTML

save_post       → atcf_has_submission()   nonce + the form marker
                → atcf_save_submission()  the schema decides, not the request
                → atcf_validate_submission()
                → atcf_save_fields()      hidden fields skipped, not cleared
                → atcf_recompute()        computed fields, from stored values
```

### Three rules the save path never breaks

1. **The schema decides, not the request.** The submission is walked by iterating
   *the fields that belong on this object* and looking each up in the payload —
   never by iterating the payload. A crafted POST naming a field that is not on
   this screen writes nothing.
2. **A hidden field is not cleared.** Conditional logic is re-evaluated
   server-side and a hidden field is skipped entirely. Otherwise every save wipes
   the fields that were merely not applicable that day.
3. **Absent is not empty.** A key missing from the payload means "this control
   was not on the form"; a key present and empty means "somebody cleared it".
   Collapsing the two is how a metabox that failed to render deletes a site's
   content.

The **form marker** (`atcf_present`) is what makes rule 3 possible at all. A post
saved from a quick edit, a bulk edit, an autosave or another plugin's
`wp_update_post()` has no `atcf` key, and without the marker that is
indistinguishable from a form where the user cleared everything.

## The two engines that exist twice

Conditional logic and the formula evaluator each exist in PHP and in TypeScript,
because the browser has to hide a field the instant its dependency changes and
the server has to decide what was actually required when the save arrives.
Neither can do the other's job.

They are not tested separately. `tests/fixtures/logic-cases.json` and
`calc-cases.json` hold one table each and both suites run it. Writing those
tables caught two genuine divergences on the first run.

## Rendering: plain HTML, upgraded in place

PHP prints a `<label>` and an `<input>`. No `<os-*>` tag is printed by PHP, and
that is deliberate.

A field renders in four places that do not share a JavaScript environment: the
classic editor, the block editor's metabox area, a term or user screen, and
inside an OpenStation chromeless iframe. The component kit is reachable in one of
them by default. Printing `<os-text-field>` where the kit has not loaded gives an
inert custom element — a field that looks like nothing and stores nothing — and
the failure is invisible until somebody's post loses its subtitle.

So the runtime upgrades in one direction only. The worst case is a plain input,
never a missing one.

The types that genuinely cannot be a plain input — relationships, galleries,
repeaters, maps — render a **mount point**: a `<div>` carrying the field
definition and the value as JSON, plus a **hidden input holding that same value**.
The hidden input is what submits when the enhancement never runs, so a JavaScript
error means a field that cannot be *edited* this page load, never one that is
silently emptied by saving.

## Where the desktop attaches

Four files, all gated behind `function_exists()` through `shell-api.php`:

| File | What it does |
|---|---|
| `shell/openstation.php` | Registers one native window with four tabs (the builder as the main tab; Content Model, Bulk Editor and Field Tools via `register_window_tab()`), a wallpaper icon, a widget, four commands, and the drag payload constants. The shell swaps the tab panes in place, like the submenu tabs on an admin-page window; a second window for side-by-side work is one `openNewWindow()` away |
| `shell/identity.php` | Turns relationship values into the shell's content-identity links and Related-menu rows — the file that makes a relationship a line on the desktop |
| `shell/preview.php` | The fifth window, behind the eye in the title bar |
| `shell/explorer.php` | Puts field groups in one folder in WP Explorer, with useful excerpts |

`shell-api.php` resolves function names across both spellings the shell has had
(`openstation_*` and `desktop_mode_*`). It is a lookup rather than a version
check, so a site mid-upgrade, a fork, or a shell that renames itself again all
degrade to "no desktop integration" instead of a fatal error on every request.

## Starter templates

`includes/templates.php` holds three worked field groups — recipes, property
listings, events — and the builder shows them wherever there is no group open.

They are built server-side and handed back already saved:

```
POST /allterrain-fields/v1/templates/<slug>   →   a normal, saved field group
```

Rather than shipped to the browser as schema for it to assemble. The reason is
the keys. A template's field keys are symbolic placeholders, and both the keys
*and* every conditional rule that points at one have to be rewritten together —
`atcf_group_from_template()` mints a fresh key per field and rewrites the rules
through the same map. Do that in the browser and applying one template twice
produces two groups whose conditionals cross over, which shows up months later
as a field that hides according to a switch in a different group.

The picker itself is drawn from `templates` on the `/config` response —
slug, label, description, icon, what it teaches, and a field count. Not the field
definitions: three cards do not need three schemas to draw, and the schema is
minted at the moment one is chosen anyway.

Nothing about the resulting group remembers it was a template. That is
deliberate — a starter that stayed special would be a starter nobody dared edit.

Extend the set with [`atcf_field_group_templates`](hooks-reference.md#atcf_field_group_templates--stable).

## Content types you make yourself

A field group has to live *on* something, and every other custom-fields plugin
assumes that something already exists — that somebody has written a
`register_post_type()` call, or installed a second plugin whose whole job is to
write one. That is a fine assumption for a developer and useless for anybody
else.

`includes/content-types.php` closes the gap. One post per type in
`atcf_content_type`, definition in post meta, registered on `init` at priority 7
— after this plugin's own types at 5, before the default 10 where themes and most
plugins hook, so anything reading `get_post_types()` on `init` sees them.

Two words in, everything else worked out:

| Asked | Derived |
|---|---|
| Singular, plural | Seventeen labels, the slug (≤20 chars), the archive, the rewrite rules |
| Four switches | `public`, `publicly_queryable`, `exclude_from_search`, `hierarchical`, `supports`, `has_archive` |

`register_post_type()` takes forty arguments and thirty-three of them are wrong
to ask about before somebody has any content. Those live in
[`atcf_content_type_args`](hooks-reference.md#atcf_content_type_args--stable).

**Deleting a type never deletes its entries.** The rows stay in `wp_posts` under
the old post type; recreating the type with the same slug brings every one of
them back. Removing a content type is routinely a change of mind about a name,
and a delete that takes two hundred recipes with it is a delete nobody dares
press.

Types are registered inside the same request that creates them, so the Content
Model that comes back from the save already contains the new node — no reload,
and a field group can be dropped on it immediately.

## What is deliberately not here

- **No custom tables.** Everything is a post, a term, a user or an option.
- **No `eval()`, anywhere.** See `includes/calc.php`.
- **No admin-ajax.** The windows are REST clients, which means the routes are
  exercised by every save anybody makes rather than only by the people who read
  the documentation.
- **No `Requires Plugins: desktop-mode`.** The shell is optional and the plugin
  is complete without it.
