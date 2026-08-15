import { test, expect, Page } from '@playwright/test';

// Helper 1: Registrasi Akun dan Bypass Semua Modal Awal
async function registerUser(page: Page, displayName: string, username: string) {
  await page.goto('/register');
  
  await page.getByRole('textbox', { name: /Display Name/i }).fill(displayName);
  await page.getByRole('textbox', { name: /Username/i }).fill(username);
  await page.getByRole('textbox', { name: /Password/i }).fill('StrongPass123!');
  await page.getByRole('button', { name: /Initialize Identity/i }).click();

  // 1. TRUST LEVEL VERIFICATION (muncul setelah registrasi selesai, ~15-20 detik)
  await page.getByRole('button', { name: /Skip for now/i }).waitFor({ state: 'visible', timeout: 60000 });
  await page.getByRole('button', { name: /Skip for now/i }).click();

  // 2. Protocol: Recovery
  await page.getByRole('button', { name: /Acknowledge/i }).waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('button', { name: /Acknowledge/i }).click();

  // 3. Secure Phrase
  await page.getByRole('button', { name: /Sequence Recorded/i }).waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('button', { name: /Sequence Recorded/i }).click();

  // 4. Verify Sequence (tutup via × — kadang butuh dua klik karena regenerasi kata)
  const closeVerifyBtn = page.locator('button[aria-label="Close"], button:has-text("×")').first();
  await closeVerifyBtn.waitFor({ state: 'visible', timeout: 20000 });
  await closeVerifyBtn.click();
  await page.waitForTimeout(1000);
  const closeVerifyBtn2 = page.locator('button[aria-label="Close"], button:has-text("×")').first();
  if (await closeVerifyBtn2.isVisible().catch(() => false)) {
    await closeVerifyBtn2.click();
  }

  // 5. System Init Modal
  const skipSystemInitBtn = page.getByRole('button', { name: /Skip for now/i });
  try {
    await skipSystemInitBtn.waitFor({ state: 'visible', timeout: 15000 });
    await skipSystemInitBtn.click();
    await skipSystemInitBtn.waitFor({ state: 'hidden', timeout: 5000 });
  } catch (e) {
    console.log('System Init modal skipped or not found');
  }

  // 6. Quick Tour Modal (If it appears)
  const closeTourBtn = page.getByRole('button', { name: /Close modal/i });
  try {
    await closeTourBtn.waitFor({ state: 'visible', timeout: 5000 });
    await closeTourBtn.click();
  } catch (e) {
    console.log('Quick Tour modal skipped or not found');
  }

  // Verifikasi mendarat di Dashboard
  await expect(page.getByRole('heading', { name: /System Ready/i })).toBeVisible({ timeout: 30000 });
}

// Helper 2: Eksekusi Upgrade Proof of Work di Settings
async function verifyUser(page: Page) {
  const settingsLink = page.locator('a[href="/settings"]').first();
  await settingsLink.click();
  await page.waitForTimeout(1000);

  // Cari tombol/badge "SANDBOXED" dan klik untuk membuka modal upgrade
  const sandboxedBtn = page.locator('button', { hasText: /sandbox/i }).first();
  await expect(sandboxedBtn).toBeVisible({ timeout: 10000 });
  await sandboxedBtn.click();

  // Di dalam modal, klik opsi Proof of Work (Mencari kata mining/pow/proof)
  const powBtn = page.locator('button', { hasText: /mining|pow|proof/i }).first();
  await expect(powBtn).toBeVisible();
  await powBtn.click();

  // TUNGGU PROSES MINING SELESAI
  // Waktu tunggu diperpanjang (60 detik) karena Web Worker butuh waktu untuk kalkulasi PoW
  const verifiedBadge = page.locator('span', { hasText: /verified/i }).first();
  await expect(verifiedBadge).toBeVisible({ timeout: 60000 });

  // Setelah berhasil diverifikasi, kembali ke layar chat
  const chatLink = page.locator('a[href="/chat"], a[aria-label="Back"]').first();
  if (await chatLink.isVisible()) {
    await chatLink.click();
  } else {
    await page.goto('/chat');
  }
  await expect(page.getByRole('heading', { name: /System Ready/i })).toBeVisible({ timeout: 15000 });
}

test.describe('Chat Functionality', () => {
  // Naikkan timeout global karena kita melakukan Registrasi (x2) + Mining PoW (x1)
  test.setTimeout(240000); 

  test('Start a new conversation and send a message', async ({ page, browser }) => {
    // Membutuhkan WebTransport untuk penerimaan real-time — skip bila tak tersedia
    // (mis. chromium headless-shell di beberapa Linux build / CI tanpa QUIC).
    const supported = await page.evaluate(() => typeof WebTransport !== 'undefined');
    test.skip(!supported, 'WebTransport tidak tersedia di environment ini');

    // 1. Register User A (Alice)
    const usernameA = `alice_${Date.now()}`;
    await registerUser(page, 'Alice', usernameA);

    // 2. Lakukan Upgrade PoW untuk User A agar bisa melakukan pencarian
    await verifyUser(page);

    // 3. Register User B (Bob) di konteks browser terpisah
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    const usernameB = `bob_${Date.now()}`; 
    await registerUser(pageB, 'Bob', usernameB);

    // 4. User A mencari User B dan memulai obrolan
    await page.bringToFront();
    
    // Tambahkan jeda agar database/Redis menyelesaikan sinkronisasi Blind Indexing
    await page.waitForTimeout(3000);
    
    // Cari Input pencarian. Kadang harus klik tab "Search" atau tombol search icon dulu.
    const searchInput = page.getByRole('textbox', { name: /search/i }).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    
    await searchInput.click();
    await searchInput.fill(usernameB);
    
    // Tekan ENTER untuk memicu kalkulasi Argon2 di Crypto Worker
    await searchInput.press('Enter');
    
    // Tunggu hasil pencarian muncul dan klik
    const searchResult = page.locator(`text=${usernameB}`).first();
    await expect(searchResult).toBeVisible({ timeout: 30000 }); 
    await searchResult.click();
    
    // 5. Kirim Pesan
    const testMessage = 'Hello Bob, this is a secure message from Alice!';
    
    // Cari input pesan di area chat (textbox / textarea)
    const messageInput = page.locator('textarea[placeholder*="essage"], input[placeholder*="essage"]').first();
    await expect(messageInput).toBeVisible({ timeout: 10000 });
    await messageInput.fill(testMessage);
    await messageInput.press('Enter');

    // Verifikasi pesan muncul di layar User A
    await expect(page.locator(`text=${testMessage}`).first()).toBeVisible({ timeout: 10000 });

    // 6. Verifikasi penerimaan pesan oleh User B (Real-time Socket.io check)
    await pageB.bringToFront();
    
    // Karena Bob belum memecahkan/dekripsi nama profil Alice, nama Alice mungkin muncul sebagai "Encrypted User" 
    // atau "Alice" (jika dekripsi cepat). ID Mentah (alice_123) TIDAK ditampilkan di UI ChatList.
    // Oleh karena itu, cara paling stabil adalah menemukan obrolan yang memiliki "Preview Teks" dari pesan yang dikirim Alice.
    const chatFromAlice = pageB.locator('div').filter({ hasText: testMessage }).first();
    await expect(chatFromAlice).toBeVisible({ timeout: 30000 });
    await chatFromAlice.click();
    
    // Verifikasi pesan muncul di layar utama (chat window) User B
    await expect(pageB.locator(`text=${testMessage}`).first()).toBeVisible({ timeout: 30000 });
  });
});
