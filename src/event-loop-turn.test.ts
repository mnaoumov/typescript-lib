import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  coalesce,
  isEventLoopTurnPending,
  yieldToEventLoop
} from './event-loop-turn.ts';

describe('yieldToEventLoop', () => {
  it('should resolve after pending microtasks', async () => {
    const order: string[] = [];
    const promise = yieldToEventLoop().then(() => {
      order.push('turn');
    });
    queueMicrotask(() => {
      order.push('microtask');
    });
    await promise;
    expect(order).toEqual(['microtask', 'turn']);
  });

  it('should resolve concurrent turns in call order and then close the channel', async () => {
    const order: number[] = [];
    const promises = [1, 2, 3].map(async (value) => {
      await yieldToEventLoop();
      order.push(value);
    });
    expect(isEventLoopTurnPending()).toBe(true);
    await Promise.all(promises);
    expect(order).toEqual([1, 2, 3]);
    expect(isEventLoopTurnPending()).toBe(false);
  });

  it('should reopen the channel for a turn requested after it closed', async () => {
    await yieldToEventLoop();
    expect(isEventLoopTurnPending()).toBe(false);
    const promise = yieldToEventLoop();
    expect(isEventLoopTurnPending()).toBe(true);
    await promise;
    expect(isEventLoopTurnPending()).toBe(false);
  });

  it('should not be delayed by fake timers', async () => {
    vi.useFakeTimers();
    try {
      await yieldToEventLoop();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('coalesce', () => {
  it('should call the callback once per turn however often it is called', async () => {
    const callback = vi.fn();
    const coalesced = coalesce(callback);
    coalesced();
    coalesced();
    coalesced();
    expect(callback).not.toHaveBeenCalled();
    await yieldToEventLoop();
    expect(callback).toHaveBeenCalledTimes(1);

    coalesced();
    await yieldToEventLoop();
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
