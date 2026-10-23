import type { TitleDef } from './types/economy'

// The titles players bought while coins and the shop existed. Nothing can be
// bought or equipped now; the boards still show the ones players own.
export const TITLES: readonly TitleDef[] = [
  { id: 'puzzler', emoji: '🧩', label: 'Puzzler', cost: 0 },
  {
    id: 'streak_lord',
    emoji: '🔥',
    label: 'Streak Lord',
    cost: 100,
    condition: { type: 'minLongestStreak', value: 7 },
  },
  {
    id: 'speed_demon',
    emoji: '⚡',
    label: 'Speed Demon',
    cost: 150,
    condition: { type: 'minSpeedSolves', value: 10 },
  },
  {
    id: 'grid_master',
    emoji: '🏆',
    label: 'Grid Master',
    cost: 300,
    condition: { type: 'minSolves', value: 50 },
  },
  {
    id: 'binary_king',
    emoji: '👑',
    label: 'Binary King',
    cost: 500,
    condition: { type: 'minSolves', value: 100 },
  },
  {
    id: 'diamond_mind',
    emoji: '💎',
    label: 'Diamond Mind',
    cost: 1000,
    condition: { type: 'minLongestStreak', value: 30 },
  },
]

export const getTitleById = (id: string): TitleDef | undefined =>
  TITLES.find((t) => t.id === id)

// Every player starts with the free Puzzler title equipped, so only titles
// bought with coins say anything beside a name.
const isBoughtTitle = (title: TitleDef | undefined): title is TitleDef =>
  title !== undefined && title.cost > 0

/**
 * The title shown beside a player's name: the bought title they equipped,
 * else the highest-priced title they bought. Players with only the free
 * starting title show none.
 */
export const pickShownTitle = (
  equippedTitle: string,
  ownedTitles: readonly string[]
): TitleDef | undefined => {
  const equipped = getTitleById(equippedTitle)
  if (isBoughtTitle(equipped)) return equipped
  return ownedTitles
    .map((id) => getTitleById(id))
    .filter(isBoughtTitle)
    .reduce<TitleDef | undefined>(
      (highest, title) => (highest && highest.cost >= title.cost ? highest : title),
      undefined
    )
}
