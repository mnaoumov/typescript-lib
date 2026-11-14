/**
 * @file
 *
 * Yields one macrotask by posting a `MessageChannel` message to itself, and debounces on the same turn.
 *
 * A zero-length timer is the usual way to give the event loop a turn, but Chromium throttles chained timers in a hidden
 * window, down to about one wake-up a minute, and `requestAnimationFrame` does not fire there at all. A message posted
 * to oneself is not throttled, so a long job paced by these helpers keeps its speed while the window is behind another
 * one. `MessageChannel` exists in every browser renderer, in Obsidian on desktop and mobile, and in Node, unlike the
 * Node-only `setImmediate`.
 *
 * The channel is opened on the first turn and closed as soon as nothing waits: an open port with a handler keeps its
 * bundle alive after a plugin unloads, and keeps a Node process from exiting.
 *
 * Ported from `src/turn.ts` of `@insurgently/obsidian-ui` 0.4.0 (https://github.com/insurgently/insurgently-obsidian-ui),
 * under its MIT license:
 *
 * MIT License
 *
 * Copyright (c) 2026 Insurgently
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { invokeAsyncSafely } from './async.ts';

interface EventLoopTurnState {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- Opened on the first turn and cleared once nothing waits.
  channel: MessageChannel | null;
  readonly waiting: (() => void)[];
}

const state: EventLoopTurnState = {
  channel: null,
  waiting: []
};

/**
 * Returns a function that calls `callback` once on the next event loop turn, however many times it is called before then.
 *
 * It is a debounce that, unlike one built on a timer, is not slowed while the window is hidden.
 *
 * @param callback - The function to call.
 * @returns The coalescing function.
 */
export function coalesce(callback: () => void): () => void {
  let isQueued = false;
  return (): void => {
    if (isQueued) {
      return;
    }
    isQueued = true;
    invokeAsyncSafely(async () => {
      await yieldToEventLoop();
      isQueued = false;
      callback();
    });
  };
}

/**
 * Checks whether the channel behind {@link yieldToEventLoop} is open.
 *
 * It is closed once every pending turn has run, so a test can assert that nothing is left to keep a process or an
 * unloaded plugin's bundle alive.
 *
 * @returns `true` while a turn is pending.
 */
export function isEventLoopTurnPending(): boolean {
  return state.channel !== null;
}

/**
 * Gives the event loop one turn (one macrotask), by posting a `MessageChannel` message to itself.
 *
 * Unlike a zero-length timer or `requestAnimationFrame`, it is not throttled in a hidden window, and unlike
 * `setImmediate` it works outside Node.
 *
 * @returns A promise that resolves on the next event loop turn.
 */
export async function yieldToEventLoop(): Promise<void> {
  state.channel ??= openChannel();
  const channel = state.channel;
  return new Promise<void>((resolve) => {
    state.waiting.push(resolve);
    channel.port2.postMessage(null);
  });
}

function openChannel(): MessageChannel {
  const channel = new MessageChannel();
  function handleMessage(): void {
    state.waiting.shift()?.();
    // A continuation runs after this handler returns, so a turn it asks for finds the channel closed and opens a new one.
    if (state.waiting.length > 0) {
      return;
    }
    // Forget the channel first, so a port that cannot close never leaves it half open for the next turn.
    state.channel = null;
    channel.port1.removeEventListener('message', handleMessage);
    channel.port1.close();
    channel.port2.close();
  }
  channel.port1.addEventListener('message', handleMessage);
  // A port listened to through `addEventListener` delivers nothing until it is started.
  channel.port1.start();
  return channel;
}
