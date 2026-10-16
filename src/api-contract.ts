/**
 * @file
 *
 * The contract of an API one module exposes to another: which methods it promises, and a
 * {@link https://standardschema.dev | Standard Schema} over each method's arguments and return value.
 *
 * The schemas are plain objects over plain functions, which a type guard already is, so a contract can cross a
 * boundary between two copies of a library and still be run by whichever copy reads it. The builders here turn
 * the guards a module already has into the two shapes a method contract needs: one value (an output) and one
 * argument list (an input). zod / valibot / arktype schemas plug into the same slots unchanged; this module just
 * does not make every provider bundle one to describe two arguments.
 *
 * Running the schemas is left to whoever owns the call path, since that is where an issue can be reported.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';

import { LIBRARY_NAME } from './library.ts';
import { castTo } from './object-utils.ts';
import {
  isBoolean,
  isNumber,
  isString,
  isStringArray,
  isUndefined
} from './type-guards.ts';

/**
 * The contract an API declares: every key is a method the API promises to expose, and its value optionally
 * carries the payload schemas for that method.
 *
 * Typed over the API when one is named: `ApiContract<MyApi>` has exactly one entry per function member of
 * `MyApi` (a missing method, an extra one or a misspelled one does not compile), and each entry's schemas must
 * produce that method's parameters and awaited return value. Without a type argument, or for `object`, it is the
 * loose record a reader that knows nothing about the API sees.
 *
 * @typeParam TApi - The API the contract describes. `object`, the default, means "not typed".
 */
export type ApiContract<TApi extends object = object> = object extends TApi ? Readonly<Record<string, ApiMethodContract>>
  : TypedApiContract<TApi>;

/**
 * The payload schemas for a single API method. Both halves are optional: a method may declare only its input,
 * only its output, neither (the entry then just declares that the method must exist), or both.
 *
 * @typeParam TParameters - The method's parameters, as a tuple, which the input schema must produce.
 * @typeParam TReturnValue - The method's return value, awaited, which the output schema must produce.
 */
export interface ApiMethodContract<TParameters = unknown, TReturnValue = unknown> {
  /**
   * Validates the method's arguments, as an array.
   */
  readonly input?: StandardSchemaV1<unknown, TParameters>;

  /**
   * Validates the method's return value, or, when the method returns a thenable, the value it resolves to.
   */
  readonly output?: StandardSchemaV1<unknown, TReturnValue>;
}

/**
 * The names of the function members of an API, which are exactly the keys a typed {@link ApiContract} has.
 *
 * @typeParam TApi - The API.
 */
export type ApiMethodName<TApi extends object> = keyof ApiMethods<TApi> & string;

/**
 * The function members of an API.
 *
 * @typeParam TApi - The API.
 */
export type ApiMethods<TApi extends object> = {
  [TKey in keyof TApi as TApi[TKey] extends (...arguments_: never) => unknown ? TKey : never]: TApi[TKey];
};

/**
 * One type guard per parameter of a method, in order.
 *
 * @typeParam TParameters - The method's parameters.
 */
export type ArgumentTypeGuards<TParameters extends readonly unknown[]> = {
  readonly [TIndex in keyof TParameters]: ExpectedTypeGuard<TParameters[TIndex]>;
};
/**
 * Options for {@link createArgumentsSchema}.
 */
export interface CreateArgumentsSchemaOptions {
  /**
   * The Standard Schema `vendor` the schema reports. Defaults to this library's name.
   */
  readonly vendor?: string;
}

/**
 * Parameters for {@link createTypeGuardSchema}: the guard, what it expects, and optionally the schema's vendor.
 *
 * @typeParam T - The type the guard narrows to.
 */
export interface CreateTypeGuardSchemaParams<T> extends ExpectedTypeGuard<T> {
  /**
   * The Standard Schema `vendor` the schema reports. Defaults to this library's name.
   */
  readonly vendor?: string;
}

/**
 * One value a schema accepts, described by a type guard and by what it expects, for the issue message.
 *
 * @typeParam T - The type the guard narrows to.
 */
export interface ExpectedTypeGuard<T> {
  /**
   * What the value should have been, phrased to follow "Expected", e.g. `'a string'`.
   */
  readonly expected: string;

  /**
   * Decides whether the value is acceptable.
   *
   * @param value - The value to check.
   * @returns Whether the value is a `T`.
   */
  readonly typeGuard: (value: unknown) => value is T;
}

/**
 * The {@link ApiContract} of a named API: one entry per function member, each typed against that member. Both
 * schemas are REQUIRED here, so a typed contract is a full description of every signature and a `{}` entry does
 * not compile. Only the loose form leaves them optional.
 *
 * @typeParam TApi - The API the contract describes.
 */
export type TypedApiContract<TApi extends object> = {
  readonly [TKey in ApiMethodName<TApi>]-?: TApi[TKey] extends (...arguments_: infer TParameters) => infer TReturnValue ? Required<ApiMethodContract<TParameters, Awaited<TReturnValue>>>
    : never;
};

type MutableTuple<TTuple extends readonly unknown[]> = { -readonly [TIndex in keyof TTuple]: TTuple[TIndex] };

