const THEMES = [
  {
    keywords: ['forest', 'woods', 'jungle', 'trees', 'woodland'],
    name: 'Forest',
    hint: 'Lush and green! Draw leafy ground tiles and tree/mushroom objects.',
    paletteHighlight: [1, 2, 3, 4, 5],
    groundLabel: 'land',
    objectLabel: 'land',
    densityHint: 0.65,
  },
  {
    keywords: ['ocean', 'sea', 'water', 'lake', 'river', 'pond', 'aquatic'],
    name: 'Ocean',
    hint: 'Watery world! Draw blue/teal ground tiles and label them "Water". Add shore tiles for coastlines.',
    paletteHighlight: [8, 9, 10, 11],
    groundLabel: 'water',
    objectLabel: 'land',
    densityHint: 0.80,
  },
  {
    keywords: ['desert', 'sand', 'dunes', 'arid', 'sahara', 'dry'],
    name: 'Desert',
    hint: 'Warm and sandy! Draw sandy/orange ground tiles and label them "Sand".',
    paletteHighlight: [6, 7, 16, 17],
    groundLabel: 'sand',
    objectLabel: 'land',
    densityHint: 0.85,
  },
  {
    keywords: ['meadow', 'field', 'plain', 'grass', 'prairie', 'flowers'],
    name: 'Meadow',
    hint: 'Open and breezy! Light greens for ground, flowers or butterflies for objects.',
    paletteHighlight: [2, 3, 4, 17],
    groundLabel: 'land',
    objectLabel: 'land',
    densityHint: 0.55,
  },
  {
    keywords: ['snow', 'winter', 'ice', 'arctic', 'tundra', 'frozen', 'blizzard'],
    name: 'Snowy',
    hint: 'Cold and crisp! Use whites and light blues for ground tiles.',
    paletteHighlight: [10, 11, 12, 18],
    groundLabel: 'land',
    objectLabel: 'land',
    densityHint: 0.75,
  },
  {
    keywords: ['swamp', 'marsh', 'bog', 'wetland', 'bayou', 'murky'],
    name: 'Swamp',
    hint: 'Dark and mossy! Mix water and shore tiles for a murky atmosphere.',
    paletteHighlight: [1, 8, 9, 4],
    groundLabel: 'shore',
    objectLabel: 'land',
    densityHint: 0.70,
  },
  {
    keywords: ['beach', 'coast', 'coastal', 'tropical', 'island', 'shore'],
    name: 'Beach',
    hint: 'Sun and surf! Sandy ground near water — use Shore and Sand labels for a coastline effect.',
    paletteHighlight: [6, 7, 9, 10],
    groundLabel: 'sand',
    objectLabel: 'land',
    densityHint: 0.80,
  },
];

/** Returns the first matching theme or null. */
export function matchTheme(text) {
  const lower = text.toLowerCase().trim();
  if (!lower) return null;
  for (const theme of THEMES) {
    if (theme.keywords.some(k => lower.includes(k))) return theme;
  }
  return null;
}
