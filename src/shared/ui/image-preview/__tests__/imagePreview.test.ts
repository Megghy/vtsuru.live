import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ImagePreview from '../ImagePreview.vue'

describe('ImagePreview', () => {
  it('正常渲染默认缩略图', () => {
    const wrapper = mount(ImagePreview, {
      props: {
        src: 'https://example.com/test.jpg',
        alt: '测试图片',
      },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/test.jpg')
    expect(img.attributes('alt')).toBe('测试图片')
  })

  it('点击缩略图打开 Lightbox 状态', async () => {
    const wrapper = mount(ImagePreview, {
      props: {
        src: 'https://example.com/img1.jpg',
        gallery: [
          'https://example.com/img1.jpg',
          'https://example.com/img2.jpg',
        ],
        index: 1,
      },
    })

    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    await button.trigger('click')

    // 检查 VueEasyLightbox 是否接收到正确的 props
    const lightbox = wrapper.findComponent({ name: 'VueEasyLightbox' })
    expect(lightbox.exists()).toBe(true)
    expect(lightbox.props('visible')).toBe(true)
    expect(lightbox.props('imgs')).toEqual([
      'https://example.com/img1.jpg',
      'https://example.com/img2.jpg',
    ])
    expect(lightbox.props('index')).toBe(1)
  })

  it('提取对象数组格式的 gallery', async () => {
    const wrapper = mount(ImagePreview, {
      props: {
        src: 'https://example.com/thumb.jpg',
        gallery: [
          { path: 'https://example.com/original-1.jpg' },
          { url: 'https://example.com/original-2.jpg' },
        ],
        index: 0,
      },
    })

    await wrapper.find('button').trigger('click')
    const lightbox = wrapper.findComponent({ name: 'VueEasyLightbox' })
    expect(lightbox.props('imgs')).toEqual([
      'https://example.com/original-1.jpg',
      'https://example.com/original-2.jpg',
    ])
  })

  it('图片加载失败时显示占位', async () => {
    const wrapper = mount(ImagePreview, {
      props: {
        src: 'https://example.com/broken.jpg',
      },
    })

    const img = wrapper.find('img')
    await img.trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('无法加载')
  })
})
