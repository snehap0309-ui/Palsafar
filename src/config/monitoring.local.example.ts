/**
 * Copy to monitoring.local.ts (gitignored) and paste your Sentry DSN.
 *
 *   cp src/config/monitoring.local.example.ts src/config/monitoring.local.ts
 *
 * Or set SENTRY_DSN in CI / shell when bundling.
 */
export const SENTRY_DSN = 'https://<key>@o<org>.ingest.sentry.io/<project>';
export const SENTRY_ENVIRONMENT = 'development' as const;
