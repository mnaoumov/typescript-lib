import {
  describe,
  expect,
  expectTypeOf,
  it
} from 'vitest';

import {
  abortableAll,
  abortableRace
} from './abortable-tasks.ts';
import { noopAsync } from './function.ts';

interface AbortableTask<T> {
  readonly promise: Promise<T>;
  readonly reject: (reason: unknown) => void;
  readonly resolve: (value: T) => void;
  readonly signal: AbortSignal;
}

interface MaybeNamed {
  readonly name?: unknown;
}

function createAbortableTask<T>(signal: AbortSignal, onAbortReason?: (reason: unknown) => unknown): AbortableTask<T> {
  let reject!: (reason: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  signal.addEventListener('abort', () => {
    reject(onAbortReason ? onAbortReason(signal.reason) : signal.reason);
  }, { once: true });
  return { promise, reject, resolve, signal };
}

function getName(reason: unknown): unknown {
  return (reason as MaybeNamed).name;
}

async function rejectLater(reason: unknown): Promise<never> {
  await noopAsync();
  throw reason as Error;
}

describe('abortableAll', () => {
  it('should resolve with every value in task order and infer a tuple', async () => {
    const result = await abortableAll(new AbortController().signal, () => [Promise.resolve(1), Promise.resolve('two')]);
    expectTypeOf(result).toEqualTypeOf<[number, string]>();
    expect(result).toEqual([1, 'two']);
  });

  it('should resolve with an empty array for no tasks', async () => {
    await expect(abortableAll(new AbortController().signal, () => [])).resolves.toEqual([]);
  });

  it('should reject with the signal reason and never call the executor when already aborted', async () => {
    const abortController = new AbortController();
    const reason = new Error('outer');
    abortController.abort(reason);
    let wasCalled = false;
    await expect(abortableAll(abortController.signal, () => {
      wasCalled = true;
      return [];
    })).rejects.toBe(reason);
    expect(wasCalled).toBe(false);
  });

  it('should abort the siblings with an AbortError DOMException and reject with the original rejection', async () => {
    const error = new Error('task failed');
    let sibling: AbortableTask<number> | undefined;
    const promise = abortableAll(new AbortController().signal, (childAbortSignal) => {
      sibling = createAbortableTask<number>(childAbortSignal);
      return [sibling.promise, Promise.reject(error)];
    });
    await expect(promise).rejects.toBe(error);
    expect(sibling?.signal.aborted).toBe(true);
    expect(sibling?.signal.reason).toBeInstanceOf(DOMException);
    expect(getName(sibling?.signal.reason)).toBe('AbortError');
  });

  it('should prefer a later real failure over an AbortError that settled first', async () => {
    const error = new Error('cleanup failed');
    const promise = abortableAll(new AbortController().signal, (childAbortSignal) => {
      const first = createAbortableTask<number>(childAbortSignal);
      const second = createAbortableTask<number>(childAbortSignal, () => error);
      first.reject(new DOMException('aborted', 'AbortError'));
      return [first.promise, second.promise];
    });
    await expect(promise).rejects.toBe(error);
  });

  it('should keep the first real failure over later ones', async () => {
    const firstError = new Error('first');
    const promise = abortableAll(new AbortController().signal, (childAbortSignal) => {
      const second = createAbortableTask<number>(childAbortSignal, () => new Error('second'));
      return [Promise.reject(firstError), second.promise];
    });
    await expect(promise).rejects.toBe(firstError);
  });

  it('should wait for every task to settle before rejecting', async () => {
    const error = new Error('task failed');
    let hasSiblingSettled = false;
    const promise = abortableAll(new AbortController().signal, (childAbortSignal) => {
      const sibling = new Promise<number>((_resolve, reject) => {
        childAbortSignal.addEventListener('abort', () => {
          setTimeout(() => {
            hasSiblingSettled = true;
            reject(childAbortSignal.reason as Error);
          }, 0);
        });
      });
      return [sibling, Promise.reject(error)];
    });
    await expect(promise).rejects.toBe(error);
    expect(hasSiblingSettled).toBe(true);
  });

  it('should pass an outer abort to the tasks with its reason', async () => {
    const abortController = new AbortController();
    const reason = new Error('outer');
    let task: AbortableTask<number> | undefined;
    const promise = abortableAll(abortController.signal, (childAbortSignal) => {
      task = createAbortableTask<number>(childAbortSignal);
      return [task.promise];
    });
    abortController.abort(reason);
    await expect(promise).rejects.toBe(reason);
    expect(task?.signal.reason).toBe(reason);
  });

  it('should stop listening to the outer signal once settled', async () => {
    const abortController = new AbortController();
    let childAbortSignal: AbortSignal | undefined;
    await abortableAll(abortController.signal, (signal) => {
      childAbortSignal = signal;
      return [Promise.resolve(1)];
    });
    abortController.abort();
    expect(childAbortSignal?.aborted).toBe(false);
  });

  it('should treat a non-object rejection as a real failure', async () => {
    const promise = abortableAll(new AbortController().signal, (childAbortSignal) => {
      const first = createAbortableTask<number>(childAbortSignal);
      first.reject(new DOMException('aborted', 'AbortError'));
      return [first.promise, rejectLater('plain')];
    });
    await expect(promise).rejects.toBe('plain');
  });

  it('should treat a null rejection as a real failure', async () => {
    const promise = abortableAll(new AbortController().signal, (childAbortSignal) => {
      const first = createAbortableTask<number>(childAbortSignal);
      first.reject(new DOMException('aborted', 'AbortError'));
      return [first.promise, rejectLater(null)];
    });
    await expect(promise).rejects.toBeNull();
  });
});

describe('abortableRace', () => {
  it('should resolve with the first value and abort the rest', async () => {
    let sibling: AbortableTask<string> | undefined;
    const result = await abortableRace(new AbortController().signal, (childAbortSignal) => {
      sibling = createAbortableTask<string>(childAbortSignal);
      return [sibling.promise, Promise.resolve(1)];
    });
    expectTypeOf(result).toEqualTypeOf<number | string>();
    expect(result).toBe(1);
    expect(getName(sibling?.signal.reason)).toBe('AbortError');
  });

  it('should reject with the first rejection', async () => {
    const error = new Error('first');
    const promise = abortableRace(new AbortController().signal, (childAbortSignal) => {
      const sibling = createAbortableTask<number>(childAbortSignal);
      return [Promise.reject(error), sibling.promise];
    });
    await expect(promise).rejects.toBe(error);
  });

  it('should prefer a later real failure over a first fulfilled task', async () => {
    const error = new Error('cleanup failed');
    const promise = abortableRace(new AbortController().signal, (childAbortSignal) => {
      const sibling = createAbortableTask<number>(childAbortSignal, () => error);
      return [Promise.resolve(1), sibling.promise];
    });
    await expect(promise).rejects.toBe(error);
  });

  it('should prefer a later real failure over a first AbortError', async () => {
    const error = new Error('cleanup failed');
    const promise = abortableRace(new AbortController().signal, (childAbortSignal) => {
      const first = createAbortableTask<number>(childAbortSignal);
      const second = createAbortableTask<number>(childAbortSignal, () => error);
      first.reject(new DOMException('aborted', 'AbortError'));
      return [first.promise, second.promise];
    });
    await expect(promise).rejects.toBe(error);
  });

  it('should keep a first real failure over a later one', async () => {
    const error = new Error('first');
    const promise = abortableRace(new AbortController().signal, (childAbortSignal) => {
      const second = createAbortableTask<number>(childAbortSignal, () => new Error('second'));
      return [Promise.reject(error), second.promise];
    });
    await expect(promise).rejects.toBe(error);
  });

  it('should reject with the signal reason when already aborted', async () => {
    const abortController = new AbortController();
    const reason = new Error('outer');
    abortController.abort(reason);
    await expect(abortableRace(abortController.signal, () => [Promise.resolve(1)])).rejects.toBe(reason);
  });

  it('should settle with no tasks only when the outer signal aborts', async () => {
    const abortController = new AbortController();
    const reason = new Error('outer');
    let hasSettled = false;
    const promise = abortableRace(abortController.signal, () => []).finally(() => {
      hasSettled = true;
    });
    await noopAsync();
    await noopAsync();
    expect(hasSettled).toBe(false);
    abortController.abort(reason);
    await expect(promise).rejects.toBe(reason);
  });
});
