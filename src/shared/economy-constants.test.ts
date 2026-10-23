import { describe, expect, it } from 'vitest'
import { pickShownTitle } from './economy-constants'

describe('pickShownTitle', () => {
  it('shows the equipped title even when the player owns a pricier one', () => {
    expect(pickShownTitle('speed_demon', ['puzzler', 'speed_demon', 'binary_king'])?.id).toBe(
      'speed_demon'
    )
  })

  it('shows the highest-priced owned title while the free starting title is equipped', () => {
    expect(pickShownTitle('puzzler', ['puzzler', 'grid_master', 'streak_lord'])?.id).toBe(
      'grid_master'
    )
  })

  it('shows the highest-priced owned title when the equipped one is unknown', () => {
    expect(pickShownTitle('retired_title', ['diamond_mind', 'streak_lord'])?.id).toBe(
      'diamond_mind'
    )
  })

  it('skips owned titles it does not know', () => {
    expect(pickShownTitle('puzzler', ['gold_crown', 'streak_lord'])?.id).toBe('streak_lord')
  })

  it('shows nothing for a player with only the free starting title', () => {
    expect(pickShownTitle('puzzler', ['puzzler'])).toBeUndefined()
  })

  it('shows nothing for a player who owns no titles', () => {
    expect(pickShownTitle('puzzler', [])).toBeUndefined()
  })
})
