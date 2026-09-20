/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly FIREBASE_API_KEY?: string;
  readonly FIREBASE_AUTH_DOMAIN?: string;
  readonly FIREBASE_DATABASE_URL?: string;
  readonly FIREBASE_PROJECT_ID?: string;
  readonly FIREBASE_STORAGE_BUCKET?: string;
  readonly FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly FIREBASE_APP_ID?: string;
  readonly FIREBASE_DEV_API_KEY?: string;
  readonly FIREBASE_DEV_AUTH_DOMAIN?: string;
  readonly FIREBASE_DEV_DATABASE_URL?: string;
  readonly FIREBASE_DEV_PROJECT_ID?: string;
  readonly FIREBASE_DEV_STORAGE_BUCKET?: string;
  readonly FIREBASE_DEV_MESSAGING_SENDER_ID?: string;
  readonly FIREBASE_DEV_APP_ID?: string;
  readonly FIREBASE_PROD_API_KEY?: string;
  readonly FIREBASE_PROD_AUTH_DOMAIN?: string;
  readonly FIREBASE_PROD_DATABASE_URL?: string;
  readonly FIREBASE_PROD_PROJECT_ID?: string;
  readonly FIREBASE_PROD_STORAGE_BUCKET?: string;
  readonly FIREBASE_PROD_MESSAGING_SENDER_ID?: string;
  readonly FIREBASE_PROD_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
