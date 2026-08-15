// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
//
// WAJIB di-import PALING AWAL (sebelum modul apa pun yang membuat schema Zod di web).
// Zod 4 default memakai JIT (Function()/eval) — melanggar CSP prod tanpa 'unsafe-eval'.
//
// NOTE: TIDAK memakai zod.config() — package zod berlabel `sideEffects: false`
// sehingga panggilan itu DI-TREE-SHAKE di build production. Mutasi langsung ke
// globalThis tidak bisa dihilangkan bundler. Mutasi (bukan replace) karena zod
// memegang referensi objek yang sama.
type ZodGlobalConfig = { jitless?: boolean };
const zodGlobal = globalThis as unknown as { __zod_globalConfig?: ZodGlobalConfig };
if (!zodGlobal.__zod_globalConfig) zodGlobal.__zod_globalConfig = {};
zodGlobal.__zod_globalConfig.jitless = true;
