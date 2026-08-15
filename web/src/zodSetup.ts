// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
//
// WAJIB di-import PALING AWAL (sebelum modul apa pun yang membuat schema Zod).
// Zod 4 secara default memakai JIT (Function()) untuk kompilasi schema —
// itu melanggar CSP `script-src` tanpa 'unsafe-eval'. Mode jitless menafsirkan
// schema tanpa eval sehingga CSP tetap ketat.
import { config } from 'zod';

config({ jitless: true });
