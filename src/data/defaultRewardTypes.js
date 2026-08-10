let counter = 0;
function rewardType(name, iconId, frequency) {
  counter += 1;
  return { id: 'rt' + counter, name, iconId, frequency, enabled: true };
}

export const DEFAULT_REWARD_TYPES = [
  rewardType('Fuel Cache', 'oil-drum', 4),
  rewardType('Refinery', 'oil-pump', 2),
  rewardType('Watchtower', 'watchtower', 3),
  rewardType('Barracks', 'barracks', 3),
  rewardType('Armour Depot', 'tank-tread', 2),
  rewardType('Warhead Cache', 'nuclear-bomb', 1),
  rewardType('Blast Site', 'mushroom-cloud', 1),
];
