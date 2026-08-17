# Hooks reference

Every action and filter this plugin fires. Status labels are explained in
[`README.md`](README.md).

---

## Capabilities

### `atcf_can_manage` — Stable

Whether the current user may create, edit and delete field groups.

```php
apply_filters( 'atcf_can_manage', bool $can );
```

Adding a field to a post type is a structural change to the site, so the default
is `manage_options`. A site with an editorial lead who owns the content model and
an administrator who owns the servers is a real and common shape, and the two are
not the same person:

```php
add_filter( 'atcf_can_manage', function ( $can ) {
    return $can || current_user_can( 'edit_others_pages' );
} );
```

### `atcf_can_edit_values` — Stable

Whether the current user may write field values on an object.

```php
apply_filters( 'atcf_can_edit_values', bool $can, string $object_type, int|string $object_id );
```

`$object_type` is one of `post`, `term`, `user`, `option`. The default answers
with WordPress's own capability for the object — never with this plugin's — and a
filter that widens it is widening who may edit that object's content.

---

## The schema

### `atcf_normalize_group` — Stable

The last word on what a field group is. Runs on **every read and every write**, so
a filter here reaches groups stored before it existed.

```php
apply_filters( 'atcf_normalize_group', array $normalized, array $raw );
```

### `atcf_normalize_field` — Stable

The same, per field.

```php
apply_filters( 'atcf_normalize_field', array $normalized, array $raw );
```

### `atcf_groups` — Stable

Every field group on the site. The seam a plugin registering groups in code hooks
into — though `atcf_register_field_group()` is the friendlier way in, and folds
into this filter itself.

```php
apply_filters( 'atcf_groups', array[] $groups, bool $include_inactive );
```

A group added here behaves exactly like one stored in the database, including its
location rules, its blocks and its REST exposure.

### `atcf_groups_for_context` — Stable

The groups that apply to one screen, after the location rules have run.

```php
apply_filters( 'atcf_groups_for_context', array[] $groups, array $context );
```

The last chance to add or remove a group before it renders, and where a *"hide
this group from anyone but an editor"* rule belongs — location rules describe
**where** a group goes, not **who** may see it.

```php
add_filter( 'atcf_groups_for_context', function ( $groups ) {
    if ( current_user_can( 'edit_others_posts' ) ) {
        return $groups;
    }

    return array_values( array_filter( $groups, fn( $group ) => 'group_editorial' !== $group['key'] ) );
} );
```

### `atcf_group_saved` — Stable

Fires after a field group is written.

```php
do_action( 'atcf_group_saved', array $saved, array $submitted );
```

The JSON sync listens to this one.

---

## Field types

### `atcf_field_types` — Stable

The whole registry, filtered on **read** rather than on write — so a filter added
on `plugins_loaded` still reaches types registered on `init`.

```php
apply_filters( 'atcf_field_types', array<string,array> $registry );
```

Removing a type here does not remove values already stored with it; those render
as an unknown type, which says so on the screen rather than dropping the value.

### `atcf_field_type_registered` — Stable

```php
do_action( 'atcf_field_type_registered', string $type, array $definition );
```

### `atcf_field_type_groups` — Stable

The palette groups, and the order the builder shows them in.

```php
apply_filters( 'atcf_field_type_groups', array<string,string> $groups );
```

### `atcf_setting_controls` — Stable

How the inspector draws each setting key. Add an entry and any field type
declaring that key gets the control, with no code in the inspector.

```php
apply_filters( 'atcf_setting_controls', array<string,array> $controls );
```

Each descriptor is `array( 'control' => string, 'label' => string )`. The
`control` names a renderer: `text`, `textarea`, `number`, `switch`, `select`,
`choices`, `post-types`, `taxonomies`, `taxonomy`, `roles`, `field-ref`,
`formula`, `columns`.

A setting no descriptor covers is still offered, as raw text under **Advanced** —
a setting the store honours and the inspector refuses to show is one only
somebody reading the source can reach.

