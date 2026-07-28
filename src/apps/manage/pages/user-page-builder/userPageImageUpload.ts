export const USER_PAGE_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const USER_PAGE_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'] as const

export function isUserPageImageFile(file: File) {
  if (file.type?.startsWith('image/')) return true
  const name = file.name.toLowerCase()
  return USER_PAGE_IMAGE_EXTENSIONS.some(extension => name.endsWith(extension))
}

export function validateUserPageImageFiles(files: File[], allowMultiple: boolean) {
  if (!files.length) return null
  if (!allowMultiple && files.length > 1) return '请选择单个图片文件'
  if (files.some(file => file.size > USER_PAGE_IMAGE_MAX_BYTES)) return '文件大小不能超过10MB'
  if (files.some(file => !isUserPageImageFile(file))) return '仅支持上传图片文件：png/jpg/jpeg/gif/webp'
  return null
}

export function isSupportedUserPageImagePath(path: string) {
  const normalized = path.toLowerCase().split(/[?#]/, 1)[0]
  return USER_PAGE_IMAGE_EXTENSIONS.some(extension => normalized.endsWith(extension))
}
