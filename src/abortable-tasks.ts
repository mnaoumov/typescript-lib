/**
 * @file
 *
 * Abort-scoped versions of `Promise.all` and `Promise.race`: each task gets a child abort signal, and the
 * group aborts the tasks still running once its outcome is known.
 *
 * Adapted from `abort-controller-x`'s `all` and `race` (MIT, see `THIRD-PARTY-NOTICES.md`), with the native
 * `AbortError` {@link DOMException} as the sibling abort reason instead of a custom error class.
 */

import { onAbort } from './abort-controller.ts';

/**
 * The result of {@link abortableAll}: the awaited value of each task, in task order.
 *
 * @typeParam T - The tuple or array of task promises.
 */
export type AbortableAllResult<T extends readonly PromiseLike<unknown>[]> = {
  -readonly [K in keyof T]: Awaited<T[K]>;
};

/**
 * Builds the group's tasks from the child abort signal they must honour.
 *
 * @typeParam T - The tuple or array of task promises.
 */
export type AbortableTasksExecutor<T extends readonly PromiseLike<unknown>[]> = (childAbortSignal: AbortSignal) => T;

interface FulfilledTaskOutcome {
  readonly status: 'fulfilled';
  readonly value: unknown;
}

interface MaybeNamed {
  readonly name?: unknown;
}

interface RejectedTaskOutcome {
  readonly reason: unknown;
  readonly status: 'rejected';
}

interface RunAbortableTasksResult {
  readonly inSettleOrder: readonly TaskOutcome[];
  readonly inTaskOrder: readonly TaskOutcome[];
}

type TaskOutcome = FulfilledTaskOutcome | RejectedTaskOutcome;

/**
 * An abort-scoped `Promise.all`.
 *
 * Calls `executor` with a child abort signal, which aborts when `abortSignal` aborts or when any task rejects.
 * The returned promise settles only once every task has settled, so no task outlives the group: it resolves
 * with every task's value, in task order, or rejects with the first rejection, where a rejection that is not an
 * `AbortError` wins over an `AbortError` that a sibling abort caused.
 *
 * The tasks must honour the child signal, rejecting once it aborts, either at once or after their cleanup.
 * A task that ignores it keeps the group waiting for it.
 *
 * @typeParam T - The tuple or array of task promises.
 * @param abortSignal - Aborts the whole group. If it is already aborted, `executor` is never called.
 * @param executor - Builds the tasks from the child abort signal.
 * @returns A {@link Promise} that resolves with the tasks' values, or rejects with the first rejection or with the
 * reason of `abortSignal` if it was already aborted.
 *
 * @example
 * ```typescript
 * const [user, settings] = await abortableAll(abortSignal, (childAbortSignal) => [
 *   fetchUser(childAbortSignal),
 *   fetchSettings(childAbortSignal)
 * ]);
 * ```
 */
export async function abortableAll<const T extends [] | readonly PromiseLike<unknown>[]>(
  abortSignal: AbortSignal,
  executor: AbortableTasksExecutor<T>
): Promise<AbortableAllResult<T>> {
  const outcomes = await runAbortableTasks(abortSignal, executor, (outcome) => outcome.status === 'rejected', 'One of the tasks passed to abortableAll() rejected');
  let rejection: RejectedTaskOutcome | undefined;
  for (const outcome of outcomes.inSettleOrder) {
    if (outcome.status === 'rejected' && (!rejection || (isAbortReason(rejection.reason) && !isAbortReason(outcome.reason)))) {
      rejection = outcome;
    }
  }

  if (rejection) {
    throw rejection.reason;
  }

  return outcomes.inTaskOrder.map((outcome) => (outcome as FulfilledTaskOutcome).value) as AbortableAllResult<T>;
}

