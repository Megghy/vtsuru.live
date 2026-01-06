import type { UploadFileResponse, UserFileTypes } from '@/api/api-models'
import { UserFileLocation } from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import { FILE_API_URL } from '@/shared/config'

/**
 * 文件上传阶段
 */
export enum UploadStage {
  Preparing = '准备上传',
  Uploading = '上传中',
  Success = '上传成功',
  Failed = '上传失败',
}

/**
 * 上传文件
 * @param files 要上传的文件列表
 * @param type 文件类型，可选，不指定时自动判断
 * @param location 存储位置，默认本地
 * @param onProgress 上传进度回调，返回上传阶段名称
 * @returns 上传结果列表
 */
export async function uploadFiles(
  files: File | File[],
  type?: UserFileTypes,
  location: UserFileLocation = UserFileLocation.Local,
  onProgress?: (stage: string) => void,
): Promise<UploadFileResponse[]> {
  try {
    onProgress?.(UploadStage.Preparing)

    const formData = new FormData()

    // 支持单个文件或文件数组
    if (Array.isArray(files)) {
      files.forEach((file) => {
        formData.append('files', file)
      })
    } else {
      formData.append('files', files)
    }

    if (type !== undefined) {
      formData.append('type', type.toString())
    }

    formData.append('location', location.toString())

    onProgress?.(UploadStage.Uploading)

    const result = await QueryPostAPI<UploadFileResponse[]>(`${FILE_API_URL}upload`, formData)

    if (result.code === 200) {
      onProgress?.(UploadStage.Success)
      return result.data
    } else {
      onProgress?.(UploadStage.Failed)
      throw new Error(result.message || '上传失败')
    }
  } catch (error) {
    onProgress?.(UploadStage.Failed)
    console.error('文件上传错误:', error)
    throw error
  }
}
