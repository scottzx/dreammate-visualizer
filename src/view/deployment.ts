/**
 * Deployment facts for the view layer.
 *
 * `VITE_STANDALONE_DEMO=1` is set only by `npm run build:demo`, which emits a
 * self-contained static copy into `docs/demo/` for GitHub Pages. That build has
 * no observer backend: it renders the isolated demo scenario entirely in the
 * browser and never calls `/api`.
 */
const viteEnv = import.meta.env as ImportMetaEnv | undefined;

export const STANDALONE_DEMO = viteEnv?.VITE_STANDALONE_DEMO === '1';

/**
 * Resolve a repository-relative asset path against the Vite base. The Pages
 * build uses `--base ./`, so the demo can live under any project sub-path while
 * the observer build keeps `/`.
 */
export function assetUrl(path: string): string {
  const base = viteEnv?.BASE_URL || '/';
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
