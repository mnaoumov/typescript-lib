/**
 * @file
 *
 * The ambient context every snippet of the documentation guides is compiled with, shared by the
 * `docs:check-snippets` script and the gate's `docs-checks.test.ts`.
 */

/**
 * The names a guide may use without declaring them.
 */
export const DOCS_SNIPPET_PRELUDE = `import type { DebugController } from '@mnaoumov/typescript-lib/debug-controller';

declare global {
  interface Window {
    /** The devtools-console debug controller a host installs (see the Debugging guide). */
    DEBUG: DebugController;
  }
}
`;
