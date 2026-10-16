import type { UploadFileInfo } from 'naive-ui'

import { toImageUploadFileInfo, type UploadSourceFile } from '@/shared/utils/uploadFileHelper'

export function createCoverFileInfo(cover?: UploadSourceFile | null): UploadFileInfo[] {
  const info = toImageUploadFileInfo(cover, '封面')
  return info ? [info] : []
}
