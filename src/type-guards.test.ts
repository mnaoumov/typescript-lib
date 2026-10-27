import {
  describe,
  expect,
  expectTypeOf,
  it
} from 'vitest';

import type {
  GuardedType,
  ObjectTypeGuardOptions,
  OptionalKeys,
  PropertyTypeGuards,
  TypeGuard
} from './type-guards.ts';

import { noop } from './function.ts';
import { castTo } from './object-utils.ts';
import {
  arrayTypeGuard,
  assert,
  assertGenericObject,
  assertNever,
  assertNonNullable,
  ensureGenericObject,
  ensureNonNullable,
  functionTypeGuard,
  instanceOfTypeGuard,
  isBoolean,
  isFunction,
  isNull,
  isNumber,
  isObject,
  isString,
  isStringArray,
  isUndefined,
  literalTypeGuard,
  nullableTypeGuard,
  objectTypeGuard,
  optionalTypeGuard,
  unionTypeGuard
} from './type-guards.ts';

type Letter = 'A' | 'B';

interface Shape {
  readonly label?: string;
  readonly size: number;
}

class Base {
  public readonly base = true;
}

class Derived extends Base {}

function expectGuard(guard: TypeGuard<unknown>, accepted: readonly unknown[], refused: readonly unknown[]): void {
  expect(accepted.map((value) => guard(value))).toEqual(accepted.map(() => true));
  expect(refused.map((value) => guard(value))).toEqual(refused.map(() => false));
}

