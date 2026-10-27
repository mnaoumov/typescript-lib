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
  ExpectedTypeGuard,
  TypedApiContract
} from './api-contract.ts';

import {
  arrayGuard,
  BOOLEAN_GUARD,
  createApiContractSchemaBuilders,
  createArgumentsSchema,
  createExpectedTypeGuard,
  createTypeGuardSchema,
  defineApiContract,
  instanceOfGuard,
  literalGuard,
  nullableGuard,
  NUMBER_GUARD,
  objectGuard,
  optionalGuard,
  optionsGuard,
  STRING_ARRAY_GUARD,
  STRING_GUARD,
  UNDEFINED_GUARD,
  unionGuard
} from './api-contract.ts';
import { LIBRARY_NAME } from './library.ts';
import {
  isNull,
  objectTypeGuard
} from './type-guards.ts';

interface CounterApi {
  readonly count: (text: string, isCaseSensitive?: boolean) => Promise<number>;
  readonly name: string;
  readonly reset: () => void;
}

interface LabelledPoint extends Point {
  readonly label?: string;
}

interface Point {
  readonly x: number;
}

class PointClass implements Point {
  public x = 0;
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

  it('should pair a type guard with what it expects', () => {
    const isPoint = objectTypeGuard<Point>({ x: NUMBER_GUARD.typeGuard });
    expect(createExpectedTypeGuard('a point', isPoint)).toEqual({ expected: 'a point', typeGuard: isPoint });
  });

  it('should build an array guard', () => {
    const guard = arrayGuard(NUMBER_GUARD);
    expect(guard.expected).toBe('an array whose every item is a number');
    expect([[], [1], ['1'], 1].map((value) => guard.typeGuard(value))).toEqual([true, true, false, false]);
    expectTypeOf(guard.typeGuard).guards.toEqualTypeOf<number[]>();
  });

  it('should build an instance guard named after the class', () => {
    const guard = instanceOfGuard(PointClass);
    expect(guard.expected).toBe('an instance of PointClass');
    expect([new PointClass(), { x: 1 }].map((value) => guard.typeGuard(value))).toEqual([true, false]);
    expectTypeOf(guard.typeGuard).guards.toEqualTypeOf<PointClass>();
  });

  it('should build a literal guard from a list', () => {
    const guard = literalGuard(['a', 1, 2n, null, undefined, true]);
    expect(guard.expected).toBe('one of \'a\', 1, 2n, null, undefined, true');
    expect(['a', 2n, 'b', 3n].map((value) => guard.typeGuard(value))).toEqual([true, true, false, false]);
  });

  it('should build a literal guard from the keys of a record', () => {
    const guard = literalGuard<'Delete' | 'Keep'>({ Delete: true, Keep: true });
    expect(guard.expected).toBe('one of \'Delete\', \'Keep\'');
    expect(['Keep', 'Move'].map((value) => guard.typeGuard(value))).toEqual([true, false]);
    expectTypeOf(guard.typeGuard).guards.toEqualTypeOf<'Delete' | 'Keep'>();
  });

  it('should build a union guard', () => {
    const guard = unionGuard(STRING_GUARD, createExpectedTypeGuard('null', isNull), NUMBER_GUARD);
    expect(guard.expected).toBe('a string or null or a number');
    expect(['a', null, 1, undefined].map((value) => guard.typeGuard(value))).toEqual([true, true, true, false]);
    expectTypeOf(guard.typeGuard).guards.toEqualTypeOf<null | number | string>();
  });
});

