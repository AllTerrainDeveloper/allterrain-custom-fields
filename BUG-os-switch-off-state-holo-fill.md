# BUG — `<os-switch>` paints the Holomesh in its **off** state

**Component:** `src/ui/components/os-switch/`
**Severity:** visual, every switch on every screen
**Scope:** `os-switch` only — no other component applies `os-holo-fill` unconditionally

## What happens

An unchecked switch renders with the full Holomesh gradient in its track. A
checked one renders flat. The two states are the wrong way round: the control
is loudest when it is off, and the mesh — which the design system reserves for
identity moments — is spent on every switch on the screen that nobody has turned
on.

It also defeats `tone`. `tone="accent" | "danger" | "success"` correctly changes
the **on** colour, so a settings panel that opts out of the mesh still shows a
row of iridescent **off** switches.

## Why

`os-switch.ts:208` puts the class on the track unconditionally — it is a static
attribute in the template, not bound to `checked`:

```ts
<button
  type="button"
  role="switch"
  class="os-holo-fill"
  ...
```

`holo.ts` then declares, at **class** specificity:

```css
.os-holo-fill {                            /* (0,1,0) */
	background-color: transparent;
	background-image: var( --_holo-fill );
	...
}
```

…and `os-switch.styles.ts` tries to reset it at **element** specificity:

```css
button {                                   /* (0,0,1) — loses */
	background-color: var( --_holo-track );
	background-image: none;
	box-shadow: inset 0 0 0 1px var( --_holo-track-edge );
}
```

A class selector beats an element selector regardless of source order, so
`background-image: none` never applies and `--_holo-track` never paints —
`background-color: transparent` wins too.

The checked rule is specific enough to win, which is why only the off state is
affected:

```css
:host( [ checked ] ) button { ... }        /* (0,1,1) — wins */
:host( [ tone='success' ][ checked ] ) button { ... }   /* (0,2,1) — wins */
```

The comment above the checked rule shows the intent was the opposite of what
ships:

> ON. Flat accent, not the mesh: toggles arrive a dozen to a settings page, and
> the brand reserves meshes for hero surfaces.

## Suggested fixes

Either would do; the second matches the stated intent more closely.

**1. Match the specificity of the reset.** One selector, no template change:

```css
button.os-holo-fill {                      /* (0,1,1) */
	background-color: var( --_holo-track );
	background-image: none;
}
```

**2. Only claim the class when the track is actually lit.** The class then means
what it says, and a caller re-enabling a mesh through its own tokens — which the
existing comment describes as the reason the class stays on — still works,
because it is present exactly when the track is filled:

```ts
class=${ checked ? 'os-holo-fill' : '' }
```

## Note on the token escape hatch

Re-pointing `--os-ui-holo-track` from a consumer scope does **not** work around
this, because the same offending rule sets `background-color: transparent`. The
only consumer-side workaround is to re-point `--os-ui-holo-fill` itself to a flat
colour, which is a blunt instrument — it disables the mesh for every control in
that subtree, not just the unlit switches.

## Reproduction

```html
<os-switch label="Off"></os-switch>
<os-switch label="On" checked></os-switch>
<os-switch label="Off, accent tone" tone="accent"></os-switch>
```

Expected: three flat tracks, one lit.
Actual: the two unchecked tracks carry the mesh; the checked one is flat.

## Where this was found

AllTerrain Fields (`allterrain-fields`), whose field inspector is a column of a
dozen switches. Currently worked around in `assets/css/fields.css` by
re-pointing `--os-ui-holo-fill` to a flat grey on the plugin's own roots; that
block is marked for deletion once this is fixed.
