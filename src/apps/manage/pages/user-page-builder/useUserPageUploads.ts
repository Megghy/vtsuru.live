import { UserFileLocation, UserFileTypes } from '@/api/api-models'
import type { BlockNode, BlockPageProject } from '@/features/user-page/block/schema'
import { countImagesInBlocks, MAX_PAGE_IMAGES } from '@/features/user-page/block/schema'
import { uploadFiles } from '@/shared/services/fileUpload'
import type { ComputedRef } from 'vue'
import { ref } from 'vue'

type UploadKey = 'imageFile' | 'avatarFile'

type PendingUploadContext =
  | { kind: 'block', blockId: string, key: UploadKey }
  | { kind: 'galleryItem', blockId: string, itemIndex: number }
  | { kind: 'galleryBulk', blockId: string }
  | { kind: 'pageBackground' }

export interface UseUserPageUploadsOptions {
  currentProject: ComputedRef<BlockPageProject | null>
  ensurePropsObject: (block: BlockNode) => Record<string, any>
  notify: {
    success: (content: string) => void
    error: (content: string) => void
  }
}

export function useUserPageUploads(opts: UseUserPageUploadsOptions) {
  const isUploading = ref(false)
  const uploadInput = ref<HTMLInputElement | null>(null)
  const pendingUpload = ref<PendingUploadContext | null>(null)

  function asObject(v: unknown): Record<string, any> | null {
    if (!v || typeof v !== 'object') return null
    if (Array.isArray(v)) return null
    return v as any
  }

  function findBlockById(blocks: BlockNode[], id: string): BlockNode | null {
    for (const b of blocks) {
      if (b.id === id) return b
      if (b.type !== 'layout') continue
      const propsObj = asObject(b.props)
      const children = Array.isArray(propsObj?.children) ? (propsObj!.children as BlockNode[]) : null
      if (!children?.length) continue
      const found = findBlockById(children, id)
      if (found) return found
    }
    return null
  }

  function isImageFile(file: File) {
    if (file.type && file.type.startsWith('image/')) return true
    const name = file.name.toLowerCase()
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some(ext => name.endsWith(ext))
  }

  function triggerUpload(block: BlockNode, key: UploadKey) {
    if (!opts.currentProject.value) {
      opts.notify.error('当前页不是区块模式，无法上传')
      return
    }
    if (!uploadInput.value) {
      opts.notify.error('上传控件未就绪，请稍后重试')
      return
    }
    pendingUpload.value = { kind: 'block', blockId: block.id, key }
    uploadInput.value?.click()
  }

  function triggerUploadGalleryItem(block: BlockNode, itemIndex: number) {
    if (!opts.currentProject.value) {
      opts.notify.error('当前页不是区块模式，无法上传')
      return
    }
    if (!uploadInput.value) {
      opts.notify.error('上传控件未就绪，请稍后重试')
      return
    }
    if (!Number.isInteger(itemIndex) || itemIndex < 0) {
      opts.notify.error('无效的图片索引')
      return
    }
    pendingUpload.value = { kind: 'galleryItem', blockId: block.id, itemIndex }
    uploadInput.value?.click()
  }

  function triggerUploadGalleryBulk(block: BlockNode) {
    if (!opts.currentProject.value) {
      opts.notify.error('当前页不是区块模式，无法上传')
      return
    }
    if (!uploadInput.value) {
      opts.notify.error('上传控件未就绪，请稍后重试')
      return
    }
    pendingUpload.value = { kind: 'galleryBulk', blockId: block.id }
    uploadInput.value?.click()
  }

  function triggerUploadPageBackground() {
    if (!opts.currentProject.value) {
      opts.notify.error('当前页不是区块模式，无法上传')
      return
    }
    if (!uploadInput.value) {
      opts.notify.error('上传控件未就绪，请稍后重试')
      return
    }
    pendingUpload.value = { kind: 'pageBackground' }
    uploadInput.value?.click()
  }

  async function onUploadChange(ev: Event) {
    const input = ev.target as HTMLInputElement
    const files = input.files ? Array.from(input.files) : []
    input.value = ''
    if (!files.length) return
    if (!pendingUpload.value) {
      opts.notify.error('未找到上传上下文，请重新点击上传按钮')
      return
    }
    const project = opts.currentProject.value
    if (!project) {
      opts.notify.error('当前页不是区块模式，无法上传')
      return
    }

    const ctx = pendingUpload.value
    pendingUpload.value = null
    const isBulk = ctx.kind === 'galleryBulk'
    if (!isBulk && files.length > 1) {
      opts.notify.error('请选择单个图片文件')
      return
    }
    if (files.some(f => f.size > 10 * 1024 * 1024)) {
      opts.notify.error('文件大小不能超过10MB')
      return
    }
    if (files.some(f => !isImageFile(f))) {
      opts.notify.error('仅支持上传图片文件（png/jpg/jpeg/gif/webp）')
      return
    }

    if (ctx.kind !== 'pageBackground') {
      const block = findBlockById(project.blocks, ctx.blockId)
      if (!block) {
        opts.notify.error('找不到要上传到的区块（可能已被删除）')
        return
      }

      const currentImages = countImagesInBlocks(project.blocks, false)
      const willAddNewImage = (() => {
        const propsObj = opts.ensurePropsObject(block)
        if (ctx.kind === 'block') {
          const hasFile = !!propsObj[ctx.key]
          const hasUrl = typeof propsObj.url === 'string' && propsObj.url.trim().length > 0
          return !hasFile && !hasUrl
        }
        if (ctx.kind === 'galleryItem') {
          if (block.type !== 'imageGallery') return false
          if (!Array.isArray(propsObj.items)) return true
          const it = propsObj.items[ctx.itemIndex]
          if (!it || typeof it !== 'object' || Array.isArray(it)) return true
          const hasFile = !!it.imageFile
          const hasUrl = typeof it.url === 'string' && it.url.trim().length > 0
          return !hasFile && !hasUrl
        }
        if (ctx.kind === 'galleryBulk') {
          if (block.type !== 'imageGallery') return false
          return true
        }
        return false
      })()
      if (ctx.kind === 'galleryBulk') {
        if (currentImages + files.length > MAX_PAGE_IMAGES) {
          opts.notify.error(`图片数量将超出上限（${currentImages + files.length}/${MAX_PAGE_IMAGES}），请减少选择数量或先删除一些图片`)
          return
        }
      } else if (willAddNewImage && currentImages >= MAX_PAGE_IMAGES) {
        opts.notify.error(`图片数量已达上限（${currentImages}/${MAX_PAGE_IMAGES}），请先删除一些图片`)
        return
      }
    }

    isUploading.value = true
    try {
      const uploadedList = await uploadFiles(isBulk ? files : files[0], UserFileTypes.Image, UserFileLocation.Local)
      if (!uploadedList?.length) throw new Error('上传失败：无返回结果')
      if (ctx.kind === 'pageBackground') {
        project.theme ??= {}
        ;(project.theme as any).pageBackgroundImageFile = uploadedList[0]
        if ((project.theme as any).pageBackgroundType !== 'image') (project.theme as any).pageBackgroundType = 'image'
      } else {
        const block = findBlockById(project.blocks, ctx.blockId)
        if (!block) throw new Error('找不到要上传到的区块（可能已被删除）')

        if (ctx.kind === 'block') {
          const propsObj = opts.ensurePropsObject(block)
          propsObj[ctx.key] = uploadedList[0]
        } else if (ctx.kind === 'galleryItem') {
          const propsObj = opts.ensurePropsObject(block)
          if (block.type !== 'imageGallery') throw new Error('当前区块不是图片组，无法写入上传结果')
          if (!Array.isArray(propsObj.items)) propsObj.items = []
          if (ctx.itemIndex >= propsObj.items.length) throw new Error('找不到要上传到的图片项（可能已被删除）')
          const it = propsObj.items[ctx.itemIndex]
          if (!it || typeof it !== 'object' || Array.isArray(it)) throw new Error('图片项数据异常，无法写入上传结果')
          it.imageFile = uploadedList[0]
        } else if (ctx.kind === 'galleryBulk') {
          const propsObj = opts.ensurePropsObject(block)
          if (block.type !== 'imageGallery') throw new Error('当前区块不是图片组，无法写入上传结果')
          if (!Array.isArray(propsObj.items)) propsObj.items = []
          uploadedList.forEach((f) => {
            propsObj.items.push({ imageFile: f, desc: '' })
          })
        } else {
          throw new Error('未知的上传上下文')
        }
      }
      opts.notify.success('已上传')
    } catch (e) {
      opts.notify.error((e as Error).message || String(e))
    } finally {
      isUploading.value = false
    }
  }

  function clearUploadedFile(block: BlockNode, key: UploadKey) {
    const propsObj = opts.ensurePropsObject(block)
    delete propsObj[key]
  }

  function clearUploadedGalleryItemFile(block: BlockNode, itemIndex: number) {
    const propsObj = opts.ensurePropsObject(block)
    if (block.type !== 'imageGallery') throw new Error('当前区块不是图片组，无法清除')
    if (!Array.isArray(propsObj.items)) return
    const it = propsObj.items[itemIndex]
    if (!it || typeof it !== 'object' || Array.isArray(it)) return
    delete it.imageFile
  }

  function clearPageBackgroundImageFile() {
    const project = opts.currentProject.value
    if (!project) throw new Error('当前页不是区块模式，无法清除')
    if (!project.theme) return
    delete (project.theme as any).pageBackgroundImageFile
  }

  return {
    isUploading,
    uploadInput,
    pendingUpload,
    triggerUpload,
    triggerUploadGalleryItem,
    triggerUploadGalleryBulk,
    triggerUploadPageBackground,
    onUploadChange,
    clearUploadedFile,
    clearUploadedGalleryItemFile,
    clearPageBackgroundImageFile,
  }
}
