/**
 * @file
 *
 * A registry of debug switches: named, app-wide booleans that change behavior while debugging.
 *
 * A debug namespace (see `debug.ts`) controls logging only. Behavior that should differ while debugging, such as
 * not terminating an operation paused on a breakpoint, is a debug switch instead, so turning logging on never
 * changes what the code does.
 *
 * The definitions, the values and the change listeners all live in the shared state bag (`typescript-lib-state.ts`)
 * as plain data, so every copy of this library loaded in one realm, such as the copy each Obsidian plugin bundles,
 * sees one value per switch. A tool such as a debug-settings UI lists every registered switch with
 * {@link getDebugSwitches} and needs no change when a library or plugin adds one.
 */

import type { DisposableEx } from './disposable.ts';
import type { ValueWrapper } from './value-wrapper.ts';

import { CallbackDisposable } from './disposable.ts';
import { getTypescriptLibState } from './typescript-lib-state.ts';

/**
 * A handle to a registered debug switch.
 */
export interface DebugSwitch extends DebugSwitchDefinition {
  /**
   * Gets the current value.
   *
   * @returns `true` if the switch is on.
   */
  isEnabled: () => boolean;

  /**
   * Sets the value, notifying the {@link onDebugSwitchChanged} listeners if it changed.
   *
   * @param isEnabled - The new value.
   */
  setEnabled: (isEnabled: boolean) => void;
}

/**
 * A change of a debug switch's value, passed to an {@link onDebugSwitchChanged} listener.
 */
export interface DebugSwitchChange {
  /**
   * The id of the switch that changed.
   */
  readonly id: string;

  /**
   * The new value.
   */
  readonly isEnabled: boolean;
}

/**
 * The listener of {@link onDebugSwitchChanged}.
 */
export type DebugSwitchChangeListener = (change: DebugSwitchChange) => void;

/**
 * The definition of a debug switch.
 */
export interface DebugSwitchDefinition {
  /**
   * What the switch does, for a settings UI.
   */
  readonly description: string;

  /**
   * The unique id, namespaced by the library or plugin that owns the switch, e.g.
   * `typescript-lib:terminate-on-timeout`.
   */
  readonly id: string;

  /**
   * The value the switch has until something sets it.
   */
  readonly isEnabledByDefault: boolean;

  /**
   * The human-readable name, for a settings UI.
   */
  readonly name: string;
}

// A switch whose value an earlier version of this library kept under its own shared-state key keeps that key, so a
// copy of that version loaded beside this one still reads and writes the same value.
const LEGACY_STATE_KEYS: Readonly<Record<string, string>> = {
  'typescript-lib:terminate-on-timeout': 'isTerminationOnTimeoutEnabled'
};

const TERMINATE_ON_TIMEOUT_DEFINITION: DebugSwitchDefinition = {
  description: 'Terminate an operation that times out. Switch it off so an operation paused on a breakpoint keeps running.',
  id: 'typescript-lib:terminate-on-timeout',
  isEnabledByDefault: true,
  name: 'Terminate operations on timeout'
};

// This library's own switches, always registered, so a settings UI lists them before any code that reads them runs.
const BUILT_IN_DEFINITIONS: readonly DebugSwitchDefinition[] = [TERMINATE_ON_TIMEOUT_DEFINITION];

/**
 * Gets a registered debug switch.
 *
 * @param id - The id of the switch.
 * @returns The switch, or `undefined` if no switch with that id is registered.
 */
export function getDebugSwitch(id: string): DebugSwitch | undefined {
  const definition = getDefinitions().get(id);
  return definition ? createHandle(definition) : undefined;
}

/**
 * Gets every registered debug switch, sorted by id.
 *
 * @returns The registered switches.
 */
