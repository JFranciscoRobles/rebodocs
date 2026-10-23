// The tests, in two sets. `node` is every test of the packages and the demos,
// as `npm test` runs them. `browser` drives the editor itself, in a Chrome
// without a window (`npm run test:browser`): the one installed when there is
// one, or the Chromium of Playwright (`npx playwright install chromium`).

import { existsSync } from 'node:fs';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'];
const chrome = !process.env.CI && CHROME.some((path) => existsSync(path));
const BROWSER_TESTS = 'packages/editor/test/browser/**/*.test.ts';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
          exclude: ['**/node_modules/**', BROWSER_TESTS],
        },
      },
      {
        test: {
          name: 'browser',
          include: [BROWSER_TESTS],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(chrome ? { launchOptions: { channel: 'chrome' } } : {}),
            instances: [{ browser: 'chromium', viewport: { width: 1280, height: 900 } }],
          },
        },
      },
    ],
  },
});
