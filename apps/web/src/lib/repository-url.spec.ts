import { describe, expect, it } from 'vitest';
import { repositoryUrl } from './repository-url';

describe('repositoryUrl', () => {
  it('derives the repository from a GitHub Pages project site', () => {
    expect(repositoryUrl({ hostname: 'octo.github.io', pathname: '/pdf-insight/' })).toBe(
      'https://github.com/octo/pdf-insight',
    );
  });
  it('returns null outside GitHub Pages or without a project path', () => {
    expect(repositoryUrl({ hostname: 'localhost', pathname: '/pdf-insight/' })).toBeNull();
    expect(repositoryUrl({ hostname: 'octo.github.io', pathname: '/' })).toBeNull();
    expect(repositoryUrl({ hostname: 'github.io', pathname: '/x/' })).toBeNull();
  });
});
