export type GameType = 'balloon' | 'envelope' | 'heart' | 'chest';

export interface GameTypeConfig {
  id: GameType;
  label: string;
  labelPlural: string;
  emoji: string;
  actionVerb: string;
  itemName: string;
  itemNamePlural: string;
  colors: string[];
}

export const GAME_TYPES: Record<GameType, GameTypeConfig> = {
  balloon: {
    id: 'balloon',
    label: 'Balão',
    labelPlural: 'Balões',
    emoji: '🎈',
    actionVerb: 'Estourar',
    itemName: 'balão',
    itemNamePlural: 'balões',
    colors: [
      'bg-balloon-red',
      'bg-balloon-blue',
      'bg-balloon-green',
      'bg-balloon-yellow',
      'bg-balloon-purple',
      'bg-balloon-pink',
      'bg-balloon-orange',
      'bg-balloon-teal',
    ],
  },
  envelope: {
    id: 'envelope',
    label: 'Envelope',
    labelPlural: 'Envelopes',
    emoji: '✉️',
    actionVerb: 'Abrir',
    itemName: 'envelope',
    itemNamePlural: 'envelopes',
    colors: [
      'bg-envelope-gold',
      'bg-envelope-silver',
      'bg-envelope-red',
      'bg-envelope-blue',
      'bg-envelope-green',
      'bg-envelope-purple',
    ],
  },
  heart: {
    id: 'heart',
    label: 'Coração',
    labelPlural: 'Corações',
    emoji: '❤️',
    actionVerb: 'Revelar',
    itemName: 'coração',
    itemNamePlural: 'corações',
    colors: [
      'bg-heart-red',
      'bg-heart-pink',
      'bg-heart-purple',
      'bg-heart-rose',
      'bg-heart-fuchsia',
      'bg-heart-coral',
    ],
  },
  chest: {
    id: 'chest',
    label: 'Baú',
    labelPlural: 'Baús',
    emoji: '🪙',
    actionVerb: 'Abrir',
    itemName: 'baú',
    itemNamePlural: 'baús',
    colors: [
      'bg-chest-wood',
      'bg-chest-gold',
      'bg-chest-bronze',
      'bg-chest-emerald',
      'bg-chest-ruby',
      'bg-chest-sapphire',
    ],
  },
};

export const GAME_TYPE_LIST = Object.values(GAME_TYPES);

export function getGameTypeConfig(type?: string | null): GameTypeConfig {
  if (type && type in GAME_TYPES) {
    return GAME_TYPES[type as GameType];
  }
  return GAME_TYPES.balloon;
}
