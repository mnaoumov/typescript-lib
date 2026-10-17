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

import type {
  GuardedType,
  Literal,
  ObjectTypeGuardOptions,
  PropertyTypeGuards,
  TypeGuard
} from './type-guards.ts';

import { LIBRARY_NAME } from './library.ts';
import { castTo } from './object-utils.ts';
import {
  arrayTypeGuard,
  instanceOfTypeGuard,
  isBoolean,
  isNumber,
  isString,
  isStringArray,
  isUndefined,
  literalTypeGuard,
  objectTypeGuard,
  optionalTypeGuard,
  unionTypeGuard
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
 * The schema builders of this module with the Standard Schema `vendor` already bound, as
 * {@link createApiContractSchemaBuilders} returns them.
 */
export interface ApiContractSchemaBuilders {
  /**
   * {@link createArgumentsSchema}, reporting the bound vendor.
   *
   * @typeParam TParameters - The method's parameters, inferred from the guards or from the contract entry.
   * @param parameters - One guard per parameter, in order.
   * @returns The schema.
   */
  readonly createArgumentsSchema: <const TParameters extends readonly unknown[]>(
    parameters: ArgumentTypeGuards<TParameters>
  ) => StandardSchemaV1<unknown, MutableTuple<TParameters>>;

  /**
   * {@link createTypeGuardSchema}, reporting the bound vendor.
   *
   * @typeParam T - The type the guard narrows to.
   * @param guard - The guard and what it expects.
   * @returns The schema.
   */
  readonly createTypeGuardSchema: <T>(guard: ExpectedTypeGuard<T>) => StandardSchemaV1<unknown, T>;
}

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
 * Options for {@link objectGuard}.
 *
 * @typeParam T - The object type the guard narrows to.
 */
export interface ObjectGuardOptions<T extends object> extends ObjectTypeGuardOptions<T> {
  /**
   * What the object is, put before its properties in `expected`, e.g. `'the options of the link'`.
   */
  readonly description?: string;
}

/**
 * One guard per option of an all-optional object type, as {@link optionsGuard} takes them: each describes a
 * PRESENT option, so it does not accept `undefined`. A required property of `T` takes `never`, so a type that is
 * not all-optional does not compile.
 *
 * @typeParam T - The object type.
 */
export type OptionGuards<T extends object> = {
  readonly [TKey in keyof T]-?: Partial<Pick<T, TKey>> extends Pick<T, TKey> ? ExpectedTypeGuard<Exclude<T[TKey], undefined>> : never;
};

/**
 * Options for {@link optionsGuard}.
 */
export interface OptionsGuardOptions {
  /**
   * What the options are, put before them in `expected`, e.g. `'select options'`.
   */
  readonly description?: string;

  /**
   * Whether a value carrying an own enumerable string key that no option guard names is refused. Letting it through,
   * the default, lets a consumer compiled against a later version of the options pass one this version does not know.
   *
   * @default `false`
   */
  readonly shouldRejectUnknownKeys?: boolean;
}

/**
 * One guard per property of an object type, as {@link objectGuard} takes them, typed as {@link PropertyTypeGuards}
 * types the bare guards.
 *
 * @typeParam T - The object type.
 */
export type PropertyGuards<T extends object> = {
  readonly [TKey in keyof T]-?: ExpectedTypeGuard<Partial<Pick<T, TKey>> extends Pick<T, TKey> ? T[TKey] | undefined : T[TKey]>;
};

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
 * Widens a guard to an array whose every item `itemGuard` accepts.
 *
 * @typeParam T - The type of an item.
 * @param itemGuard - The guard for one item.
 * @returns The guard.
 */
export function arrayGuard<T>(itemGuard: ExpectedTypeGuard<T>): ExpectedTypeGuard<T[]> {
  return createExpectedTypeGuard(`an array whose every item is ${itemGuard.expected}`, arrayTypeGuard(itemGuard.typeGuard));
}

/**
 * Binds the Standard Schema `vendor` once, so a contract does not pass it to every schema builder. Destructure the
 * result under the builders' own names and the calls read exactly as the unbound ones do:
 *
 * ```ts
 * const { createArgumentsSchema, createTypeGuardSchema } = createApiContractSchemaBuilders('my-plugin');
 * ```
 *
 * @param vendor - The vendor every schema reports.
 * @returns The bound builders.
 */
export function createApiContractSchemaBuilders(vendor: string): ApiContractSchemaBuilders {
  return {
    createArgumentsSchema: <const TParameters extends readonly unknown[]>(parameters: ArgumentTypeGuards<TParameters>) => createArgumentsSchema(parameters, { vendor }),
    createTypeGuardSchema: <T>(guard: ExpectedTypeGuard<T>) => createTypeGuardSchema({ ...guard, vendor })
  };
}

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
 * Pairs a type guard with what it expects.
 *
 * @typeParam T - The type the guard narrows to.
 * @param expected - What the value should have been, phrased to follow "Expected", e.g. `'a string'`.
 * @param typeGuard - The guard.
 * @returns The guard.
 */
export function createExpectedTypeGuard<T>(expected: string, typeGuard: TypeGuard<T>): ExpectedTypeGuard<T> {
  return { expected, typeGuard };
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
 * Builds a guard accepting an instance of a class, or of a class derived from it, expecting `an instance of` the
 * class's name.
 *
 * @typeParam T - The type of an instance.
 * @param constructor - The class.
 * @returns The guard.
 */
export function instanceOfGuard<T>(constructor: abstract new (...arguments_: never[]) => T): ExpectedTypeGuard<T> {
  return createExpectedTypeGuard(`an instance of ${constructor.name}`, instanceOfTypeGuard(constructor));
}

/**
 * Builds a guard accepting exactly the keys of a record, expecting `one of` them. Typing the record over a union
 * makes a member later added to the union fail to compile until it is listed.
 *
 * @typeParam T - The accepted strings.
 * @param literals - A record whose keys are the accepted strings.
 * @returns The guard.
 */
export function literalGuard<T extends string>(literals: Readonly<Record<T, true>>): ExpectedTypeGuard<T>;
/**
 * Builds a guard accepting exactly the listed values, expecting `one of` them.
 *
 * @typeParam T - The accepted values.
 * @param literals - The accepted values.
 * @returns The guard.
 */
export function literalGuard<T extends Literal>(literals: readonly T[]): ExpectedTypeGuard<T>;
/**
 * Builds a guard accepting exactly the listed values.
 *
 * @param literals - The accepted values, as a list or as the keys of a record.
 * @returns The guard.
 */
export function literalGuard(literals: Readonly<Record<string, true>> | readonly Literal[]): ExpectedTypeGuard<Literal> {
  const literalList: readonly Literal[] = isReadonlyArray(literals) ? literals : Object.keys(literals);
  return createExpectedTypeGuard(`one of ${literalList.map((literal) => formatLiteral(literal)).join(', ')}`, literalTypeGuard(literalList));
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
 * Builds a guard accepting an object whose every listed property its guard accepts, as {@link objectTypeGuard} does,
 * expecting the properties and what each expects: `{ alias?: a string; path: a string }`, after the
 * {@link ObjectGuardOptions.description} when one is given. A key is marked optional when it is listed in
 * {@link ObjectTypeGuardOptions.exactOptionalKeys}; without that list, an optional property's guard says
 * `or undefined` itself.
 *
 * @typeParam T - The object type.
 * @param propertyGuards - One guard per property of `T`.
 * @param options - The options for the guard.
 * @returns The guard.
 */
export function objectGuard<T extends object>(propertyGuards: PropertyGuards<T>, options?: ObjectGuardOptions<T>): ExpectedTypeGuard<T> {
  const guards = castTo<Readonly<Record<string, ExpectedTypeGuard<unknown>>>>(propertyGuards);
  const exactOptionalKeys: object = options?.exactOptionalKeys ?? {};
  return createExpectedTypeGuard(
    describeObject(options?.description, guards, (key) => Object.hasOwn(exactOptionalKeys, key)),
    objectTypeGuard<T>(castTo<PropertyTypeGuards<T>>(mapGuards(guards, (guard) => guard.typeGuard)), options)
  );
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

/**
 * Builds a guard accepting an options bag: an object whose every option may be absent, or `undefined`, and must
 * otherwise pass its guard. A key no guard names is let through unless
 * {@link OptionsGuardOptions.shouldRejectUnknownKeys} is set. It expects the options and what each expects:
 * `{ prefix?: a string; isHidden?: a boolean }`, after the {@link OptionsGuardOptions.description} when one is given.
 *
 * @typeParam T - The options type, every property of which is optional.
 * @param optionGuards - One guard per option of `T`, for a present value.
 * @param options - The options for the guard.
 * @returns The guard.
 */
export function optionsGuard<T extends object>(optionGuards: OptionGuards<T>, options?: OptionsGuardOptions): ExpectedTypeGuard<T> {
  const guards = castTo<Readonly<Record<string, ExpectedTypeGuard<unknown>>>>(optionGuards);
  return createExpectedTypeGuard(
    describeObject(options?.description, guards, () => true),
    objectTypeGuard<T>(castTo<PropertyTypeGuards<T>>(mapGuards(guards, (guard) => optionalTypeGuard(guard.typeGuard))), {
      shouldRejectUnknownKeys: options?.shouldRejectUnknownKeys ?? false
    })
  );
}

/**
 * Builds a guard accepting what any of the given guards accepts, expecting their `expected` texts joined by `or`.
 *
 * @typeParam TGuards - The guards.
 * @param guards - The guards, tried in order.
 * @returns The guard.
 */
export function unionGuard<const TGuards extends readonly ExpectedTypeGuard<unknown>[]>(
  ...guards: TGuards
): ExpectedTypeGuard<GuardedType<TGuards[number]['typeGuard']>> {
  return createExpectedTypeGuard(
    guards.map((guard) => guard.expected).join(' or '),
    unionTypeGuard(...guards.map((guard) => guard.typeGuard))
  );
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

function describeObject(
  description: string | undefined,
  guards: Readonly<Record<string, ExpectedTypeGuard<unknown>>>,
  isOptional: (key: string) => boolean
): string {
  const entries = Object.entries(guards);
  const properties = entries.length === 0
    ? '{}'
    : `{ ${entries.map(([key, guard]) => `${key}${isOptional(key) ? '?' : ''}: ${guard.expected}`).join('; ')} }`;
  return description === undefined ? properties : `${description}: ${properties}`;
}

function formatLiteral(literal: Literal): string {
  if (isString(literal)) {
    return `'${literal}'`;
  }

  return typeof literal === 'bigint' ? `${String(literal)}n` : String(literal);
}

function isReadonlyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function mapGuards(
  guards: Readonly<Record<string, ExpectedTypeGuard<unknown>>>,
  toTypeGuard: (guard: ExpectedTypeGuard<unknown>) => TypeGuard<unknown>
): Record<string, TypeGuard<unknown>> {
  return Object.fromEntries(Object.entries(guards).map(([key, guard]) => [key, toTypeGuard(guard)]));
}