/**
 * An abort-scoped `Promise.race`.
 *
 * Calls `executor` with a child abort signal, which aborts when `abortSignal` aborts or when the first task
 * settles. The returned promise settles only once every task has settled, so no task outlives the group, and it
 * settles like the first task that settled. One exception keeps a real failure from being swallowed: a later
 * rejection that is not an `AbortError` wins over a first task that fulfilled or rejected with an `AbortError`.
 *
 * The tasks must honour the child signal, rejecting once it aborts, either at once or after their cleanup.
 * A task that ignores it keeps the group waiting for it.
 *
 * With no tasks, the returned promise settles only when `abortSignal` aborts, rejecting with its reason, as
 * `Promise.race([])` never settles.
 *
 * @typeParam T - The tuple or array of task promises.
 * @param abortSignal - Aborts the whole group. If it is already aborted, `executor` is never called.
 * @param executor - Builds the tasks from the child abort signal.
 * @returns A {@link Promise} that settles like the winning task, or rejects with the reason of `abortSignal` if it
 * was already aborted.
 *
 * @example
 * ```typescript
 * const result = await abortableRace(abortSignal, (childAbortSignal) => [
 *   sleep(5000, childAbortSignal).then(() => ({ status: 'timeout' as const })),
 *   fetchUser(childAbortSignal).then((user) => ({ status: 'success' as const, user }))
 * ]);
 * ```
 */
export async function abortableRace<const T extends [] | readonly PromiseLike<unknown>[]>(
  abortSignal: AbortSignal,
  executor: AbortableTasksExecutor<T>
): Promise<Awaited<T[number]>> {
  const outcomes = await runAbortableTasks(abortSignal, executor, () => true, 'One of the tasks passed to abortableRace() settled');
  let result: TaskOutcome | undefined;
  for (const outcome of outcomes.inSettleOrder) {
    if (!result || (outcome.status === 'rejected' && !isAbortReason(outcome.reason) && (result.status === 'fulfilled' || isAbortReason(result.reason)))) {
      result = outcome;
    }
  }

  if (!result) {
    return await new Promise<never>((_resolve, reject) => {
      onAbort(abortSignal, () => {
        reject(abortSignal.reason as Error);
      });
    });
  }

  if (result.status === 'rejected') {
    throw result.reason;
  }

  return result.value as Awaited<T[number]>;
}

// eslint-disable-next-line n/no-unsupported-features/node-builtins -- `DOMException` is a DOM global always present in the Obsidian/Electron (Chromium) runtime this code targets, and is also a Node global from Node 17 onward.
function createSiblingAbortReason(message: string): DOMException {
  // eslint-disable-next-line n/no-unsupported-features/node-builtins -- `DOMException` is a DOM global always present in the Obsidian/Electron (Chromium) runtime this code targets, and is also a Node global from Node 17 onward.
  return new DOMException(message, 'AbortError');
}

function isAbortReason(reason: unknown): boolean {
  return typeof reason === 'object' && (reason as MaybeNamed | null)?.name === 'AbortError';
}

async function runAbortableTasks(
  abortSignal: AbortSignal,
  executor: AbortableTasksExecutor<readonly PromiseLike<unknown>[]>,
  shouldAbortSiblings: (outcome: TaskOutcome) => boolean,
  siblingAbortMessage: string
): Promise<RunAbortableTasksResult> {
  if (abortSignal.aborted) {
    throw abortSignal.reason;
  }

  const childAbortController = new AbortController();
  const abortSubscription = onAbort(abortSignal, () => {
    childAbortController.abort(abortSignal.reason);
  });

  try {
    const tasks = executor(childAbortController.signal);
    const inSettleOrder: TaskOutcome[] = [];
    const inTaskOrder = await Promise.all(tasks.map(async (task) => {
      let outcome: TaskOutcome;
      try {
        outcome = { status: 'fulfilled', value: await task };
      } catch (error) {
        outcome = { reason: error, status: 'rejected' };
      }
      inSettleOrder.push(outcome);
      if (shouldAbortSiblings(outcome)) {
        childAbortController.abort(createSiblingAbortReason(siblingAbortMessage));
      }
      return outcome;
    }));
    return { inSettleOrder, inTaskOrder };
  } finally {
    abortSubscription.dispose();
  }
}
