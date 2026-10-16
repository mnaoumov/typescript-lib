---
title: Getting started
description: Install `@mnaoumov/typescript-lib` and import its helpers by subpath.
sidebar:
    order: 0
---

`@mnaoumov/typescript-lib` is a collection of generic TypeScript utilities: async helpers, errors, disposables, strings, paths, debug logging, value transformers and DOM helpers. It depends on no other `@mnaoumov` package and runs in Node, in a browser renderer and inside Obsidian, desktop and mobile.

## Installation

```bash
npm install @mnaoumov/typescript-lib
```

The package ships ESM and CommonJS builds, each with its own declarations, so it works from either module system.

## Importing

Every module of the library is a subpath of the package, named after its file. Import a helper from the module that declares it:

```typescript
import { unique } from '@mnaoumov/typescript-lib/array';
import { sleep } from '@mnaoumov/typescript-lib/async';

const ids = unique([1, 1, 2]);
await sleep({ milliseconds: 100 });
```

A folder of modules is a subpath too, and so is each module inside it:

```typescript
import { DateTransformer } from '@mnaoumov/typescript-lib/transformers/date-transformer';
```

The package root and every folder also re-export their modules as namespaces, named after the module. Most module names are kebab-case, which is not a valid JavaScript identifier, so those namespaces need bracket notation:

```typescript
import * as typescriptLib from '@mnaoumov/typescript-lib';

const ids = typescriptLib.array.unique([1, 1, 2]);
const controller = typescriptLib['abort-controller'];
```

Prefer the module subpath. A namespace import from the root loads every module of the library, while a subpath loads only the module it names and what that module imports.

## Platform-only modules

A module that only works on one platform says so in its name: a `desktop-` prefix for desktop (Node and Electron) only, a `mobile-` prefix for mobile only. Importing one is safe everywhere; calling it on the other platform is not. Every other module is cross-platform.

## Initializing the library

The library carries no knowledge of who hosts it. A host that wants its own debug namespace, a stack trace on every debug message, or a link to its own debugging guide in the library's messages pushes that configuration once, at startup:

```typescript
import { Library } from '@mnaoumov/typescript-lib/library';

Library.init({
  debugPrefixNamespace: 'my-app:',
  shouldPrintStackTrace: true
});
```

Calling `Library.init` a second time throws. `Library.resetToDefault` clears the configuration, for example between tests. See [Debugging](/typescript-lib/guides/debugging/) for what the debug settings change.

## Where to go next

- [Debugging](/typescript-lib/guides/debugging/): turn the library's debug messages, and your own, on and off.
- [API reference](/typescript-lib/api/): every module and export, generated from the library's TSDoc.
