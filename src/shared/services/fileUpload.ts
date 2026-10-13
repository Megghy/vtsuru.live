import type { UploadFileResponse } from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import { FILE_API_URL } from '@/shared/config'

export const FileStore = {
  Library: 'library',
  Questions: 'questions',
  Configs: 'configs',
  Goods: 'goods',
  Tickets: 'tickets',
  Voices: 'voices',
  Assistant: 'assistant',
  Forum: 'forum',
  Pngtuber: 'pngtuber',
} as const

export type FileStoreName = (typeof FileStore)[keyof typeof FileStore]

export enum UploadStage {
  Preparing = '准备上传',
  Uploading = '上传中',
  Success = '上传成功',
  Failed = '上传失败',
}

export async function uploadFiles(
  files: File | File[],
  store: FileStoreName = FileStore.Library,
  onProgress?: (stage: string) => void,
): Promise<UploadFileResponse[]> {
  try {
    onProgress?.(UploadStage.Preparing)

    const formData = new FormData()
    for (const file of Array.isArray(files) ? files : [files]) formData.append('files', file)
    formData.append('store', store)

    onProgress?.(UploadStage.Uploading)

    const result = await QueryPostAPI<UploadFileResponse[]>(`${FILE_API_URL}upload`, formData)
    if (result.code === 200) {
      onProgress?.(UploadStage.Success)
      return result.data
    }
    onProgress?.(UploadStage.Failed)
    throw new Error(result.message || '上传失败')
  } catch (error) {
    onProgress?.(UploadStage.Failed)
    console.error('文件上传错误:', error)
    throw error
  }
}