describe('TypeGuards', () => {
  describe('primitive guards', () => {
    it.each([
      { accepted: [true, false], guard: isBoolean, name: 'isBoolean', refused: [0, 'true', null, undefined] },
      { accepted: [noop, Base], guard: isFunction, name: 'isFunction', refused: [{}, null, 'f'] },
      { accepted: [null], guard: isNull, name: 'isNull', refused: [undefined, 0, ''] },
      { accepted: [0, NaN, -1.5], guard: isNumber, name: 'isNumber', refused: ['1', null, undefined, 1n] },
      { accepted: [{}, [], new Base()], guard: isObject, name: 'isObject', refused: [null, undefined, 'a', noop] },
      { accepted: ['', 'a'], guard: isString, name: 'isString', refused: [1, null, undefined, ['a']] },
      { accepted: [[], ['a', 'b']], guard: isStringArray, name: 'isStringArray', refused: ['a', ['a', 1], null, {}] },
      { accepted: [undefined], guard: isUndefined, name: 'isUndefined', refused: [null, 0, ''] }
    ])('$name should accept exactly its type', ({ accepted, guard, refused }) => {
      expectGuard(guard, accepted, refused);
    });
  });

  describe('combinators', () => {
    it('arrayTypeGuard should accept an array whose every item passes', () => {
      const guard = arrayTypeGuard(isNumber);
      expectGuard(guard, [[], [1, 2]], [[1, '2'], 1, null, { length: 0 }]);
      expectTypeOf(guard).guards.toEqualTypeOf<number[]>();
    });

    it('functionTypeGuard should accept any function under the given signature', () => {
      const guard = functionTypeGuard<() => Promise<ArrayBuffer>>();
      expectGuard(guard, [noop, Base], [{}, null]);
      expectTypeOf(guard).guards.toEqualTypeOf<() => Promise<ArrayBuffer>>();
    });

    it('instanceOfTypeGuard should accept an instance of the class or a derived one', () => {
      const guard = instanceOfTypeGuard(Base);
      expectGuard(guard, [new Base(), new Derived()], [{ base: true }, null, Base]);
      expectTypeOf(guard).guards.toEqualTypeOf<Base>();
    });

    it('literalTypeGuard should accept exactly the listed values', () => {
      const guard = literalTypeGuard(['a', 1, null, NaN]);
      expectGuard(guard, ['a', 1, null, NaN], ['b', '1', undefined, 2]);
      expectTypeOf(guard).guards.toEqualTypeOf<'a' | null | number>();
    });

    it('literalTypeGuard should accept exactly the keys of a record', () => {
      const guard = literalTypeGuard<Letter>({ A: true, B: true });
      expectGuard(guard, ['A', 'B'], ['C', 'toString', 1, null]);
      expectTypeOf(guard).guards.toEqualTypeOf<Letter>();
    });

    it('literalTypeGuard should refuse a record missing a member of the union', () => {
      // @ts-expect-error -- `B` is missing.
      const guard = literalTypeGuard<Letter>({ A: true });
      expect(guard('A')).toBe(true);
    });

    it('nullableTypeGuard and optionalTypeGuard should widen a guard', () => {
      const nullable = nullableTypeGuard(isString);
      const optional = optionalTypeGuard(isString);
      expectGuard(nullable, [null, 'a'], [undefined, 1]);
      expectGuard(optional, [undefined, 'a'], [null, 1]);
      expectTypeOf(nullable).guards.toEqualTypeOf<null | string>();
      expectTypeOf(optional).guards.toEqualTypeOf<string | undefined>();
    });

    it('unionTypeGuard should accept what any of its guards accepts', () => {
      const guard = unionTypeGuard(isString, isNumber, isNull);
      expectGuard(guard, ['a', 1, null], [undefined, true, {}]);
      expectTypeOf(guard).guards.toEqualTypeOf<null | number | string>();
      expectGuard(unionTypeGuard(), [], [undefined, 1]);
    });

    it('GuardedType should read the narrowed type of a guard', () => {
      expectTypeOf<GuardedType<typeof isString>>().toEqualTypeOf<string>();
      expectTypeOf<GuardedType<TypeGuard<number> | TypeGuard<string>>>().toEqualTypeOf<number | string>();
    });
  });

  describe('objectTypeGuard', () => {
    const isShape = objectTypeGuard<Shape>({ label: optionalTypeGuard(isString), size: isNumber });

    it('should accept an object whose every listed property passes', () => {
      expectGuard(isShape, [{ size: 1 }, { label: 'a', size: 1 }, { extra: true, size: 1 }], [{ label: 1, size: 1 }, { label: 'a' }, null, 1, []]);
      expectTypeOf(isShape).guards.toEqualTypeOf<Shape>();
    });

    it('should read an inherited property', () => {
      const inherited: unknown = Object.create({ size: 1 });
      expect(isShape(inherited)).toBe(true);
    });

    it('should accept unknown keys by default and refuse them when asked', () => {
      const strict = objectTypeGuard<Shape>({ label: optionalTypeGuard(isString), size: isNumber }, { shouldRejectUnknownKeys: true });
      expectGuard(strict, [{ size: 1 }, { label: 'a', size: 1 }], [{ extra: true, size: 1 }]);
      expect(objectTypeGuard<Shape>({ label: optionalTypeGuard(isString), size: isNumber }, {})({ extra: true, size: 1 })).toBe(true);
    });

    it('should require a guard for every key', () => {
      // @ts-expect-error -- `label` is missing.
      const missingKey: PropertyTypeGuards<Shape> = { size: isNumber };
      expect(missingKey).toEqual({ size: isNumber });
    });

    it('should refuse an absent optional property whose guard was not widened to undefined', () => {
      expect(objectTypeGuard<Shape>({ label: isString, size: isNumber })({ size: 1 })).toBe(false);
    });

    describe('with exactOptionalKeys', () => {
      const isExactShape = objectTypeGuard<Shape>({ label: isString, size: isNumber }, { exactOptionalKeys: { label: true } });

      it('should accept an absent optional key and refuse one present as undefined', () => {
        expectGuard(isExactShape, [{ size: 1 }, { label: 'a', size: 1 }, { extra: true, size: 1 }], [{ label: undefined, size: 1 }, { label: 1, size: 1 }]);
      });

      it('should refuse an absent required key', () => {
        expectGuard(isExactShape, [], [{ label: 'a' }, {}]);
      });

      it('should read only own keys', () => {
        expect(isExactShape(Object.create({ size: 1 }))).toBe(false);
        expect(isExactShape(Object.assign(Object.create({ label: 1 }), { size: 1 }))).toBe(true);
      });

      it('should still refuse unknown keys when asked', () => {
        const strict = objectTypeGuard<Shape>({ label: isString, size: isNumber }, { exactOptionalKeys: { label: true }, shouldRejectUnknownKeys: true });
        expectGuard(strict, [{ size: 1 }], [{ extra: true, size: 1 }]);
      });

      it('should require every optional key and only optional keys', () => {
        // @ts-expect-error -- `label` is optional and missing.
        const missing: ObjectTypeGuardOptions<Shape> = { exactOptionalKeys: {} };
        // @ts-expect-error -- `size` is required.
        const required: ObjectTypeGuardOptions<Shape> = { exactOptionalKeys: { label: true, size: true } };
        expect([missing, required]).toHaveLength(2);
        expectTypeOf<OptionalKeys<Shape>>().toEqualTypeOf<'label'>();
      });
    });
  });

  describe('assert', () => {
    it('should not throw when condition is true', () => {
      expect(() => {
        assert(true, 'should not throw');
      }).not.toThrow();
    });

    it('should throw with string message when condition is false', () => {
      expect(() => {
        assert(false, 'test error');
      }).toThrow('test error');
    });

    it('should throw the provided Error instance when condition is false', () => {
      const error = new TypeError('custom error');
      expect(() => {
        assert(false, error);
      }).toThrow(error);
    });
  });

  describe('assertGenericObject', () => {
    it('should not throw for a plain object', () => {
      const $object = { key: 'value' };
      expect(() => {
        assertGenericObject($object);
      }).not.toThrow();
    });

    it('should narrow the type to GenericObject', () => {
      const $object: object = { a: 1, b: 'two' };
      assertGenericObject($object);
      expect($object['a']).toBe(1);
      expect($object['b']).toBe('two');
    });
  });

  describe('assertNever', () => {
    it('should throw with the stringified value', () => {
      expect(() => {
        assertNever(castTo<never>('unexpected'));
      }).toThrow('Unhandled value: unexpected');
    });

    it('should be callable in an exhaustive switch default branch', () => {
      type Mode = 'a' | 'b';
      function handle(mode: Mode): string {
        switch (mode) {
          case 'a': {
            return 'A';
          }
          case 'b': {
            return 'B';
          }
          default: {
            assertNever(mode);
          }
        }
      }
      expect(handle('a')).toBe('A');
      expect(handle('b')).toBe('B');
      expect(() => handle('c' as Mode)).toThrow('Unhandled value: c');
    });
  });

  describe('assertNonNullable', () => {
    it('should not throw for a defined value', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Assertion needed to satisfy NullableConstraint generic.
        assertNonNullable('hello' as string | undefined);
      }).not.toThrow();
    });

    it('should throw for null', () => {
      expect(() => {
        assertNonNullable(null);
      }).toThrow('Value is null');
    });

    it('should throw for undefined', () => {
      expect(() => {
        assertNonNullable(undefined);
      }).toThrow('Value is undefined');
    });

    it('should throw with custom message', () => {
      expect(() => {
        assertNonNullable(null, 'custom error');
      }).toThrow('custom error');
    });

    it('should throw with custom Error', () => {
      const error = new Error('my error');
      expect(() => {
        assertNonNullable(null, error);
      }).toThrow(error);
    });
  });

  describe('ensureGenericObject', () => {
    it('should return the object as GenericObject', () => {
      const $object: object = { x: 42 };
      const result = ensureGenericObject($object);
      expect(result).toBe($object);
      expect(result['x']).toBe(42);
    });

    it('should preserve original type in the intersection', () => {
      const $object = { name: 'test', value: 123 };
      const result = ensureGenericObject($object);
      expect(result.name).toBe('test');
      expect(result.value).toBe(123);
      expectTypeOf(result.name).toEqualTypeOf<string>();
      expectTypeOf(result.value).toEqualTypeOf<number>();
    });

    it('should allow accessing unknown properties via index signature', () => {
      const $object = { name: 'test' };
      const result = ensureGenericObject($object);
      result['newProp'] = 'dynamic';
      expect(result['newProp']).toBe('dynamic');
    });
  });

  describe('ensureNonNullable', () => {
    it('should return the value when not null or undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Assertion needed to satisfy NullableConstraint generic.
      expect(ensureNonNullable('hello' as string | undefined)).toBe('hello');
    });

    it('should throw for null', () => {
      expect(() => ensureNonNullable(null)).toThrow('Value is null');
    });

    it('should throw for undefined', () => {
      expect(() => ensureNonNullable(undefined)).toThrow('Value is undefined');
    });
  });
});
