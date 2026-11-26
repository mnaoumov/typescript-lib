/**
 * @file
 *
 * A mutual-exclusion lock for async functions: a {@link Semaphore} with one permit.
 *
 * Adapted from `es-toolkit`'s `Mutex` (MIT, see `THIRD-PARTY-NOTICES.md`).
 */

import type { Promisable } from 'type-fest';

import { Semaphore } from './semaphore.ts';

/**
 * A mutual-exclusion lock for async functions: only one holder at a time, waiters served first in first out.
 *
 * @example
 * ```typescript
 * const mutex = new Mutex();
 *
 * await mutex.runExclusive(async () => {
 *   await app.vault.process(file, (content) => content + '\n');
 * });
 * ```
 */
export class Mutex {
  /**
   * Whether the lock is held.
   *
   * @returns `true` while some caller holds the lock.
   */
  public get isLocked(): boolean {
    return this.semaphore.available === 0;
  }

  /**
   * The number of callers waiting for the lock.
   *
   * @returns The length of the wait queue.
   */
  public get waitingCount(): number {
    return this.semaphore.waitingCount;
  }

  private readonly semaphore = new Semaphore(1);

  /**
   * Takes the lock, waiting until it is free.
   *
   * @param abortSignal - Cancels the wait. An aborted acquire does not hold the lock, so it must not be released.
   * @returns A {@link Promise} that resolves once the lock is held, or rejects with the signal's reason.
   */
  public async acquire(abortSignal?: AbortSignal): Promise<void> {
    await this.semaphore.acquire(abortSignal);
  }

  /**
   * Frees the lock, handing it to the longest-waiting caller if there is one.
   *
   * @throws {Error} If the lock is not held.
   */
  public release(): void {
    this.semaphore.release();
  }

  /**
   * Runs a function while holding the lock, freeing it when the function settles.
   *
   * @typeParam T - The type of the function's result.
   * @param fn - The function to run.
   * @param abortSignal - Cancels the wait for the lock. It does not interrupt `fn` once it has started.
   * @returns A {@link Promise} that resolves with the function's result.
   */
  public async runExclusive<T>(fn: () => Promisable<T>, abortSignal?: AbortSignal): Promise<T> {
    return await this.semaphore.runExclusive(fn, abortSignal);
  }

  /**
   * Takes the lock only if it is free right now.
   *
   * @returns `true` if the lock was taken, which must then be released, `false` if it was held.
   */
  public tryAcquire(): boolean {
    return this.semaphore.tryAcquire();
  }
}
