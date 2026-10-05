# @pdf-insight/typescript-config

Shared TypeScript compiler settings that every package and app in the monorepo extends.

## Role in the architecture

This package holds no code. It keeps the compiler rules in one place so the pure packages, the
browser app and the serverless function are all type-checked under the same strict settings.
Each workspace's `tsconfig.json` extends one of the files below and adds its own `include` list
(the browser app also its `@/` path alias). Type checking never emits files (`noEmit`); bundling is done by the build tools.

## Key exports

- `base.json`: strict settings shared by everything: ES2022 target, `bundler` module resolution,
  `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, no ambient `types`. Used directly by the
  runtime-independent packages.
- `react.json`: extends `base.json` with the DOM libraries, the `react-jsx` transform and the
  `vite/client` types for the browser app.
- `function.json`: extends `base.json` with the DOM libraries, which supply web-standard globals:
  `Request`, `Response`, `Headers` and `fetch` for the serverless function's handler, `Blob` and
  `setTimeout` for the domain package that runs in both the browser and the function.
