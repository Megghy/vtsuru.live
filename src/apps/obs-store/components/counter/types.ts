export type CounterTheme = 'minimal' | 'card' | 'neon' | 'glass'

export interface CounterState {
  title: string
  count: number
  target: number
  step: number
  prefix: string
  suffix: string
  showProgress: boolean
  theme: CounterTheme
  accentColor: string
  soundEnabled: boolean
}

export type CounterAction =
  | { type: 'INCREMENT'; amount: number }
  | { type: 'DECREMENT'; amount: number }
  | { type: 'RESET' }
  | { type: 'CELEBRATE' }

export const DEFAULT_COUNTER_STATE: CounterState = {
  title: '挑战死亡计数',
  count: 0,
  target: 0,
  step: 1,
  prefix: 'DEATHS',
  suffix: '',
  showProgress: false,
  theme: 'card',
  accentColor: '#38bdf8',
  soundEnabled: false,
}
