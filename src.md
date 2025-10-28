# Rekomendasi perbaikan — langkah demi langkah (prioritas tinggi → rendah)

> Catatan umum sebelum mulai: lakukan perubahan satu-persatu dan jalankan aplikasinya (mode dev) untuk melihat perubahan efeknya. Buat commit terpisah sehingga mudah rollback.

## 1) Verifikasi cara import & inisialisasi `libsodium` (perbaikan paling cepat dan sering sukses)

Pastikan kamu **selalu** menunggu `sodium.ready` sebelum memakai fungsi apa pun. Implementasi yang aman:

```ts
// utils/sodium.ts (contoh)
import * as _sodium from 'libsodium-wrappers';

let sodiumPromise: Promise<typeof _sodium> | null = null;

export async function getSodium() {
  if (!sodiumPromise) {
    sodiumPromise = (async () => {
      const sodium = await _sodium;
      await sodium.ready; // <= penting
      return sodium;
    })();
  }
  return sodiumPromise;
}
```

Di mana pun kamu pakai `getSodium()` pastikan `await getSodium()` terjadi sebelum akses konstanta (mis. `sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE`).

**Kenapa:** banyak pengguna Vite/bundler lupa `await sodium.ready` sehingga objek sodium belum selesai inisialisasi WASM → konstanta jadi undefined.

---

## 2) Tambahkan cek defensif & diagnostic log

Sebelum memanggil `crypto_pwhash` tambahkan pemeriksaan nilai:

```ts
const sodium = await getSodium();
if (typeof sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE !== 'number') {
  console.error('Sodium constants missing', {
    opslimit: sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    memlimit: sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    alg: sodium.crypto_pwhash_ALG_DEFAULT
  });
  throw new Error('libsodium not initialized properly');
}
```

**Tujuan:** konfirmasi cepat apakah konstanta memang undefined pada runtime — berguna untuk debugging dan laporan bug.

---

## 3) Konfigurasi Vite untuk WASM (jika masalahnya terkait bundling)

Tambahkan konfigurasi agar Vite tidak meng-optimasi/mem-bundle `libsodium-wrappers` secara agresif dan agar file `.wasm` tersedia di runtime:

Contoh perubahan `vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['libsodium-wrappers']  // hindari pre-bundling yang mengacaukan inisialisasi WASM
  },
  build: {
    target: 'es2020',
    // ensure wasm assets are copied
    rollupOptions: {
      output: {
        // Biarkan .wasm sebagai asset — bukan inline
      }
    }
  },
  assetsInclude: ['**/*.wasm']  // pastikan vite menganggap .wasm sebagai asset
});
```

**Catatan:** ada banyak variasi tergantung versi Vite; jika diperlukan, gunakan `vite-plugin-wasm` atau `vite-plugin-static-copy` untuk memastikan file `.wasm` disalin ke `dist` dengan path yang bisa diakses.

---

## 4) Alternatif paket: gunakan `libsodium-wrappers-sumo`

Jika konfigurasi Vite tetap menyulitkan, dua jalan keluar cepat:

* **A. `libsodium-wrappers-sumo`** — paket “sumo” berisi fallback asm.js sehingga lebih toleran terhadap bundler (meskipun ukuran lebih besar). Ganti import:

```bash
npm install libsodium-wrappers-sumo
```

```ts
import * as _sodium from 'libsodium-wrappers-sumo';
await (await _sodium).ready;
```

**Saran:** coba dulu `libsodium-wrappers-sumo` (minim perubahan) — kalau itu memecahkan masalah, kamu aman melanjutkan. Jika ukuran bundle jadi masalah.

---

## 5) Jalankan reproducer kecil (isolated test)

Buat file JS/TS kecil di proyek (mis. `scripts/test-sodium.ts`) yang **langsung** melakukan import `libsodium-wrappers` dan panggil `crypto_pwhash` sederhana — jalankan di browser dev server atau Node (tergantung dukungan) untuk memastikan apakah itu gagal di lingkungan dev:

```ts
// scripts/test-sodium.ts (pseudo)
import * as sodium from 'libsodium-wrappers';
(async () => {
  await sodium.ready;
  console.log('sodium ready, opslimit:', sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE);
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    'password',
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
  console.log('pwhash ok length', key.length);
})();
```

Jika test ini gagal di dev server, artinya masalah berada di bundling/init WASM — lanjut ke langkah 3/4.

---

---

# Checklist tindakan segera (urutan yang saya rekomendasikan)

1. Pastikan `getSodium()` memanggil dan `await sodium.ready`. (implementasi/cek)
2. Tambahkan diagnostic logging (cek konstanta sodium) sebelum pemanggilan `crypto_pwhash`. (cek nilai undefined)
3. Jalankan `scripts/test-sodium.ts` atau minimal reproducer untuk verifikasi cepat. (diagnosis)
4. Jika konstanta undefined → ubah `vite.config.ts` seperti di atas (exclude / assetsInclude). Restart dev server. (perbaikan bundling)
5. Jika masih gagal → coba `libsodium-wrappers-sumo`. (fallback)
6. (Opsional) Beri report ke upstream `libsodium-wrappers` dan cek issue tracker untuk kombinasi Vite-versi yang digunakan (investigasi kompatibilitas). (investigasi lanjutan)

---