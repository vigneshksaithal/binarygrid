import { writable } from 'svelte/store'
import type { CoinReward } from '../../shared/types/economy'

export const coinRewardStore = writable<CoinReward | null>(null)

export const setCoinReward = (reward: CoinReward) => {
  coinRewardStore.set(reward)
}

export const resetCoinReward = () => {
  coinRewardStore.set(null)
}