export function getDebugSwitches(): DebugSwitch[] {
  return [...getDefinitions().values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((definition) => createHandle(definition));
}

/**
 * Gets the debug switch that decides whether a `runWithTimeout` call without its own `onTimeout` terminates the
 * operation when it times out.
 *
 * Its id is `typescript-lib:terminate-on-timeout` and it is on by default. Switch it off while debugging, so an
 * operation paused on a breakpoint is not terminated under the debugger. The timeout is still logged through the
 * `Async:runWithTimeout` debugger.
 *
 * @returns The debug switch.
 */
export function getTerminateOnTimeoutDebugSwitch(): DebugSwitch {
  return registerDebugSwitch(TERMINATE_ON_TIMEOUT_DEFINITION);
}

/**
 * Adds a listener called whenever a debug switch's value changes, in any loaded copy of this library.
 *
 * @param listener - The listener.
 * @returns A disposable that removes the listener.
 */
export function onDebugSwitchChanged(listener: DebugSwitchChangeListener): DisposableEx {
  const listeners = getListeners();
  listeners.add(listener);
  return new CallbackDisposable({
    callback(): void {
      listeners.delete(listener);
    }
  });
}

/**
 * Registers a debug switch.
 *
 * Registering an id again is idempotent: the first definition is kept, and the returned handle reads the same
 * value. A value set with {@link setDebugSwitch} before the switch was registered is kept, not reset to the
 * default.
 *
 * @param definition - The definition of the switch.
 * @returns The handle to the switch.
 */
export function registerDebugSwitch(definition: DebugSwitchDefinition): DebugSwitch {
  const definitions = getDefinitions();
  let registeredDefinition = definitions.get(definition.id);
  if (!registeredDefinition) {
    registeredDefinition = {
      description: definition.description,
      id: definition.id,
      isEnabledByDefault: definition.isEnabledByDefault,
      name: definition.name
    };
    definitions.set(definition.id, registeredDefinition);
  }
  return createHandle(registeredDefinition);
}

/**
 * Sets the value of a debug switch, notifying the {@link onDebugSwitchChanged} listeners if it changed.
 *
 * The switch does not have to be registered yet: the value is kept, and the switch takes it when it registers. That
 * lets a settings store re-apply saved values before every library or plugin that owns a switch has loaded.
 *
 * @param id - The id of the switch.
 * @param isEnabled - The new value.
 */
export function setDebugSwitch(id: string, isEnabled: boolean): void {
  const definition = getDefinitions().get(id);
  // An unregistered switch with no value yet has no previous value, so its first set counts as a change.
  const wrapper = getValueWrapper(id, definition?.isEnabledByDefault ?? !isEnabled);
  if (wrapper.value === isEnabled) {
    return;
  }
  wrapper.value = isEnabled;
  for (const listener of getListeners()) {
    listener({ id, isEnabled });
  }
}

function createHandle(definition: DebugSwitchDefinition): DebugSwitch {
  return {
    ...definition,
    isEnabled(): boolean {
      return getValueWrapper(definition.id, definition.isEnabledByDefault).value;
    },
    setEnabled(isEnabled: boolean): void {
      setDebugSwitch(definition.id, isEnabled);
    }
  };
}

function getDefinitions(): Map<string, DebugSwitchDefinition> {
  const definitions = getTypescriptLibState('debugSwitchDefinitions', new Map<string, DebugSwitchDefinition>()).value;
  // Checked on every read, because the map may have been created by a copy of this library that predates a switch.
  for (const definition of BUILT_IN_DEFINITIONS) {
    if (!definitions.has(definition.id)) {
      definitions.set(definition.id, definition);
    }
  }
  return definitions;
}

function getListeners(): Set<DebugSwitchChangeListener> {
  return getTypescriptLibState('debugSwitchListeners', new Set<DebugSwitchChangeListener>()).value;
}

function getValueWrapper(id: string, isEnabledByDefault: boolean): ValueWrapper<boolean> {
  return getTypescriptLibState(LEGACY_STATE_KEYS[id] ?? `debugSwitch:${id}`, isEnabledByDefault);
}
