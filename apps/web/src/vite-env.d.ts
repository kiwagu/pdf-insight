/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Link to the source repository shown in the footer; no link when unset. */
  readonly VITE_REPOSITORY_URL?: string;
}
