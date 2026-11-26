import {
  describe,
  expect,
  it
} from 'vitest';

import { noopAsync } from './function.ts';
import { Semaphore } from './semaphore.ts';

describe('Semaphore', () => {
  it('should start with every permit free', () => {
    const semaphore = new Semaphore(2);
    expect(semaphore.capacity).toBe(2);
    expect(semaphore.available).toBe(2);
    expect(semaphore.waitingCount).toBe(0);
  });

  it('should reject a capacity that is not a positive integer', () => {
    for (const capacity of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => new Semaphore(capacity)).toThrow(RangeError);
    }
  });

  it('should take permits without waiting while any are free', async () => {
    const semaphore = new Semaphore(2);
    await semaphore.acquire();
    await semaphore.acquire();
    expect(semaphore.available).toBe(0);
    semaphore.release();
    expect(semaphore.available).toBe(1);
  });

  it('should hand a released permit to waiters first in first out', async () => {
    const semaphore = new Semaphore(1);
    await semaphore.acquire();
    const order: number[] = [];
    const first = semaphore.acquire().then(() => {
      order.push(1);
    });
    const second = semaphore.acquire().then(() => {
      order.push(2);
    });
    expect(semaphore.waitingCount).toBe(2);

    semaphore.release();
    await first;
    expect(order).toEqual([1]);
    expect(semaphore.available).toBe(0);

    semaphore.release();
    await second;
    expect(order).toEqual([1, 2]);

    semaphore.release();
    expect(semaphore.available).toBe(1);
  });

  it('should throw when released more times than acquired', () => {
    const semaphore = new Semaphore(1);
    expect(() => {
      semaphore.release();
    }).toThrow('Semaphore released more times than it was acquired');
  });

  it('should try to acquire without waiting', () => {
    const semaphore = new Semaphore(1);
    expect(semaphore.tryAcquire()).toBe(true);
    expect(semaphore.tryAcquire()).toBe(false);
    semaphore.release();
    expect(semaphore.tryAcquire()).toBe(true);
  });

  it('should reject an acquire with an already aborted signal and take no permit', async () => {
    const semaphore = new Semaphore(1);
    const reason = new Error('aborted');
    await expect(semaphore.acquire(AbortSignal.abort(reason))).rejects.toBe(reason);
    expect(semaphore.available).toBe(1);
  });

  it('should leave the queue when a waiting acquire is aborted', async () => {
    const semaphore = new Semaphore(1);
    await semaphore.acquire();
    const abortController = new AbortController();
    const aborted = semaphore.acquire(abortController.signal);
    const next = semaphore.acquire();
    expect(semaphore.waitingCount).toBe(2);

    const reason = new Error('stop');
    abortController.abort(reason);
    await expect(aborted).rejects.toBe(reason);
    expect(semaphore.waitingCount).toBe(1);

    semaphore.release();
    await next;
    expect(semaphore.waitingCount).toBe(0);
    expect(semaphore.available).toBe(0);
  });

  it('should stop listening to the signal once a waiting acquire is granted', async () => {
    const semaphore = new Semaphore(1);
    await semaphore.acquire();
    const abortController = new AbortController();
    const acquired = semaphore.acquire(abortController.signal);
    semaphore.release();
    await acquired;
    abortController.abort();
    expect(semaphore.available).toBe(0);
    semaphore.release();
    expect(semaphore.available).toBe(1);
  });

  it('should run a function exclusively and release after it settles', async () => {
    const semaphore = new Semaphore(1);
    let running = 0;
    let maxRunning = 0;
    async function task(): Promise<number> {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await noopAsync();
      running--;
      return running;
    }
    await expect(Promise.all([semaphore.runExclusive(task), semaphore.runExclusive(task)])).resolves.toEqual([0, 0]);
    expect(maxRunning).toBe(1);
    expect(semaphore.available).toBe(1);
  });

  it('should release after the function throws', async () => {
    const semaphore = new Semaphore(1);
    const error = new Error('boom');
    await expect(semaphore.runExclusive(() => {
      throw error;
    })).rejects.toBe(error);
    expect(semaphore.available).toBe(1);
  });

  it('should not run the function or release when the wait is aborted', async () => {
    const semaphore = new Semaphore(1);
    await semaphore.acquire();
    const reason = new Error('aborted');
    let hasRun = false;
    await expect(semaphore.runExclusive(() => {
      hasRun = true;
    }, AbortSignal.abort(reason))).rejects.toBe(reason);
    expect(hasRun).toBe(false);
    expect(semaphore.available).toBe(0);
  });
});
