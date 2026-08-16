# JavaScript

## The bundles

Seven of them, because they load on entirely different schedules. A single bundle
would make every author downloading a post editor also download a graph renderer
they will never open.

| Bundle | Loads when | Size (min) |
|---|---|---|
| `fields` | Any admin screen with a field on it | ~51 KB |
| `builder` | The Field Groups window opens, or its admin page | ~85 KB |
| `model` | The Content Model window opens | ~20 KB |
| `bulk` | The Bulk Editor opens | ~10 KB |
| `tools` | The Tools window opens | ~9 KB |
| `widget` | Somebody has the Field Inspector on their wallpaper | ~44 KB |
| `dock` | Every shell page, at boot | **~1.2 KB** |

`dock` is deliberately tiny and deliberately separate. The tile has to be
registered at boot for every user who can reach it, and loading the builder to
draw a dock icon would make everyone pay for a window most of them will not open
in a given session.

Both a readable and a minified build are committed, which is what makes "download
the zip from a tag and install it" work with no `npm install`. `SCRIPT_DEBUG`
picks the readable one.

## Two globals

```js
window.allTerrainFields     // the runtime config, plus registerMount()
window.allTerrainFieldsL10n // the translated strings the runtime needs
```

The config carries `restUrl`, `nonce`, `adminUrl`, `canManage`, `devMode`,
`dragTypes`, `shell.active`, `shell.chromeless` and — inside a lazily opened
window — arrives through `wp.os.getWindowConfig()` instead of through a script
tag, because the lazy path never runs `wp_print_scripts()`.

## The DOM contract

PHP renders a field as:

```html
<div class="atcf-field atcf-field--image"
     style="--atcf-width:50%"
     data-atcf-field="field_a1b2c3"
     data-atcf-type="image"
     data-atcf-name="hero_image"
     data-atcf-accepts="media"
     data-atcf-conditional='{"enabled":true,…}'>

  <div class="atcf-field__header"><label class="atcf-field__label" for="…">Hero image</label></div>

  <div class="atcf-field__control">
    <div class="atcf-mount"
         data-atcf-mount="image"
         data-atcf-field-json='{…}'
         data-atcf-value="42"
         data-atcf-subs='[…]'>          <!-- containers only -->
    </div>
    <input type="hidden" name="atcf[field_a1b2c3][__json]" value="42" data-atcf-fallback="1" />
  </div>

  <p class="atcf-field__hint" id="…">…</p>
  <p class="atcf-field__error" id="…" role="alert"></p>
</div>
```

Three things in there are load-bearing:

- **`data-atcf-accepts`** is the only thing the drag bridge reads. No list of
  field types exists anywhere in the drop code.
- **The hidden input is a sibling of the mount, not a child**, so a mount that
  replaces its own contents cannot delete the thing that submits.
- **The error region exists on render** rather than being created when an error
  appears. A `role="alert"` element created alongside its text is one a screen
  reader may never announce.

## The mount registry

```js
window.allTerrainFields.registerMount( 'my_type', ( context ) => {
    // context: { host, field, value, set, wrapper }
    // return an optional teardown
} );
```

`set( value )` writes JSON into the hidden input, updates
`host.dataset.atcfValue`, and dispatches a **bubbling** `atcf:changed` on the
field wrapper — which is what makes the form-wide conditional-logic pass and any
computed field beside it recalculate. A control that only wrote its own hidden
input would leave a condition depending on it permanently reading the value the
page loaded with.

## Events the runtime dispatches

| Event | On | `detail` |
|---|---|---|
| `atcf:changed` | The field wrapper, bubbling | `{ field, value }` |
| `atcf:media-dropped` | The mount host | `{ ids: number[] }` |
| `atcf:entities-dropped` | The mount host | `{ ids, titles, urls }` |
| `atcf:text-dropped` | The mount host | `{ text: string }` |

The three drop events are dispatched by `drops.ts` **after** it has decided the
payload is something this field can hold, so a control never has to know what a
wallpaper tile is.

## Drag payload types

Emitted by this plugin, and documented so another plugin can register a drop
target for one:

| Slug | What it carries |
|---|---|
| `allterrain-fields/field` | A field being dragged in the builder. `{ kind: 'new' \| 'existing', type, key, field }` — the **whole field**, not just its key, which is what lets a card dropped into a second builder window be reconstructed there |
| `allterrain-fields/group` | A field group tile from the Content Model. `{ id, key, title }` |
| `allterrain-fields/value` | A value dragged out of a field: an attachment, a related post, a repeater row. `{ kind, id, ref, title, thumbnail }` |

`allterrain-fields/value` carries `ref` as well as `id` deliberately: `ref` is the
shape WP Explorer's own `shortcut` payload uses, so a target written against the
shell rather than against this plugin accepts it without knowing anything about
this plugin.

Accepting one is ordinary:

