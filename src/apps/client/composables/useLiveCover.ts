import { ref } from 'vue'
import type { UploadFileInfo } from 'naive-ui'
import { uploadCover, updateCover } from '@/apps/client/api/live-manage'

// 封面上传校验配置
const COVER_MAX_SIZE = 5 * 1024 * 1024 // 5MB
const COVER_ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * 直播封面上传 composable: 管理封面文件选择、格式/大小校验、预览与上传应用。
 */
export function useLiveCover() {
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

  const handleCoverFileChange = (file: UploadFileInfo) => {
    if (!file.file) {
      handleCoverRemove()
      return
    }

    // 格式校验
    if (!COVER_ACCEPT_TYPES.includes(file.file.type)) {
      window.$message.error('封面格式不支持，仅支持 JPG / PNG / WEBP')
      handleCoverRemove()
      return
    }

    // 大小校验
    if (file.file.size > COVER_MAX_SIZE) {
      window.$message.error('封面文件过大，请上传不超过 5MB 的图片')
      handleCoverRemove()
      return
    }

    coverFile.value = file.file
    if (coverPreviewUrl.value) {
      URL.revokeObjectURL(coverPreviewUrl.value)
    }
    coverPreviewUrl.value = URL.createObjectURL(file.file)
  }

  const handleUploadCover = async () => {
    if (!coverFile.value) {
      window.$message.error('请先选择要上传的封面图片')
      return
    }

    try {
      isUploadingCover.value = true
      window.$message.info('正在上传并应用封面...')
      const uploadResponse = await uploadCover(coverFile.value)
      if (uploadResponse.code === 0 && uploadResponse.data?.location) {
        uploadedCoverUrl.value = uploadResponse.data.location

        const updateResponse = await updateCover(uploadResponse.data.location)
        if (updateResponse.code === 0) {
          window.$message.success('封面上传并应用成功！')
        }
        else {
          window.$message.error(`封面上传成功但应用失败: ${updateResponse.message || '未知错误'}`)
        }
      }
      else {
        window.$message.error(`封面上传失败: ${uploadResponse.message || '未知错误'}`)
      }
    }
    catch (err: any) {
      console.error('封面上传或应用失败:', err)
      window.$message.error(`封面上传或应用失败: ${err.message || err}`)
    }
    finally {
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
