import { ref } from 'vue'

import { uploadCover, updateCover } from '@/apps/client/api/live-manage'

// 封面上传校验配置
const COVER_MAX_SIZE = 5 * 1024 * 1024 // 5MB
const COVER_ACCEPT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * 直播封面上传 composable: 管理封面文件选择、格式/大小校验、预览与上传应用。
 */
export function useLiveCover() {
  const toast = useToast()
  const coverFile = ref<File | null>(null)
  const coverPreviewUrl = ref('')
  const uploadedCoverUrl = ref('')
  const isUploadingCover = ref(false)

  const handleCoverRemove = () => {
    if (coverPreviewUrl.value) {
      URL.revokeObjectURL(coverPreviewUrl.value)
    }
    coverFile.value = null
    coverPreviewUrl.value = ''
  }

  const handleCoverFileChange = (file: File | undefined) => {
    if (!file) {
      handleCoverRemove()
      return
    }

    // 格式校验
    if (!COVER_ACCEPT_TYPES.has(file.type)) {
      toast.add({ title: '封面格式不支持，仅支持 JPG / PNG / WEBP', color: 'error' })
      handleCoverRemove()
      return
    }

    // 大小校验
    if (file.size > COVER_MAX_SIZE) {
      toast.add({ title: '封面文件过大，请上传不超过 5MB 的图片', color: 'error' })
      handleCoverRemove()
      return
    }

    coverFile.value = file
    if (coverPreviewUrl.value) {
      URL.revokeObjectURL(coverPreviewUrl.value)
    }
    coverPreviewUrl.value = URL.createObjectURL(file)
  }

  const handleUploadCover = async () => {
    if (!coverFile.value) {
      toast.add({ title: '请先选择要上传的封面图片', color: 'error' })
      return
    }

    try {
      isUploadingCover.value = true
      toast.add({ title: '正在上传并应用封面...', color: 'info' })
      const uploadResponse = await uploadCover(coverFile.value)
      if (uploadResponse.code === 0 && uploadResponse.data?.location) {
        uploadedCoverUrl.value = uploadResponse.data.location

        const updateResponse = await updateCover(uploadResponse.data.location)
        if (updateResponse.code === 0) {
          toast.add({ title: '封面上传并应用成功！', color: 'success' })
        } else {
          toast.add({ title: `封面上传成功但应用失败: ${updateResponse.message || '未知错误'}`, color: 'error' })
        }
      } else {
        toast.add({ title: `封面上传失败: ${uploadResponse.message || '未知错误'}`, color: 'error' })
      }
    } catch (err: any) {
      console.error('封面上传或应用失败:', err)
      toast.add({ title: `封面上传或应用失败: ${err.message || err}`, color: 'error' })
    } finally {
      isUploadingCover.value = false
    }
  }

  return {
    coverFile,
    coverPreviewUrl,
    isUploadingCover,
    handleCoverFileChange,
    handleCoverRemove,
    handleUploadCover,
  }
}
