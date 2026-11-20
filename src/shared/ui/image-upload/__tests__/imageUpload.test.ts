import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import {
  acquireFilePreviewUrl,
  createLocalImageItem,
  fromRemoteImage,
  fromRemoteImageList,
  getPendingUploadFiles,
  ImageUpload,
  releaseFilePreviewUrl,
  type UploadImageItem,
} from '../index'

describe('image-upload', () => {
  it('converts remote image models and distinguishes them from local pending files', () => {
    expect(fromRemoteImage(undefined)).toBeNull()
    expect(fromRemoteImage({ id: 1, path: '' })).toBeNull()

    const remote = fromRemoteImage(
      {
        id: 123,
        name: '封面',
        path: 'https://vtsuru.live/vtsuru/objects/abc?fid=123',
      },
      '封面',
    )
    expect(remote).toEqual({
      kind: 'remote',
      id: '123',
      name: '封面.png',
      url: 'https://vtsuru.live/vtsuru/objects/abc?fid=123',
    })

    const file = new File(['img'], 'new-cover.webp', { type: 'image/webp' })
    const local = createLocalImageItem(file)
    const list: UploadImageItem[] = [
      ...fromRemoteImageList([{ id: 456, name: 'avatar.webp', path: 'https://vtsuru.live/files/avatar.webp' }]),
      local,
    ]

    expect(list[0].name).toBe('avatar.webp')
    expect(getPendingUploadFiles(list)).toEqual([file])
    expect(getPendingUploadFiles([remote!])).toEqual([])
  })

  it('ref-counts blob preview URLs across mount, tab-switch unmount/remount, and item removal', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')

    const file = new File(['bytes'], 'gift.png', { type: 'image/png' })
    const items = ref<UploadImageItem[]>([createLocalImageItem(file)])

    const wrapper1 = mount(ImageUpload, {
      props: {
        modelValue: items.value,
        maxFiles: 1,
        'onUpdate:modelValue': (val: UploadImageItem[]) => {
          items.value = val
        },
      },
    })

    const firstUrl = items.value[0].url
    expect(firstUrl).toMatch(/^blob:/)
    expect(wrapper1.find('img').attributes('src')).toBe(firstUrl)

    // Unmount (e.g. switching TabsContent) releases the first blob URL without losing File
    wrapper1.unmount()
    expect(revokeSpy).toHaveBeenCalledWith(firstUrl)
    expect(getPendingUploadFiles(items.value)).toEqual([file])

    // Remounting acquires a fresh valid blob URL for the same File
    const wrapper2 = mount(ImageUpload, {
      props: {
        modelValue: items.value,
        maxFiles: 1,
        'onUpdate:modelValue': (val: UploadImageItem[]) => {
          items.value = val
        },
      },
    })
    const secondUrl = items.value[0].url
    expect(secondUrl).toMatch(/^blob:/)
    expect(wrapper2.find('img').attributes('src')).toBe(secondUrl)

    // Clicking remove button emits empty list and revokes secondUrl immediately
    await wrapper2.find('button[aria-label^="移除"]').trigger('click')
    expect(items.value).toEqual([])
    expect(revokeSpy).toHaveBeenCalledWith(secondUrl)

    wrapper2.unmount()
    createSpy.mockRestore()
    revokeSpy.mockRestore()
  })

  it('supports shared reference counting via acquireFilePreviewUrl / releaseFilePreviewUrl', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    const file = new File(['shared'], 'shared.png', { type: 'image/png' })

    const u1 = acquireFilePreviewUrl(file)
    const u2 = acquireFilePreviewUrl(file)
    expect(u1).toBe(u2)

    releaseFilePreviewUrl(file)
    expect(revokeSpy).not.toHaveBeenCalledWith(u1)

    releaseFilePreviewUrl(file)
    expect(revokeSpy).toHaveBeenCalledWith(u1)
    revokeSpy.mockRestore()
  })

  it('allows clicking thumbnail to replace in single-file mode without blocking remove button', async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    const items = ref<UploadImageItem[]>([
      ...fromRemoteImageList([{ id: 789, name: 'cover.png', path: 'https://vtsuru.live/files/cover.png' }]),
    ])

    const wrapper = mount(ImageUpload, {
      props: {
        modelValue: items.value,
        maxFiles: 1,
        placeholder: '点击更换封面',
        'onUpdate:modelValue': (val: UploadImageItem[]) => {
          items.value = val
        },
      },
    })

    const replaceTrigger = wrapper.find('[role="button"][aria-label="点击更换封面"]')
    expect(replaceTrigger.exists()).toBe(true)
    await replaceTrigger.trigger('click')
    expect(clickSpy).toHaveBeenCalledTimes(1)

    await wrapper.find('button[aria-label^="移除"]').trigger('click')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(items.value).toEqual([])

    wrapper.unmount()
    clickSpy.mockRestore()
  })

  it('opens lightbox preview when clicking thumbnail in multi-file mode without blocking remove button', async () => {
    const items = ref<UploadImageItem[]>([
      ...fromRemoteImageList([
        { id: 101, name: 'first.png', path: 'https://vtsuru.live/files/first.png' },
        { id: 102, name: 'second.png', path: 'https://vtsuru.live/files/second.png' },
      ]),
    ])

    const wrapper = mount(ImageUpload, {
      attachTo: document.body,
      props: {
        modelValue: items.value,
        maxFiles: 5,
        'onUpdate:modelValue': (val: UploadImageItem[]) => {
          items.value = val
        },
      },
    })

    const secondTrigger = wrapper.find('[role="button"][aria-label="放大查看 second.png"]')
    expect(secondTrigger.exists()).toBe(true)
    await secondTrigger.trigger('click')
    await nextTick()

    const lightbox = document.body.querySelector('[data-testid="image-lightbox"]')
    expect(lightbox).not.toBeNull()
    expect(lightbox!.querySelector('img')?.getAttribute('src')).toBe('https://vtsuru.live/files/second.png')
    expect(lightbox!.textContent).toContain('2 / 2')

    const closeBtn = lightbox!.querySelector('button[aria-label="关闭预览"]') as HTMLButtonElement
    closeBtn.click()
    await flushPromises()
    await vi.waitFor(() => expect(document.body.querySelector('[data-testid="image-lightbox"]')).toBeNull())

    await wrapper.find('button[aria-label="移除 first.png"]').trigger('click')
    expect(items.value).toHaveLength(1)
    expect(items.value[0].id).toBe('102')
    expect(document.body.querySelector('[data-testid="image-lightbox"]')).toBeNull()

    wrapper.unmount()
  })
})
