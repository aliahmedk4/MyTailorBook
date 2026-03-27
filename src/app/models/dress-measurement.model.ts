export type Measurements = Record<string, string>;

export interface DressMeasurement {
  id: string;
  dressType: string;
  measurements: Measurements;
  notes?: string;
}
