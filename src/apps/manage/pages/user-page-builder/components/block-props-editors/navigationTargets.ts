export type NavigationTarget = {
  back?: boolean
  page?: string
  url?: string
  copyText?: string
  copiedMessage?: string
}

export type NavigationTargetType = 'page' | 'external' | 'back' | 'copy'

export function getNavigationTargetType(target: NavigationTarget): NavigationTargetType {
  if (typeof target.copyText === 'string') return 'copy'
  if (target.back === true) return 'back'
  return target.page ? 'page' : 'external'
}

export function setNavigationTargetType(target: NavigationTarget, type: NavigationTargetType) {
  if (type === 'copy') {
    target.copyText = target.copyText ?? ''
    delete target.back
    delete target.page
    delete target.url
    return
  }

  delete target.copyText
  delete target.copiedMessage

  if (type === 'back') {
    target.back = true
    delete target.page
    delete target.url
    return
  }

  delete target.back
  if (type === 'page') {
    target.page ||= 'home'
    delete target.url
    return
  }

  if (!target.url?.trim()) target.url = 'https://'
  delete target.page
}
