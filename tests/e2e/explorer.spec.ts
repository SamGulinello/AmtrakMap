import { expect, test } from './fixtures';

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

test.describe('Amtrak Live Explorer', () => {
  test('renders the national map, network summary, and demo labelling', async ({ page }) => {
    await page.goto(DEMO);

    await expect(page.getByTestId('status-strip')).toBeVisible();
    await expect(page.getByTestId('source-badge')).toHaveAttribute('aria-label', /demo snapshot/i);
    const feedRead = page.getByTestId('last-updated');
    await expect(feedRead).toContainText(/Feed read|Last good read/);
    // Phones hide the visible prefix, so the full sentence must survive as the
    // accessible name rather than being dropped from the DOM.
    await expect(feedRead).toHaveAttribute('aria-label', /^Feed read |^Last good read /);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();

    // The network summary lives in the filters panel, a drawer on phones.
    await openFiltersOnMobile(page);
    const positions = page.getByTestId('summary-positions');
    await expect(positions).toHaveCount(1);
    await expect(positions).toBeVisible();
    expect(Number((await positions.textContent())?.trim())).toBeGreaterThan(50);
    await expect(page.getByTestId('summary-stations')).not.toHaveText('0');
    // Freshness must be stated in terms of the source's data, not the page load,
    // and demo data must never be dressed up as live.
    await expect(page.getByTestId('freshness-line').first()).toContainText(/Snapshot positions averaged/);
    await expect(page.getByTestId('source-line')).toContainText(/demo/i);
  });

  test('the header fits the viewport without clipping its controls', async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.getByTestId('refresh-button')).toBeVisible();

    const header = page.locator('.app-header');
    const overflow = await header.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, 'header content is wider than the header').toBeLessThanOrEqual(1);

    // A control clipped by the viewport edge is still "visible" to Playwright, so
    // assert the button genuinely sits inside the window.
    const refresh = await page.getByTestId('refresh-button').boundingBox();
    const viewport = page.viewportSize()!;
    expect(refresh!.x + refresh!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(refresh!.x).toBeGreaterThanOrEqual(0);

    // The visible time must stay on one line; a wrapped clock made the header
    // four lines tall on a phone.
    const time = await page.getByTestId('last-updated').boundingBox();
    expect(time!.height).toBeLessThan(30);
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

test.describe('keyboard navigation', () => {
  test('"/" focuses search without stealing keys from a text field', async ({ page }) => {
    await page.goto(DEMO);
    const search = page.getByPlaceholder('Search trains, stations, routes…');

    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('/');
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');

    // A literal slash typed into the field must reach the field, not refocus it.
    await search.fill('a');
    await page.keyboard.press('/');
    await expect(search).toHaveValue('a/');
  });
});

test.describe('degraded conditions', () => {
  test('shows an offline notice instead of silently pretending to be live', async ({ page, context, consoleGuard }) => {
    await page.goto(DEMO);
    await expect(page.getByTestId('data-notice')).toHaveCount(0);

    consoleGuard.ignore = true;
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    const notice = page.getByTestId('data-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Offline.');

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(notice).toHaveCount(0);
  });

  test('falls back to the labelled snapshot when the live feed is unreachable', async ({ page, context, consoleGuard }) => {
    // Block the upstream API before the app boots so the live provider fails.
    await context.route('https://api.amtraker.com/**', (route) => route.abort());
    consoleGuard.ignore = true;
    await page.goto('/');

        const notice = page.getByTestId('data-notice');
    await expect(notice).toBeVisible({ timeout: 30_000 });
    await expect(notice).toContainText('Data source problem');

    // Whatever is displayed must still be honestly labelled as a snapshot.
    await expect(page.getByTestId('source-badge')).toHaveAttribute('aria-label', /demo snapshot/i);
  });

  test('reports a hard load failure instead of spinning forever', async ({ page, context, consoleGuard }) => {
    // Break both the live feed and the snapshot chunk so no data path works.
    await context.route('https://api.amtraker.com/**', (route) => route.abort());
    await context.route('**/amtraker-trains.snapshot*.js', (route) => route.abort());
    consoleGuard.ignore = true;
    await page.goto('/?mode=demo');

    const bootError = page.getByTestId('boot-error');
    await expect(bootError).toBeVisible({ timeout: 20_000 });
    await expect(bootError).toContainText('could not be loaded');
    await expect(bootError.getByTestId('boot-retry')).toBeVisible();
  });

  test('explains an empty filter result rather than showing a blank list', async ({ page }) => {
    await page.goto(DEMO);
    await openFiltersOnMobile(page);
    await page.getByPlaceholder('Search trains, stations, routes…').fill('zzzznotarealtrain');
    const empty = page.getByTestId('empty-state');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('No matches');
  });
});
