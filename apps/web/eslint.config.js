import { react } from '@pdf-insight/eslint-config/react';

export default [
  ...react,
  {
    // Generated shadcn primitives export their variant helpers next to the component, and the
    // i18n module keeps its provider and hooks together; fast refresh reloads those files instead.
    files: ['src/components/ui/**/*.tsx', 'src/lib/i18n.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
];
