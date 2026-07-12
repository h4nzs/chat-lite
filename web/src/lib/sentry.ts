// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

/**
 * Initialize Sentry for production error tracking.
 * In development, Sentry is disabled by default unless VITE_SENTRY_DSN is set.
 */
export function initSentry() {
  if (!SENTRY_DSN && import.meta.env.PROD) {
    console.warn('[Sentry] VITE_SENTRY_DSN not configured — error tracking disabled');
    return;
  }
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.PROD ? 'production' : 'development',
    release: `nyx-chat@${__APP_VERSION__}`,
    // Only capture 10% of transactions in dev to save quota
    tracesSampleRate: import.meta.env.PROD ? 0.25 : 0.0,
    // Capture replay on error only (privacy-first for E2EE chat)
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 0.1 : 0.0,
    // Denylist sensitive URLs/keys that should never be sent to Sentry
    denyUrls: [
      /chrome-extension:\/\//i,
      /moz-extension:\/\//i,
    ],
    beforeSend(event) {
      // Strip potentially sensitive data from event context
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
        delete event.request.headers['Set-Cookie'];
        delete event.request.headers['X-CSRF-Token'];
        delete event.request.headers['csrf-token'];
      }
      // Sanitize error messages that might contain encryption keys
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map(value => {
          if (value.value) {
            // Redact base64 strings that look like keys (64+ chars)
            value.value = value.value.replace(/[A-Za-z0-9+/=_-]{64,}/g, '[REDACTED_KEY]');
          }
          return value;
        });
      }
      return event;
    },
    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
      }),
    ],
  });

  console.log('[Sentry] Frontend error tracking initialized', import.meta.env.PROD ? '🟢 production' : '🟡 development');
}

/**
 * Get the Sentry instance for manual error capturing.
 */
export function getSentry() {
  return Sentry;
}

export default Sentry;
