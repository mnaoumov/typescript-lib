/**
 * @file
 *
 * Contains utility functions for type guards, and combinators that build a {@link TypeGuard} out of others.
 *
 * The combinators here work on bare type guards. Their `api-contract` counterparts (`arrayGuard`, `optionalGuard`,
 * ...) work on an `ExpectedTypeGuard`, a type guard paired with the text an issue message reports, and their names
 * drop the `Type` this layer's names carry.
 */

import type { GenericFunction } from './function.ts';

import { noop } from './function.ts';

/**
 * A type that represents a generic object.
 *
 * @typeParam T - The base type to intersect with.
 */
export type GenericObject<T = unknown> = Record<string | symbol, unknown> & T;

/**
 * The type a {@link TypeGuard} narrows to. Distributes over a union of guards.
 *
 * @typeParam TTypeGuard - The type guard.
 */
export type GuardedType<TTypeGuard> = TTypeGuard extends (value: unknown) => value is infer T ? T : never;

/**
 * A value {@link literalTypeGuard} can compare against.
 */
export type Literal = bigint | boolean | null | number | string | symbol | undefined;

/**
 * Options for {@link objectTypeGuard}.
 */
export interface ObjectTypeGuardOptions {
  /**
   * Whether a value carrying an own enumerable string key that no property guard names is refused.
   *
   * @default `false`
   */
  readonly shouldRejectUnknownKeys?: boolean;
}

/**
 * One type guard per property of an object type, as {@link objectTypeGuard} takes them. Every key of `T` must be
 * listed. The guard of an optional property is typed to narrow to `undefined` as well, but a guard that refuses
 * `undefined` still compiles there, so widen it with {@link optionalTypeGuard}: an absent property reads as
 * `undefined`, and a guard refusing it refuses the object.
 *
 * @typeParam T - The object type.
 */
export type PropertyTypeGuards<T extends object> = {
  readonly [TKey in keyof T]-?: TypeGuard<Partial<Pick<T, TKey>> extends Pick<T, TKey> ? T[TKey] | undefined : T[TKey]>;
};

/**
 * A function deciding whether a value is a `T`.
 *
 * @typeParam T - The type the guard narrows to.
 */
export type TypeGuard<T> = (value: unknown) => value is T;

type NullableConstraint<T> = null extends T ? unknown : undefined extends T ? unknown : never;

/**
 * Builds a guard accepting an array whose every item the item guard accepts.
 *
 * @typeParam T - The type of an item.
 * @param isItem - The guard for one item.
 * @returns The guard.
 */
export function arrayTypeGuard<T>(isItem: TypeGuard<T>): TypeGuard<T[]> {
  return (value): value is T[] => Array.isArray(value) && value.every((item) => isItem(item));
}

/**
 * Asserts that a condition is `true`. Throws if it is not.
 *
 * Use in place of `/* v8 ignore *\/` for defensive guards that should
 * never trigger at runtime but would otherwise create uncovered branches.
 *
 * @param isTrue - The condition to assert.
 * @param errorOrMessage - The error or message to throw if the condition is `false`.
 */
export function assert(isTrue: boolean, errorOrMessage: Error | string): asserts isTrue {
  if (!isTrue) {
    throw typeof errorOrMessage === 'string' ? new Error(errorOrMessage) : errorOrMessage;
  }
}

/**
 * Asserts that a value is a generic object, narrowing its type in place.
 *
 * @typeParam T - The type of the value.
 * @param _object - The value to assert.
 */
export function assertGenericObject<T>(_object: T): asserts _object is GenericObject<T> {
  noop();
}

