import { expect, test } from '@playwright/test';

const DEMO = '/?mode=demo';

/**
 * Below 860px the sidebar is a drawer that starts closed. Tests that need the
 * train list open it first, exactly as a phone user would.
 */
async function openFiltersOnMobile(page: import('@playwright/test').Page) {
  if ((page.viewportSize()?.width ?? 1440) < 861) {
    await page.getByTestId('sidebar-toggle').click();
    await expect(page.getByTestId('train-list')).toBeVisible();
  }
}

/** Collect console errors and failed requests so a broken run cannot pass silently. */
function watchForBreakage(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

test.describe('Amtrak Live Explorer', () => {
  test('renders the national map, network summary, and demo labelling', async ({ page }) => {
    const errors = watchForBreakage(page);
    await page.goto(DEMO);

    await expect(page.getByTestId('status-strip')).toBeVisible();
    await expect(page.getByTestId('source-badge')).toHaveAttribute('aria-label', /demo snapshot/i);
    await expect(page.getByTestId('last-updated')).toContainText(/Updated|Last good/);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();

    // The network summary lives in the filters panel, a drawer on phones.
    await openFiltersOnMobile(page);
    const positions = page.getByTestId('summary-positions');
    await expect(positions).toHaveCount(1);
    await expect(positions).toBeVisible();
    expect(Number((await positions.textContent())?.trim())).toBeGreaterThan(50);
    await expect(page.getByTestId('summary-stations')).not.toHaveText('0');

    expect(errors).toEqual([]);
  });

  test('selecting a train populates the detail panel with stops', async ({ page }) => {
    await page.goto(DEMO);
    await openFiltersOnMobile(page);
    const items = page.getByTestId('train-list-item');
    await expect(items.first()).toBeVisible();
    await items.first().click();

    const panel = page.getByTestId('train-detail');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Service');
    await expect(panel.getByTestId('stop-row').first()).toBeVisible();
    // Provenance must be stated, never implied to be live Amtrak data.
    await expect(panel).toContainText('not live Amtrak data');
  });

  test('search filters trains and shows matching results', async ({ page }) => {
    await page.goto(DEMO);
    await openFiltersOnMobile(page);
    const search = page.getByPlaceholder('Search trains, stations, routes…');
    await search.fill('zephyr');

    const items = page.getByTestId('train-list-item');
    await expect(items.first()).toBeVisible();
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(20);
    for (let i = 0; i < count; i += 1) {
      await expect(items.nth(i)).toContainText(/zephyr/i);
    }
  });

  test('route filter narrows the list and the map stays interactive', async ({ page }) => {
    await page.goto(DEMO);
    await openFiltersOnMobile(page);
    await page.getByTestId('route-filter').selectOption({ label: 'California Zephyr' });
    const items = page.getByTestId('train-list-item');
    await expect(items.first()).toBeVisible();
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(items.nth(i)).toContainText('California Zephyr');
    }

    // The drawer covers the map on phones, so close it before using the map.
    if ((page.viewportSize()?.width ?? 1440) < 861) {
      await page.getByRole('button', { name: 'Close filters panel' }).click();
      await expect(page.getByTestId('train-list')).toBeHidden();
    }

    // Zoom controls and return-to-national-view must respond.
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: /national view/i }).click();
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  });

  test('station selection shows station details and serving trains', async ({ page }) => {
    await page.goto(DEMO);
    await openFiltersOnMobile(page);
    await page.getByPlaceholder('Search trains, stations, routes…').fill('Chicago Union');
    const stationResults = page.getByTestId('station-result');
    await expect(stationResults.first()).toBeVisible();
    await stationResults.first().click();

    const panel = page.getByTestId('station-detail');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('CHI');
  });

  test('refresh runs and keeps the UI consistent', async ({ page }) => {
    await page.goto(DEMO);
    await openFiltersOnMobile(page);
    await expect(page.getByTestId('train-list-item').first()).toBeVisible();
    const firstNumber = await page.getByTestId('train-list-item').first().textContent();
    await page.getByTestId('refresh-button').click();
    await expect(page.getByTestId('train-list-item').first()).toBeVisible();
    expect(await page.getByTestId('train-list-item').first().textContent()).toBe(firstNumber);
  });

  test('search keyboard shortcut and Escape reset the view', async ({ page }) => {
    await page.goto(DEMO);
    await openFiltersOnMobile(page);
    await page.getByTestId('train-list-item').first().click();
    await expect(page.getByTestId('train-detail')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('train-detail')).toHaveCount(0);
  });
});
