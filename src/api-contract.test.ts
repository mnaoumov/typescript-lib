import type { StandardSchemaV1 } from '@standard-schema/spec';

import {
  describe,
  expect,
  expectTypeOf,
  it
} from 'vitest';

import type {
  ApiContract,
  ApiMethodContract,
  ApiMethodName,
  TypedApiContract
} from './api-contract.ts';

import {
  BOOLEAN_GUARD,
  createArgumentsSchema,
  createTypeGuardSchema,
  defineApiContract,
  nullableGuard,
  NUMBER_GUARD,
  optionalGuard,
  STRING_ARRAY_GUARD,
  STRING_GUARD,
  UNDEFINED_GUARD
} from './api-contract.ts';
import { LIBRARY_NAME } from './library.ts';

interface CounterApi {
  count: (text: string, isCaseSensitive?: boolean) => Promise<number>;
  readonly name: string;
  reset: () => void;
}

const COUNTER_CONTRACT = defineApiContract<CounterApi>({
  count: {
    input: createArgumentsSchema([STRING_GUARD, optionalGuard(BOOLEAN_GUARD)]),
    output: createTypeGuardSchema(NUMBER_GUARD)
  },
  reset: {
    input: createArgumentsSchema([]),
    output: createTypeGuardSchema(UNDEFINED_GUARD)
  }
});

function validate<T>(schema: StandardSchemaV1<unknown, T>, value: unknown): StandardSchemaV1.Result<T> {
  const result = schema['~standard'].validate(value);
  if (result instanceof Promise) {
    throw new TypeError('Expected a synchronous schema.');
  }
  return result;
}

describe('createTypeGuardSchema', () => {
  const schema = createTypeGuardSchema(NUMBER_GUARD);

  it('should accept a value the guard accepts', () => {
    expect(validate(schema, 1)).toEqual({ value: 1 });
  });

  it('should report a value the guard refuses', () => {
    expect(validate(schema, '1')).toEqual({ issues: [{ message: 'Expected a number.' }] });
  });

  it('should be a Standard Schema of this library', () => {
    expect(schema['~standard'].version).toBe(1);
    expect(schema['~standard'].vendor).toBe(LIBRARY_NAME);
  });

  it('should report the vendor it is given', () => {
    expect(createTypeGuardSchema({ ...NUMBER_GUARD, vendor: 'my-plugin' })['~standard'].vendor).toBe('my-plugin');
  });
});

describe('createArgumentsSchema', () => {
  const schema = COUNTER_CONTRACT.count.input;

  it('should accept a full argument list', () => {
    expect(validate(schema, ['a', true])).toEqual({ value: ['a', true] });
  });

  it('should accept an argument list missing an optional argument', () => {
    expect(validate(schema, ['a'])).toEqual({ value: ['a'] });
  });

  it('should refuse a value that is not an argument list', () => {
    expect(validate(schema, 'a')).toEqual({ issues: [{ message: 'Expected an argument list.' }] });
  });

  it('should refuse too many arguments', () => {
    expect(validate(schema, ['a', true, 1])).toEqual({ issues: [{ message: 'Expected at most 2 argument(s), got 3.' }] });
  });

  it('should report each failing argument by its index', () => {
    expect(validate(schema, [1, 'x'])).toEqual({
      issues: [
        { message: 'Expected a string.', path: [0] },
        { message: 'Expected a boolean or undefined.', path: [1] }
      ]
    });
  });

  it('should default the vendor to this library and report the one it is given', () => {
    expect(schema['~standard'].vendor).toBe(LIBRARY_NAME);
    expect(createArgumentsSchema([], { vendor: 'my-plugin' })['~standard'].vendor).toBe('my-plugin');
  });
});

