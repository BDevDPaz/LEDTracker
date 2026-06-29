import { EngineState, EngineEvent } from './contracts/types';
import { workTrackerReducer } from './reducer/workTrackerReducer';
import { workTrackerEffects } from './effects/workTrackerEffects';
import { initialState } from './state/initialState';

type Listener = (state: EngineState) => void;

class WorkTrackerEngine {
  private state: EngineState = initialState;
  private listeners: Set<Listener> = new Set();

  getState() {
    return this.state;
  }

  dispatch(event: EngineEvent) {
    this.state = workTrackerReducer(this.state, event);
    this.notify();
    void workTrackerEffects(event, this.state, this.dispatch.bind(this));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.state));
  }
}

export const engine = new WorkTrackerEngine();
