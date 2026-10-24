import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

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
})