/**
 * Asserts at compile time that every case of a discriminated union has been
 * handled. Place at the `default` branch of a `switch` over a union or enum.
 *
 * If a new variant is added to the union without a matching `case`, the call
 * to {@link assertNever} fails to compile because `value` is no longer `never`.
 * If reached at runtime (e.g. because the value was bypassed via JSON or a
 * type assertion), it throws a descriptive `Error`.
 *
 * @example
 * ```ts
 * switch (mode) {
 *   case 'a': return doA();
 *   case 'b': return doB();
 *   default: assertNever(mode);
 * }
 * ```
 *
 * @param value - The exhaustively-handled value, narrowed to `never` by control flow.
 * @throws Always, if reached at runtime.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}

/**
 * Asserts that a value is not `null` or `undefined`, narrowing its type in place.
 *
 * Only callable when `T` includes `null` or `undefined`. Passing an already non-nullable type is a compile error.
 *
 * @typeParam T - The type of the value.
 * @param value - The value to check.
 * @param errorOrMessage - Optional {@link Error} or error message string.
 * @throws If the value is `null` or `undefined`.
 */
export function assertNonNullable<T extends NullableConstraint<T>>(value: T, errorOrMessage?: Error | string): asserts value is NonNullable<T> {
  if (value !== null && value !== undefined) {
    return;
  }

  errorOrMessage ??= value === null ? 'Value is null' : 'Value is undefined';
  const error = typeof errorOrMessage === 'string' ? new Error(errorOrMessage) : errorOrMessage;
  throw error;
}

/**
 * Ensures that a value is a generic object, returning it with narrowed type.
 *
 * @typeParam T - The type of the value.
 * @param $object - The value to ensure.
 * @returns The value as a generic object.
 */
export function ensureGenericObject<T>($object: T): GenericObject<T> {
  return $object as GenericObject<T>;
}

/**
 * Ensures that a value is not `null` or `undefined` and returns it with narrowed type.
 *
 * Only callable when `T` includes `null` or `undefined`. Passing an already non-nullable type is a compile error.
 *
 * @typeParam T - The type of the value.
 * @param value - The value to check.
 * @param errorOrMessage - Optional {@link Error} or error message string.
 * @returns The value with `null` and `undefined` excluded from its type.
 * @throws If the value is `null` or `undefined`.
 */
export function ensureNonNullable<T extends NullableConstraint<T>>(value: T, errorOrMessage?: Error | string): NonNullable<T> {
  assertNonNullable(value, errorOrMessage);
  return value;
}

/**
 * Builds a guard accepting any function, narrowed to the signature `TFunction`. Only that the value is a function
 * is checked: a signature cannot be checked at runtime, so the guard trusts it.
 *
 * @typeParam TFunction - The signature the guard narrows to.
 * @returns The guard.
 */
export function functionTypeGuard<TFunction extends GenericFunction>(): TypeGuard<TFunction> {
  return (value): value is TFunction => isFunction(value);
}

/**
 * Builds a guard accepting an instance of a class, or of a class derived from it.
 *
 * @typeParam T - The type of an instance.
 * @param constructor - The class.
 * @returns The guard.
 */
export function instanceOfTypeGuard<T>(constructor: abstract new (...arguments_: never[]) => T): TypeGuard<T> {
  return (value): value is T => value instanceof constructor;
}

/**
 * Checks whether a value is a boolean.
 *
 * @param value - The value to check.
 * @returns Whether the value is a boolean.
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Checks whether a value is a function.
 *
 * @param value - The value to check.
 * @returns Whether the value is a function.
 */
export function isFunction(value: unknown): value is GenericFunction {
  return typeof value === 'function';
}

/**
 * Checks whether a value is `null`.
 *
 * @param value - The value to check.
 * @returns Whether the value is `null`.
 */
export function isNull(value: unknown): value is null {
  return value === null;
}

/**
 * Checks whether a value is a number.
 *
 * @param value - The value to check.
 * @returns Whether the value is a number.
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

/**
 * Checks whether a value is an object: not `null`, and not a primitive or a function.
 *
 * @param value - The value to check.
 * @returns Whether the value is an object.
 */
export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/**
 * Checks whether a value is a string.
 *
 * @param value - The value to check.
 * @returns Whether the value is a string.
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Checks whether a value is an array of strings.
 *
 * @param value - The value to check.
 * @returns Whether the value is an array whose every item is a string.
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

/**
 * Checks whether a value is `undefined`.
 *
 * @param value - The value to check.
 * @returns Whether the value is `undefined`.
 */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

