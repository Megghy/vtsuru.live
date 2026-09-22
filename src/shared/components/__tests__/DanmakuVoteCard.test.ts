import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import { voteSnapshot } from '@/test/voteFixtures'

import DanmakuVoteCard from '../DanmakuVoteCard.vue'

const wrappers: VueWrapper[] = []
function render(counts: number[], props: Record<string, unknown> = {}) {
  const wrapper = mount(DanmakuVoteCard, {
    props: { data: voteSnapshot(counts), position: 'top-center', ...props },
  })
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('DanmakuVoteCard duel', () => {
  it.each(['top-center', 'center'])('shows a one-vote lead accurately at %s', (position) => {
    const wrapper = render([100, 101], { position })
    expect(wrapper.find('.duel-status').text()).toBe('领先 1 票')
    expect(wrapper.find('.duel-status').classes()).toContain('right')
    expect(wrapper.find('.side-left .duel-percent').text()).toBe('49.8%')
    expect(wrapper.find('.side-right .duel-percent').text()).toBe('50.2%')
    expect(wrapper.find('.duel-fill.side-left').attributes('style')).toContain(`scaleX(${100 / 201})`)
    expect(wrapper.findAll('.duel-side.is-leading')).toHaveLength(1)
    expect(wrapper.find('.duel-side.is-leading').attributes('data-option-index')).toBe('2')
    expect(wrapper.find('.duel-midline').exists()).toBe(true)
  })

  it('never remounts the card or swaps sides on overtake and settlement', async () => {
    const wrapper = render([101, 100])
    const element = wrapper.find('.danmaku-vote-card').element
    const updated = voteSnapshot([101, 102])
    updated.options.reverse() // The API returns leaders first.
    await wrapper.setProps({ data: updated })
    expect(wrapper.find('.danmaku-vote-card').element).toBe(element)
    expect(wrapper.find('.duel-side.side-left').attributes('data-option-index')).toBe('1')
    expect(wrapper.find('.duel-overtake').text()).toBe('反超')
    await wrapper.setProps({ data: { ...updated, isEnding: true, isActive: false } })
    expect(wrapper.find('.danmaku-vote-card').element).toBe(element)
    expect(wrapper.find('.duel-side.is-winner').attributes('data-option-index')).toBe('2')
    expect(wrapper.find('.duel-overtake').exists()).toBe(false)
    expect(wrapper.find('.duel-status').text()).toBe('胜出 1 票')
  })

  it.each([
    { counts: [0, 0], ending: false, label: '等待投票' },
    { counts: [0, 0], ending: true, label: '无人投票' },
    { counts: [100, 100], ending: false, label: '平票' },
    { counts: [100, 100], ending: true, label: '平票结束' },
  ])('handles $counts / ending=$ending', ({ counts, ending, label }) => {
    const wrapper = render(counts, { data: voteSnapshot(counts, { isEnding: ending, winnerOption: '选项 1' }) })
    expect(wrapper.find('.duel-status').text()).toBe(label)
    expect(wrapper.findAll('.duel-side.is-leading, .duel-side.is-winner')).toHaveLength(0)
    expect(wrapper.find('.reveal-layer').exists()).toBe(false)
  })

  it('keeps hidden results out of the numbers, bars and leader state', () => {
    const wrapper = render([100, 101], { data: voteSnapshot([100, 101], { showResults: false }) })
    expect(wrapper.find('.duel-status').text()).toBe('结果未公开')
    expect(wrapper.find('.duel-track').exists()).toBe(false)
    expect(wrapper.find('.duel-stats').exists()).toBe(false)
    expect(wrapper.find('.duel-leader-badge').exists()).toBe(false)
  })
})

describe('DanmakuVoteCard list', () => {
  it('ignores invalid URL theme overrides', () => {
    const wrapper = render([100, 101], { theme: 'unknown' })
    expect(wrapper.find('.theme-duel').exists()).toBe(true)
    expect(wrapper.find('.duel-status').text()).toBe('领先 1 票')
  })

  it('shows a precise lead above the list', () => {
    const wrapper = render([100, 101, 20], { theme: 'glass' })
    expect(wrapper.find('.vote-outcome').text()).toBe('领先第二名 1 票')
    expect(wrapper.findAll('.is-leading')).toHaveLength(1)
    expect(wrapper.find('.is-leading .option-count .vote-number').text()).toBe('101')
  })

  it('marks all tied leaders with the same label, without a winner', () => {
    const wrapper = render([100, 100, 20], { theme: 'minimal' })
    expect(wrapper.findAll('.is-leading')).toHaveLength(2)
    expect(wrapper.findAll('.leading-badge').map((badge) => badge.text())).toEqual(['并列第一', '并列第一'])
  })

  it('keeps zero-vote lists neutral and reports ended ties consistently', async () => {
    const wrapper = render([0, 0, 0], { theme: 'transparent' })
    expect(wrapper.find('.vote-outcome').text()).toBe('等待投票')
    expect(wrapper.find('.is-leading').exists()).toBe(false)
    await wrapper.setProps({ data: voteSnapshot([100, 100, 20], { isEnding: true }) })
    expect(wrapper.find('.vote-outcome').text()).toBe('并列第一')
    expect(wrapper.findAll('.is-winner, .is-dimmed')).toHaveLength(0)
  })

  it('does not disclose hidden votes through ordering, badges or folded counts', () => {
    const data = voteSnapshot([10, 100, 20], { showResults: false })
    data.options.reverse()
    const wrapper = render([], { data, theme: 'glass', maxDisplay: 2 })
    expect(wrapper.findAll('.option-row').map((row) => row.attributes('data-option-index'))).toEqual(['1', '2'])
    expect(wrapper.find('.option-right').exists()).toBe(false)
    expect(wrapper.find('.leading-badge').exists()).toBe(false)
    expect(wrapper.find('.remaining-hint').text()).toBe('另有 1 个候选项')
  })

  it('keeps folded counts and backend theme defaults', () => {
    const wrapper = render([100, 80, 40, 20], {
      data: voteSnapshot([100, 80, 40, 20], { theme: 'transparent' }),
      maxDisplay: 2,
    })
    expect(wrapper.find('.theme-transparent').exists()).toBe(true)
    expect(wrapper.find('.remaining-hint').text()).toBe('另有 2 个候选项（共 60 票）')
  })
})
