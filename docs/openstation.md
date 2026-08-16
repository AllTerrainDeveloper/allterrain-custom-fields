# OpenStation

What this plugin asked of the desktop shell, what it got, and what is still
missing.

---

## What the shell is for, here

A custom-fields plugin has always been a form builder pointed at a post. That
framing is why every one of them stops at the edit screen — and it is not a
failure of imagination, it is a failure of *surface*. There is one page, so there
is one thing to look at, so a relationship can only ever be a picker and a field
group can only ever be a list.

Three things this plugin does are impossible in a browser tab, and each of them
is a shell framework rather than an idea:

| The thing | The framework | Why a tab cannot do it |
|---|---|---|
| A relationship drawn as a **line between two windows** | `relations` | A tab has one document; there is no second window to draw to |
| A photo **dragged from the Media window into an Image field on the post you are writing** | `dragManager` + the cross-frame bridge | The pointer starts in one document and ends in another |
| The group's fields **rendered by the real renderer, beside the builder, updating as you edit** | the preview pairing | A modal covers the thing you were editing, which is the whole problem |

---

## Surfaces registered

### Windows

| Id | What | Bundle | Placement |
|---|---|---|---|
| `allterrain-fields` | The field group builder | `builder` | `none` |
| `allterrain-fields-model` | The Content Model graph | `model` | `none` |
| `allterrain-fields-bulk` | The Bulk Editor | `bulk` | `none` |
| `allterrain-fields-tools` | Import, export, JSON sync | `tools` | `none` |
| `allterrain-fields-preview` | The paired preview, behind the eye | `builder` | `none` |

All five are **native**, not iframes. That is the decision the rest of the
plugin's behaviour rests on: rendering into the shell's own DOM is what gives a
window `wp.os.dragManager` — one pointer pipeline shared with the wallpaper's
file tiles, WP Explorer, and every other plugin's windows.

All five are `placement => 'none'`, because five tiles for one plugin is five
claims on the same corner of the user's attention. They are reached through one
dock tile with a hover menu.

Each carries its config on the registration rather than through
`wp_localize_script()`, because the lazy-load path bypasses `wp_print_scripts()`
entirely — a window opened for the first time mid-session would otherwise boot
with no config at all.

### The dock tile

One system tile, `order => 6`, with a four-row constellation. The **builder is
first**, and that ordering is load-bearing: a system tile has no landing page, so
the shell runs the first submenu row when its head is clicked. With the Content
Model first, clicking "Fields" would open the graph — the tile would not do what
its own name says.

Each row declares its `windowId`, which lets the flyout list it under "Open
windows" when it already is, rather than offering to open a second copy.

### The wallpaper icon

`register_icon`, position 34, pointing at the builder.

### The widget

`allterrain-fields/inspector` — the **Field Inspector**. A card that shows the
custom fields of whichever window has focus, editable, live.

This is the surface that only exists because the desktop does. In a tab there is
one focus and it is the page, so "the fields of the thing you are looking at" is
a sentence with no meaning. With four windows open it is the most useful sentence
there is.

It works by reading `wp.os.relations.get( windowId )` on `os-window-focused`. The
shell already knows what every window is showing; this asks.

### Commands

Four, one per window, each naming the bundle that serves it so the palette can
load it lazily.

### WP Explorer

Both post types collapse into one **Fields** folder at `order => 16` — below the
built-in Posts, Pages and Media, above the generic plugin folders at 20. A field
group's excerpt is rewritten to say how many fields it has and where it appears,
because a field group's title is the least interesting thing about it.

---

## Relations — the twenty lines that matter most

The shell keeps a per-window *content identity*: what this window is showing, and
what that thing points at. From those it derives groups, draws visible ties on the
desktop, and fills the title bar's **Related** menu.

It already works this out for a post: internal links, embedded media, the
featured image, assigned terms. What it cannot know is that this site's Product
type has a "Case studies" relationship field pointing at three other posts,
because that relationship exists nowhere in the post's content — it exists in
three rows of `wp_postmeta`.

`includes/shell/identity.php` tells it, through two filters:

```php
add_filter( 'openstation_window_content_identity', 'atcf_extend_content_identity', 20, 2 );
add_filter( 'openstation_window_related_entities', 'atcf_related_entities', 20, 3 );
```

Both registered against **both spellings** (`openstation_*` and
`desktop_mode_*`), because a listener for a hook that never fires costs nothing
and is far cheaper than deciding at boot which shell is present — the answer can
change between `plugins_loaded` and the hook firing.

Three rules it follows:

1. **Extend, never replace.** The shell's own detection has already filled in the
   post's links; returning a fresh array would throw all of that away to add three
   ids, which is how an integration makes the feature it hooked worse.
2. **`references`, not `child`.** A related product is not *part of* this product
   — it is something this product points at — and the shell draws the two
   differently on purpose. Claiming containment for a reference makes the desktop
   assert an ownership the data does not have.
