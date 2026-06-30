import { EngineState } from '../contracts/types';

export const initialState: EngineState = {
  activeSession: null,
  settings: {
    id: 1,
    employee_name: '',
    employer_name: '',
    company_email: '',
    tolerance_radius: 200,
    hourly_rate: 0,
    language: 'es',
    start_time: '08:00',
    overtime_multiplier: 1.5,
  },
  isLoading: false,
  error: null,
  lastUpdated: 0,
};
