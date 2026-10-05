// Root ESLint configuration. Each workspace keeps its own config, which `turbo run lint` applies
// package by package; this file re-anchors those configs under their directories so an editor
// opened at the repository root and a root-level `eslint .` see exactly the same rules.
import api from './apps/api/eslint.config.js';
import web from './apps/web/eslint.config.js';
import contracts from './packages/contracts/eslint.config.js';
import domain from './packages/domain/eslint.config.js';
import i18n from './packages/i18n/eslint.config.js';
import { base } from '@pdf-insight/eslint-config/base';

const ALL_SOURCES = ['**/*.{js,ts,tsx}'];
const under = (dir) => (pattern) => `${dir}/${pattern}`;

/** Re-anchors a package's flat config entries (files and ignores) under the package directory. */
const scope = (dir, configs) =>
  configs.map((config) => {
    const globalIgnore = Object.keys(config).length === 1 && Array.isArray(config.ignores);
    if (globalIgnore) return { ignores: config.ignores.map(under(dir)) };
    return {
      ...config,
      files: (config.files ?? ALL_SOURCES).map(under(dir)),
      ...(config.ignores ? { ignores: config.ignores.map(under(dir)) } : {}),
    };
  });

/** Applies a config to a fixed file set: the shared ESLint package and this file are plain JavaScript modules. */
const only = (files, configs) =>
  configs
    .filter((config) => !(Object.keys(config).length === 1 && Array.isArray(config.ignores)))
    .map((config) => ({ ...config, files }));

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'supabase/.temp/**',
      'refs/**',
      '.claude/worktrees/**',
    ],
  },
  ...scope('apps/api', api),
  ...scope('apps/web', web),
  ...scope('packages/contracts', contracts),
  ...scope('packages/domain', domain),
  ...scope('packages/i18n', i18n),
  ...only(['eslint.config.js', 'packages/eslint-config/**/*.js'], base),
];
