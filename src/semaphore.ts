/**
 * @file
 *
 * A counting semaphore that limits how many async operations run at once.
 *
 * Adapted from `es-toolkit`'s `Semaphore` (MIT, see `THIRD-PARTY-NOTICES.md`), with an abort-aware
 * {@link Semaphore.acquire}, {@link Semaphore.tryAcquire}, {@link Semaphore.runExclusive}, and a
 * {@link Semaphore.release} that throws instead of silently ignoring a release with nothing acquired.
 */

import type { Promisable } from 'type-fest';

interface Waiter {
  readonly grant: () => void;
}

/**
 * A counting semaphore for async functions.
 *
 * Each {@link Semaphore.acquire} takes a permit, or waits until one is released. Each {@link Semaphore.release}
 * hands its permit to the longest-waiting acquirer, first in first out, or returns it to the pool.
 *
 * @example
 * ```typescript
 * const semaphore = new Semaphore(3);
 *
 * await Promise.all(files.map((file) => semaphore.runExclusive(() => processFile(file))));
 * ```
 */
export class Semaphore {
  /**
   * The number of permits currently free.
   *
   * @returns The number of permits an acquirer could take right now without waiting.
   */
  public get available(): number {
    return this.availablePermits;
  }

  /**
   * The number of acquirers waiting for a permit.
   *
   * @returns The length of the wait queue.
   */
  public get waitingCount(): number {
    return this.waiters.length;
  }

  private availablePermits: number;
  private readonly waiters: Waiter[] = [];

  /**
   * Creates a semaphore.
   *
   * @param capacity - The total number of permits, a positive integer.
   */
  public constructor(public readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`capacity must be a positive integer, got ${String(capacity)}`);
    }
    this.availablePermits = capacity;
  }

  /**
   * Takes a permit, waiting until one is free.
   *
   * @param abortSignal - Cancels the wait. An aborted acquire takes no permit, so it must not be released.
   * @returns A {@link Promise} that resolves once the permit is held, or rejects with the signal's reason.
   */
  public async acquire(abortSignal?: AbortSignal): Promise<void> {
    abortSignal?.throwIfAborted();
    if (this.tryAcquire()) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        grant(): void {
          abortSignal?.removeEventListener('abort', onAbort);
          resolve();
        }
      };

      const onAbort = (): void => {
        const index = this.waiters.indexOf(waiter);
        this.waiters.splice(index, 1);
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Rejecting with the signal's reason as-is, like `AbortSignal.throwIfAborted`.
        reject(abortSignal?.reason);
      };

      abortSignal?.addEventListener('abort', onAbort, { once: true });
      this.waiters.push(waiter);
    });
  }

  /**
   * Returns a permit, handing it to the longest-waiting acquirer if there is one.
   *
   * @throws {Error} If every permit is already free, which means a release without a matching acquire.
   */
  public release(): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.grant();
      return;
    }

    if (this.availablePermits >= this.capacity) {
      throw new Error('Semaphore released more times than it was acquired');
    }
    this.availablePermits++;
  }

  /**
   * Runs a function while holding a permit, releasing it when the function settles.
   *
   * @typeParam T - The type of the function's result.
   * @param fn - The function to run.
   * @param abortSignal - Cancels the wait for a permit. It does not interrupt `fn` once it has started.
   * @returns A {@link Promise} that resolves with the function's result.
   */
  public async runExclusive<T>(fn: () => Promisable<T>, abortSignal?: AbortSignal): Promise<T> {
    await this.acquire(abortSignal);
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Takes a permit only if one is free right now.
   *
   * @returns `true` if a permit was taken, which must then be released, `false` if none was free.
   */
  public tryAcquire(): boolean {
    if (this.availablePermits === 0) {
      return false;
    }
    this.availablePermits--;
    return true;
  }
}
