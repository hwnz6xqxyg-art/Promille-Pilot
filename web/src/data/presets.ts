/** The 8 drink presets — copy exactly as in the design handoff. */
export interface DrinkPreset {
  e: string;
  name: string;
  detail: string;
  vol: number;
  abv: number;
}

/** A user-created preset — a DrinkPreset with a stable id for edit/delete. */
export interface CustomDrink extends DrinkPreset {
  id: string;
}

export const PRESETS: DrinkPreset[] = [
  { e: '🍺', name: 'Bier', detail: '0,5 l · 5 %', vol: 500, abv: 5 },
  { e: '🍺', name: 'Bier', detail: '0,3 l · 5 %', vol: 300, abv: 5 },
  { e: '🌾', name: 'Weizen', detail: '0,5 l · 5,4 %', vol: 500, abv: 5.4 },
  { e: '🍋', name: 'Radler', detail: '0,5 l · 2,5 %', vol: 500, abv: 2.5 },
  { e: '🍷', name: 'Wein', detail: '0,2 l · 12 %', vol: 200, abv: 12 },
  { e: '🥂', name: 'Sekt', detail: '0,1 l · 11 %', vol: 100, abv: 11 },
  { e: '🍹', name: 'Longdrink', detail: '0,3 l · 10 %', vol: 300, abv: 10 },
  { e: '🥃', name: 'Shot', detail: '2 cl · 40 %', vol: 20, abv: 40 },
];