describe('guards', () => {
  it('should describe what each guard expects', () => {
    expect([BOOLEAN_GUARD, NUMBER_GUARD, STRING_GUARD, STRING_ARRAY_GUARD, UNDEFINED_GUARD].map((guard) => guard.expected)).toEqual([
      'a boolean',
      'a number',
      'a string',
      'an array of strings',
      'undefined'
    ]);
  });

  it('should widen a guard to null', () => {
    const guard = nullableGuard(STRING_ARRAY_GUARD);
    expect(guard.expected).toBe('an array of strings or null');
    expect([null, ['a'], undefined, 'a'].map((value) => guard.typeGuard(value))).toEqual([true, true, false, false]);
    expectTypeOf(guard.typeGuard).guards.toEqualTypeOf<null | string[]>();
  });

  it('should widen a guard to undefined', () => {
    const guard = optionalGuard(NUMBER_GUARD);
    expect(guard.expected).toBe('a number or undefined');
    expect([undefined, 1, null, '1'].map((value) => guard.typeGuard(value))).toEqual([true, true, false, false]);
    expectTypeOf(guard.typeGuard).guards.toEqualTypeOf<number | undefined>();
  });

  it('should let a spread guard say what the value is', () => {
    const schema = createTypeGuardSchema({ ...STRING_GUARD, expected: 'a path' });
    expect(validate(schema, 1)).toEqual({ issues: [{ message: 'Expected a path.' }] });
  });
});

describe('ApiContract', () => {
  it('should type each entry against its method', () => {
    expectTypeOf(COUNTER_CONTRACT.count.input).toEqualTypeOf<StandardSchemaV1<unknown, Parameters<CounterApi['count']>>>();
    expectTypeOf(COUNTER_CONTRACT.count.output).toEqualTypeOf<StandardSchemaV1<unknown, number>>();
    expectTypeOf(COUNTER_CONTRACT.reset.output).toEqualTypeOf<StandardSchemaV1<unknown, void>>();
    expectTypeOf<ApiMethodName<CounterApi>>().toEqualTypeOf<'count' | 'reset'>();
    expectTypeOf(COUNTER_CONTRACT).toEqualTypeOf<TypedApiContract<CounterApi>>();
    expectTypeOf<ApiContract<CounterApi>>().toEqualTypeOf<TypedApiContract<CounterApi>>();
  });

  it('should refuse a contract that does not match the API', () => {
    // @ts-expect-error -- `reset` is missing.
    const missingMethod: ApiContract<CounterApi> = { count: COUNTER_CONTRACT.count };

    const extraMethod: ApiContract<CounterApi> = {
      ...COUNTER_CONTRACT,
      // @ts-expect-error -- `name` is not a method of the API.
      name: COUNTER_CONTRACT.count
    };

    const emptyEntry: ApiContract<CounterApi> = {
      // @ts-expect-error -- A typed entry needs both schemas.
      count: {},
      reset: COUNTER_CONTRACT.reset
    };

    const wrongOutput = defineApiContract<CounterApi>({
      count: {
        input: COUNTER_CONTRACT.count.input,
        // @ts-expect-error -- The output schema must produce the awaited return value, a number.
        output: createTypeGuardSchema(STRING_GUARD)
      },
      reset: COUNTER_CONTRACT.reset
    });

    const wrongInput = defineApiContract<CounterApi>({
      count: {
        // @ts-expect-error -- The first argument is a string.
        input: createArgumentsSchema([NUMBER_GUARD]),
        output: COUNTER_CONTRACT.count.output
      },
      reset: COUNTER_CONTRACT.reset
    });

    expect([missingMethod, extraMethod, emptyEntry, wrongOutput, wrongInput]).toHaveLength(5);
  });

  it('should keep the untyped form loose', () => {
    expectTypeOf<ApiContract>().toEqualTypeOf<Readonly<Record<string, ApiMethodContract>>>();
  });

  it('should return the contract it is given', () => {
    const contract = { count: COUNTER_CONTRACT.count, reset: COUNTER_CONTRACT.reset };
    expect(defineApiContract<CounterApi>(contract)).toBe(contract);
  });
});
