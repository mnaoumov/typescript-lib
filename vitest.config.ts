import {
  DEFAULT_VITEST_TEST_EXCLUDE,
  defineLibraryVitestConfig
} from '@mnaoumov/typescript-dev-toolkit/test-runners/vitest-config';

import { selfSourcePlugin } from './scripts/vitest-self-source.ts';

// The files that `vi.stubGlobal` a DOM global the VM pool cannot redefine. See the AGENTS.md section on
// `pool: 'vmThreads'`: they keep the default pool, in a sibling project.
const GLOBAL_STUB_TEST_FILES = [
  'src/abort-controller.test.ts',
  'src/async.test.ts',
  'src/blob.test.ts'
];

const SETUP_FILES = ['@mnaoumov/typescript-test-toolkit/vitest-setup'];

const SHARED_SERVER = {
  // eslint-disable-next-line unicorn/name-replacements -- `deps` is a Vitest config key.
  deps: {
    // Processed by Vite, so its own imports of this package reach the sources through `selfSourcePlugin`.
    inline: ['@mnaoumov/typescript-test-toolkit']
  }
};

export default defineLibraryVitestConfig({
  plugins: [selfSourcePlugin('@mnaoumov/typescript-lib')],
  projects: [
    {
      test: {
        environment: 'jsdom',
        exclude: [...DEFAULT_VITEST_TEST_EXCLUDE, '**/*.integration.test.ts', ...GLOBAL_STUB_TEST_FILES],
        include: ['src/**/*.test.ts'],
        name: 'unit-tests',
        pool: 'vmThreads',
        server: SHARED_SERVER,
        setupFiles: SETUP_FILES
      }
    },
    {
      test: {
        environment: 'jsdom',
        exclude: [...DEFAULT_VITEST_TEST_EXCLUDE],
        include: GLOBAL_STUB_TEST_FILES,
        name: 'unit-tests:global-stubs',
        server: SHARED_SERVER,
        setupFiles: SETUP_FILES
      }
    },
    {
      test: {
        environment: 'node',
        exclude: [...DEFAULT_VITEST_TEST_EXCLUDE],
        // The scripts' own helpers, such as the documentation checks; outside `src/`, so outside the coverage gate.
        include: ['scripts/**/*.test.ts'],
        name: 'unit-tests:scripts',
        setupFiles: []
      }
    }
  ]
});
