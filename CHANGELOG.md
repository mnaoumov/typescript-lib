# CHANGELOG

## 1.6.1

- fix(error): keep printError from hiding the error it prints

## 1.6.0

- feat(debug): let Library.init take debug namespace aliases
- chore(build): drop the duplicate build:compile:typescript script
- build(docs): use typescript-dev-toolkit 3.7.0's shared guide-snippet and outdated-reference checks
- docs: check guide snippets and retired obsidian-dev-utils references
- build(deps): take typescript-dev-toolkit 3.6.2 for the logo-aware OG card cache
- docs: replace the docs site logo and favicon with the approved mark

## 1.5.0

- feat: add an api-contract verifier, objectGuard/optionsGuard and exact-optional objectTypeGuard

## 1.4.0

- feat(debug-switches): add a debug switch registry

## 1.3.0

- feat(type-guards): add type-guard combinators and a vendor-bound schema builder
- build: validate the published output's dependencies in the build
- ci(docs-site): set the repository homepage from the docs site build
- build(deps): take typescript-dev-toolkit 3.0.0
- docs: show the package logo as the home page hero image

## 1.2.0

- feat(async): add an app-wide switch for runWithTimeout's default termination
- docs: link mnaoumov.dev/typescript-lib from the README

## 1.1.1

- docs: publish the documentation site at mnaoumov.dev/typescript-lib
- build(deps): take @mnaoumov/typescript-dev-toolkit 2.0.0 and its rule namespace

## 1.1.0

- feat(api-contract): add the api-contract subpath

## 1.0.1

- build: keep pure subpaths free of node and DOM globals
- build: add the lockfile, resolved against npm now that every sibling is published
- docs: drop the stale note about the seeded lock holding obsidian 1.13.1

## 1.0.0

- Initial release as a standalone repository: the package moved out of the [`obsidian-dev-utils`](https://github.com/mnaoumov/obsidian-dev-utils) workspace with its history, and its version line restarts at `1.0.0`