3. **Group the Related menu by the field's own label**, so it reads the way the
   content model does:

   ```
   Case studies
     The Northwind rebuild
     Baker & Sons, three years on
   Written by
     Ada Lovelace
   ```

   "Related posts" would be a menu that lists the site. The author's own words
   are a menu that explains it.

The link list is deduplicated (a featured image that is also in a gallery field
arrives twice, and two lines between the same pair of windows reads as a
rendering bug) and capped at 32, which is where the shell caps it too. The
Related rows are budgeted at 24 out of the shell's 64, so the built-in comments,
terms and media rows survive — they are what a user is looking for when they open
the menu out of habit.

---

## Drag

### In the shell

`wp.os.dragManager`, with a same-interface fallback for pages that have no shell.
Not to reimplement the shell, but so there is exactly **one** drag code path — a
builder with two drag implementations is a builder where the fallback is broken
and nobody notices, because the people who would notice are all running the
shell.

The fallback implements the **claimant rule** exactly: a target whose `accept()`
returns false still swallows the drop rather than letting it fall through. Without
that, dropping a field on a container that refuses it lands it on the canvas
behind, which is worse than nothing happening.

### Across the frame boundary

The post editor inside OpenStation is a chromeless iframe, and a pointer that
started on the wallpaper never enters it. The shell forwards `os-drag-over` and
`os-drop` as `postMessage`; `listenForCrossFrameDrops()` answers them, hit-tests
with `document.elementFromPoint()`, and replies `os-drag-accept` so the shell's
ghost shows an accepting cursor rather than a refusing one.

**This is the North Star.** Dragging a photo from the Media window into an Image
field on the post you are writing is the thing a custom-fields plugin has never
been able to do, and it is about sixty lines because the shell already did the
hard part.

### Why pointer events rather than HTML5 drag

HTML5 drag has no programmatic cancel — Escape, alt-tab and system modals all
strand the state — and `setPointerCapture` anywhere in the ancestry silently
stops `dragstart` from firing at all. The one exception is a file dragged off the
operating system, where HTML5 is the only API the browser offers and the drag
originates outside the page anyway.

---

## The preview pairing

`registerTitleBarButton` with `placement: 'right'` and `order: 90` — just before
the shell's own Related button, so the builder's eye lands where every other
window's eye is.

What it opens is not a front-end page. It is **the edit screen the group is about
to create**: the group's fields rendered by `atcf_render_group_fields()`, the same
function the post editor calls, against a real post, with the real controls, and
then mounted with the real runtime.

A preview built from a second, simplified renderer is a preview that is wrong
exactly where it matters.

`atcf_register_titlebar_button_script()` declares the bundle as a provider, which
is what makes the button paint for a session that was already open when the
plugin was activated — without it, the button only appears after a reload, which
is exactly when nobody is looking for it.

---

## Degrading

Every call goes through `shell-api.php`, which resolves a function by its **bare
name** across both prefixes:

```php
atcf_shell_has( 'register_window' );      // is it there at all?
atcf_shell_call( 'register_icon', … );    // whichever spelling this install has
atcf_shell_hooks( 'mode_init' );          // both names, listen to both
```

A lookup rather than a version check, deliberately. A site mid-upgrade, a fork,
or a shell that renames itself a third time all degrade to "no desktop
integration" instead of a fatal error on every request — the same promise the rest
of the plugin makes to sites with no shell at all.

Every registration is wrapped, and a `WP_Error` from one window does not take the
others down: a shell whose validation differs about one window's arguments should
still give the user the other three.

---

## What is still missing

Written down because a wish list nobody records is a wish list nobody grants.

### 1. A drop-accept reply the shell actually reads

`listenForCrossFrameDrops()` posts `os-drag-accept` back to the parent, and as
far as this plugin can tell the shell does not currently act on it. The effect is
that the ghost's cursor does not change when it crosses into an iframe field that
*will* take the drop, so the gesture is right and the feedback is missing. A
documented parent-side handler for it would finish the loop.

### 2. Relations for terms and users

`atcf_sync_relationships()` returns early for anything that is not a post,
because a mirror on a term or a user is coherent and simply not built. The blocker
is on this side, not the shell's — but a shell-level convention for what a
`term/{taxonomy}` root means when the *term* is the thing being edited would
settle the design.

### 3. A window-level "content changed" broadcast

The Field Inspector widget listens for `os-window-content-changed` to notice when
an already-focused window navigates to another post. It also writes through
`wp.os.broadcast()` when it edits a value, so an editor showing the same post can
refresh — but nothing on the other side listens yet, because the editor is
somebody else's iframe. A documented topic the shell relays *into* iframes would
close that.

### 4. Window tabs for the builder

The builder's three panes (Fields / Where it appears / Settings) are its own tab
strip, drawn in its own markup. `Window.setTabs()` exists and would put them in
the window chrome where every other window's tabs are — which is where a user
would look for them. Not adopted yet because the tab state has to survive
switching field groups, and it was not obvious the chrome-level API keeps it.