```js
wp.os.dragManager.registerDropTarget( {
    id: 'my-plugin-target',
    element: myElement,
    accept: ( payload ) => payload.type === 'allterrain-fields/value',
    onDrop: ( session ) => {
        const { kind, id, title } = session.payload.data;
        // …
    },
} );
```

## Payloads this plugin accepts

Everything the shell emits for a dragged entity: `shortcut`, `desktop-file`,
`openstation/file`, `desktop-mode/file`. Both spellings, because the rename from
Desktop Mode to OpenStation went all the way down and this plugin ships to sites
running either. Filterable in PHP through `atcf_accepted_drag_types`.

Plus native `dragover`/`drop` for a file dragged straight off the operating
system — the one place in this plugin where HTML5 drag events are the right tool,
because the drag originates outside the page and no pointer pipeline can see it.

## The formula window's message bus

The formula editor opens as a **native window paired with the builder**, not as a
modal over it — a modal takes the builder away, and you cannot see the field you
are writing the formula for while you write it.

The two talk over the shell's bus (`wp.os.broadcast` / `wp.os.subscribe`). Three
topics, and every message quotes a **session**: a token minted by whichever
builder pressed the button, carried in the window's parameters. Two builders open
on two field groups can each drive the formula window without hearing the other's
messages.

| Topic | Sent by | Payload |
|---|---|---|
| `os.allterrain-fields.formula-hello` | the window, on boot | `{ session }` |
| `os.allterrain-fields.formula-context` | the builder, in reply | `{ session, label, formula, fields, functions }` |
| `os.allterrain-fields.formula-result` | the window, on **Use this formula** | `{ session, formula }` |

**The window speaks first, and that is the load-bearing part.** The obvious
design — the builder broadcasts the context straight after `openWindow()` — is a
race it loses about half the time: a window that was already open receives it, a
window still booting does not. Having the window announce itself when it is ready
removes the timing question rather than narrowing it.

The builder also re-broadcasts the context after opening, for the opposite case:
a window that was **already** open never boots, so it never says hello, and
without that second broadcast pressing *Editor* on a second field would leave the
window showing the first.

The window is a singleton and accepts **any** context, adopting its session
rather than filtering on the one it was born with — otherwise it would go on
showing the first field forever. It does not close on save; it says *"Sent to the
builder"* and waits, because staying open across several fields is the whole
reason it is a window.

With no shell, the same editor opens as an in-page dialog. Same tokeniser, same
reference, same calculator.

## The cross-frame bridge

A pointer that starts in the parent shell never generates an event inside a child
frame. That is a browser security boundary, not an oversight. The shell forwards
the position and the payload as `postMessage` instead:

```
parent → iframe   os-drag-over    { position: { x, y }, payload }
parent → iframe   os-drag-leave
parent → iframe   os-drop         { position: { x, y }, payload }
iframe → parent   os-drag-accept  { accepted: true }
```

`listenForCrossFrameDrops()` turns those back into the same `deliver()` call a
same-frame drop makes, so a photo behaves identically whichever way it arrived.

This is the piece that makes **dragging a photo from the Media window into an
Image field on the post you are writing** work at all, and it is the thing a
custom-fields plugin has never been able to do.

Messages are matched on `event.source === window.parent` rather than on a fixed
origin: the chromeless window is same-origin with its parent by construction (it
is an admin URL on the same site), and a shell that renamed its origin would be a
shell whose iframes had already stopped working for much larger reasons.

## `<os-*>` components

`control( 'os-select', 'select', … )` asks one question — **has this tag actually
upgraded?** — by asking the custom element registry.

Not "is the shell installed" and not "did `loadComponents()` resolve". The kit
registers a subset of its tags at boot and the rest per bundle, so a tag can be
missing after a perfectly successful load, and an `<os-select>` that never
upgraded is an inert element with no value, no keyboard behaviour and no way for
the user to tell that anything is wrong.

`componentsReady()` asks the shell for the kit once per page and caches the
promise, so two bundles booting in the same tab share one fetch instead of racing
two. Nothing ever waits on it before rendering.

## The shared engines

`src/shared/logic.ts` and `src/shared/calc.ts` are the browser halves of the two
engines that also exist in PHP. Both run
`tests/fixtures/{logic,calc}-cases.json`, and the PHP suites run the same files.

If you change one, change both, and add the case that would have caught you. That
is not a slogan: the first run of those tables found unary minus parsed as a
subtraction (`3 * -2` gave `-2`) and `round( 1.005, 2 )` disagreeing between the
two languages.

## Building

```bash
npm run build         # every bundle, dev and minified, then mirror to a local site
npm run dev           # the builder bundle, rebuilt on save
npm run typecheck     # tsc --noEmit
npm test              # vitest
```

Vite in library mode, one IIFE per target, chosen by `ATCF_TARGET`. No jQuery, no
framework, no runtime dependency of any kind — a bundle here is the TypeScript
you wrote and nothing else.
