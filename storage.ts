import { PlayerCounter } from "./counter";

export class CounterStorage {
  // Load/save counters from plugin data or a markdown file
  async loadCounters(): Promise<PlayerCounter[]> { /* ... */ }
  async saveCounters(counters: PlayerCounter[]): Promise<void> { /* ... */ }
  async logChange(counterKey: string, value: number, comment?: string) { /* ... */ }
}