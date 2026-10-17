/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API origin for production builds (empty = same origin, e.g. behind a reverse proxy). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
