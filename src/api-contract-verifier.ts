/**
 * @file
 *
 * Checks an {@link ApiContract} against sample payloads, for a contract's own test: every method has both schemas,
 * every schema reports the expected vendor, and each schema accepts every valid payload and refuses every invalid one.
 *
 * It returns what it found rather than asserting, so it runs under any test framework:
 *
 * ```ts
 * expect(await verifyApiContract(MY_API_CONTRACT, { cases, vendor: 'my-plugin' })).toEqual([]);
 * ```
 *
 * It lives apart from `api-contract.ts` because a contract a consumer copies imports that module into its plugin,
 * and nothing here is needed at runtime.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { ApiContract } from './api-contract.ts';

/**
 * The sample payloads of one method, for each half of its contract.
 */
export interface ApiMethodCases {
  /**
   * Sample argument lists.
   */
  readonly input: PayloadCases;

  /**
   * Sample return values.
   */
  readonly output: PayloadCases;
}

/**
 * Sample payloads for one schema.
 */
export interface PayloadCases {
  /**
   * Payloads the schema must refuse.
   */
  readonly invalid: readonly unknown[];

  /**
   * Payloads the schema must accept.
   */
  readonly valid: readonly unknown[];
}

/**
 * Options for {@link verifyApiContract}.
 *
 * @typeParam TContract - The contract.
 */
export interface VerifyApiContractOptions<TContract extends ApiContract> {
  /**
   * The sample payloads, one entry per method of the contract.
   */
  readonly cases: Readonly<Record<keyof TContract & string, ApiMethodCases>>;

  /**
   * The Standard Schema `vendor` every schema must report.
   */
  readonly vendor: string;
}

/**
 * Runs a Standard Schema that must be synchronous. A schema guarding a call it cannot delay, as a contract's schemas
 * do, has to answer before that call returns.
 *
 * @typeParam TOutput - The type the schema produces.
 * @param schema - The schema.
 * @param value - The value to validate.
 * @returns The schema's result.
 * @throws If the schema answers with a promise.
 */
export function validateSync<TOutput>(schema: StandardSchemaV1<unknown, TOutput>, value: unknown): StandardSchemaV1.Result<TOutput> {
  const result = schema['~standard'].validate(value);
  if (result instanceof Promise) {
    throw new TypeError('Expected a synchronous schema, got one that answers with a promise.');
  }

  return result;
}

/**
 * Checks a contract against sample payloads: the contract has exactly the methods the cases name, each with both
 * schemas, every schema reports the given vendor and Standard Schema version 1, and each schema accepts every valid
 * payload and refuses every invalid one.
 *
 * @typeParam TContract - The contract.
 * @param contract - The contract.
 * @param options - The sample payloads and the expected vendor.
 * @returns One message per violation, empty when the contract passes.
 */
export async function verifyApiContract<TContract extends ApiContract>(contract: TContract, options: VerifyApiContractOptions<TContract>): Promise<string[]> {
  const violations: string[] = [];
  const looseContract: ApiContract = contract;
  const cases: Readonly<Record<string, ApiMethodCases>> = options.cases;

  for (const methodName of Object.keys(looseContract)) {
    if (!Object.hasOwn(cases, methodName)) {
      violations.push(`${methodName}: the contract has the method, but no cases are given for it.`);
    }
  }

  for (const [methodName, methodCases] of Object.entries(cases)) {
    const methodContract = looseContract[methodName];
    if (methodContract === undefined) {
      violations.push(`${methodName}: cases are given, but the contract has no such method.`);
      continue;
    }

    for (const half of ['input', 'output'] as const) {
      const schema = methodContract[half];
      if (schema === undefined) {
        violations.push(`${methodName} ${half}: the contract has no schema.`);
        continue;
      }

      // Read as a number: the type says 1, but a schema from another library may speak a later version.
      const { vendor } = schema['~standard'];
      const version: number = schema['~standard'].version;
      if (vendor !== options.vendor || version !== 1) {
        violations.push(`${methodName} ${half}: the schema reports vendor '${vendor}' and version ${String(version)}, expected '${options.vendor}' and 1.`);
      }

      const { invalid, valid } = methodCases[half];
      for (const [index, value] of valid.entries()) {
        const result = await schema['~standard'].validate(value);
        if (result.issues !== undefined) {
          violations.push(`${methodName} ${half}: valid case ${String(index)} was refused: ${formatIssues(result.issues)}`);
        }
      }

      for (const [index, value] of invalid.entries()) {
        const result = await schema['~standard'].validate(value);
        if (result.issues === undefined || result.issues.length === 0) {
          violations.push(`${methodName} ${half}: invalid case ${String(index)} was accepted.`);
        }
      }
    }
  }

  return violations;
}

function formatIssues(issues: readonly StandardSchemaV1.Issue[]): string {
  return issues.map((issue) => issue.message).join(' ');
}
