/** Getränke-Vorlagen für schnelles Erfassen. Werte sind typische Durchschnitte. */
export interface DrinkPreset {
  key: string;
  emoji: string;
  /** Anzeigename (bereits sprachneutral genug: Getränkenamen). */
  name: string;
  volumeMl: number;
  abvPercent: number;
}

export const DRINK_PRESETS: DrinkPreset[] = [
  { key: 'beer_05', emoji: '🍺', name: 'Bier 0,5 l', volumeMl: 500, abvPercent: 5 },
  { key: 'beer_03', emoji: '🍺', name: 'Bier 0,3 l', volumeMl: 300, abvPercent: 5 },
  { key: 'weizen', emoji: '🍺', name: 'Weizen 0,5 l', volumeMl: 500, abvPercent: 5.4 },
  { key: 'radler', emoji: '🍺', name: 'Radler 0,5 l', volumeMl: 500, abvPercent: 2.5 },
  { key: 'wine', emoji: '🍷', name: 'Wein 0,2 l', volumeMl: 200, abvPercent: 12 },
  { key: 'sekt', emoji: '🥂', name: 'Sekt 0,1 l', volumeMl: 100, abvPercent: 11 },
  { key: 'longdrink', emoji: '🥃', name: 'Longdrink', volumeMl: 300, abvPercent: 10 },
  { key: 'shot', emoji: '🥃', name: 'Shot 2 cl', volumeMl: 20, abvPercent: 40 },
];
