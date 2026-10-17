import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { DebugSwitchDefinition } from './debug-switches.ts';

import {
  getDebugSwitch,
  getDebugSwitches,
  getTerminateOnTimeoutDebugSwitch,
  onDebugSwitchChanged,
  registerDebugSwitch,
  setDebugSwitch
} from './debug-switches.ts';
import { getTypescriptLibState } from './typescript-lib-state.ts';

function makeDefinition(id: string, isEnabledByDefault = false): DebugSwitchDefinition {
  return {
    description: `Description of ${id}`,
    id,
    isEnabledByDefault,
    name: `Name of ${id}`
  };
}

describe('debug-switches', () => {
  describe('registerDebugSwitch', () => {
    it('should return a handle carrying the definition and the default value', () => {
      const debugSwitch = registerDebugSwitch(makeDefinition('test:a', true));
      expect(debugSwitch.id).toBe('test:a');
      expect(debugSwitch.name).toBe('Name of test:a');
      expect(debugSwitch.description).toBe('Description of test:a');
      expect(debugSwitch.isEnabledByDefault).toBe(true);
      expect(debugSwitch.isEnabled()).toBe(true);
    });

    it('should keep the first definition when the same id registers again', () => {
      const first = registerDebugSwitch(makeDefinition('test:a', false));
      first.setEnabled(true);
      const second = registerDebugSwitch({ ...makeDefinition('test:a', false), name: 'Other name' });
      expect(second.name).toBe('Name of test:a');
      expect(second.isEnabled()).toBe(true);
      expect(getDebugSwitches().filter((debugSwitch) => debugSwitch.id === 'test:a')).toHaveLength(1);
    });

    it('should adopt a value set before the switch registered', () => {
      setDebugSwitch('test:a', true);
      expect(registerDebugSwitch(makeDefinition('test:a', false)).isEnabled()).toBe(true);
    });

    it('should keep the terminate-on-timeout value under the key earlier versions read', () => {
      getTypescriptLibState('isTerminationOnTimeoutEnabled', true).value = false;
      const debugSwitch = getTerminateOnTimeoutDebugSwitch();
      expect(debugSwitch.isEnabled()).toBe(false);
      debugSwitch.setEnabled(true);
      expect(getTypescriptLibState('isTerminationOnTimeoutEnabled', false).value).toBe(true);
    });
  });

  describe('getDebugSwitch', () => {
    it('should return undefined for an unregistered id', () => {
      expect(getDebugSwitch('test:missing')).toBeUndefined();
    });

    it('should return a handle to a registered switch', () => {
      registerDebugSwitch(makeDefinition('test:a'));
      const debugSwitch = getDebugSwitch('test:a');
      expect(debugSwitch?.id).toBe('test:a');
      debugSwitch?.setEnabled(true);
      expect(getDebugSwitch('test:a')?.isEnabled()).toBe(true);
    });
  });

  describe('getDebugSwitches', () => {
    it('should list every registered switch sorted by id', () => {
      registerDebugSwitch(makeDefinition('test:b'));
      registerDebugSwitch(makeDefinition('test:a'));
      expect(getDebugSwitches().map((debugSwitch) => debugSwitch.id)).toStrictEqual(['test:a', 'test:b', 'typescript-lib:terminate-on-timeout']);
    });

    it('should list the built-in switches with nothing registered', () => {
      expect(getDebugSwitches().map((debugSwitch) => debugSwitch.id)).toStrictEqual(['typescript-lib:terminate-on-timeout']);
    });

    it('should restore a built-in switch missing from a registry an earlier copy created', () => {
      getTypescriptLibState('debugSwitchDefinitions', new Map<string, DebugSwitchDefinition>());
      expect(getDebugSwitch('typescript-lib:terminate-on-timeout')?.isEnabledByDefault).toBe(true);
    });
  });

  describe('setDebugSwitch', () => {
    it('should notify the listeners when the value changes', () => {
      registerDebugSwitch(makeDefinition('test:a'));
      const listener = vi.fn();
      onDebugSwitchChanged(listener);
      setDebugSwitch('test:a', true);
      expect(listener).toHaveBeenCalledExactlyOnceWith({ id: 'test:a', isEnabled: true });
    });

    it('should not notify the listeners when the value is unchanged', () => {
      registerDebugSwitch(makeDefinition('test:a'));
      const listener = vi.fn();
      onDebugSwitchChanged(listener);
      setDebugSwitch('test:a', false);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should notify the listeners on the first set of an unregistered switch', () => {
      const listener = vi.fn();
      onDebugSwitchChanged(listener);
      setDebugSwitch('test:a', false);
      expect(listener).toHaveBeenCalledExactlyOnceWith({ id: 'test:a', isEnabled: false });
    });
  });

  describe('onDebugSwitchChanged', () => {
    it('should stop notifying a listener once its disposable is disposed', () => {
      const debugSwitch = registerDebugSwitch(makeDefinition('test:a'));
      const listener = vi.fn();
      const disposable = onDebugSwitchChanged(listener);
      disposable.dispose();
      debugSwitch.setEnabled(true);
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
