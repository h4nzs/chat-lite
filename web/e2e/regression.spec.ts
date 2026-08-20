import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'node:path';

// Helper (duplikasi per spec — konvensi repo): Registrasi User + bypass modal awal
async function registerUser(page: Page, displayName: string, username: string) {
  await page.goto('/register');

  await page.getByRole('textbox', { name: /Display Name/i }).fill(displayName);
  await page.getByRole('textbox', { name: /Username/i }).fill(username);
  await page.getByRole('textbox', { name: /Password/i }).fill('StrongPass123!');
  await page.getByRole('button', { name: /Initialize Identity/i }).click();

  await page.getByRole('button', { name: /Skip for now/i }).waitFor({ state: 'visible', timeout: 60000 });
  await page.getByRole('button', { name: /Skip for now/i }).click();

  await page.getByRole('button', { name: /Acknowledge/i }).waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('button', { name: /Acknowledge/i }).click();

  await page.getByRole('button', { name: /Sequence Recorded/i }).waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('button', { name: /Sequence Recorded/i }).click();

  const closeVerifyBtn = page.locator('button[aria-label="Close"], button:has-text("×")').first();
  await closeVerifyBtn.waitFor({ state: 'visible', timeout: 20000 });
  await closeVerifyBtn.click();
  await page.waitForTimeout(1000);
  const closeVerifyBtn2 = page.locator('button[aria-label="Close"], button:has-text("×")').first();
  if (await closeVerifyBtn2.isVisible().catch(() => false)) {
    await closeVerifyBtn2.click();
  }

  const skipSystemInitBtn = page.getByRole('button', { name: /Skip for now/i });
  try {
    await skipSystemInitBtn.waitFor({ state: 'visible', timeout: 15000 });
    await skipSystemInitBtn.click();
    await skipSystemInitBtn.waitFor({ state: 'hidden', timeout: 5000 });
  } catch (e) {}

  const closeTourBtn = page.getByRole('button', { name: /Close modal/i });
  try {
    await closeTourBtn.waitFor({ state: 'visible', timeout: 5000 });
    await closeTourBtn.click();
  } catch (e) {}

  await expect(page.getByRole('heading', { name: /System Ready/i })).toBeVisible({ timeout: 30000 });
}

// Helper: bikin link burner dari sidebar host, buka di konteks guest, kirim teks awal
async function openBurnerAsGuest(
  page: Page,
  context: BrowserContext
): Promise<{ guestPage: Page; roomId: string }> {
  // 1. Klik tombol burner di sidebar
  const burnerBtn = page.locator('button[title="Create burner conversation link"]').first();
  await expect(burnerBtn).toBeVisible({ timeout: 15000 });
  await burnerBtn.click();

  // 2. Ambil link dari modal
  const linkEl = page.locator('div', { hasText: /\/drop\/#/ }).first();
  await expect(linkEl).toBeVisible({ timeout: 10000 });
  const modalText = await linkEl.innerText();
  const hrefMatch = modalText.match(/https?:\/\/[^\s]+\/drop\/#(\S+)/);
  expect(hrefMatch).not.toBeNull();
  const link = hrefMatch![0]!;
  const roomId = hrefMatch![1]!.split(':')[0]!;
  expect(roomId.startsWith('burner_')).toBe(true);

  // 3. Klik COPY SECURE LINK → menambahkan conversation burner ke store host &
  //    mengarahkan host ke ChatWindow burner (tempat MessageInput + Destroy berada).
  const copyBtn = page.getByRole('button', { name: /Copy Secure Link/i }).first();
  await expect(copyBtn).toBeVisible({ timeout: 10000 });
  await copyBtn.click();

  // 4. Buka link di konteks guest terisolasi
  const guestPage = await context.newPage();
  await guestPage.goto(link);

  // 5. Guest kirim teks awal agar DR host terinisialisasi
  const guestInput = guestPage.getByPlaceholder('Type an ephemeral message...').first();
  await expect(guestInput).toBeVisible({ timeout: 30000 });
  await guestInput.fill('ping');
  await guestInput.press('Enter');

  return { guestPage, roomId };
}

async function sendFileFromHost(page: Page, filePath: string) {
  // MessageInput staging flow: pilih file → preview → klik tombol kirim
  // Input file sengaja disembunyikan (className="hidden") → tidak perlu visible.
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 15000 });
  await fileInput.setInputFiles(filePath);

  // Preview staging muncul dengan nama file → klik tombol submit composer
  const stagedName = filePath.split('/').pop()!;
  await expect(page.locator('text=' + stagedName).first()).toBeVisible({ timeout: 15000 });

  const sendBtn = page.locator('form button[type="submit"]').first();
  await expect(sendBtn).toBeEnabled({ timeout: 10000 });
  await sendBtn.click();
}

// Cek WebTransport HARUS setelah navigasi ke origin app (di about:blank,
// `window.isSecureContext === false` → WebTransport undefined meski didukung).
async function supportsWebTransport(page: Page): Promise<boolean> {
  await page.goto('/');
  return page.evaluate(() => typeof WebTransport !== 'undefined');
}

test.describe('Regression: burner flows', () => {
  test.setTimeout(240000);

  test('host sends a photo → guest bubble shows a preview (regression: no preview on host→guest files)', async ({ page, browser }) => {
    const supported = await supportsWebTransport(page);
    test.skip(!supported, 'WebTransport tidak tersedia di environment ini');

    const hostName = `bh_${Date.now()}`;
    await registerUser(page, 'Burn Host', hostName);

    const context = await browser.newContext();
    const { guestPage, roomId } = await openBurnerAsGuest(page, context);

    // Host buka chat burner & kirim foto
    await page.goto(`/chat/${roomId}`);
    await page.waitForTimeout(1000);

    const imgPath = path.resolve(process.cwd(), 'public', 'pwa-192x192.png');
    await sendFileFromHost(page, imgPath);

    // REGRESI: bubble guest harus menampilkan preview (gambar hasil dekripsi),
    // bukan kosong / waiting-for-key tanpa media.
    await expect(guestPage.locator('main img').first()).toBeVisible({ timeout: 45000 });
    await expect(guestPage.locator('text=Waiting for key').first()).toHaveCount(0);
  });

  test('burner conversation destroyed on host stays deleted after reload (regression: reappears)', async ({ page, browser }) => {
    const supported = await supportsWebTransport(page);
    test.skip(!supported, 'WebTransport tidak tersedia di environment ini');

    const hostName = `bd_${Date.now()}`;
    await registerUser(page, 'Burn Del', hostName);

    const context = await browser.newContext();
    const { roomId } = await openBurnerAsGuest(page, context);

    await page.goto(`/chat/${roomId}`);
    await page.waitForTimeout(1000);

    // Destroy sesi dari ChatWindow host
    const destroyBtn = page.getByRole('button', { name: /Destroy Burner Session/i }).first();
    await expect(destroyBtn).toBeVisible({ timeout: 15000 });
    await destroyBtn.click();

    // Setelah destroy, host dialihkan ke /chat — reload & pastikan room tidak kembali
    await page.waitForTimeout(1000);
    await page.reload();
    await page.waitForTimeout(3000);

    await expect(page.locator(`a[href*="${roomId}"]`)).toHaveCount(0);
    await expect(page.locator('div', { hasText: roomId }).first()).toHaveCount(0);
  });
});