/**
 * Builds a guard accepting exactly the keys of a record. Typing the record over a union, as
 * `literalTypeGuard<Mode>({ A: true, B: true })`, makes a member later added to the union fail to compile until
 * it is listed.
 *
 * @typeParam T - The accepted strings.
 * @param literals - A record whose keys are the accepted strings.
 * @returns The guard.
 */
export function literalTypeGuard<T extends string>(literals: Readonly<Record<T, true>>): TypeGuard<T>;
/**
 * Builds a guard accepting exactly the listed values, compared as `Array.prototype.includes` compares them.
 *
 * @typeParam T - The accepted values.
 * @param literals - The accepted values.
 * @returns The guard.
 */
export function literalTypeGuard<T extends Literal>(literals: readonly T[]): TypeGuard<T>;
/**
 * Builds a guard accepting exactly the listed values.
 *
 * @param literals - The accepted values, as a list or as the keys of a record.
 * @returns The guard.
 */
export function literalTypeGuard(literals: Readonly<Record<string, true>> | readonly Literal[]): TypeGuard<Literal> {
  if (isReadonlyArray(literals)) {
    const literalList: readonly unknown[] = literals;
    return (value): value is Literal => literalList.includes(value);
  }

  return (value): value is Literal => isString(value) && Object.hasOwn(literals, value);
}

/**
 * Widens a guard to also accept `null`.
 *
 * @typeParam T - The type the guard narrows to.
 * @param isValue - The guard to widen.
 * @returns A guard accepting what `isValue` accepts, or `null`.
 */
export function nullableTypeGuard<T>(isValue: TypeGuard<T>): TypeGuard<null | T> {
  return unionTypeGuard(isNull, isValue);
}

/**
 * Builds a guard accepting an object whose every listed property its guard accepts. A property is read with
 * `Reflect.get`, so an inherited one counts and an absent one reads as `undefined`.
 *
 * @typeParam T - The object type.
 * @param propertyTypeGuards - One guard per property of `T`.
 * @param options - The options for the guard.
 * @returns The guard.
 */
export function objectTypeGuard<T extends object>(propertyTypeGuards: PropertyTypeGuards<T>, options?: ObjectTypeGuardOptions): TypeGuard<T> {
  const shouldRejectUnknownKeys = options?.shouldRejectUnknownKeys ?? false;
  return (value): value is T => {
    if (!isObject(value)) {
      return false;
    }

    if (shouldRejectUnknownKeys && Object.keys(value).some((key) => !Object.hasOwn(propertyTypeGuards, key))) {
      return false;
    }

    for (const key in propertyTypeGuards) {
      if (!propertyTypeGuards[key](Reflect.get(value, key))) {
        return false;
      }
    }

    return true;
  };
}

/**
 * Widens a guard to also accept `undefined`, which is what an optional property or parameter reads as when it is
 * left out.
 *
 * @typeParam T - The type the guard narrows to.
 * @param isValue - The guard to widen.
 * @returns A guard accepting what `isValue` accepts, or `undefined`.
 */
export function optionalTypeGuard<T>(isValue: TypeGuard<T>): TypeGuard<T | undefined> {
  return unionTypeGuard(isUndefined, isValue);
}

/**
 * Builds a guard accepting what any of the given guards accepts.
 *
 * @typeParam TTypeGuards - The guards.
 * @param typeGuards - The guards, tried in order.
 * @returns The guard.
 */
export function unionTypeGuard<const TTypeGuards extends readonly TypeGuard<unknown>[]>(
  ...typeGuards: TTypeGuards
): TypeGuard<GuardedType<TTypeGuards[number]>> {
  return (value): value is GuardedType<TTypeGuards[number]> => typeGuards.some((typeGuard) => typeGuard(value));
}

function isReadonlyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
