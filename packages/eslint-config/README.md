# @pdf-insight/eslint-config

Shared ESLint flat configs for the TypeScript packages and the React app.

## Role in the architecture

Every workspace lints under the same rules, so each `eslint.config.js` only imports one of the
configs below and, where needed, adds its own ignores. The rules are type-aware
(`typescript-eslint` with the project service), forbid `any` and stray `console.log`, require
type-only imports to be marked as such, and leave formatting to Prettier
(`eslint-config-prettier` turns the conflicting stylistic rules off).

## Key exports

- `./base` (named export `base`): ESLint recommended + `typescript-eslint` recommended
  type-checked rules + Prettier compatibility, with the project's stricter rules on top. Used by
  the runtime-independent packages and the serverless function.
- `./react` (named export `react`): everything in `base`, plus for `*.tsx` files the React Hooks
  recommended rules, the React Refresh export check, and a ban on `dangerouslySetInnerHTML`.
  Used by the browser app.
