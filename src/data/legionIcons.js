// Icons here are referenced by URL (external CDN), unlike the reward
// icons which are embedded inline — see data/rewardIcons.js for why.
// If you ever see these fail to load, that's the signal to switch this
// set to the inline-embed pattern too.
const BASE = 'https://certseeds.github.io/wh40k-icon/assets/';

function icon(id, label, file, group) {
  return { id, label, url: BASE + file, group };
}

export const UNIT_TYPE_ICONS = [
  icon('dedicated-transport', 'Dedicated Transport', 'dedicated-transport.GK1Tqsod.svg', 'Unit Type'),
  icon('elites', 'Elites', 'elites.EfVlWVQK.svg', 'Unit Type'),
  icon('fast-attack', 'Fast Attack', 'fast-attack.C0x8jKl_.svg', 'Unit Type'),
  icon('flyer', 'Flyer', 'flyer.D1WkXX5K.svg', 'Unit Type'),
  icon('fortification', 'Fortification', 'fortification.lLaL6z15.svg', 'Unit Type'),
  icon('heavy-support', 'Heavy Support', 'heavy-support.BBy1fpuj.svg', 'Unit Type'),
  icon('hq', 'HQ', 'hq.BWbt9m-q.svg', 'Unit Type'),
  icon('lord-of-war', 'Lord of War', 'lord-of-war.5tGB9rKh.svg', 'Unit Type'),
  icon('troops', 'Troops', 'troops._tbSIzGv.svg', 'Unit Type'),
];

export const LOYALIST_LEGION_ICONS = [
  icon('dark-angels', 'Dark Angels', 'dark-angels.aVk1no01.svg', 'Loyalist Legions'),
  icon('white-scars', 'White Scars', 'white-scars.0tOO-YLc.svg', 'Loyalist Legions'),
  icon('space-wolves', 'Space Wolves', 'space-wolves.0LwWQBox.svg', 'Loyalist Legions'),
  icon('imperial-fists', 'Imperial Fists', 'imperial-fists.Dz56noos.svg', 'Loyalist Legions'),
  icon('blood-angels', 'Blood Angels', 'blood-angels.DQ7Yb_2g.svg', 'Loyalist Legions'),
  icon('iron-hands', 'Iron Hands', 'iron-hands.CbPGUqsy.svg', 'Loyalist Legions'),
  icon('ultramarines', 'Ultramarines', 'ultramarines.DU3Oum-W.svg', 'Loyalist Legions'),
  icon('salamanders', 'Salamanders', 'salamanders.f3D4mseZ.svg', 'Loyalist Legions'),
  icon('raven-guard', 'Raven Guard', 'raven-guard.BsPkF1nT.svg', 'Loyalist Legions'),
];

export const TRAITOR_LEGION_ICONS = [
  icon('emperors-children', "Emperor's Children", 'emperors-children-1.C3dG4IHZ.svg', 'Traitor Legions'),
  icon('iron-warriors', 'Iron Warriors', 'iron-warriors.BYiTKU1q.svg', 'Traitor Legions'),
  icon('night-lords', 'Night Lords', 'night-lords.CsHpIVaO.svg', 'Traitor Legions'),
  icon('world-eaters', 'World Eaters', 'world-eaters-1.CCTtxlUp.svg', 'Traitor Legions'),
  icon('death-guard', 'Death Guard', 'death-guard.DcXjVyMJ.svg', 'Traitor Legions'),
  icon('thousand-sons', 'Thousand Sons', 'thousand-sons.4jpNzb4W.svg', 'Traitor Legions'),
  icon('sons-of-horus', 'Sons of Horus', 'son-of-horus.D6InCC47.svg', 'Traitor Legions'),
  icon('word-bearers', 'Word Bearers', 'word-bearers.CvzmNnnj.svg', 'Traitor Legions'),
  icon('alpha-legion', 'Alpha Legion', 'alpha-legion-1.CStcKRqG.svg', 'Traitor Legions'),
];

// Everything the icon panel needs, in one list. To add a new icon set
// (e.g. a third faction book), add another array above and spread it
// in here — no other file needs to change.
export const ALL_ICONS = [
  ...UNIT_TYPE_ICONS,
  ...LOYALIST_LEGION_ICONS,
  ...TRAITOR_LEGION_ICONS,
];

export function iconById(id) {
  return ALL_ICONS.find((ic) => ic.id === id);
}

// 'unit' icons stack (multiple per hex); 'faction' icons fill the hex
// and only one can occupy it at a time.
export function iconKind(def) {
  return def && def.group === 'Unit Type' ? 'unit' : 'faction';
}
