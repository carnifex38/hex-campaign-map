// Default legend entries. Each one is {id, name, color, owner, homeIconId}.
// `owner` is the player/participant this colour belongs to and
// `homeIconId` is the legion/faction emblem (see data/legionIcons.js)
// that marks their home base on the map — together they're what
// utils/connectivity.js uses to work out which of their tiles are
// still connected back to base. Left blank on the seed entries; the
// user assigns them per-campaign from the Legend Key.
// The palette is stored in app state (see state/mapReducer.js) so
// it's fully editable at runtime — this is just the seed data for a
// fresh map.
let counter = 0;
function entry(name, color, owner = '', homeIconId = null) {
  counter += 1;
  return { id: 'p' + counter, name, color, owner, homeIconId };
}

export const DEFAULT_PALETTE = [
  entry('Unclaimed', '#202325'),
  entry('Imperium (Blue)', '#1f3a5f'),
  entry('Imperium (Gold)', '#b8963e'),
  entry('Adeptus Mech.', '#8a1f1f'),
  entry('Chaos', '#5a1010'),
  entry('Orks', '#3a5a2a'),
  entry('Necrons', '#2a5a4a'),
  entry('Tyranids', '#4a2a5a'),
  entry('Aeldari', '#3a5a6a'),
  entry("T'au", '#3a6a6a'),
  entry('Objective', '#b8963e'),
  entry('Impassable', '#0c0c0c'),
];
