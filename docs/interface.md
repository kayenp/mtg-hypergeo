# Interface: the share link, version 1

STE-style, strict level. No STE dictionary was checked.

## Scope

The share link holds all the inputs of the page in the address fragment (the part after `#`).
The fragment works from `file://` and from GitHub Pages, because the browser does not send the fragment to a server.

## Example

```
#v=1&n=60&g=24.2.4.Lands&g=4.1..Combo%20A&min=5&free=0&otp=1&turns=10&seed=1&trials=100000
```

## Format

The fragment is a list of `key=value` parts, with `&` between the parts.
The decoder accepts a fragment with or without the first `#`.

| Key | Input | Value | Default |
|---|---|---|---|
| `v` | format version | `1` | none |
| `n` | deck size | whole number | 60 |
| `g` | one card group | `copies.least.most.name` | see below |
| `min` | smallest hand | whole number | 5 |
| `free` | free mulligans | whole number | 0 |
| `otp` | on the play | `1` (on the play) or `0` (on the draw) | `1` |
| `turns` | turns to show | whole number | 10 |
| `seed` | simulation seed | whole number | 1 |
| `trials` | simulation trials | whole number | 100000 |

- A whole number has 1 to 9 digits and no sign. The page checks each range with the rules of R1 and R3 in `docs/spec.md`.
- Each group has one `g` part. The order of the `g` parts is the order of the groups.
- The decoder splits a `g` value at the first three dots only, because a name can hold dots.
- An empty most count means no limit.
- The encoder writes the name with `encodeURIComponent`. The decoder reads it with `decodeURIComponent`.
- If no `g` part is in a version 1 link, the deck has no groups.
- The default groups are "Lands" (24 copies, least 2, most 4) and "Key card" (4 copies, least 1, no most). The decoder uses them only for a link that it cannot read.

## Limits

- If the fragment has more than 2,000 characters, the page uses all the defaults and shows an issue.
- If the link has more than 6 groups, the page uses the first 6 groups and shows an issue.
- If a name has more than 40 characters, the page cuts the name to 40 characters and shows an issue.

## Bad and missing fields

- If the fragment is empty or has no `v` part, the page uses all the defaults and shows no issue.
- If `v` is a whole number above 1, the page uses all the defaults. The page then shows the issue "This link was made by a newer version of the page. The page shows the default deck."
- If `v` has a different bad value, the page uses all the defaults and shows an issue.
- If a field other than `g` is missing or bad, the page uses the default of that field. The page then shows an issue that names the field.
- If a `g` part is bad, the page leaves out that group and shows an issue that names the group.
- The decoder does not throw an error for any text.
- The page gives each decoded value to the validation, as for a value that the user types.
- The decoder ignores a key that it does not know.

## Versions

- A change to the format needs a new version number.
- A new version of the page keeps the decoder for each old version, so that an old link continues to work.
- Each change gets an entry under "Changes".

## Changes

- Version 1 (2026-11-15): the first version.
