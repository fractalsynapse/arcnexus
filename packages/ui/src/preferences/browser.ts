import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { Subscriptions } from '../registry/subscriptions.js';
import type { PreferencesSnapshot, UiPreference } from './schema.js';

export interface UiPreferencesBinding {
  load(): Promise<PreferencesSnapshot>;
  save(entry: UiPreference): Promise<PreferencesSnapshot>;
}

type State = PreferencesSnapshot & { ready: boolean; error?: string };

/** Publish a shared snapshot and keep local reads from overtaking a pending save. */
export class UiPreferences {
  private readonly observers = new Subscriptions();
  private state: State = { entries: [], ready: false };
  private pending: Promise<unknown> = Promise.resolve();
  readonly subscribe = this.observers.subscribe;
  readonly snapshot = () => this.state;

  /** Accept a transport without binding UI to a gateway or storage implementation. */
  constructor(private readonly binding: UiPreferencesBinding) {}

  /** Read committed settings when the app opens or returns to focus. */
  readonly refresh = () => this.queue(this.binding.load, false);

  /** Commit one setting and expose the gateway's accepted snapshot. */
  readonly save = (entry: UiPreference) => this.queue(() => this.binding.save(entry), true);

  /** Serialize operations so failed requests cannot replace the last committed settings. */
  private queue(request: () => Promise<PreferencesSnapshot>, reportFailure: boolean) {
    const result = this.pending.then(async () => {
      try {
        this.state = { ...(await request()), ready: true };
      } catch {
        const error = reportFailure ? 'Settings could not be saved.' : this.state.error;
        this.state = { ...this.state, ready: true, error };
        this.observers.publish();
        return false;
      }
      this.observers.publish();
      return true;
    });
    this.pending = result;
    return result;
  }
}

export const preferencesScope = createContext<UiPreferences | undefined>(undefined);

export function useUiPreferences() {
  const store = useContext(preferencesScope);
  if (!store) throw new Error('UI preferences binding is required');
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot);
  return { ...snapshot, save: store.save };
}

export function usePreferenceRefresh(store: UiPreferences) {
  useEffect(() => {
    void store.refresh();
    window.addEventListener('focus', store.refresh);
    return () => window.removeEventListener('focus', store.refresh);
  }, [store]);
}
