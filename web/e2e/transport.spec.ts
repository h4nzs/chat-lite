// Copyright (c) 2026 [han]. All rights reserved.
// This file is part of NYX, licensed under the AGPL-3.0.
//
// Spesifikasi jalur real-time (WebTransport). Secara otomatis SKIP bila
// browser environment tidak menyediakan WebTransport (mis. chromium
// headless-shell di beberapa Linux build, atau CI tanpa QUIC).
//
// Jalankan di environment yang mendukung: browser desktop normal / CI
// dengan Chrome penuh. Butuh sidecar WebTransport + server + DB + Redis.
import { test, expect, Page, Browser } from '@playwright/test';

async function webTransportSupported(page: Page): Promise<boolean> {
  return page.evaluate(() => typeof WebTransport !== 'undefined');
}

// Helper register (sama dengan spec lain — flow modal onboarding aktual)
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
  const closeBtn = page.locator('button[aria-label="Close"], button:has-text("×")').first();
  await closeBtn.waitFor({ state: 'visible', timeout: 20000 });
  await closeBtn.click();
  await page.waitForTimeout(1000);
  const closeBtn2 = page.locator('button[aria-label="Close"], button:has-text("×")').first();
  if (await closeBtn2.isVisible().catch(() => false)) await closeBtn2.click();
  const skipInit = page.getByRole('button', { name: /Skip for now/i });
  try { await skipInit.waitFor({ state: 'visible', timeout: 15000 }); await skipInit.click(); } catch (e) {}
  await page.getByRole('heading', { name: /System Ready/i }).waitFor({ state: 'visible', timeout: 30000 });
}

test.describe('Real-time Transport (WebTransport)', () => {
  test.setTimeout(300000);

  test('kirim pesan → terima di peer (latency end-to-end)', async ({ page, browser }) => {
    test.skip(!(await webTransportSupported(page)), 'WebTransport tidak tersedia di environment ini');

    const usernameA = `wta_${Date.now()}`;
    const usernameB = `wtb_${Date.now()}`;
    await registerUser(page, 'Alice WT', usernameA);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await registerUser(pageB, 'Bob WT', usernameB);

    // Alice mencari Bob & membuka chat
    await page.bringToFront();
    const searchInput = page.getByRole('textbox', { name: /search/i }).first();
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    await searchInput.fill(usernameB);
    await searchInput.press('Enter');
    const searchResult = page.locator(`text=${usernameB}`).first();
    await expect(searchResult).toBeVisible({ timeout: 30000 });
    await searchResult.click();

    const messageInput = page.locator('textarea[placeholder*="essage"], input[placeholder*="essage"]').first();
    await expect(messageInput).toBeVisible({ timeout: 10000 });

    const testMessage = `WT-latency-${Date.now()}`;
    const t0 = Date.now();
    await messageInput.fill(testMessage);
    await messageInput.press('Enter');

    // Optimistic bubble tampil cepat
    await expect(page.locator(`text=${testMessage}`).first()).toBeVisible({ timeout: 5000 });
    const optimisticMs = Date.now() - t0;
    console.log(`[perf] optimistic bubble: ${optimisticMs}ms`);

    // Peer menerima via WebTransport real-time
    await pageB.bringToFront();
    const chatFromAlice = pageB.locator('div').filter({ hasText: testMessage }).first();
    await expect(chatFromAlice).toBeVisible({ timeout: 15000 });
    await chatFromAlice.click();
    await expect(pageB.locator(`text=${testMessage}`).first()).toBeVisible({ timeout: 15000 });
    const endToEndMs = Date.now() - t0;
    console.log(`[perf] end-to-end receive: ${endToEndMs}ms`);

    // Regresi performa kasar: < 8 detik end-to-end di localhost (sangat longgar;
    // p95 asli diukur via instrumentasi dev [perf:transport]).
    expect(endToEndMs).toBeLessThan(8000);

    await contextB.close();
  });

  test('unsend: pengirim menghapus → pesan hilang di kedua sisi', async ({ page, browser }) => {
    test.skip(!(await webTransportSupported(page)), 'WebTransport tidak tersedia di environment ini');

    const usernameA = `wuc_${Date.now()}`;
    const usernameB = `wud_${Date.now()}`;
    await registerUser(page, 'Alice U', usernameA);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await registerUser(pageB, 'Bob U', usernameB);

    await page.bringToFront();
    const searchInput = page.getByRole('textbox', { name: /search/i }).first();
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    await searchInput.fill(usernameB);
    await searchInput.press('Enter');
    await expect(page.locator(`text=${usernameB}`).first()).toBeVisible({ timeout: 30000 });
    await page.locator(`text=${usernameB}`).first().click();

    const messageInput = page.locator('textarea[placeholder*="essage"], input[placeholder*="essage"]').first();
    await expect(messageInput).toBeVisible({ timeout: 10000 });
    const testMessage = `WT-unsend-${Date.now()}`;
    await messageInput.fill(testMessage);
    await messageInput.press('Enter');
    await expect(page.locator(`text=${testMessage}`).first()).toBeVisible({ timeout: 10000 });

    // Peer melihat pesan
    await pageB.bringToFront();
    const chatFromAlice = pageB.locator('div').filter({ hasText: testMessage }).first();
    await expect(chatFromAlice).toBeVisible({ timeout: 15000 });
    await chatFromAlice.click();

    // Pengirim unsend via store API (mengirim deleteSecret — server memverifikasi ownership)
    await page.bringToFront();
    const unsendResult = await page.evaluate(async (msgText) => {
      try {
        // @ts-ignore — path absolut Vite dev server (runtime-only)
        const { useMessageStore } = await import('/src/store/message.ts');
        // @ts-ignore — path absolut Vite dev server (runtime-only)
        const { useConversationStore } = await import('/src/store/conversation.ts');
        const convs = useConversationStore.getState().conversations as { id: string }[];
        if (convs.length === 0) return 'NO_CONVERSATION';
        const conv = convs[0];
        const state = useMessageStore.getState();
        const target = ((state.messages as Record<string, { content: string | null; id: string }[]>)[conv.id] || []).find((m) => m.content === msgText);
        if (!target) return 'MESSAGE_NOT_FOUND';
        await state.sendMessage(conv.id, { content: JSON.stringify({ type: 'UNSEND', targetMessageId: target.id }), isSilent: true });
        return 'UNSEND_SENT';
      } catch (e) {
        return 'ERR: ' + (e instanceof Error ? e.message : String(e));
      }
    }, testMessage);
    console.log('unsend result:', unsendResult);

    // Kedua sisi menunjukkan tombstone "message deleted"
    await expect(page.getByText(/message deleted|deleted message/i).first()).toBeVisible({ timeout: 15000 });
    await pageB.bringToFront();
    await expect(pageB.getByText(/message deleted|deleted message/i).first()).toBeVisible({ timeout: 15000 });

    await contextB.close();
  });
});
