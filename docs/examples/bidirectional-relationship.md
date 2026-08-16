# A relationship that holds in both directions

Two post types that point at each other, kept consistent with no `save_post` hook
anywhere.

```php
add_action( 'init', function () {
    atcf_register_field_group( array(
        'key'      => 'group_product',
        'title'    => 'Product details',
        'location' => array( array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'product' ) ) ),
        'fields'   => array(
            array(
                'key'      => 'field_product_cases',
                'label'    => 'Case studies',
                'name'     => 'case_studies',
                'type'     => 'relationship',
                'settings' => array(
                    'post_types'    => array( 'case_study' ),
                    'bidirectional' => true,
                    'mirror'        => 'field_case_products',   // ← the far side's key
                ),
            ),
        ),
    ) );

    atcf_register_field_group( array(
        'key'      => 'group_case',
        'title'    => 'Case study details',
        'location' => array( array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'case_study' ) ) ),
        'fields'   => array(
            array(
                'key'      => 'field_case_products',
                'label'    => 'Products',
                'name'     => 'products',
                'type'     => 'relationship',
                'settings' => array(
                    'post_types'    => array( 'product' ),
                    'bidirectional' => true,
                    'mirror'        => 'field_product_cases',
                ),
            ),
        ),
    ) );
}, 20 );
```

Now setting either side sets the other:

```php
atcf_update_field( 'case_studies', array( 42, 43 ), $product_id );

get_post_meta( 42, 'products', true ); // [ $product_id ]
```

…and it holds through every write path: the editor, the Bulk Editor, a REST call,
a WP-CLI import, an AI agent's ability call. Removing one side removes the other.
Deleting either post cleans up whatever pointed at it.

## Things worth knowing

**One mirror per field.** Two would mean a single edge written into two places on
the far side, and nothing could then say which was authoritative when they
disagreed.

**A field may mirror itself.** That is the most useful case of all — "Related
articles" on one post type, where the far side is the same field on another post
of the same type. Set `mirror` to the field's own key.

**Self-edges are dropped.** A post related to itself renders as a card linking to
the page you are already on, and every "related items" loop then has to remember
to exclude the current post — which half of them do not.

**Mirroring onto a single-value field is legal.** One product, many reviews, with
the review's `post_object` field pointing back — the review ends up pointing at
the product that most recently claimed it, rather than the write being silently
dropped.

**Only post-to-post, for now.** A mirror on a term or a user returns early rather
than writing values nothing reads. See
[`../openstation.md`](../openstation.md#2-relations-for-terms-and-users).

## On the desktop

None of the above needs OpenStation. With it, the relationship also becomes a
**line drawn between two windows** and a row in the title bar's Related menu,
grouped under the field's own label — because `includes/shell/identity.php`
announces exactly these values to the shell's relations framework.
