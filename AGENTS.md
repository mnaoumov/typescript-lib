# AGENTS.md

## Filing an issue (for AI agents and humans)

Open issues through the [issue forms](https://github.com/mnaoumov/typescript-lib/issues/new/choose), not as blank issues.

Filing from the CLI or the API (`gh issue create --body`, or an AI agent filing for you) skips the form, and `gh issue create --template` cannot load an issue form. In that case, open the matching form in [`.github/ISSUE_TEMPLATE/`](https://github.com/mnaoumov/typescript-lib/tree/HEAD/.github/ISSUE_TEMPLATE), copy every field as a `### <label>` heading in the form's order, and fill in each one. Always state the version you used and your operating system.

## Project overview

`@mnaoumov/typescript-lib` — Generic TypeScript utilities: async helpers, errors, disposables, strings, paths, debug logging and more, usable in any TypeScript project.

It is the bottom of the `@mnaoumov` package graph: it depends on none of the others, and the four other packages all depend on it. It runs in Node, in a browser renderer and inside Obsidian, desktop and mobile, so its ESLint config holds shipped source to Node 16.16.0 (`minimumNodeVersion` in `scripts/eslint-config.ts`), the oldest Node an Obsidian installer that still receives updates ships.

- `src/` — the sources, one module per file, each a published subpath (`@mnaoumov/typescript-lib/<module>`). The `index.ts` barrels and the `.d.ts` files beside the sources are build outputs and gitignored.
- A module that only works on one platform carries a `desktop-` / `mobile-` prefix (`desktop-zip-extractor.ts`), and the ESLint config lets exactly those import Node builtins. See the carried rule L5 below.
- `unicorn/prefer-global-this` is off: the DOM helpers address `window` on purpose, and the rule's autofix chains with `unicorn/no-unnecessary-global-this` into a bare global read that throws exactly where the global is absent.
- **A debug namespace controls logging only, never behavior.** Behavior that should change while debugging is a named debug switch in `debug-switches.ts` (`registerDebugSwitch`, ids namespaced like `typescript-lib:terminate-on-timeout`), which a settings UI lists generically with `getDebugSwitches()`. Never gate behavior on a debugger's `enabled`.
- The shared state lives in a realm-global slot (`typescript-lib-state.ts`, `async-operation-hook.ts`), so two loaded copies of this package share it. Tests prove that with a second copy loaded through `vi.resetModules()`.

## Commands

Every script is a thin entry point under `scripts/`, run with `jiti`, over the shared tooling in `@mnaoumov/typescript-dev-toolkit` (and `@mnaoumov/obsidian-dev-toolkit` for an Obsidian package).

- `npm run gate` — **the branch gate: run it before committing.** It is the same code `npm run version` runs as its release preflight: the lockfile check, `format:check`, `spellcheck`, `lint:md`, `build`, `lint`, `find-overexposed`, `test:coverage`. `npm run gate -- --no-build` skips the build when the output is current. CI (`.github/workflows/ci.yml`) runs the whole gate.
- `npm run build` — every `build:*` step this package defines, in order (`scripts/build.ts`).
- `npm test` / `npm run test:coverage` / `npm run test:watch` — the unit tests; `test:coverage` holds all four thresholds at 100%. Arguments after `--` reach vitest, so `npm test -- src/foo.test.ts` runs that one file.
- `npm run test:mutation [-- src/<module>.ts ...]` — Stryker mutation testing, on demand only and never in the gate: with module paths it mutates those modules and runs only their sibling tests, with none it mutates everything, incrementally. It runs in place, so it refuses an uncommitted tree, and nothing may be edited while it runs. `stryker.config.mjs` and `vitest.stryker.config.ts` (the two `unit-tests` projects flattened into one, on Stryker's own pool) configure it; the reports land in the gitignored `reports/mutation/`.
- `npm run lint` / `npm run lint:fix` — ESLint. A warning fails it. ESLint is type-aware and reads the generated barrels, so build first on a fresh clone.
- `npm run lint:md` / `npm run lint:md:fix`, `npm run format` / `npm run format:check`, `npm run spellcheck` — markdownlint (with the soft-break rule on: every paragraph is one physical line), dprint and cspell.
- `npm run docs:build` / `npm run docs:dev` / `npm run docs:preview` — this package's documentation site, built with `@mnaoumov/typescript-dev-toolkit`'s docs-site builder (`scripts/docs-site-config.ts`, `astro.config.ts`, `docs/`): the API reference generated into `docs/src/content/docs/api`, the Open Graph cards, `astro build` into `docs/dist`, then a check of every link of the output, external ones included. `.github/workflows/build-pages.yml` builds and deploys it to `https://mnaoumov.dev/typescript-lib/` on every published release. This site is first in the deploy order of the five `@mnaoumov` sites, because it links to none of the others and they all link to it.
- `npm run docs:check-snippets` — type-checks every fenced `ts` / `js` block of the guides against `src/`, with `@mnaoumov/typescript-dev-toolkit/docs-site/docs-snippets` and this package's prelude (`scripts/docs-snippet-prelude.ts`, the names every guide may use undeclared). The gate runs the same check in `scripts/docs-checks.test.ts` (the `unit-tests:scripts` project), beside `docs-site/outdated-references`, which fails on a retired `obsidian-dev-utils` module path, repository link or console recipe. An HTML comment above a fence shapes its check: `<!-- snippet-check: context <declarations> -->` declares names the prose already introduced, and `<!-- snippet-check: skip <reason> -->` exempts deliberate pseudo-code. A line that names an old address on purpose carries `outdated-reference-ok`.
- `npm run commit` — a guided Conventional-Commits message.
- `npm run version '--' <type> [--no-changelog-editing]` — the release. Quote the `--` in PowerShell.

## Standalone layout

This package moved out of the `obsidian-dev-utils` workspace, with its history, on 2026-10-15. Five things differ from the workspace and are easy to undo by accident:

- **A sibling `@mnaoumov/*` package is an ordinary dependency, installed from npm.** There is no `@mnaoumov/source` export condition any more: `generateLibraryExports` writes none unless asked, and `package.json`'s dependencies are the package boundary the workspace's ESLint config used to enforce.
- **A package cannot install itself, so its own scripts never import it by name.** In the tooling packages the scripts import `../src/*.ts`, so the toolkit builds and lints itself from its sources.
- **A test-support package that depends on this one would otherwise bring a SECOND copy of it into a test run.** Where that happens (`typescript-lib`, `obsidian-lib`), `scripts/vitest-self-source.ts` resolves this package's own name onto `src/`, the test-support packages are listed in the vitest projects' `server.deps.inline` so their imports go through it, and `tsconfig.json`'s `paths` does the same for the types. Drop any of the three and a test-setup reset reaches a different module instance than the code under test.
- **A package a test mocks through must be processed by Vite.** A dependency Node loads directly ignores `vi.mock` and survives `vi.resetModules()`, so a test that mocks `node:fs` underneath a toolkit helper, or that loads a second copy of a module on purpose, needs that dependency in `server.deps.inline`.
- **The first `package-lock.json` was seeded from the workspace lock**, so every dependency starts at the version the workspace tested rather than at whatever each range resolves to today.

## Releasing

`npm run version '--' <patch|minor|major>` runs the gate, bumps the version, writes `CHANGELOG.md`, commits, tags, pushes and creates the GitHub release. The release carries no assets. Publishing the release triggers `.github/workflows/publish-npm.yml`, which rebuilds and runs `npm publish` through npm trusted publishing (OIDC): no npm token exists anywhere, and a publish from a developer machine is not possible. The package's trusted publisher on npmjs.com names this repository and `publish-npm.yml`; renaming the workflow breaks publishing until that setting matches.

`1.0.0` was published once from the `obsidian-dev-utils` workspace, all five packages together, because each package's tooling depends on siblings that were not on npm yet. This repository releases from `1.0.1` on; the `1.0.0` tag marks where it took over.

## Commits

Conventional Commits, enforced by commitlint in the `commit-msg` hook, which also refuses a header the spellchecker rejects. The `pre-commit` hook runs nano-staged: spellcheck, `lint:fix`, `format` and `lint:md:fix` on the staged files. Set `NANO_STAGED=0` in a gitignored `.env` to skip it.

## Carried over from obsidian-dev-utils

These sections were written in the `obsidian-dev-utils` workspace, where this package lived until it moved here with its history, and they still govern it. "This repository" or "this library" in them means that workspace; a path of another package is written `mnaoumov/<package>:<path>`, the file in that package's own repository.

### File Structure

Every source file follows this pattern:

```typescript
/**
 * @file
 *
 * Brief description of module purpose.
 */

import type { SomeType } from './some-module.ts';

import { something } from './other-module.ts';

export function myFunction(param: Type): ReturnType {
  // ...
}
```

### Naming

- Directories: kebab-case (e.g., `script-utils/bundlers/esbuild-impl`, `test-runners`)
- **Exception:** `constructors/` files use camelCase matching the exported function name (e.g., `getDomEventsHandlersConstructor.ts`), mirroring the `obsidian-typings` Constructors convention
- **An `Async` suffix disambiguates, it does NOT mean "this returns a promise".** Add it only when a synchronous counterpart of the same name already exists and would otherwise collide. Being `async` is never on its own a reason for the suffix — measured 2026-07-31, ~18 suffixed members against ~179 async members without one, and **every** established use resolves a name collision: `onloadAsync` (Obsidian's `onload`), `hideAsync`, `triggerAsync`/`tryTriggerAsync`, `createDivAsync`/`createElAsync`/… (Obsidian's sync `createDiv`/`createEl`), `setTimeoutAsync`/`requestAnimationFrameAsync`/`setImmediateAsync`/ `nextTickAsync` (the callback-based globals), `replaceAllAsync` (`String.replaceAll`), `noopAsync` (`noop`). (`invokeAsyncSafely` is not a counter-example — its `Async` is mid-name, describing what it invokes.) A `*Params` interface is named after its method, so it follows the method either way.

### Documentation

- Every exported function/class requires JSDoc with `@param` and `@returns` tags
- Every file requires a `@file` JSDoc comment at the top
- Test files and mock files are exempt from documentation requirements

### Imports

- Sorted alphabetically (enforced by `eslint-plugin-perfectionist`)
- Always include `.ts` extension in relative imports

### Interface members

- Interface and object-type-alias property signatures are readonly by default, enforced by `typescript-dev-toolkit/readonly-interface-members`. A member that is reassigned needs a property-level `eslint-disable-next-line` explaining the mutation, as in `src/error.ts`'s shared state. This rule does not make array elements readonly.

### L2. Timing primitives must be fake-timer controllable

- Delay/timeout primitives (e.g. `sleep`, `abortSignalTimeout`, `setTimeoutAsync`) must be built on `globalThis.setTimeout`, never on the native `AbortSignal.timeout`. Vitest fake timers patch `setTimeout` but not `AbortSignal.timeout` (it owns an internal timer they cannot advance), so a primitive built on `AbortSignal.timeout` runs in real wall-clock time even under `vi.useFakeTimers()` — making it and everything layered on it non-deterministic and slow to test.
- Use `globalThis.setTimeout`, not `window.setTimeout`. `globalThis.setTimeout` is present (and fake-timer patched) in BOTH browser/jsdom and Node — under jsdom `window === globalThis`, so nothing changes there — but it additionally works in a `node` environment where `window` is undefined. This matters because consumer integration-test projects run vitest `environment: 'node'`: a hook that awaits `sleep` there would throw `ReferenceError: window is not defined` if the primitive were built on `window.setTimeout`.
- This applies transitively: any helper that awaits a delay (like `sleep` awaiting `abortSignalTimeout`) inherits the (un)controllability of the underlying timer, so the requirement is on the lowest-level primitive.
- When reimplementing a native timing primitive this way, mirror the native abort reason so consumers see identical behavior: `abortSignalTimeout` aborts with a `DOMException` named `TimeoutError` (as native `AbortSignal.timeout` does), not a plain `Error`.
- (cannot be forced by ESLint — a custom `no-restricted-syntax` selector could flag `AbortSignal.timeout` usage in `src/`)

### L5. Platform-only modules carry a `desktop-` / `mobile-` filename prefix

- A module that only works on (or is only meant for) **desktop** must have a `desktop-` filename prefix; a **mobile**-only module must have a `mobile-` prefix. The prefix marks the file, not its exports — e.g. `desktop-trusted-input.ts` exports `typeIntoEditor`, not `desktopTypeIntoEditor`.
- **The `desktop-` prefix is LOAD-BEARING, not advisory** — `getNodeBuiltinsConfigs` in `mnaoumov/obsidian-dev-toolkit:src/linters/eslint-config.ts` keys the Node-builtins exemption off `src/**/desktop-*.ts`, in every plugin built on this library. A desktop-only module that skips the prefix keeps reporting `import-x/no-nodejs-modules` **and** `obsidianmd/no-nodejs-modules`, the second of which a consumer cannot waive (the community-directory runner turns an inline `obsidianmd/*` disable into an error); a cross-platform module that wrongly takes the prefix gets an exemption it should not have. The exemption exists because the `Platform.isDesktopApp` gate lives one file up, in the caller, where neither rule can see it — see **L6**.
- **Tests group by SUT, so they take a dot segment, never the prefix.** A desktop-only test of a cross-platform SUT is `<sut>.desktop.test.ts` / `<sut>.desktop.integration.test.ts` — the subject first, the platform as a dot segment, matching `*.android.integration.test.ts`. A desktop-only module's own co-located test just inherits the module's name (`desktop-zip-extractor.test.ts`), so it is already grouped and already exempt. Both shapes are covered without a further glob: every `*.integration.test.ts` and every `context.testFiles` unit test is exempt from the Node-builtins bans anyway, since neither is ever bundled into `main.js`.
- "Platform-only" means the module directly uses a platform-restricted API (Node builtins, `window.electron`, mobile-only APIs) at the **top level** (so importing the module loads that API). Examples: `desktop-trusted-input.ts` (`window.electron` trusted input), `desktop-demo-vault-opener.ts` (`node:fs`/`node:os` + `window.electron`). A module using only cross-platform APIs at the top level gets no prefix — e.g. `community-plugins.ts` (uses `requestUrl`), and `open-demo-vault-command-handler.ts`, which is desktop-*gated* but stays cross-platform-loadable by dynamic-importing the desktop-only opener (see **L6**).
- **The prefix restricts where a module may be CALLED, never whether it may be IMPORTED — every module in `src/` must survive being imported on either platform.** The generated barrels (`src/**/index.ts`, `mnaoumov/obsidian-lib:src/__merged.ts`) re-export **every** leaf they find, and `src/index.ts` pulls in both, so anything under `src/` is on the load path of every consumer that imports a namespace — and of the integration-test harness plugin, which loads the whole library on a phone. A `desktop-` name therefore buys no exemption from being loaded there; it only says "calling this on mobile is a bug". `desktop-trusted-input.ts` is the model: it names `window.electron` only *inside* its functions, so importing it on mobile is inert.
- **So a platform-only dependency that runs code while INITIALIZING must be dynamically imported.** A static `import { existsSync } from 'node:fs'` is fine (mobile's `require` returns `undefined` and nothing reads it at load time), but a dependency whose own top level *evaluates* a platform-only API is not. `adm-zip` opens with `const { randomFillSync } = require('crypto')`, so a static `import AdmZip from 'adm-zip'` in `desktop-demo-vault-opener.ts` threw during barrel initialization and killed the harness plugin's load on Android — every test in its `integration-tests:android` project failed behind an opaque "plugin failed to load". `adm-zip` has since left this package entirely, so neither half of it is in the tree to inspect: extraction moved to `desktop-zip-extractor.ts`, which needs only `node:zlib`, and the release-time archiver moved to `fflate`. The rule stands for the next such dependency — defer it behind a call-time `import()`, or do without it.
- **A dependency on the plugin-runtime path costs every consumer's bundle, and a dynamic `import()` does NOT buy it back.** An Obsidian plugin ships one CJS `main.js`, esbuild has no code splitting to put a chunk behind, and `await import()` only defers EVALUATION — the module body is inlined either way. Measured 2026-08-31 in `obsidian-fix-tab-size`'s 247 KB bundle: the demo-vault opener and the `adm-zip` it then imported took ~41 KB of it, ~17%, in a plugin that opens no archives of its own. Prefer a Node builtin (already `external`, so free) over a dependency for anything reachable from `mnaoumov/obsidian-lib:src/`.
- `mobile-trusted-input.ts` is the `mobile-` example: it reads `window.__obsidianIntegrationTesting`, a global only the integration-testing harness installs, and calling it anywhere else throws. Like its `desktop-` twin it names that global only *inside* its functions, so importing it on desktop is inert — which it has to be, since the barrels put it on every consumer's load path.
- (the naming half is enforced only in the negative — a non-`desktop-` file using `node:` reports, since it gets no exemption, but a `desktop-` file that uses nothing platform-only is not flagged for taking a prefix it does not need. A custom check could still flag `window.electron` usage in a non-`desktop-` file, which no rule covers. The **import-safety** half IS enforced, by the mobile-load check on the harness plugin bundle described under **Build** — that bundle imports the entire library, so it stands in for the worst-case consumer.)

### L6. Public-facing APIs must be cross-platform-loadable — internalize the platform split

- No **public-facing** API (anything a consuming plugin imports and uses — a command handler, a component, a helper it registers) may force the consumer to write a platform check (`if (Platform.isDesktop) { … }`) or a dynamic `import()` around it. That is too much hassle and leaks an implementation detail. The public entry point must be **cross-platform-loadable**: importing it never loads a platform-only module, so a plugin registers it directly (`new FooCommandHandler({ … })`) on any platform.
- The library **internalizes the platform split**: the public module keeps only cross-platform top-level imports, and defers the desktop-/mobile-only work to a `Platform`-gated **dynamic `import()`** of a `desktop-`/`mobile-` prefixed module (L5) at **call time** — inside a method that only runs on the right platform. This is the library-owned counterpart to the rule a consuming plugin follows (a dual-platform plugin reaching a `desktop-*` module uses a dynamic import); here the library does it so the consumer never has to.
- Reference: `OpenDemoVaultCommandHandler` (`command-handlers/open-demo-vault-command-handler.ts`, no prefix) is registered directly by any plugin; its `canExecute` gates on `Platform.isDesktopApp` (so the command hides on mobile and `execute` runs only on desktop), and `execute` does `const { openDemoVault } = await import('../desktop-demo-vault-opener.ts')` — so the desktop-only opener (static `node:fs` imports) is never on the mobile load path, yet the consumer writes no platform guard. The dynamic `import()` needs no `eslint-disable` (the `no-restricted-syntax` `ImportExpression` ban was removed from the shared config); keep the literal path so esbuild can bundle it.
- **Second reference — a facade over BOTH arms, and the flat-barrel rule it needs.** `trusted-input.ts` (no prefix) exports the same seven helper names as `desktop-trusted-input.ts` and `mobile-trusted-input.ts`, and each one dispatches through a `Platform.isDesktopApp`-gated call-time `import()` of the arm that fits. Unlike the demo-vault case there is no `canExecute` to hide the command on the wrong platform, so the dispatch happens per call, in the helper itself.
  - **That trio is a name collision in the flat barrel**, which is one namespace — and L5 forbids the obvious escape ("the prefix marks the file, not its exports", so no `desktopPressKey`). So `scripts/build-generate-merged.ts` **supersedes**: when an unprefixed module has a `desktop-` / `mobile-` prefixed sibling of the same name in the same directory, the barrel exports the facade and skips the twins. `lib.pressKey` inside an `evalInObsidian` closure is then platform-correct, both published subpaths stay importable, and no export is renamed. The per-directory `index.ts` barrels need none of this — they re-export namespaced (`export * as 'desktop-trusted-input'`), so a same-named sibling never collides there.
  - **A facade may supersede its twins only if it exports every value name they do**, and the generator throws otherwise (`scripts/helpers/module-supersession.ts`). Without that invariant a twin that later grows an export the facade lacks would silently vanish from the flat bag instead of failing the build. A prefixed module with no facade — `desktop-demo-vault-opener.ts` — supersedes nothing and reaches the barrel on its own.
- The rule constrains what the library **forces**, not what a consumer **may** import. A consumer is free to import a `desktop-*` / `mobile-*` module directly — that is a **deliberate platform commitment**: correct for a desktop-only plugin (or for a consumer wrapping both arms in a facade of its own), and a knowingly-wrong choice for a cross-platform plugin (it will break that plugin's load on the other platform). What L6 forbids is the library shipping its **cross-platform-intended** public API as a `desktop-*`/`mobile-*` module, thereby forcing every consumer into a platform guard. So: prefer a cross-platform facade as the primary, documented entry point; still expose the `desktop-*`/`mobile-*` modules for consumers who deliberately opt in.
- (cannot be forced by ESLint — an API-design convention)

### L8. Re-export a type from an ESM-only package through its `import type`, never `export … from`

- `build:validate-declarations` type-checks the emitted `dist/lib/cjs/**/*.d.cts` under CJS resolution. There, any reference to an **ESM-only** dependency (`type-fest`, and anything else without a CJS entry) fails with **TS1479** unless the module specifier carries `with { 'resolution-mode': 'import' }`.
- TypeScript's declaration emit adds that attribute **only to import declarations**. It does NOT add it to a re-export, so `export type { PackageJson } from 'type-fest';` compiles fine in `src/` and then fails the `.d.cts` validation — a break invisible to `lint`, `test`, and `build:compile`.
- Re-export the binding already imported at the top of the file instead (`import type { PackageJson } from 'type-fest';` … `export type { PackageJson };`). The resolution mode stays attached to the import, and both the `.d.cts` and `.d.mts` emit the bare `export type { … };`.
- `unicorn/prefer-export-from` actively pushes back toward the broken form, so the re-export needs an `// eslint-disable-next-line unicorn/prefer-export-from -- …` naming this reason. See `mnaoumov/typescript-dev-toolkit:src/npm.ts` for the reference case.
- (cannot be forced by ESLint — the opposing rule is the one ESLint has; `build:validate-declarations` is the check that catches it)

### Framework

- Vitest with explicit imports (globals: false) — always import `describe`, `it`, `expect`, etc. from `'vitest'`
- Test environment: `node` by default; use `// @vitest-environment jsdom` directive for browser tests
- Coverage provider: v8
- **`unit-tests:obsidian` runs on `pool: 'vmThreads'`, and the one thing that costs is `vi.stubGlobal('window' | 'document', …)`, which throws there.** The pool builds the jsdom once per worker instead of once per test file — measured 2026-09-15 at `test:coverage` 149.79 s → 56.88 s and that project alone 36.06 s → 9.92 s, since Vitest's own advisory had 67% of tracked time going on jsdom construction. Isolation is unaffected (probed directly: no DOM, `globalThis` or prototype state crosses files in one worker) and so is coverage (`coverage/lcov.info` byte-identical to the default pool's over a six-file subset). But a VM context's `window` and `document` are **non-configurable accessors** on its global, so `vi.stubGlobal` fails with `Cannot redefine property: window` — JS semantics, not something to route around. Every other global (`FileReader`, `Image`, `getComputedStyle`, `fetch`, `electron`) stubs normally. A test that needs to stub one of those two goes in `GLOBAL_STUB_TEST_FILES` in `scripts/vitest-config.ts`, which is the sibling `unit-tests:obsidian-global-stubs` project on the default pool. The other remedy the advisory names, `isolate: false`, was measured and is not a trade-off worth revisiting: **91.62 s, slower than the 36.06 s baseline**, with 68 tests failing on shared state. **The shared `defineObsidianPluginVitestConfig` gives every consuming plugin the same pool** on its `unit-tests` project, with the same escape hatch as a context field, `globalStubTestFiles`, which emits a `unit-tests:global-stubs` sibling only when non-empty. Two facts measured before that shipped (2026-09-16) widen what is written above. **The locked set is four globals, not two:** listing the VM global's non-configurable own properties under `jsdom` gives `window`, `top`, `document` and `location` (the default pool locks none of them), and the one that a grep for `stubGlobal` misses is `Object.defineProperty(window, 'location', …)` — a common way to fake `location.reload`. So check a suite by running it with `--pool=vmThreads`, not by grepping it. **The VM context also LACKS globals, silently:** Vitest copies only a fixed handful of Node globals into the `jsdom` window, so `crypto.subtle`, the Web Streams classes, `CompressionStream`, the `Performance*` classes and `URLPattern` are absent under the VM pool while present under the default one. A plugin's canvas hashing failed on `crypto.subtle.digest`, and feature-detecting code would instead pass while testing a fallback Obsidian never runs. `restoreNodeWebGlobals` (`mnaoumov/typescript-test-toolkit:src/node-web-globals.ts`), called from `setup()`, defines each missing name from its Node module and leaves present ones alone. And the project's `execArgv` flag that turns off Node's Web Storage still reaches a `vmThreads` worker: `process.execArgv` carries it and Node's own `localStorage` descriptor is absent, as under `threads`.
  - **A per-file module realm is why `installWarningsAsErrors` marks its listener instead of comparing identity.** Under this pool each test file evaluates the module afresh while `process` stays shared per worker, so an identity check matches nothing and every file appends another `'warning'` listener until Node's `MaxListenersExceededWarning` — which that listener rethrows, failing a blameless file. Any other per-worker registration added here needs the same treatment.
- **A `unit-tests:eslint-typecheck` case timing out at 60 s is machine load, not a broken rule — retry rather than investigate.** That project runs `maxWorkers: 1` with `isolate: false` (`scripts/vitest-config.ts`) and every `@typescript-eslint/rule-tester` case builds a type-aware program, so it is the first thing in the suite to blow the per-test timeout when the box is busy — one case was measured at 141 s under load. It fails as a bare `Error: Test timed out in 60000ms.` inside `RuleTester.js` with no assertion message, which reads like a real regression. Confirm by running the named file alone (`npx vitest run <file>`): if it passes there, nothing is wrong. Do not run `find-overexposed` or another gate concurrently with `test:coverage` — that alone was enough to fail two runs on 2026-09-02, and a failed run also wipes `coverage/`, so there is no lcov left to decode afterwards.
- **`reporters` is PINNED to `['default']`, because vitest's fallback is not one reporter but two — and the one an AI session gets prints no per-file line at all.** An unset `reporters` resolves to `isAgent ? 'minimal' : 'default'`, and `std-env`'s `isAgent` is true inside every AI coding session (it reads `AI_AGENT` plus a dozen tool-specific variables). `MinimalReporter` extends the default one with `summary: false`, `silent: 'passed-only'`, and a `printTestModule` that returns early unless the module FAILED, so a passing file prints nothing at all. Measured here 2026-09-23 on `unit-tests:script-utils` (43 files, vitest 5.0.1), the same command both ways: **0 per-file lines over a 13-line log unset, 46 over a 58-line log pinned**. And `silent: 'passed-only'` also swallows a passing test's console output, so a `console.log` added to find something vanishes for a session and not for a developer. The pin lives in `DEFAULT_VITEST_REPORTERS` (`mnaoumov/typescript-dev-toolkit:src/test-runners/vitest-config.ts`, re-exported by `mnaoumov/obsidian-dev-toolkit:src/test-runners/vitest-config.ts`), is applied by `defineObsidianPluginVitestConfig` so **every consuming plugin gets it**, and is imported by `scripts/vitest-config.ts` rather than restated, since this repo's own config predates the factory. If a test log ever comes back with only totals, check this before suspecting the suite.
- **Do NOT add a reporter that names the file a dead pool worker took with it — vitest 5 does that itself.** `emitUnexpectedExit` is `(code, signal) => …` there, and builds its message from the exit code, the signal, the runner state and the files the worker held. Driven against real runs here on 2026-09-23 in all four shapes: a worker `SIGKILL`ed mid-file, one killed at import before collection, the same under `minimal`, and the realistic one — the dying file among 42 others in a parallel run, which reported `42 passed (43)` AND named the file. Under vitest 4 none of that existed, the run said only `167 passed (168)`, and a reporter reconciling the specifications `onTestRunStart` hands over against the modules that actually reported was the only way to learn which file was lost. Lifting such a reporter into this library was considered on 2026-09-23 and DROPPED on the measurement above: on vitest 5 it would be a module, a test file and a 100%-coverage burden for every consumer, carrying a claim that is no longer true.

### File Conventions

- Test files: `src/[module-name].test.ts` (next to source file, kebab-case)
- Browser tests: `src/[module-name].browser.test.ts` with `// @vitest-environment jsdom`
- Test helpers: `@mnaoumov/typescript-test-toolkit/mock-implementation` (`mockImplementation`)
- **Build-script tests live beside the script, at `scripts/**/*.test.ts`** — collected by `scripts/vitest-config.ts`'s `unit-tests:build-scripts` (`scripts/helpers/**`) and `unit-tests:docs-generator` (`scripts/docs-gen/**`) projects, and linted as TESTS: `defineEslintConfigs` seeds that glob onto `context.testFiles` alongside `src/**/*.test.ts`. It is deliberately in `context.scriptFiles` **as well**, since every script-scoped block only turns rules off (`import-x/no-nodejs-modules`, `unicorn/no-process-exit`) and a build-script test wants those off exactly as its script does. That seeding was missing until 2026-09-15: the first such suite with numbers in it took 37 `no-magic-numbers` errors on the values it exists to record, plus `unicorn/consistent-function-scoping` on the per-suite fixture factories tests are exempted to allow. If a rule is ever turned **on** for `scriptFiles`, it lands on these files too, and flat-config order rather than intent decides which side wins.
- **A test that loads one of this repository's own TypeScript modules through `jiti` belongs in `*.integration.test.ts`, because it corrupts the v8 coverage of that module.** `jiti` compiles the file into a second in-process copy of the same source path, and the merged v8 report then reads the *un-executed* copy for at least some of its lines — measured 2026-09-15 on `no-soft-break-in-paragraph.ts`, which reads 100% under its own test alone and **95.23%, with the rule's own body reported uncovered**, when a test that runs `markdownlint-cli2` (which loads this repo's `.markdownlint-cli2.mjs`, and through it that rule, via `jiti`) sits beside it in the same project. Mocking the vite-side import does NOT fix it — the second copy is the `jiti` one. `test:coverage` runs `--project=unit-tests --project=unit-tests:*` only, so moving such a case to the `integration-tests` project takes it out of the coverage run while keeping it in `npm run test:integration` and in the release preflight. Cover the module itself with a unit sibling that mocks the tool. `markdownlint-content.integration.test.ts` + `markdownlint-content.test.ts` are the worked pair.

### Patterns

```typescript
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { myFunction } from './my-module.ts';

describe('MyModule', () => {
  it('should do something', () => {
    expect(myFunction(input)).toBe(expected);
  });
});
```
