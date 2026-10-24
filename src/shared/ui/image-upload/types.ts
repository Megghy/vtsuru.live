export interface RemoteImageSource {
  id?: number | string | null
  name?: string | null
  path?: string | null
}

export type RemoteUploadImageItem = {
  kind: 'remote'
  id: string
  name: string
  url: string
}

export type LocalUploadImageItem = {
  kind: 'local'
  id: string
  name: string
  file: File
  url: string
}

export type UploadImageItem = RemoteUploadImageItem | LocalUploadImageItem
