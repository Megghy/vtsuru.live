import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { VideoFrom, VideoStatus } from '@/api/api-models'
import VideoCollectResultCard from '@/apps/web/pages/video-collect/VideoCollectResultCard.vue'

describe('VideoCollectResultCard.vue', () => {
  const mockItem = {
    info: {
      bvid: 'BV1xx411c7mD',
      status: VideoStatus.Accepted,
      senders: [
        {
          sendAt: 1700000000000,
          sender: '热心粉丝小张',
          senderId: 123456,
          description: '主播这个视频真的太好笑了！强烈推荐！',
          from: VideoFrom.Collect,
        },
      ],
    },
    video: {
      id: 'BV1xx411c7mD',
      title: '【高能切片】超搞笑名场面集锦',
      description: '原视频简介内容',
      publistTime: 1700000000000,
      ownerName: '切片UP主',
      ownerUId: 654321,
      cover: 'https://i0.hdslb.com/bfs/archive/test.jpg',
      length: 185,
      partitionId: 1,
      partitionName: '游戏',
    },
  }

  it('正确渲染视频标题、UP 主、BV 号以及推荐人与推荐理由', () => {
    const wrapper = mount(VideoCollectResultCard, {
      props: {
        item: mockItem,
        index: 0,
        presentation: 'plain',
        revealed: true,
      },
    })

    expect(wrapper.text()).toContain('【高能切片】超搞笑名场面集锦')
    expect(wrapper.text()).toContain('切片UP主')
    expect(wrapper.text()).toContain('BV1xx411c7mD')
    expect(wrapper.text()).toContain('热心粉丝小张')
    expect(wrapper.text()).toContain('主播这个视频真的太好笑了！强烈推荐！')
    expect(wrapper.text()).toContain('03:05')
  })

  it('点击已看状态切换按钮触发 toggleWatched 事件', async () => {
    const wrapper = mount(VideoCollectResultCard, {
      props: {
        item: mockItem,
        index: 0,
        watched: false,
      },
    })

    const watchBtn = wrapper.find('.watch-toggle-btn')
    expect(watchBtn.exists()).toBe(true)
    await watchBtn.trigger('click')

    expect(wrapper.emitted('toggleWatched')).toBeTruthy()
    expect(wrapper.emitted('toggleWatched')!.length).toBe(1)
  })

  it('翻牌模式下：未揭晓时点击卡片触发 toggleReveal，揭晓后点击触发 select', async () => {
    const wrapper = mount(VideoCollectResultCard, {
      props: {
        item: mockItem,
        index: 0,
        presentation: 'flip',
        revealed: false,
      },
    })

    // 点击未翻开的卡片
    await wrapper.find('.mystery-face').trigger('click')
    expect(wrapper.emitted('toggleReveal')).toBeTruthy()

    // 更新为已翻开
    await wrapper.setProps({ revealed: true })
    await wrapper.find('.video-result-card__content').trigger('click')
    expect(wrapper.emitted('select')).toBeTruthy()

    // 点击盖上按钮
    const flipBackBtn = wrapper.find('.flip-back-btn')
    expect(flipBackBtn.exists()).toBe(true)
    await flipBackBtn.trigger('click')
    expect(wrapper.emitted('toggleReveal')!.length).toBe(2)
  })

  it('无推荐人时优雅降级展示原简介或占位，不产生异常', () => {
    const itemWithoutSender = {
      ...mockItem,
      info: {
        ...mockItem.info,
        senders: [],
      },
    }

    const wrapper = mount(VideoCollectResultCard, {
      props: {
        item: itemWithoutSender,
        index: 0,
        featured: true,
      },
    })

    expect(wrapper.text()).toContain('原视频简介内容')
    expect(wrapper.classes()).toContain('is-featured')
  })
})