### `atcf_container_types` — Stable

Which field types hold sub-fields. A plugin registering its own container type
has to be in this list or the store will never walk into it.

```php
apply_filters( 'atcf_container_types', string[] $types );
```

### `atcf_field_group_templates` — Stable

The starter templates offered where somebody with no field groups lands, and
behind the **Templates** button in the builder's rail afterwards.

```php
apply_filters( 'atcf_field_group_templates', array<string,array> $templates );
```

Keyed by slug. Each entry is:

| Key | Type | What it is |
| --- | --- | --- |
| `slug` | `string` | Matches the array key. Appears in the REST path. |
| `label` | `string` | Card title. |
| `description` | `string` | A sentence, shown on the card. |
| `icon` | `string` | A dashicon class. |
| `teaches` | `string[]` | Chips on the card — what somebody *learns* from opening it, not what it contains. |
| `group` | `array` | Anything `atcf_normalize_group()` accepts. |

Field keys inside `group` are **symbolic** — `field_recipe_serves`. Every one is
replaced with a freshly minted key when the template is applied, and every
conditional rule is rewritten through the same map, so applying one template
twice gives two independent groups rather than two whose logic points at each
other's fields. Write the symbolic keys however you like; just make the
`conditional` rules name the same strings.

Formulas need no such treatment: they name sibling fields by **name**, which is
what the author reads on screen.

```php
add_filter(
	'atcf_field_group_templates',
	function ( $templates ) {
		$templates['podcast'] = array(
			'slug'        => 'podcast',
			'label'       => 'Podcast episodes',
			'description' => 'Audio, guests, a running time and chapter markers.',
			'icon'        => 'dashicons-microphone',
			'teaches'     => array( 'File fields', 'Repeaters' ),
			'group'       => array(
				'title'    => 'Episode',
				'location' => array( array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'post' ) ) ),
				'fields'   => array(
					array( 'key' => 'field_pod_audio', 'name' => 'audio', 'label' => 'Audio', 'type' => 'file' ),
				),
			),
		);

		return $templates;
	}
);
```

---

## Content types

### `atcf_content_types` — Stable

Every content type this plugin registers. A plugin can add one without it being
stored, which is how a theme ships a content type its users can see on the
graph but cannot delete by accident.

```php
apply_filters( 'atcf_content_types', array[] $types );
```

Each entry is the shape `atcf_normalize_content_type()` returns: `slug`,
`singular`, `plural`, `icon`, `public`, `hierarchical`, `editor`, `thumbnail`,
`excerpt`, `archive`, `taxonomies`.

### `atcf_content_type_args` — Stable

The arguments a content type is registered with, before `register_post_type()`
sees them. The form asks about seven things; `register_post_type()` takes forty.
This is where the other thirty-three go.

```php
apply_filters( 'atcf_content_type_args', array $args, array $type );
```

```php
// Every content type made here goes under a shared menu.
add_filter(
	'atcf_content_type_args',
	function ( $args ) {
		$args['show_in_menu'] = 'edit.php?post_type=atcf_field_group';

		return $args;
	}
);
```

### `atcf_reserved_type_slugs` — Stable

Slugs a content type may not use. Not a security boundary — the capability check
is — but the thing that stops somebody registering `post` a second time.

```php
apply_filters( 'atcf_reserved_type_slugs', string[] $reserved );
```

### `atcf_model_location_params` — Stable

Which location parameters attach a field group to which kind of node on the
Content Model. A plugin adding a location parameter meaning "this post type"
adds it here and the graph understands it.

```php
apply_filters( 'atcf_model_location_params', array<string,string> $params );
```

Keys are location parameter names; values are the node-id prefix — `''` for a
post type, `'taxonomy:'` for a taxonomy, `'user'` for the People node.

### `atcf_ability_*` — Stable

The plugin registers its abilities on **`wp_abilities_api_init`**, and its
category on `wp_abilities_api_categories_init` — the categories hook fires first,
and an ability naming a category that does not exist yet is refused with a
`_doing_it_wrong()` notice nobody reads.

