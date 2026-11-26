import {
  describe,
  expect,
  it
} from 'vitest';

import { noopAsync } from './function.ts';
import { Mutex } from './mutex.ts';

describe('Mutex', () => {
  it('should lock and unlock', async () => {
    const mutex = new Mutex();
    expect(mutex.isLocked).toBe(false);
    await mutex.acquire();
    expect(mutex.isLocked).toBe(true);
    mutex.release();
    expect(mutex.isLocked).toBe(false);
  });

  it('should queue a second acquirer until release', async () => {
    const mutex = new Mutex();
    await mutex.acquire();
    let isAcquired = false;
    const second = mutex.acquire().then(() => {
      isAcquired = true;
    });
    await noopAsync();
    expect(isAcquired).toBe(false);
    expect(mutex.waitingCount).toBe(1);
    mutex.release();
    await second;
    expect(isAcquired).toBe(true);
    expect(mutex.isLocked).toBe(true);
  });

  it('should try to acquire without waiting', () => {
    const mutex = new Mutex();
    expect(mutex.tryAcquire()).toBe(true);
    expect(mutex.tryAcquire()).toBe(false);
  });

  it('should throw when released while not locked', () => {
    const mutex = new Mutex();
    expect(() => {
      mutex.release();
    }).toThrow(Error);
  });

  it('should reject an aborted acquire', async () => {
    const mutex = new Mutex();
    await mutex.acquire();
    const reason = new Error('aborted');
    await expect(mutex.acquire(AbortSignal.abort(reason))).rejects.toBe(reason);
  });

  it('should run a function exclusively', async () => {
    const mutex = new Mutex();
    const order: string[] = [];
    await Promise.all([
      mutex.runExclusive(async () => {
        order.push('a start');
        await noopAsync();
        order.push('a end');
      }),
      mutex.runExclusive(() => {
        order.push('b');
      })
    ]);
    expect(order).toEqual(['a start', 'a end', 'b']);
    expect(mutex.isLocked).toBe(false);
  });
});
