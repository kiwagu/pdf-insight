const PAGES_HOST = /^([a-z0-9-]+)\.github\.io$/i;

/** The GitHub repository behind a GitHub Pages project site (`<owner>.github.io/<repo>/`).
 *  Anywhere else, a local or preview server for instance, it is null and no link is shown. */
export function repositoryUrl(location: Pick<Location, 'hostname' | 'pathname'>): string | null {
  const owner = PAGES_HOST.exec(location.hostname)?.[1];
  const repo = location.pathname.split('/').find((segment) => segment.length > 0);
  return owner && repo ? `https://github.com/${owner}/${repo}` : null;
}
