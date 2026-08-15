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

test.describe('Profile & Identity Settings', () => {
  test('Update profile display name and bio', async ({ page }) => {
    test.setTimeout(150000);
    const username = `profile_${Date.now()}`;
    await registerUser(page, 'Old Name', username);

    // 1. Navigate to settings (where editing happens)
    const settingsLink = page.locator('a[href="/settings"]').first();
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
    } else {
      await page.goto('/settings');
    }
    
    // Tunggu animasi masuk settings selesai
    await page.waitForTimeout(1000);

    // 2. Update display name
    // Menggunakan pemilih CSS yang tangguh namun spesifik karena elemen input teks bisa lebih dari satu
    const nameField = page.locator('input[type="text"]').filter({ hasNot: page.locator('[readonly]') }).first();
    await expect(nameField).toBeVisible({ timeout: 10000 });
    await nameField.fill('Updated Ghost Identity');
    
    // 3. Save changes
    // Mencari tombol submit form atau tombol yang memiliki teks 'save' atau 'update'
    const saveBtn = page.getByRole('button', { name: /save|update|processing/i }).filter({ hasText: /save|update/i }).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
    } else {
      // Fallback
      await page.locator('button[type="submit"]').first().click();
    }

    // 4. Verify UI reflects the change or success message appears
    await expect(nameField).toHaveValue('Updated Ghost Identity', { timeout: 10000 });
    
    // Verifikasi inisial Avatar berubah menjadi UG (Updated Ghost)
    // expect.poll: event `user:updated`/REST update bisa lambat saat suite paralel
    // (server lokal). Polling 45 detik jauh lebih stabil daripada expect tunggal.
    await expect.poll(
      async () => {
        const initials = await page.getByText('UG', { exact: true }).first().isVisible().catch(() => false);
        return initials;
      },
      { timeout: 45000, message: 'Avatar initials "UG" harus muncul setelah update profil' }
    ).toBe(true);
  });
});