It also listens on the pre-Core spelling `abilities_api_init`, for a site running
the feature plugin. The registrar is guarded so a site firing both registers each
ability once.

Filter the set with the Abilities API's own hooks; this plugin adds none of its
own on top.

### `atcf_model_node_field_limit` — Stable

How many fields a Content Model box names before it says "and N more". A box is a
diagram, not a list table — ten rows is about where one stops being readable at a
glance.

```php
apply_filters( 'atcf_model_node_field_limit', int $limit, string $node_id );
```

### `atcf_content_type_saved` — Stable

```php
do_action( 'atcf_content_type_saved', array $type );
```

### `atcf_content_type_deleted` — Stable

Fires after the definition goes. **The entries stored under the type are not
touched** — recreating the type with the same slug brings all of them back.

```php
do_action( 'atcf_content_type_deleted', int $id );
```

---

## Values

### `atcf_pre_save_value` — Stable

A value on its way to storage, **before** sanitisation — so a filter here sees
exactly what was submitted, which is what a filter normalising a legacy format
needs.

```php
apply_filters( 'atcf_pre_save_value', mixed $value, array $field, array $ref, string $path );
```

### `atcf_saved_value` — Stable

```php
do_action( 'atcf_saved_value', mixed $value, array $field, array $ref, string $path );
```

### `atcf_load_value` — Stable

A value on the way out.

```php
apply_filters( 'atcf_load_value', mixed $value, array $field, array $ref, bool $formatted );
```

`$formatted` says whether the field type's own formatter has already run. A
filter that ignores it will run on both the raw and the formatted read, which is
almost never what was meant.

### `atcf_submission_saved` — Stable

Fires after a whole submission is written, once per object.

```php
do_action( 'atcf_submission_saved', array $ref, array[] $groups, array $values );
```

---

## Validation

### `atcf_validate_field` — Stable

One field's errors. The seam for a site rule the built-ins cannot express.

```php
apply_filters( 'atcf_validate_field', array $errors, array $field, mixed $value, array $ref );
```

```php
add_filter( 'atcf_validate_field', function ( $errors, $field, $value ) {
    if ( 'sku' === $field['name'] && $value && ! str_starts_with( $value, 'AT-' ) ) {
        $errors[ $field['key'] ] = 'Every SKU starts with AT-.';
    }

    return $errors;
}, 10, 3 );
```

### `atcf_validation_errors` — Stable

Every error for a submission, keyed by field key.

```php
apply_filters( 'atcf_validation_errors', array $errors, array[] $groups, array $values, array $ref );
```

---

## Conditional logic

### `atcf_logic_operators` — Stable

The operators the builder offers, as `operator => label`.

```php
apply_filters( 'atcf_logic_operators', array<string,string> $operators );
```

**Adding one here without teaching the evaluator about it produces a rule that
always fails**, which reads as the condition being ignored. The PHPUnit suite
asserts that every offered operator is one `atcf_normalize_operator()` recognises,
so a half-added operator fails the build rather than a site.

---

## Location rules

### `atcf_location_params` — Stable

The parameters the rule editor offers, grouped.

```php
apply_filters( 'atcf_location_params', array[] $params );
```

Each entry is `array( 'param' => string, 'label' => string, 'choices' => string )`,
where `choices` names a list in `atcf_location_choices`.

### `atcf_location_choices` — Stable

The choice lists those parameters draw from.

```php
apply_filters( 'atcf_location_choices', array<string,array> $choices );
```

### `atcf_location_test` — Stable

The result of one rule. **`null` means no built-in test handled this parameter**,
which is the seam a plugin adding a parameter fills. Returning null leaves the
rule unmatched, so an unknown parameter never accidentally shows a group
everywhere.

```php
apply_filters( 'atcf_location_test', bool|null $match, array $rule, array $context );
```

