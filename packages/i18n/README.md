# @pdf-insight/i18n

Flat key to string catalogs for Polish and English, a translator that returns the key when a string
is missing, and a parity validator wired into lint.

## Role in the architecture

Every user-facing string of the web app lives here, under a flat dotted key such as
`upload.dropHint` or `error.rate_limited`. Polish is the default locale and English the only other
one. The catalogs are plain JSON in `src/catalogs/`, so a translator can edit them without touching
code. The package has no runtime dependencies and no host globals, and relative imports carry an
explicit `.ts` extension, so the same source runs under Bun, Node (Vitest) and Vite.

A missing string never throws: the translator returns the key itself, so a gap shows up on screen
instead of breaking the page. Gaps are prevented earlier by the parity gate: `bun run lint` runs
`src/validate.ts` after ESLint, which prints nothing when the catalogs match and fails, listing the
gaps, when one catalog has a key the other lacks.

## Key exports

- **Locales**: `SUPPORTED_LOCALES` (`['pl', 'en']`), type `Locale`, `DEFAULT_LOCALE` (`'pl'`),
  `isLocale(value)` (a type guard for values read from storage or the browser).
- **Catalogs**: `catalogs` (`Record<Locale, Catalog>`), type `Catalog` (`Record<string, string>`),
  type `MessageKey` (the union of the keys in `pl.json`, so an unknown key is a type error).
- **Translation**: `createTranslator(locale)` returns `t(key, params?)`; `{name}` placeholders are
  replaced from `params`, and a placeholder without a matching param is left as is. Keys and params
  are looked up as own properties only, so a name such as `constructor` or `toString` never
  resolves to an inherited object member.
- **Parity**: `missingKeys(reference, candidate)` lists, sorted, the keys of `reference` that
  `candidate` lacks as own properties.

## Adding a string

Add the key to both `src/catalogs/pl.json` and `src/catalogs/en.json`; the key set of the two files
must stay identical, and `bun run lint` refuses any difference.

## Scripts

- `bun run test`: Vitest over `src/**/*.spec.ts`.
- `bun run lint`: ESLint with the shared workspace config, then the catalog parity check.
- `bun run typecheck`: `tsc` with the shared base config.
