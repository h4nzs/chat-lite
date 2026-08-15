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

test.describe('Security & Sessions', () => {
  test('View active sessions and verify current device', async ({ page }) => {
    test.setTimeout(150000);
    const username = `secuser_${Date.now()}`;
    await registerUser(page, 'Sec User', username);

    // 1. Navigate to Session Management
    const settingsLink = page.locator('a[href="/settings"]').first();
    await settingsLink.click();
    await page.waitForTimeout(1000);
    const sessionsBtn = page.locator('button', { hasText: /sessions/i }).first();
    await sessionsBtn.click();

    // 2. Wait for scanning to finish (if any spinner is shown)
    const scanningSpinner = page.locator('text=Scanning').first();
    if (await scanningSpinner.isVisible()) {
      await expect(scanningSpinner).toBeHidden({ timeout: 15000 });
    }

    // 3. Verify current device is listed
    // The page should show at least one active device (the current one) marked as "Current"
    const currentDeviceIndicator = page.getByText(/CURRENT|ACTIVE|THIS DEVICE/i).first();
    await expect(currentDeviceIndicator).toBeVisible({ timeout: 15000 });
  });
});
