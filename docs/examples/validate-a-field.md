# A site rule the built-ins cannot express

```php
add_filter( 'atcf_validate_field', function ( $errors, $field, $value, $ref ) {
    if ( 'sku' !== $field['name'] || '' === $value ) {
        return $errors;
    }

    if ( ! preg_match( '/^AT-[0-9]{4}$/', (string) $value ) ) {
        $errors[ $field['key'] ] = 'A SKU is AT- followed by four digits.';
    }

    return $errors;
}, 10, 4 );
```

Errors are keyed by **field key**, which is what lets the browser put the message
under the control it belongs to and move focus to the first one. A single
"something was wrong" string at the top of a forty-field screen is not an error
message, it is a scavenger hunt.

## The rules the built-in validator already keeps

Worth knowing so a custom rule does not fight them:

**A field the logic hides is never validated.** `atcf_visible_fields()` runs
first, so your filter is not called for a field that is not on the screen. That is
the single most reported bug in every plugin that shipped conditional logic and
server validation separately, and it is prevented structurally rather than by
remembering.

**A required field gets one message, not two.** If a field is required and empty,
validation stops there — telling somebody a field is empty *and* that its value is
not a valid email is two sentences about one blank box. Your filter still runs;
just be aware the value it sees may be empty.

**A row inside a container is keyed per row**, as `field_key[2]`, so the third
row's email is distinguishable from the ninth's.

## Validating across fields

`atcf_validation_errors` sees the whole submission, which is where a rule about
two fields together belongs:

```php
add_filter( 'atcf_validation_errors', function ( $errors, $groups, $values ) {
    $start = $values['field_start_date'] ?? '';
    $end   = $values['field_end_date'] ?? '';

    if ( $start && $end && strtotime( $end ) < strtotime( $start ) ) {
        $errors['field_end_date'] = 'That is before the start date.';
    }

    return $errors;
}, 10, 3 );
```
