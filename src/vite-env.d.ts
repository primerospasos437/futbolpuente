/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origen del API Express (vacío = misma origen / proxy de Vite en dev). En Cloudflare Pages: URL pública del backend. */
  readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
