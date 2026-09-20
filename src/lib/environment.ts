/**
 * Application Environment Detection System
 * 
 * Environments:
 * - LOCAL: Running on local machine (localhost, 127.0.0.1, local IP, Vite dev mode) -> CYAN / SKY BLUE
 * - DEV:   Deployed from 'dev' git branch -> RED
 * - TEST:  Deployed from 'test' git branch -> AMBER
 * - PROD:  Deployed from main/production branch (fallback)
 */

export type AppEnvironment = 'LOCAL' | 'DEV' | 'TEST' | 'PROD';

export interface EnvironmentStyle {
  env: AppEnvironment;
  label: string;
  darkStyle: string;
  lightStyle: string;
  dotColor: string;
  description: string;
}

export const getAppEnvironment = (): AppEnvironment => {
  const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env : undefined) || {};
  const procEnv = (typeof process !== 'undefined' && process.env) ? process.env : {};

  const getVar = (key: string): string => {
    const val = metaEnv[key] || procEnv[key];
    return typeof val === 'string' ? val.trim().toLowerCase() : '';
  };

  // 1. Check explicit environment override variable (VITE_APP_ENV / FIREBASE_ENV / VITE_DEPLOY_ENV)
  const explicitEnv = getVar('VITE_APP_ENV') || getVar('FIREBASE_ENV') || getVar('VITE_DEPLOY_ENV');
  if (explicitEnv === 'local') return 'LOCAL';
  if (explicitEnv === 'dev' || explicitEnv === 'development') return 'DEV';
  if (explicitEnv === 'test' || explicitEnv === 'testing' || explicitEnv === 'staging') return 'TEST';
  if (explicitEnv === 'prod' || explicitEnv === 'production') return 'PROD';

  // 2. Check Hostname when running in browser
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname.toLowerCase();

    // Local host detection
    const isLocalHost = 
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      /^192\.168\.\d+\.\d+$/.test(host) ||
      /^10\.\d+\.\d+\.\d+$/.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/.test(host);

    if (isLocalHost) {
      return 'LOCAL';
    }

    // Hostname subdomains / paths for deployed dev & test environments
    if (host.includes('dev.') || host.includes('-dev.') || host.startsWith('dev-') || host.includes('-dev-')) {
      return 'DEV';
    }
    if (host.includes('test.') || host.includes('-test.') || host.startsWith('test-') || host.includes('-test-') || host.includes('staging')) {
      return 'TEST';
    }
  }

  // 3. Branch detection from CI/CD build variables
  const branch = getVar('VITE_GIT_BRANCH') || 
                 getVar('HEAD') || 
                 getVar('VERCEL_GIT_COMMIT_REF') || 
                 getVar('CF_PAGES_BRANCH') || 
                 getVar('GITHUB_REF_NAME');

  if (branch === 'dev' || branch === 'development' || branch.includes('/dev') || branch.startsWith('dev-') || branch.endsWith('-dev')) {
    return 'DEV';
  }
  if (branch === 'test' || branch === 'testing' || branch === 'staging' || branch.includes('/test') || branch.startsWith('test-') || branch.endsWith('-test')) {
    return 'TEST';
  }

  // 4. Default to LOCAL if Vite is in development mode
  if (metaEnv.DEV || procEnv.NODE_ENV === 'development') {
    return 'LOCAL';
  }

  return 'LOCAL';
};

export const getEnvironmentStyle = (env: AppEnvironment): EnvironmentStyle => {
  switch (env) {
    case 'DEV':
      return {
        env: 'DEV',
        label: 'DEV',
        darkStyle: 'bg-rose-950/60 border-rose-500/50 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.25)]',
        lightStyle: 'bg-rose-100 border-rose-300 text-rose-800 shadow-xs',
        dotColor: 'bg-rose-500',
        description: 'Deployed from DEV branch',
      };
    case 'TEST':
      return {
        env: 'TEST',
        label: 'TEST',
        darkStyle: 'bg-amber-950/60 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
        lightStyle: 'bg-amber-100 border-amber-300 text-amber-900 shadow-xs',
        dotColor: 'bg-amber-500',
        description: 'Deployed from TEST branch',
      };
    case 'PROD':
      return {
        env: 'PROD',
        label: 'PROD',
        darkStyle: 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
        lightStyle: 'bg-emerald-100 border-emerald-300 text-emerald-900 shadow-xs',
        dotColor: 'bg-emerald-500',
        description: 'Deployed from Production',
      };
    case 'LOCAL':
    default:
      return {
        env: 'LOCAL',
        label: 'LOCAL',
        darkStyle: 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
        lightStyle: 'bg-cyan-100 border-cyan-300 text-cyan-900 shadow-xs',
        dotColor: 'bg-cyan-400',
        description: 'Running on Local Machine',
      };
  }
};
