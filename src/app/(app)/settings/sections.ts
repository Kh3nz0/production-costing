export const SETTINGS_SECTIONS = [
  ['business', 'Business'],
  ['equipment', 'Equipment'],
  ['utilities', 'Utility rates'],
  ['labour', 'Labour'],
  ['overhead', 'Overhead'],
  ['channels', 'Sales channels'],
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number][0];
