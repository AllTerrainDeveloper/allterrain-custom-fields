# Showing a field group to some people

Location rules describe **where** a group goes, not **who** may see it. Adding a
"user role" rule to a group on a post type would be asking the wrong question:
the rule engine is answering *"is this the Products screen?"*, and the role of
whoever is looking at it is a different axis entirely.

The right seam is `atcf_groups_for_context`, which runs after the location rules
and is the last chance to add or remove a group before it renders.

```php
add_filter( 'atcf_groups_for_context', function ( $groups, $context ) {
    if ( current_user_can( 'edit_others_posts' ) ) {
        return $groups;
    }

    // Contributors and authors do not see the editorial workflow group at all.
    return array_values(
        array_filter( $groups, fn( $group ) => 'group_editorial' !== $group['key'] )
    );
}, 10, 2 );
```

## This hides, it does not protect

A group filtered out here never renders, so its fields are never submitted and
`atcf_save_submission()` never writes them — the save path iterates the groups
that apply to *this user on this screen*, so a crafted POST naming one of those
fields writes nothing either.

What it does **not** do is stop somebody reading the values. `get_field()` and the
REST object route are gated on the object's own capability, which is the right
ceiling for a value. If a field holds something that must not be read by an
author, filter `atcf_load_value` as well — or, better, do not put it on a post
they can edit.

## The whole content model, not one group

`atcf_can_manage` gates the *builder*, the Content Model, the Bulk Editor, Tools
and every schema REST route:

```php
// Let the editorial lead own the content model without owning the servers.
add_filter( 'atcf_can_manage', function ( $can ) {
    return $can || current_user_can( 'edit_others_pages' );
} );
```
