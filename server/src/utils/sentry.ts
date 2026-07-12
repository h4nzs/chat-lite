// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].

import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN || '';

/**
 * Initialize Sentry for production error tracking on the server.
 * Should be called at the very beginning of server startup.
 */
export async function initSentry() {
  if (!SENTRY_DSN && process.env.NODE_ENV === 'production') {
    console.warn('[Sentry] SENTRY_DSN not configured — error tracking disabled');
    return;
  }
  if (!SENTRY_DSN) return;

  // Profile integration (optional, loaded lazily to avoid missing import errors)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const integrations: any[] = [];
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_PROFILING === 'true') {
    try {
      // Dynamic import to avoid requiring @sentry/profiling-node in all environments
      const { nodeProfilingIntegration } = await import('@sentry/profiling-node');
      integrations.push(nodeProfilingIntegration());
    } catch {
      console.warn('[Sentry] Profiling not available — @sentry/profiling-node may not be installed');
    }
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: `nyx-chat-server@${process.env.npm_package_version || 'unknown'}`,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.0,
    integrations,
    beforeSend(event) {
      // Sanitize sensitive data before sending
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
        delete event.request.headers['Set-Cookie'];
        delete event.request.headers['X-CSRF-Token'];
        delete event.request.headers['csrf-token'];
      }
      // Redact long base64 strings that might be keys
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map(value => {
          if (value.value) {
            value.value = value.value.replace(/[A-Za-z0-9+/=_-]{64,}/g, '[REDACTED_KEY]');
          }
          return value;
        });
      }
      return event;
    },
  });

  console.log('[Sentry] Backend error tracking initialized',
    process.env.NODE_ENV === 'production' ? '🟢 production' : '🟡 development');
}

/**
 * Get the Sentry instance for manual error capturing.
 */
export function getSentry() {
  return Sentry;
}

export default Sentry;
