import type { StandardSchemaV1 } from '@standard-schema/spec';

import {
  describe,
  expect,
  it
} from 'vitest';

import type { ApiMethodCases } from './api-contract-verifier.ts';
import type { ApiContract } from './api-contract.ts';

import {
  validateSync,
  verifyApiContract
} from './api-contract-verifier.ts';
import {
  BOOLEAN_GUARD,
  createApiContractSchemaBuilders,
  createTypeGuardSchema,
  defineApiContract,
  NUMBER_GUARD,
  optionalGuard,
  STRING_GUARD,
  UNDEFINED_GUARD
} from './api-contract.ts';
import { noopAsync } from './function.ts';

interface CounterApi {
  count: (text: string, isCaseSensitive?: boolean) => Promise<number>;
  reset: () => void;
}

const { createArgumentsSchema, createTypeGuardSchema: createBoundTypeGuardSchema } = createApiContractSchemaBuilders('counter');

const COUNTER_CONTRACT = defineApiContract<CounterApi>({
  count: {
    input: createArgumentsSchema([STRING_GUARD, optionalGuard(BOOLEAN_GUARD)]),
    output: createBoundTypeGuardSchema(NUMBER_GUARD)
  },
  reset: {
    input: createArgumentsSchema([]),
    output: createBoundTypeGuardSchema(UNDEFINED_GUARD)
  }
});

const COUNTER_CASES: Readonly<Record<'count' | 'reset', ApiMethodCases>> = {
  count: {
    input: { invalid: [[], [1], ['a', 'b'], ['a', true, 'extra']], valid: [['a'], ['a', true]] },
    output: { invalid: ['1', undefined], valid: [0, 1] }
  },
  reset: {
    input: { invalid: [['extra'], 'not a list'], valid: [[]] },
    output: { invalid: [null], valid: [undefined] }
  }
};

const ASYNC_SCHEMA: StandardSchemaV1<unknown, number> = {
  '~standard': {
    validate: async (value: unknown): Promise<StandardSchemaV1.Result<number>> => {
      await noopAsync();
      return typeof value === 'number' ? { value } : { issues: [{ message: 'Expected a number.' }] };
    },
    vendor: 'counter',
    version: 1
  }
};

describe('verifyApiContract', () => {
  it('should find nothing wrong with a contract that passes its cases', async () => {
    expect(await verifyApiContract(COUNTER_CONTRACT, { cases: COUNTER_CASES, vendor: 'counter' })).toEqual([]);
  });

  it('should report a valid case refused and an invalid case accepted', async () => {
    const cases = {
      ...COUNTER_CASES,
      count: { ...COUNTER_CASES.count, output: { invalid: [2], valid: ['1'] } }
    };
    expect(await verifyApiContract(COUNTER_CONTRACT, { cases, vendor: 'counter' })).toEqual([
      'count output: valid case 0 was refused: Expected a number.',
      'count output: invalid case 0 was accepted.'
    ]);
  });

  it('should report a schema reporting another vendor', async () => {
    const contract = defineApiContract<CounterApi>({ ...COUNTER_CONTRACT, reset: { ...COUNTER_CONTRACT.reset, output: createTypeGuardSchema(UNDEFINED_GUARD) } });
    expect(await verifyApiContract(contract, { cases: COUNTER_CASES, vendor: 'counter' })).toEqual([
      'reset output: the schema reports vendor \'@mnaoumov/typescript-lib\' and version 1, expected \'counter\' and 1.'
    ]);
  });

  it('should report a wrong Standard Schema version', async () => {
    const schema = createBoundTypeGuardSchema(UNDEFINED_GUARD);
    const output: StandardSchemaV1<unknown, undefined> = { '~standard': { ...schema['~standard'], version: 2 as 1 } };
    const contract = defineApiContract<CounterApi>({ ...COUNTER_CONTRACT, reset: { ...COUNTER_CONTRACT.reset, output } });
    expect(await verifyApiContract(contract, { cases: COUNTER_CASES, vendor: 'counter' })).toEqual([
      'reset output: the schema reports vendor \'counter\' and version 2, expected \'counter\' and 1.'
    ]);
  });

  it('should report methods and schemas the contract and the cases disagree on', async () => {
    const contract: ApiContract = { count: { output: COUNTER_CONTRACT.count.output }, extra: {} };
    const cases: Readonly<Record<string, ApiMethodCases>> = { count: COUNTER_CASES.count, reset: COUNTER_CASES.reset };
    expect(await verifyApiContract(contract, { cases, vendor: 'counter' })).toEqual([
      'extra: the contract has the method, but no cases are given for it.',
      'count input: the contract has no schema.',
      'reset: cases are given, but the contract has no such method.'
    ]);
  });

  it('should run an asynchronous schema', async () => {
    const contract: ApiContract = { count: { input: COUNTER_CONTRACT.count.input, output: ASYNC_SCHEMA } };
    expect(await verifyApiContract(contract, { cases: { count: COUNTER_CASES.count }, vendor: 'counter' })).toEqual([]);
  });
});

describe('validateSync', () => {
  it('should return the result of a synchronous schema', () => {
    expect(validateSync(createTypeGuardSchema(NUMBER_GUARD), 1)).toEqual({ value: 1 });
  });

  it('should throw on an asynchronous schema', () => {
    expect(() => validateSync(ASYNC_SCHEMA, 1)).toThrow('Expected a synchronous schema, got one that answers with a promise.');
  });
});
