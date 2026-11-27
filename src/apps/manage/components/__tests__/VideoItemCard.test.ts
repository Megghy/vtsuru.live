import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { VideoFrom, VideoStatus } from '@/api/generated/model'
import VideoItemCard from '@/apps/manage/components/VideoItemCard.vue'

describe('VideoItemCard.vue', () => {
  const mockVideoInfo = {
    bvid: 'BV1xx411c7mD',
    status: VideoStatus.Pending,
    senders: [
      {
        sendAt: 1700000000000,
        sender: '粉丝小明',
        senderId: 10001,
        description: '强烈安利这个切片！',
        from: VideoFrom.Collect,
      },
    ],
  }

  const mockVideoData = {
    id: 'BV1xx411c7mD',
    title: '名场面超长合集',
    description: 'B站视频原简介',
    publistTime: 1700000000000,
    ownerName: '优质UP主',
    ownerUId: 20002,
    cover: 'https://i0.hdslb.com/bfs/archive/test.jpg',
    length: 125,
    partitionId: 1,
    partitionName: '游戏',
    createTime: '',
    updateTime: '',
    isDeleted: false,
    sort: 0,
  }

  it('正确渲染标题、UP主、BV号、粉丝推荐人与推荐理由', () => {
    const wrapper = mount(VideoItemCard, {
      props: {
        videoInfo: mockVideoInfo,
        videoData: mockVideoData,
      },
    })

    expect(wrapper.text()).toContain('名场面超长合集')
    expect(wrapper.text()).toContain('优质UP主')
    expect(wrapper.text()).toContain('BV1xx411c7mD')
    expect(wrapper.text()).toContain('粉丝小明')
    expect(wrapper.text()).toContain('强烈安利这个切片！')
    expect(wrapper.text()).toContain('02:05')
  })

  it('待审核状态下显示「通过」「拒绝」与删除按钮，并触发对应事件', async () => {
    const wrapper = mount(VideoItemCard, {
      props: {
        videoInfo: mockVideoInfo,
        videoData: mockVideoData,
      },
    })

    const buttons = wrapper.findAll('.video-actions button')
    expect(buttons.length).toBe(3)
    expect(buttons[0].text()).toContain('通过')
    expect(buttons[1].text()).toContain('拒绝')
    expect(buttons[2].attributes('aria-label')).toBe('彻底删除此投稿')

    await buttons[0].trigger('click')
    expect(wrapper.emitted('updateStatus')).toBeTruthy()
    expect(wrapper.emitted('updateStatus')![0]).toEqual([VideoStatus.Accepted, mockVideoInfo])

    await buttons[1].trigger('click')
    expect(wrapper.emitted('reject')).toBeTruthy()
    expect(wrapper.emitted('reject')![0]).toEqual([mockVideoInfo, mockVideoData.title])
  })

  it('多推荐人时能触发展开折叠', async () => {
    const multiSenderInfo = {
      ...mockVideoInfo,
      senders: [
        ...mockVideoInfo.senders,
        {
          sendAt: 1700000010000,
          sender: '粉丝小红',
          senderId: 10002,
          description: '我也推荐这个！',
          from: VideoFrom.Collect,
        },
      ],
    }

    const wrapper = mount(VideoItemCard, {
      props: {
        videoInfo: multiSenderInfo,
        videoData: mockVideoData,
      },
    })

    const toggleButton = wrapper.findAll('button').find((btn) => btn.text().includes('共 2 人'))
    expect(toggleButton).toBeTruthy()

    await toggleButton!.trigger('click')
    expect(wrapper.text()).toContain('粉丝小红')
  })
})
