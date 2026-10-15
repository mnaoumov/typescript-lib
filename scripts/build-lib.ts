/**
 * @file
 *
 * Builds the library: unbundled CommonJS and ESM output.
 */

import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { buildLibrary } from '@mnaoumov/typescript-dev-toolkit/library-build';

await wrapCliTask(async () => {
  await buildLibrary();
});