```php
// A rule that matches only on posts with a featured image.
add_filter( 'atcf_location_params', function ( $params ) {
    $params[0]['params'][] = array(
        'param'   => 'has_thumbnail',
        'label'   => 'Has a featured image',
        'choices' => 'yes_no',
    );

    return $params;
} );

add_filter( 'atcf_location_choices', function ( $choices ) {
    $choices['yes_no'] = array( '1' => 'Yes', '0' => 'No' );

    return $choices;
} );

add_filter( 'atcf_location_test', function ( $match, $rule, $context ) {
    if ( 'has_thumbnail' !== $rule['param'] ) {
        return $match;
    }

    return has_post_thumbnail( $context['post_id'] ) === ( '1' === $rule['value'] );
}, 10, 3 );
```

---

## Relationships

### `atcf_relationship_graph` — Experimental

The site's content model as edges. What the Content Model window draws.

```php
apply_filters( 'atcf_relationship_graph', array[] $edges );
```

### `atcf_mirror_written` — Experimental

Fires each time one side of a bidirectional relationship is rewritten.

```php
do_action( 'atcf_mirror_written', array $mirror, int $target, int $source, bool $added );
```

---

## Blocks

### `atcf_block_markup` — Stable

A field-group block's rendered markup.

```php
apply_filters( 'atcf_block_markup', string $markup, array $group, array $data );
```

---

## Options pages

### `atcf_options_pages` — Stable

Every options page on the site, keyed by slug.

```php
apply_filters( 'atcf_options_pages', array[] $pages );
```

---

## The JSON sync

### `atcf_json_dir` — Stable

Where field group JSON is written. Defaults to `atcf-json` in the active theme.
Point it at a directory an earlier plugin left behind and a migrating site keeps
its files where they already are.

```php
apply_filters( 'atcf_json_dir', string $dir );
```

Return an empty string to switch the sync off entirely, which is the right answer
on a site whose theme directory is not writable and whose deploys do not carry
the files anyway.

---

## Assets and the desktop

### `atcf_runtime_config` — Stable

The blob every bundle reads as `window.allTerrainFields`.

```php
apply_filters( 'atcf_runtime_config', array $config );
```

Everything in it reaches anybody who can open an admin screen with a field on it,
so a filter adding to it is adding to a payload with a wide audience.

### `atcf_accepted_drag_types` — Experimental

The shell drag payload slugs the field runtime is willing to look inside.

```php
apply_filters( 'atcf_accepted_drag_types', string[] $types );
```

Listed rather than guessed because the Explorer's payload slug has already
changed once, in the rename from Desktop Mode to OpenStation.

---

## Compatibility

### `atcf_template_compatibility` — Stable

Whether to define the drop-in template function names (`get_field()`,
`have_rows()`, …) when nothing else has claimed them.

```php
apply_filters( 'atcf_template_compatibility', bool $enabled );
```

Return false on a site that would rather keep the namespace clear — because it is
mid-migration and wants the fatal error that tells it a template was missed,
rather than the silence that hides it.

### `atcf_import_acf_type_map` — Experimental

The ACF-to-AllTerrain field type map the importer translates through. Almost
every slug is identical; this map holds the strays (`google_map` → `location`,
`icon_picker` → `icon`). A plugin porting a custom ACF field type adds its own
slug here and the importer stops flagging it.

```php
apply_filters( 'atcf_import_acf_type_map', array $map );
```

### `atcf_import_acf_group` — Experimental

A field group converted from ACF, just before it is saved. The place to carry
a setting the conversion has no opinion about, or to veto a group by returning
an empty array.

```php
apply_filters( 'atcf_import_acf_group', array $group, array $acf, array $warnings );
```

### `atcf_import_acf_field` — Experimental

The same, per field.

```php
apply_filters( 'atcf_import_acf_field', array $field, array $acf, array $warnings );
```

The importer itself is two REST routes under `allterrain-fields/v1`, both
gated on `atcf_can_manage()`:

- `GET /import/acf` — what there is to import from: whether ACF is active, how
  many `acf-field-group` posts the database holds, and a summary of every
  group found (running plugin first, database leftovers second).
