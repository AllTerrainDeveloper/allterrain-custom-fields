# A field group in code

A field group is the shape of a site's content, which makes it code — and code
belongs in version control rather than in a database row that only exists on
production.

```php
add_action( 'init', function () {
    atcf_register_field_group( array(
        'key'      => 'group_seo',
        'title'    => 'Search appearance',
        'location' => array(
            array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'post' ) ),
            array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'page' ) ),
        ),
        'fields'   => array(
            array(
                'key'          => 'field_seo_title',
                'label'        => 'Title tag',
                'name'         => 'seo_title',
                'type'         => 'text',
                'instructions' => 'Leave blank to use the post title.',
                'settings'     => array( 'maxlength' => 60 ),
            ),
            array(
                'key'      => 'field_seo_description',
                'label'    => 'Meta description',
                'name'     => 'seo_description',
                'type'     => 'textarea',
                'settings' => array( 'rows' => 2, 'maxlength' => 155, 'new_lines' => '' ),
            ),
        ),
    ) );
}, 20 );
```

Read it exactly as you would a stored one:

```php
echo esc_html( get_field( 'seo_title' ) ?: get_the_title() );
```

## Things worth knowing

**Give every key yourself.** A group or field with no `key` is given a random one
on every request, so conditional logic joining on it would break between page
loads. Keys in code are how the group stays the same group.

**The location is an OR of ANDs.** The two clauses above read as *"on posts, and
also on pages"*. Putting both rules in one clause would read as *"on things that
are both a post and a page"*, which matches nothing.

**A stored group with the same key wins.** That ordering is what makes "declare it
in code, then let a site adjust it in the builder" work — which is the whole
reason a site would use both. The builder shows a code-registered group read-only,
because saving it would write a second copy into the database and the file would
win again on the next request, which looks exactly like the builder losing the
edit.

**Priority 20**, so this plugin's own post types and field types (5 and 6) already
exist.
