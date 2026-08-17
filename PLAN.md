# AllTerrain Fields — the plan

Custom fields for WordPress with every premium feature free, built as an
[OpenStation](https://wordpress.org/plugins/desktop-mode/) desktop app.

The premise: a custom-fields plugin has always been a *form builder pointed at a
post*. That framing is why every one of them stops at the edit screen. A field
group is really a **schema**, a relationship field is really an **edge in a
graph**, and a field value is really a **thing you should be able to drag**.
None of those three are expressible in a browser tab, and all three are
first-class in OpenStation.

## What the shell buys us that no custom-fields plugin ever had

| Shell framework | What it becomes here |
|---|---|
| **Relations** | A relationship field is a real desktop tie. Open a post and the posts its relationship fields point at are in the title bar's Related menu and drawn as edges on the wallpaper. |
| **Drag** | Drag a photo from WP Explorer onto an Image field **on the real edit screen** (cross-iframe bridge). Drag a post onto a Relationship field. Drag a field between two builder windows. Drag a field group onto a post type in the Content Model and it is assigned. |
| **Preview** | The eye in the builder's title bar opens the group's fields rendered exactly as the edit screen will render them, paired beside the builder. Change a field, watch it change. |
| **Native windows** | The builder, the Content Model graph, the Bulk Editor and Tools are windows, not admin pages. |
| **Dock constellation** | One tile, five rows — not five tiles. |
| **os-controls** | Every control in the builder *and every field on the edit screen* is an `<os-*>` component when the shell is there. |
| **Widgets** | A Field Inspector on the wallpaper that follows whatever window has focus and edits its fields live. |
| **Files on the desktop** | A field group is a desktop file. Put your content model on your wallpaper. |
| **Abilities** | Fourteen typed abilities, so an AI client can read and write field values with the same capability checks a human gets. |

**OpenStation is optional.** Every shell call sits behind a `function_exists()`
gate. Without the shell this is a complete custom-fields plugin under **Fields**
in wp-admin.

## Decisions

### Everything is a post, and values live in ordinary meta

A field group is a post. Its schema is JSON in one meta row. A *value* is a
normal meta row keyed by the field's **name** — `get_post_meta( $id,
'hero_title', true )` works with no plugin API at all — with a companion
`_hero_title` row holding the field key, which is how the plugin knows which
field type wrote it. That flat storage convention is the right one:
it means every export tool, WP-CLI command, REST route and `meta_query` that
already exists keeps working.

### The logic and formula engines exist twice, and are tested once

Conditional logic and computed fields run in the browser (to hide a field as you
type) and on the server (to decide what was actually required). Two
implementations of one rule table is how a user gets shown a form they cannot
save. So `tests/fixtures/*.json` holds one case table and both suites run it.

### The registry has no privileged path

Every built-in field type is one `atcf_register_field_type()` call using exactly
the API a third-party plugin would use. If a built-in needs something the
registry cannot express, the registry gets a feature.

## Build order

1. **Foundation** — bootstrap, post types, schema normalisation, field-type registry, storage, location rules, template API + drop-in `get_field()` shims.
2. **Rendering** — field controls, metaboxes for post / term / user / options, save + validate, REST.
3. **Shell** — `shell-api.php`, windows, icon, widget, commands, dock constellation, relations, drag payloads, preview.
4. **Builder** — palette, canvas, inspector, location editor, logic map.
5. **Content Model** — the graph window.
6. **Field runtime** — the edit-screen controls, repeater / flexible / gallery, cross-frame drop targets.
7. **Tools** — import / export, JSON sync with a diff, bulk editor.
8. **Tests and docs.**
