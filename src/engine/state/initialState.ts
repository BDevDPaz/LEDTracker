import { EngineState } from '../contracts/types';

export const initialState: EngineState = {
  activeSession: null,
  settings: null,
  isLoading: false,
  error: null,
  lastUpdated: 0,
};
