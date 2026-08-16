# AllTerrain Fields — developer documentation

This directory is the **public contract** with plugin and theme authors. It is
not an afterthought: other plugins read it to learn how to integrate, so a change
to a hook without a change here ships a lie.

| Document | What is in it |
|---|---|
| [`architecture.md`](architecture.md) | How the plugin fits together: the schema, the store, the two identifiers, the request lifecycle. Start here. |
| [`hooks-reference.md`](hooks-reference.md) | Every PHP action and filter, with its signature and status. |
| [`field-types.md`](field-types.md) | Registering a field type, including the control that draws it and what it accepts off the desktop. |
| [`javascript.md`](javascript.md) | The bundles, the mount registry, the drag payload types, the DOM contract. |
| [`openstation.md`](openstation.md) | What this plugin asked of the desktop shell, what it got, and what is still missing. |
| [`examples/`](examples/) | Copy-paste recipes. |

## Looking at the front end while you work on it

`bin/harness.html` mounts any one bundle against canned REST responses, with no
WordPress admin around it — including the field runtime, against markup dumped
from the real PHP renderer by `bin/dump-fields.sh`. It never ships.

## Status labels

Every hook and every exported name carries one:

- **Stable** — shipping, and backwards-compatible inside the current major
  version.
- **Experimental** — shipping, but the signature may still change. Use it, and
  expect to read a changelog.
- **Planned** — a reserved name that does not fire yet.

A "Stable" signature changing incompatibly is a breaking change and gets
discussed before it ships.

## The rule this plugin holds itself to

**If a function decides something, wrap it in a filter. If it does something,
fire an action.** When writing any code in this plugin, ask *"can a plugin author
extend or override this?"* If the answer is no, add a hook. When in doubt, add
the hook.

That matters twice over for a plugin whose whole premise is that the paid tier
was never technically hard: the next person's idea is the one that has not been
built yet, and a plugin with no seams is a plugin they have to fork.
