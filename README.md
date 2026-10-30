# @mnaoumov/typescript-lib

Generic TypeScript utilities, usable in any TypeScript project: async helpers, errors, disposables, strings, paths, debug logging, value transformers and DOM helpers.

## Installation

```bash
npm install @mnaoumov/typescript-lib
```

## Documentation

The guides and the API reference are at [mnaoumov.dev/typescript-lib](https://mnaoumov.dev/typescript-lib/).

## Where it fits

It is one of five packages that replace [`obsidian-dev-utils`](https://github.com/mnaoumov/obsidian-dev-utils): [`@mnaoumov/typescript-lib`](https://github.com/mnaoumov/typescript-lib), [`@mnaoumov/typescript-test-toolkit`](https://github.com/mnaoumov/typescript-test-toolkit), [`@mnaoumov/typescript-dev-toolkit`](https://github.com/mnaoumov/typescript-dev-toolkit), [`@mnaoumov/obsidian-lib`](https://github.com/mnaoumov/obsidian-lib) and [`@mnaoumov/obsidian-dev-toolkit`](https://github.com/mnaoumov/obsidian-dev-toolkit). It depends on none of the other `@mnaoumov` packages. It moved here from that repository with its history.

## API contracts

`@mnaoumov/typescript-lib/api-contract` describes an API one module exposes to another: which methods it promises, and a [Standard Schema](https://standardschema.dev) over each method's arguments and awaited return value. The schemas are built from type guards, so no schema library is needed, and zod / valibot / arktype schemas fit the same slots.

A provider keeps two files beside each other. `api.d.ts` declares the API type and stays copyable. `api-contract.ts` is the contract constant and nothing else:

```ts
import {
  BOOLEAN_GUARD,
  createArgumentsSchema,
  createTypeGuardSchema,
  defineApiContract,
  NUMBER_GUARD,
  optionalGuard,
  STRING_GUARD
} from '@mnaoumov/typescript-lib/api-contract';

import type { CounterApi } from './api.d.ts';

export const COUNTER_API_CONTRACT = defineApiContract<CounterApi>({
  count: {
    input: createArgumentsSchema([{ ...STRING_GUARD, expected: 'a text' }, optionalGuard(BOOLEAN_GUARD)]),
    output: createTypeGuardSchema(NUMBER_GUARD)
  }
});
```

`defineApiContract<TApi>` checks the contract against the API: one entry per method, none missing or extra, each with both schemas, and each schema producing that method's parameters or awaited return value. The builders take their types from the entry, so no tuple is restated. `ApiContract<TApi>` is the same check as a type annotation, and `ApiContract` with no type argument is the loose record a reader that does not know the API sees.

- `createArgumentsSchema(guards, { vendor })` validates an argument list: one guard per parameter, issues carrying the argument index, too many arguments refused.
- `createTypeGuardSchema({ expected, typeGuard, vendor })` validates one value.
- `BOOLEAN_GUARD`, `NUMBER_GUARD`, `STRING_GUARD`, `STRING_ARRAY_GUARD` and `UNDEFINED_GUARD` are ready-made guards, `optionalGuard` and `nullableGuard` widen one, and a spread renames what it expects.
- `arrayGuard`, `literalGuard`, `unionGuard` and `instanceOfGuard` build a guard together with what it expects, and `createExpectedTypeGuard(expected, typeGuard)` pairs any other type guard with its text.
- `objectGuard<T>({ ... }, { description })` builds an object guard from one such guard per property, expecting `description: { key: expected; ... }`. `optionsGuard<T>` does the same for an all-optional options bag: each guard describes a present option, and an absent or `undefined` one passes.
- The schema `vendor` defaults to `@mnaoumov/typescript-lib`. `createApiContractSchemaBuilders(vendor)` binds it once: destructure `createArgumentsSchema` and `createTypeGuardSchema` from it, and no call passes the vendor again.

The guards for an API's own shapes come from `@mnaoumov/typescript-lib/type-guards`, whose combinators work on bare type guards: `objectTypeGuard<T>({ ... })` takes one guard per property of `T` and none may be missing (`{ shouldRejectUnknownKeys: true }` refuses extra keys, and `{ exactOptionalKeys: { ... } }`, listing every optional key, reads own keys only and refuses an optional key present as `undefined`), and `arrayTypeGuard`, `literalTypeGuard`, `unionTypeGuard`, `optionalTypeGuard`, `nullableTypeGuard`, `instanceOfTypeGuard` and `functionTypeGuard` build the rest. A name ending in `TypeGuard` returns a bare type guard; the `api-contract` name without `Type` returns the same guard paired with its `expected` text.

Running the schemas belongs to whoever owns the call path. `@mnaoumov/obsidian-lib`'s plugin API registry runs them while its debugger is on.

A contract's own test can use `@mnaoumov/typescript-lib/api-contract-verifier`. `verifyApiContract(contract, { cases, vendor })` takes valid and invalid sample payloads for each half of each method and returns every violation it finds: a method the contract and the cases disagree on, a missing schema, a wrong vendor, a valid payload refused or an invalid one accepted. It returns a list rather than asserting, so it works under any test runner: `expect(await verifyApiContract(...)).toEqual([])`. `validateSync(schema, value)` runs a schema that must answer synchronously, and throws when it answers with a promise.

## Filing an issue (for AI agents and humans)

Open issues through the [issue forms](https://github.com/mnaoumov/typescript-lib/issues/new/choose), not as blank issues.

Filing from the CLI or the API (`gh issue create --body`, or an AI agent filing for you) skips the form, and `gh issue create --template` cannot load an issue form. In that case, open the matching form in [`.github/ISSUE_TEMPLATE/`](https://github.com/mnaoumov/typescript-lib/tree/HEAD/.github/ISSUE_TEMPLATE), copy every field as a `### <label>` heading in the form's order, and fill in each one. Always state the version you used and your operating system.

## License

© [Michael Naumov](https://github.com/mnaoumov/)
