import { test, expect, Page } from '@playwright/test';

test.describe('Authentication & Onboarding', () => {
  test.setTimeout(180000); 

  // Helper: Registrasi Akun dan Bypass Semua Modal Awal
  async function registerAndBypass(page: Page, displayName: string, username: string) {
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

    // 5. Bypass System Init Modal
    const skipSystemInitBtn = page.getByRole('button', { name: /Skip for now/i });
    try {
      await skipSystemInitBtn.waitFor({ state: 'visible', timeout: 15000 });
      await skipSystemInitBtn.click();
      await skipSystemInitBtn.waitFor({ state: 'hidden', timeout: 5000 });
    } catch (e) {
      console.log('System Init modal skipped or not found');
    }

    // 6. Bypass Quick Tour Modal (If it appears)
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

  test('Register with Proof of Work', async ({ page }) => {
    await page.route('**/api/auth/pow/challenge', async route => {
      await route.fulfill({ status: 200, json: { challenge: 'mock_challenge', difficulty: 1 } });
    });
    await page.route('**/api/auth/pow/verify', async route => {
      await route.fulfill({
        status: 201,
        json: { message: 'Registered successfully', user: { id: 'mock_id', username: 'testuser_pow' }, tokens: { access: 'token', refresh: 'token' } }
      });
    });
    await registerAndBypass(page, 'Test User', 'testuser_pow');
  });

  test('Login with correct password', async ({ page }) => {
    const username = `loginuser_${Date.now()}`;
    
    // 1. Register User
    await registerAndBypass(page, 'Test Login User', username);
    
    // 2. Clear Session — logout via app API dulu (cookie HttpOnly tidak bisa dihapus
    //    langsung dari document.cookie), lalu bersihkan storage lokal.
    await page.evaluate(async () => {
      try {
        // @ts-ignore — path absolut Vite dev server (runtime-only)
        const { useAuthStore } = await import('/src/store/auth.ts');
        await useAuthStore.getState().logout().catch(() => {});
      } catch (e) {}
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(';').forEach(c => {
        const name = c.split('=')[0]?.trim();
        if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
      });
      const dbs = await indexedDB.databases();
      for (const db of dbs) { 
        if (db.name) indexedDB.deleteDatabase(db.name); 
      }
    });

    // 3. FORCE PAGE RELOAD
    // Wipes out Zustand/React state in memory so SPA knows the user is truly logged out
    await page.reload();

    // 4. Login
    await page.goto('/login');
    await page.getByRole('textbox', { name: /Username/i }).fill(username);
    await page.getByRole('textbox', { name: /Password/i }).fill('StrongPass123!');
    await page.getByRole('button', { name: /Login/i }).click();

    // 5. Asersi Login berhasil: modal "New Device Detected" muncul (bukti sesi aktif
    //    tapi kunci lokal terhapus — recovery flow), modal bisa ditutup dan TIDAK reopen.
    await expect(page.getByRole('heading', { name: /New Device Detected/i })).toBeVisible({ timeout: 30000 });
    const closeNewDeviceBtn = page.getByRole('button', { name: /Close modal/i });
    await closeNewDeviceBtn.click();
    await expect(page.getByRole('heading', { name: /New Device Detected/i })).toBeHidden({ timeout: 10000 });
    // Tidak boleh ada error server di form
    await expect(page.getByText('Internal server error')).toBeHidden();

    // Bypass modals lainnya (System Init / Quick Tour)
    const skipSystemInitBtn = page.getByRole('button', { name: /Skip for now/i });
    try {
      await skipSystemInitBtn.waitFor({ state: 'visible', timeout: 5000 });
      await skipSystemInitBtn.click();
    } catch (e) {}

    const closeTourBtn = page.getByRole('button', { name: /Close modal/i });
    try {
      await closeTourBtn.waitFor({ state: 'visible', timeout: 5000 });
      await closeTourBtn.click();
    } catch (e) {}
  });

  test('Fail login with incorrect password', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByRole('textbox', { name: /Username/i }).fill('nonexistent_user');
    await page.getByRole('textbox', { name: /Password/i }).fill('WrongPassword123!');
    await page.getByRole('button', { name: /Login/i }).click();

    await expect(page.getByText('Invalid credentials')).toBeVisible({ timeout: 15000 });
  });
});
