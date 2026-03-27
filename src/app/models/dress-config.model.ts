export interface MeasurementField {
  key: string;    // unique identifier e.g. 'chest', 'custom_neck'
  label: string;  // display name e.g. 'Chest', 'Neck'
}

export interface DressConfig {
  id: string;
  name: string;               // e.g. 'Shirt', 'Kurta'
  fields: MeasurementField[]; // ordered list of measurement fields for this dress
  isDefault: boolean;
}
