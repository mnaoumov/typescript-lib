# CHANGELOG

## 3.1.0

- feat(disposable): return DisposableEx from every API that hands out a disposable
- fix(async-events): let a caller generic over the event name forward its listener
- docs(changelog): regroup the published release notes for readers

## 3.0.0

This release has 1 breaking change, 2 fixes and 3 documentation changes. 7 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Breaking changes

- make interface members readonly

### Fixed

- **async:** stop convertAsyncToSync growing its stack trace on every call
- recover stacks when source maps fail

### Documentation

- add a Changelog section to the README
- add See also comparison with similar libraries
- add issue-filing instructions for AI agents

## 2.0.0

This release has 1 breaking change.

### Breaking changes

- **debug:** remove showInitialDebugMessage

## 1.7.0

This release has 1 new feature.

### New

- **debug:** export isDebugNamespaceEnabled and formatDebugGuideReference

## 1.6.2

This release has 2 fixes and 1 documentation change. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Fixed

- **debug:** print no initial debug message while the plugin's debug messages are disabled
- **path:** return the drive root from resolve instead of /F:

### Documentation

- point the debug console recipes and the state-slot doc at obsidian-lib

## 1.6.1

This release has 1 fix.

### Fixed

- **error:** keep printError from hiding the error it prints

## 1.6.0

This release has 1 new feature and 2 documentation changes. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **debug:** let Library.init take debug namespace aliases

### Documentation

- check guide snippets and retired obsidian-dev-utils references
- replace the docs site logo and favicon with the approved mark

## 1.5.0

This release has 1 new feature.

### New

- add an api-contract verifier, objectGuard/optionsGuard and exact-optional objectTypeGuard

## 1.4.0

This release has 1 new feature.

### New

- **debug-switches:** add a debug switch registry

## 1.3.0

This release has 1 new feature and 1 documentation change. 3 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### New

- **type-guards:** add type-guard combinators and a vendor-bound schema builder

### Documentation

- show the package logo as the home page hero image

## 1.2.0

This release has 1 new feature and 1 documentation change.

### New

- **async:** add an app-wide switch for runWithTimeout's default termination

### Documentation

- link mnaoumov.dev/typescript-lib from the README

## 1.1.1

This release has 1 documentation change. 1 maintenance commit (tests, build, CI, refactoring, dependencies) is not listed.

### Documentation

- publish the documentation site at mnaoumov.dev/typescript-lib

## 1.1.0

This release has 1 new feature.

### New

- **api-contract:** add the api-contract subpath

## 1.0.1

This release has 1 documentation change. 2 maintenance commits (tests, build, CI, refactoring, dependencies) are not listed.

### Documentation

- drop the stale note about the seeded lock holding obsidian 1.13.1

## 1.0.0

- Initial release as a standalone repository: the package moved out of the [`obsidian-dev-utils`](https://github.com/mnaoumov/obsidian-dev-utils) workspace with its history, and its version line restarts at `1.0.0`
