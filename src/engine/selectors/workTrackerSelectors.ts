import { EngineState } from '../contracts/types';

export const selectActiveSession = (state: EngineState) => state.activeSession;
export const selectSettings = (state: EngineState) => state.settings;
export const selectIsLoading = (state: EngineState) => state.isLoading;
export const selectError = (state: EngineState) => state.error;
