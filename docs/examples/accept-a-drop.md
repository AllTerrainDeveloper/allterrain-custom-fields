# Accepting a dragged field value

This plugin emits `allterrain-fields/value` whenever somebody lifts something out
of a field — an attachment out of a gallery, a related post out of a relationship
field, a row out of a repeater. Any other plugin's native window can catch it.

```js
wp.os.dragManager.registerDropTarget( {
    id: 'my-plugin-inbox',
    element: document.querySelector( '.my-inbox' ),
    acceptLabel: 'Add to the inbox',

    accept: ( payload ) =>
        payload.type === 'allterrain-fields/value' && payload.data.kind === 'post',

    onEnter: ( session ) => session.payload.source.closest( '.my-inbox' ),
    onDrop: ( session ) => {
        const { id, title, thumbnail } = session.payload.data;

        addToInbox( { id, title, thumbnail } );
    },
} );
```

## What the payload carries

```js
{
    type: 'allterrain-fields/value',
    source: HTMLElement,       // the chip or tile that was lifted
    data: {
        kind: 'post' | 'attachment' | 'user' | 'term' | 'repeater-row',
        id: 42,
        ref: '42',             // the same id, spelled the way WP Explorer spells it
        title: 'The Northwind rebuild',
        thumbnail: 'https://…',
        field: 'field_a1b2c3',  // which field it came out of
    },
}
```

**The whole object travels, not just an id.** That is deliberate: a drop target
can render something meaningful the instant the pointer enters, without a REST
round trip mid-drag.

**`ref` is there as well as `id`** because `ref` is the shape WP Explorer's own
`shortcut` payload uses — so a target written against the shell rather than
against this plugin accepts it without knowing anything about this plugin.

## Accepting a whole field group

The Content Model window emits `allterrain-fields/group` when a group tile is
dragged:

```js
accept: ( payload ) => payload.type === 'allterrain-fields/group',
onDrop: ( session ) => {
    const { id, key, title } = session.payload.data;
},
```

## Refusing visibly

The shell's **claimant rule** means a target whose `accept()` returns false still
swallows the drop rather than letting it fall through to whatever is behind it. So
registering a target that refuses is not a no-op — it is how a refusal becomes
*visible* rather than the thing landing somewhere unexpected underneath:

```js
wp.os.dragManager.registerDropTarget( {
    id: 'my-plugin-canvas',
    element: canvas,
    accept: () => false,   // the tiles are the targets, not the canvas
    onDrop: () => undefined,
} );
```

## Going the other way

Emitting a payload of your own is `buildPayload()` plus a `pointerdown`. This
plugin's own tiles do it in about ten lines — see `src/model/index.ts` for the
field-group tile.
