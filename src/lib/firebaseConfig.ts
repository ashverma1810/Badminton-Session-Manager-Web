/**
 * Firebase Environment & Secrets Configuration
 * 
 * Securely retrieves Firebase configuration parameters from runtime environment
 * variables and platform secrets (supporting distinct DEV and PROD configurations).
 * No credentials or project secrets are hardcoded in source code.
 */

export interface FirebaseAppConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
  measurementId?: string;
}

// Helper to safely read from import.meta.env or injected process.env
const readEnvVar = (keys: string[]): string => {
  const metaEnvObj = typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env : undefined;
  const metaEnv = metaEnvObj || ({} as Record<string, string | undefined>);
  const procEnv = (typeof process !== 'undefined' && process.env) ? process.env : ({} as Record<string, string | undefined>);

  for (const key of keys) {
    const val = metaEnv[key] || procEnv[key];
    if (typeof val === 'string' && val.trim() !== '') {
      return val.trim();
    }
  }
  return '';
};

const metaEnvObj = typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: { DEV?: boolean; MODE?: string } }).env : undefined;
const isDev = Boolean(
  (metaEnvObj && (metaEnvObj.DEV || metaEnvObj.MODE === 'development')) ||
  (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development')
);

export const getFirebaseEnvMode = (): 'development' | 'production' => {
  return isDev ? 'development' : 'production';
};

/**
 * Resolves Firebase configuration by environment precedence:
 * 1. Environment-specific override (FIREBASE_DEV_* or FIREBASE_PROD_*)
 * 2. Standard secret / env name (FIREBASE_*)
 * 3. Vite-prefixed alias (VITE_FIREBASE_*)
 */
const resolveConfigValue = (baseName: string): string => {
  const devKey = `FIREBASE_DEV_${baseName}`;
  const prodKey = `FIREBASE_PROD_${baseName}`;
  const stdKey = `FIREBASE_${baseName}`;
  const viteKey = `VITE_FIREBASE_${baseName}`;

  if (isDev) {
    return readEnvVar([devKey, stdKey, viteKey]);
  } else {
    return readEnvVar([prodKey, stdKey, viteKey]);
  }
};

export const loadFirebaseConfig = (): {
  config: FirebaseAppConfig;
  missingKeys: string[];
  isValid: boolean;
} => {
  const apiKey = (typeof process !== 'undefined' && process.env?.FIREBASE_API_KEY) || resolveConfigValue('API_KEY');
  const authDomain = (typeof process !== 'undefined' && process.env?.FIREBASE_AUTH_DOMAIN) || resolveConfigValue('AUTH_DOMAIN');
  const databaseURL = (typeof process !== 'undefined' && process.env?.FIREBASE_DATABASE_URL) || resolveConfigValue('DATABASE_URL');
  const projectId = (typeof process !== 'undefined' && process.env?.FIREBASE_PROJECT_ID) || resolveConfigValue('PROJECT_ID');
  const storageBucket = (typeof process !== 'undefined' && process.env?.FIREBASE_STORAGE_BUCKET) || resolveConfigValue('STORAGE_BUCKET');
  const messagingSenderId = (typeof process !== 'undefined' && process.env?.FIREBASE_MESSAGING_SENDER_ID) || resolveConfigValue('MESSAGING_SENDER_ID');
  const appId = (typeof process !== 'undefined' && process.env?.FIREBASE_APP_ID) || resolveConfigValue('APP_ID');
  const firestoreDatabaseId = (typeof process !== 'undefined' && process.env?.FIREBASE_FIRESTORE_DATABASE_ID) || resolveConfigValue('FIRESTORE_DATABASE_ID') || '(default)';
  const measurementId = resolveConfigValue('MEASUREMENT_ID');

  const requiredFields: Record<string, string> = {
    FIREBASE_API_KEY: apiKey,
    FIREBASE_AUTH_DOMAIN: authDomain,
    FIREBASE_DATABASE_URL: databaseURL,
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_STORAGE_BUCKET: storageBucket,
    FIREBASE_MESSAGING_SENDER_ID: messagingSenderId,
    FIREBASE_APP_ID: appId,
  };

  const missingKeys = Object.entries(requiredFields)
    .filter(([_, value]) => !value || value.trim() === '')
    .map(([key]) => key);

  const config: FirebaseAppConfig = {
    apiKey,
    authDomain,
    databaseURL,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    firestoreDatabaseId,
    measurementId: measurementId || undefined,
  };

  return {
    config,
    missingKeys,
    isValid: missingKeys.length === 0,
  };
};

const resolved = loadFirebaseConfig();

if (!resolved.isValid) {
  console.warn(
    `[Firebase Config Warning] Missing required Firebase configuration keys: ${resolved.missingKeys.join(', ')}.\n` +
    `Ensure these values are configured in your platform Secrets or .env file.`
  );
}

export const firebaseConfig: FirebaseAppConfig = resolved.config;
export const isFirebaseConfigured: boolean = resolved.isValid;
export const missingFirebaseConfigKeys: string[] = resolved.missingKeys;
