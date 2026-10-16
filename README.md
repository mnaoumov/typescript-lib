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
- The schema `vendor` defaults to `@mnaoumov/typescript-lib`.

Running the schemas belongs to whoever owns the call path. `@mnaoumov/obsidian-lib`'s plugin API registry runs them while its debugger is on.

## License

© [Michael Naumov](https://github.com/mnaoumov/)