describe('createApiContractSchemaBuilders', () => {
  const builders = createApiContractSchemaBuilders('my-plugin');

  it('should bind the vendor of every schema it builds', () => {
    expect(builders.createArgumentsSchema([STRING_GUARD])['~standard'].vendor).toBe('my-plugin');
    expect(builders.createTypeGuardSchema(NUMBER_GUARD)['~standard'].vendor).toBe('my-plugin');
  });

  it('should validate as the unbound builders do', () => {
    expect(validate(builders.createArgumentsSchema([STRING_GUARD]), [1])).toEqual({ issues: [{ message: 'Expected a string.', path: [0] }] });
    expect(validate(builders.createTypeGuardSchema(NUMBER_GUARD), 1)).toEqual({ value: 1 });
  });

  it('should type a contract entry as the unbound builders do', () => {
    const { createArgumentsSchema: createBoundArgumentsSchema, createTypeGuardSchema: createBoundTypeGuardSchema } = builders;
    const contract = defineApiContract<CounterApi>({
      count: {
        input: createBoundArgumentsSchema([STRING_GUARD, optionalGuard(BOOLEAN_GUARD)]),
        output: createBoundTypeGuardSchema(NUMBER_GUARD)
      },
      reset: {
        input: createBoundArgumentsSchema([]),
        output: createBoundTypeGuardSchema(UNDEFINED_GUARD)
      }
    });
    expectTypeOf(contract).toEqualTypeOf<TypedApiContract<CounterApi>>();
    expect(validate(contract.count.input, ['a', 1])).toEqual({ issues: [{ message: 'Expected a boolean or undefined.', path: [1] }] });
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

describe('objectGuard', () => {
  it('should check each property and list them in expected', () => {
    const guard = objectGuard<LabelledPoint>({ label: optionalGuard(STRING_GUARD), x: NUMBER_GUARD });
    expect(guard.expected).toBe('{ label: a string or undefined; x: a number }');
    expect([guard.typeGuard({ x: 1 }), guard.typeGuard({ label: 'a', x: 1 }), guard.typeGuard({ label: 1, x: 1 })]).toEqual([true, true, false]);
    expectTypeOf(guard).toEqualTypeOf<ExpectedTypeGuard<LabelledPoint>>();
  });

  it('should mark exact optional keys and pass the options through', () => {
    const guard = objectGuard<LabelledPoint>({ label: STRING_GUARD, x: NUMBER_GUARD }, {
      description: 'a labelled point',
      exactOptionalKeys: { label: true },
      shouldRejectUnknownKeys: true
    });
    expect(guard.expected).toBe('a labelled point: { label?: a string; x: a number }');
    expect([guard.typeGuard({ x: 1 }), guard.typeGuard({ label: undefined, x: 1 }), guard.typeGuard({ extra: 1, x: 1 })]).toEqual([true, false, false]);
  });

  it('should describe an object with no properties', () => {
    expect(objectGuard<object>({}).expected).toBe('{}');
  });
});

describe('optionsGuard', () => {
  interface Options {
    readonly isHidden?: boolean;
    readonly prefix?: string;
  }

  const guard = optionsGuard<Options>({ isHidden: BOOLEAN_GUARD, prefix: STRING_GUARD }, { description: 'the options' });

  it('should accept every option absent, undefined or of its type', () => {
    expect([{}, { isHidden: undefined }, { isHidden: true, prefix: 'a' }, { extra: 1 }].map((value) => guard.typeGuard(value))).toEqual([true, true, true, true]);
    expect([{ isHidden: 'yes' }, { prefix: 1 }, null].map((value) => guard.typeGuard(value))).toEqual([false, false, false]);
    expectTypeOf(guard).toEqualTypeOf<ExpectedTypeGuard<Options>>();
  });

  it('should list the options as optional in expected', () => {
    expect(guard.expected).toBe('the options: { isHidden?: a boolean; prefix?: a string }');
    expect(optionsGuard<Options>({ isHidden: BOOLEAN_GUARD, prefix: STRING_GUARD }).expected).toBe('{ isHidden?: a boolean; prefix?: a string }');
  });

  it('should refuse unknown keys when asked', () => {
    expect(optionsGuard<Options>({ isHidden: BOOLEAN_GUARD, prefix: STRING_GUARD }, { shouldRejectUnknownKeys: true }).typeGuard({ extra: 1 })).toBe(false);
  });

  it('should refuse a type with a required property', () => {
    // @ts-expect-error -- `x` is required, so it takes `never`.
    const required = optionsGuard<Point>({ x: NUMBER_GUARD });
    expect(required.typeGuard({})).toBe(true);
  });
});