/**
 * Accepts a boolean.
 */
export const BOOLEAN_GUARD: ExpectedTypeGuard<boolean> = { expected: 'a boolean', typeGuard: isBoolean };

/**
 * Accepts a number.
 */
export const NUMBER_GUARD: ExpectedTypeGuard<number> = { expected: 'a number', typeGuard: isNumber };

/**
 * Accepts a string. Spread it to say what the string is: `{ ...STRING_GUARD, expected: 'a path' }`.
 */
export const STRING_GUARD: ExpectedTypeGuard<string> = { expected: 'a string', typeGuard: isString };

/**
 * Accepts an array of strings.
 */
export const STRING_ARRAY_GUARD: ExpectedTypeGuard<string[]> = { expected: 'an array of strings', typeGuard: isStringArray };

/**
 * Accepts `undefined`, which is the output of a method returning `void` or `Promise<void>`.
 */
export const UNDEFINED_GUARD: ExpectedTypeGuard<undefined> = { expected: 'undefined', typeGuard: isUndefined };

/**
 * Builds the input schema of a method contract: a schema over the method's ARGUMENT LIST, one type guard per
 * parameter. An argument that fails its guard is reported with its index as the issue path, and an argument list
 * longer than the parameter list is refused. A missing argument reaches its guard as `undefined`, so an optional
 * parameter's guard accepts `undefined` (see {@link optionalGuard}).
 *
 * @typeParam TParameters - The method's parameters, inferred from the guards or from the contract entry.
 * @param parameters - One guard per parameter, in order.
 * @param options - The options for the schema.
 * @returns The schema.
 */
export function createArgumentsSchema<const TParameters extends readonly unknown[]>(
  parameters: ArgumentTypeGuards<TParameters>,
  options?: CreateArgumentsSchemaOptions
): StandardSchemaV1<unknown, MutableTuple<TParameters>> {
  const parameterList = castTo<readonly ExpectedTypeGuard<unknown>[]>(parameters);
  return createSchema((value: unknown): StandardSchemaV1.Result<MutableTuple<TParameters>> => {
    if (!Array.isArray(value)) {
      return { issues: [{ message: 'Expected an argument list.' }] };
    }

    if (value.length > parameterList.length) {
      return { issues: [{ message: `Expected at most ${String(parameterList.length)} argument(s), got ${String(value.length)}.` }] };
    }

    const issues = parameterList.flatMap((parameter, index): StandardSchemaV1.Issue[] => parameter.typeGuard(value[index]) ? [] : [{ message: `Expected ${parameter.expected}.`, path: [index] }]);
    return issues.length === 0 ? { value: castTo<MutableTuple<TParameters>>(value) } : { issues };
  }, options?.vendor);
}

/**
 * Builds a schema over one value from a type guard: the output schema of a method contract, typically.
 *
 * @typeParam T - The type the guard narrows to.
 * @param params - The guard, what it expects, and optionally the schema's vendor.
 * @returns The schema.
 */
export function createTypeGuardSchema<T>(params: CreateTypeGuardSchemaParams<T>): StandardSchemaV1<unknown, T> {
  return createSchema(
    (value: unknown): StandardSchemaV1.Result<T> => params.typeGuard(value) ? { value } : { issues: [{ message: `Expected ${params.expected}.` }] },
    params.vendor
  );
}

/**
 * States a contract against an API type, so every entry is checked against its method and the schema builders
 * inside it infer their types from the method rather than from a restated tuple. It returns the contract as is.
 *
 * @typeParam TApi - The API the contract describes.
 * @param contract - The contract.
 * @returns The same contract.
 */
export function defineApiContract<TApi extends object>(contract: TypedApiContract<NoInfer<TApi>>): TypedApiContract<TApi> {
  return contract;
}

/**
 * Widens a guard to also accept `null`.
 *
 * @typeParam T - The type the guard narrows to.
 * @param guard - The guard to widen.
 * @returns A guard accepting what `guard` accepts, or `null`.
 */
export function nullableGuard<T>(guard: ExpectedTypeGuard<T>): ExpectedTypeGuard<null | T> {
  return {
    expected: `${guard.expected} or null`,
    typeGuard: (value: unknown): value is null | T => value === null || guard.typeGuard(value)
  };
}

/**
 * Widens a guard to also accept `undefined`, which is what an optional parameter receives when it is left out.
 *
 * @typeParam T - The type the guard narrows to.
 * @param guard - The guard to widen.
 * @returns A guard accepting what `guard` accepts, or `undefined`.
 */
export function optionalGuard<T>(guard: ExpectedTypeGuard<T>): ExpectedTypeGuard<T | undefined> {
  return {
    expected: `${guard.expected} or undefined`,
    typeGuard: (value: unknown): value is T | undefined => value === undefined || guard.typeGuard(value)
  };
}

function createSchema<T>(validate: (value: unknown) => StandardSchemaV1.Result<T>, vendor: string | undefined): StandardSchemaV1<unknown, T> {
  return {
    '~standard': {
      validate,
      vendor: vendor ?? LIBRARY_NAME,
      version: 1
    }
  };
}
