import { expect, test as base } from '@playwright/test';

/**
 * Shared test harness. Every scenario fails if the page logs a console error or
 * throws an uncaught exception, so a silent runtime break cannot slip through a
 * passing assertion.
 *
 * Scenarios that break the network on purpose opt out, because Chromium reports
 * deliberately aborted requests as console errors:
 *
 *   async ({ page, consoleGuard }) => {
 *     consoleGuard.ignore = true;
 *     ...
 *   }
 */
export type ConsoleGuard = { ignore: boolean };

export const test = base.extend<{ consoleGuard: ConsoleGuard; watchConsole: void }>({
  consoleGuard: async ({}, use) => {
    await use({ ignore: false });
  },

  watchConsole: [
    async ({ page, consoleGuard }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

      await use();

      if (consoleGuard.ignore) return;
      expect(
        errors,
        'the page logged console errors or threw during this scenario',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
