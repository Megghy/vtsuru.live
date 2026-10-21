export interface UploadFileInfo {
  id: string
  name: string
  status?: 'pending' | 'uploading' | 'finished' | 'removed' | 'error'
  percentage?: number
  file?: File | null
  url?: string | null
  batchId?: string
  thumbnailUrl?: string | null
  type?: string | null
  fullPath?: string | null
}
