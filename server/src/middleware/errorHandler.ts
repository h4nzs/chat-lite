// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
// For commercial licensing, contact [admin@nyx-app.my.id].
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors.js';

/**
 * Global error handling middleware
 * Must be mounted last in the Express middleware chain
 */
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Handle CSRF token errors
  if ((err as { code?: string }).code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  // Handle JSON parse errors
  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Handle ApiError instances
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }

  // Handle errors with status and message properties
  if ((err as { status?: number })?.status && (err as { message?: string })?.message) {
    const error = err as { status: number; message: string };
    return res.status(error.status).json({ error: error.message });
  }

  // Log unexpected errors
  console.error('❌ Server Error:', err);

  // Default to 500 Internal Server Error
  res.status(500).json({ error: 'Internal server error' });
};