- `POST /import/acf` — imports. A body carrying `groups` converts a pasted ACF
  export; a body carrying `keys` imports that subset of what the site holds;
  an empty body imports everything detected. Groups are matched on key, so
  importing twice updates rather than duplicates. The response lists, per
  group, whatever would not convert.

### `atcf_import_metabox_type_map` — Experimental

The Meta-Box-to-AllTerrain field type map the importer translates through. A
plugin porting a custom Meta Box field type adds its own slug here and the
importer stops flagging it.

```php
apply_filters( 'atcf_import_metabox_type_map', array $map );
```

### `atcf_import_metabox_group` — Experimental

A field group converted from a Meta Box definition, just before it is saved.
The place to carry a setting the conversion has no opinion about, or to veto a
box by returning an empty array.

```php
apply_filters( 'atcf_import_metabox_group', array $group, array $box, array $warnings );
```

### `atcf_import_metabox_field` — Experimental

The same, per field.

```php
apply_filters( 'atcf_import_metabox_field', array $field, array $mb, array $warnings );
```

The importer itself is two REST routes under `allterrain-fields/v1`, both
gated on `atcf_can_manage()`:

- `GET /import/metabox` — what there is to import from: whether Meta Box is
  active and a summary of every definition found (the `rwmb_meta_boxes`
  filter first, the Builder's `meta-box` posts second — the latter survive
  Meta Box being deactivated).
- `POST /import/metabox` — imports. A body carrying `boxes` converts a pasted
  Builder export (or hand-written `rwmb_meta_boxes` arrays); a body carrying
  `ids` imports that subset of what the site holds; an empty body imports
  everything detected. Field keys are minted deterministically from the box
  id and field path, so importing twice updates rather than duplicates. The
  response lists, per group, everything worth knowing — including which
  fields' stored values do not share a storage layout and will start fresh.

---

## Functions a plugin may call

| Function | Status | What it does |
|---|---|---|
| `atcf_register_field_type( $type, $args )` | Stable | Registers a field type. See [`field-types.md`](field-types.md). |
| `atcf_unregister_field_type( $type )` | Stable | Removes one. |
| `atcf_register_field_group( $group )` | Stable | Registers a group in code. Shown read-only in the builder. |
| `atcf_add_options_page( $args )` | Stable | Registers an options page in code. |
| `atcf_get_field( $selector, $object, $formatted )` | Stable | Reads a value. |
| `atcf_update_field( $selector, $value, $object )` | Stable | Writes one, syncing mirrors and recomputing totals. |
| `atcf_get_fields( $object, $formatted )` | Stable | Every value on an object. |
| `atcf_get_field_object( $selector, $object )` | Stable | The definition with its value attached. |
| `atcf_have_rows()` / `atcf_the_row()` / `atcf_get_sub_field()` | Stable | The repeater loop. |
| `atcf_count_rows( $selector, $object )` | Stable | A row count without loading the rows. |
| `atcf_delete_field( $selector, $object )` | Stable | Deletes a value, and a container's rows with it. |
| `atcf_block_field( $selector, $formatted )` | Stable | Reads a field inside a block template. |
| `atcf_recompute( $ref )` | Experimental | Recalculates every computed field on an object. |
| `atcf_relationship_graph()` | Experimental | The content model as edges. |

## Abilities

Registered on `abilities_api_init`, and only when `wp_register_ability()` exists.

| Ability | Capability |
|---|---|
| `allterrain-fields/list-groups` | `atcf_can_manage` |
| `allterrain-fields/describe-model` | `atcf_can_manage` |
| `allterrain-fields/read-values` | `edit_post` on the named post |
| `allterrain-fields/write-value` | `edit_post` on the named post |
| `allterrain-fields/find-by-value` | `edit_posts`, then filtered per result |

There is deliberately **no ability that restructures the schema.** "Add a field to
every product" is a change a person should make while looking at the
consequences.
