import type { ViteUserConfig } from 'vitest/config';

import { getStrykerTestInclude } from '@mnaoumov/typescript-dev-toolkit/test-runners/stryker-config';
import { DEFAULT_VITEST_TEST_EXCLUDE } from '@mnaoumov/typescript-dev-toolkit/test-runners/vitest-config';

import { selfSourcePlugin } from './scripts/vitest-self-source.ts';

// The mutation run's vitest configuration: the `unit-tests` and `unit-tests:global-stubs` projects flattened into one,
// since Stryker's vitest runner forces its own pool anyway, and that pool lets `vi.stubGlobal` redefine `window`.
const config: ViteUserConfig = {
  plugins: [selfSourcePlugin('@mnaoumov/typescript-lib')],
  test: {
    environment: 'jsdom',
    exclude: [...DEFAULT_VITEST_TEST_EXCLUDE, 'src/**/*.integration.test.ts'],
    globals: false,
    include: getStrykerTestInclude(['src/**/*.test.ts']),
    server: {
      // eslint-disable-next-line unicorn/name-replacements -- `deps` is a Vitest config key.
      deps: {
        inline: ['@mnaoumov/typescript-test-toolkit']
      }
    },
    setupFiles: ['@mnaoumov/typescript-test-toolkit/vitest-setup']
  }
};

export default config;
