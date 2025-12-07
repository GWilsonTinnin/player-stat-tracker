export type CounterType = "plot" | "simple";

export interface PlayerCounter {
  key: string;
  type: CounterType;
  value: number;
  comment?: string;
  log?: string;
  history: Array<{
    timestamp: string;
    value: number;
    comment?: string;
  }>;
}