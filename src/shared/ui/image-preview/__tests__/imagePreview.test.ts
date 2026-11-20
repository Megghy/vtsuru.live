import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'
import { SmartImage } from '@/shared/ui/image'

import { ImageLightbox, ImagePreview, useHtmlImagePreview } from '../index'

describe('ImagePreview & ImageLightbox', () => {
  it('正常渲染默认缩略图且附带 no-referrer', () => {
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
    expect(img.attributes('referrerpolicy')).toBe('no-referrer')
  })

  it('点击缩略图打开原生灯箱并支持切换、缩放与旋转', async () => {
    const wrapper = mount(ImagePreview, {
      attachTo: document.body,
      props: {
        src: 'https://example.com/img1.jpg',
        gallery: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
        index: 1,
      },
    })

    await wrapper.find('button').trigger('click')
    await nextTick()

    const lightbox = document.body.querySelector('[data-testid="image-lightbox"]')
    expect(lightbox).not.toBeNull()
    const previewImg = lightbox!.querySelector('img')
    expect(previewImg?.getAttribute('src')).toBe('https://example.com/img2.jpg')
    expect(previewImg?.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(lightbox!.textContent).toContain('2 / 2')

    const prevBtn = lightbox!.querySelector('button[aria-label="上一张"]') as HTMLButtonElement
    prevBtn.click()
    await nextTick()
    expect(lightbox!.querySelector('img')?.getAttribute('src')).toBe('https://example.com/img1.jpg')

    const zoomInBtn = lightbox!.querySelector('button[aria-label="放大"]') as HTMLButtonElement
    const rotateBtn = lightbox!.querySelector('button[aria-label="向右旋转"]') as HTMLButtonElement
    zoomInBtn.click()
    rotateBtn.click()
    await nextTick()

    const canvas = lightbox!.querySelector('img')?.parentElement as HTMLElement
    expect(canvas.style.transform).toContain('scale(1.25)')
    expect(canvas.style.transform).toContain('rotate(90deg)')

    const closeBtn = lightbox!.querySelector('button[aria-label="关闭预览"]') as HTMLButtonElement
    closeBtn.click()
    await flushPromises()
    await vi.waitFor(() => expect(document.body.querySelector('[data-testid="image-lightbox"]')).toBeNull())

    wrapper.unmount()
  })

  it('提取对象数组格式的 gallery', async () => {
    const wrapper = mount(ImagePreview, {
      attachTo: document.body,
      props: {
        src: 'https://example.com/thumb.jpg',
        gallery: [{ path: 'https://example.com/original-1.jpg' }, { url: 'https://example.com/original-2.jpg' }],
        index: 0,
      },
    })

    await wrapper.find('button').trigger('click')
    await nextTick()

    const lightbox = document.body.querySelector('[data-testid="image-lightbox"]')
    expect(lightbox).not.toBeNull()
    expect(lightbox!.querySelector('img')?.getAttribute('src')).toBe('https://example.com/original-1.jpg')
    expect(lightbox!.textContent).toContain('1 / 2')

    wrapper.unmount()
  })

  it('disabled 为 true 时点击不打开 Lightbox', async () => {
    const wrapper = mount(ImagePreview, {
      attachTo: document.body,
      props: {
        src: 'https://example.com/test.jpg',
        disabled: true,
      },
    })

    await wrapper.find('button').trigger('click')
    await nextTick()
    expect(document.body.querySelector('[data-testid="image-lightbox"]')).toBeNull()
    wrapper.unmount()
  })

  it('在 Dialog 内打开和关闭 Lightbox 不关闭外层 Dialog', async () => {
    const outerOpen = ref(true)
    const Host = defineComponent({
      components: { Dialog, DialogContent, DialogTitle, ImagePreview },
      setup() {
        return { outerOpen }
      },
      template: `
        <Dialog v-model:open="outerOpen">
          <DialogContent :aria-describedby="undefined">
            <DialogTitle>外层弹窗</DialogTitle>
            <ImagePreview src="https://example.com/inside.jpg" alt="弹窗内图片" />
          </DialogContent>
        </Dialog>
      `,
    })

    const wrapper = mount(Host, { attachTo: document.body })
    await nextTick()

    const previewBtn = document.body.querySelector('button[aria-label="弹窗内图片"]') as HTMLButtonElement | null
    expect(previewBtn).not.toBeNull()
    previewBtn!.click()
    await nextTick()

    const lightbox = document.body.querySelector('[data-testid="image-lightbox"]')
    expect(lightbox).not.toBeNull()

    const closeBtn = lightbox!.querySelector('button[aria-label="关闭预览"]') as HTMLButtonElement
    closeBtn.click()
    await flushPromises()
    await vi.waitFor(() => expect(document.body.querySelector('[data-testid="image-lightbox"]')).toBeNull())
    expect(outerOpen.value).toBe(true)

    wrapper.unmount()
  })

  it('useHtmlImagePreview 点击普通图片打开灯箱并跳过链接内图片', async () => {
    const Host = defineComponent({
      components: { ImageLightbox },
      setup() {
        const preview = useHtmlImagePreview()
        return { preview }
      },
      template: `
        <div>
          <div class="html-wrap" @click="preview.handleHtmlClick">
            <a href="https://example.com" @click.prevent><img id="linked-img" src="https://example.com/linked.jpg" alt="链接图" /></a>
            <img id="plain-img-1" src="https://example.com/plain1.jpg" alt="正文图1" />
            <img id="plain-img-2" src="https://example.com/plain2.jpg" alt="正文图2" />
          </div>
          <ImageLightbox
            v-model:open="preview.open.value"
            :imgs="preview.imgs.value"
            :index="preview.index.value"
          />
        </div>
      `,
    })

    const wrapper = mount(Host, { attachTo: document.body })

    await wrapper.find('#linked-img').trigger('click')
    await nextTick()
    expect(document.body.querySelector('[data-testid="image-lightbox"]')).toBeNull()

    await wrapper.find('#plain-img-2').trigger('click')
    await nextTick()
    const lightbox = document.body.querySelector('[data-testid="image-lightbox"]')
    expect(lightbox).not.toBeNull()
    expect(lightbox!.textContent).toContain('2 / 2')
    expect(lightbox!.querySelector('img')?.getAttribute('src')).toBe('https://example.com/plain2.jpg')

    wrapper.unmount()
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

  it('站内图片按容器尺寸自动拉取小图、失败时回退原图，点开灯箱仍看原图', async () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 96,
      height: 96,
      top: 0,
      left: 0,
      bottom: 96,
      right: 96,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

    try {
      const wrapper = mount(ImagePreview, {
        attachTo: document.body,
        props: {
          src: 'https://files.vtsuru.suki.club/vtsuru/objects/019abc?fid=12&sig=xyz',
          alt: '站内缩略图',
        },
      })

      // 挂载前未发射处理 URL，避免双发请求；挂载后按 96x96 * dpr=1 对齐到 100w_100h_1c
      expect(wrapper.find('img').attributes('src')).toBeUndefined()
      await nextTick()
      expect(wrapper.find('img').attributes('src')).toBe(
        'https://files.vtsuru.suki.club/vtsuru/objects/019abc?fid=12&sig=xyz&100w_100h_1c',
      )

      // 点开灯箱应还原原图链接
      await wrapper.find('button').trigger('click')
      await nextTick()
      const lightbox = document.body.querySelector('[data-testid="image-lightbox"]')
      expect(lightbox?.querySelector('img')?.getAttribute('src')).toBe(
        'https://files.vtsuru.suki.club/vtsuru/objects/019abc?fid=12&sig=xyz',
      )

      // 第一次 error 回退原图，第二次 error 显示无法加载
      await wrapper.find('img').trigger('error')
      await nextTick()
      expect(wrapper.find('img').attributes('src')).toBe(
        'https://files.vtsuru.suki.club/vtsuru/objects/019abc?fid=12&sig=xyz',
      )
      await wrapper.find('img').trigger('error')
      await nextTick()
      expect(wrapper.find('img').exists()).toBe(false)
      expect(wrapper.text()).toContain('无法加载')

      wrapper.unmount()
    } finally {
      spy.mockRestore()
    }
  })

  it('SmartImage 按容器缩放并在开启 preview 时点击打开原图灯箱', async () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 48,
      height: 48,
      top: 0,
      left: 0,
      bottom: 48,
      right: 48,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

    try {
      const wrapper = mount(SmartImage, {
        attachTo: document.body,
        props: {
          src: 'https://files.vtsuru.suki.club/imgur/demo.png',
          alt: '表格封面',
          preview: true,
          class: 'size-12 rounded object-cover',
        },
      })

      await nextTick()
      expect(wrapper.find('img').attributes('src')).toBe('https://files.vtsuru.suki.club/imgur/demo.png?64w_64h_1c')

      await wrapper.find('img').trigger('click')
      await nextTick()
      const lightbox = document.body.querySelector('[data-testid="image-lightbox"]')
      expect(lightbox?.querySelector('img')?.getAttribute('src')).toBe('https://files.vtsuru.suki.club/imgur/demo.png')

      wrapper.unmount()
    } finally {
      spy.mockRestore()
    }
  })
})
