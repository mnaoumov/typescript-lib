---
title: Debugging
description: Write namespaced debug messages, and turn them on from the console with the `DebugController`.
---

`@mnaoumov/typescript-lib` writes its debug messages through the [debug](https://github.com/debug-js/debug) library, and gives you the same machinery for your own. Every message belongs to a namespace, and none is shown until its namespace is enabled.

## Writing debug messages

`getDebugger` returns a debugger for a namespace. Call it like a function:

<!-- snippet-check: context declare const items: readonly unknown[]; -->

```typescript
import { getDebugger } from '@mnaoumov/typescript-lib/debug';

const debug = getDebugger('my-app:sync');

debug('Synced %d items', items.length);
```

The message is written with `console.debug`. When the host initialized the library with `shouldPrintStackTrace: true` (see [Getting started](/typescript-lib/guides/getting-started/#initializing-the-library)), each message also carries the stack trace of the line that wrote it.

The library's own messages live under its debug namespace, `typescript-lib` by default, behind the host's `debugPrefixNamespace`. A host built on the library, such as an Obsidian plugin, passes its own prefix, so the library's messages inside plugin `my-plugin` are under `my-plugin:typescript-lib:*`.

## Showing debug messages

Browser and Electron consoles hide `console.debug` output until you enable the **Verbose** level in the console's log-level filter. Do that first, or nothing below shows anything.

Then enable the namespaces you want. `getDebugController` returns a `DebugController`, which a host typically exposes as `window.DEBUG` so you can call it from the console:

```javascript
window.DEBUG.enable('my-app'); // the `my-app` namespace itself
window.DEBUG.enable('my-app:*'); // everything under `my-app`
window.DEBUG.enable('*:typescript-lib:*'); // the library's own messages, inside any host
window.DEBUG.enable('*'); // everything
window.DEBUG.disable('my-app:sync'); // hide one namespace again
window.DEBUG.get(); // the current list, e.g. ['my-app:*', '-my-app:sync']
window.DEBUG.set(''); // hide everything
```

A namespace prefixed with `-` is explicitly disabled and wins over a wildcard that would enable it. Several namespaces can be given as an array or as one comma-separated string. The setting is stored by the debug library (in `localStorage` in a browser), so it survives a reload.

Calling the controller is meant for the console. Do not leave such calls in shipped code.

> [!NOTE]
>
> With stack traces on, debug messages show a `CustomStackTraceError`. It is not an error: it is how the message carries a clickable stack trace.
