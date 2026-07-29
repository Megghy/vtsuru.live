import type { BlockPageProject } from '@/apps/user-page/block/schema'
import type { UserPageConfig, UserPagesSettingsV1 } from '@/apps/user-page/types'
import { createId } from './editorHelpers'

export function createDefaultProject(): BlockPageProject {
  return {
    version: 1,
    theme: {
      spacing: 'normal',
      radius: 12,
      primaryColor: '#18a058',
    },
    blocks: [
      { id: createId(), type: 'profile' },
      { id: createId(), type: 'buttons', props: { items: [] } },
      { id: createId(), type: 'footer' },
    ],
  }
}

export function isValidPageConfig(config: unknown): boolean {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false
  const page = config as UserPageConfig
  if (page.mode === 'legacy') return true
  if (page.mode === 'block') return !!page.block
  if (page.mode === 'contrib') return !!page.contrib
  return false
}

export function isEmptyDraftPlaceholder(settings: UserPagesSettingsV1 | null): boolean {
  if (!settings || settings.version !== 1 || Object.keys(settings.pages ?? {}).length !== 0) return false
  if (Object.keys(settings).some(key => !['version', 'home', 'pages'].includes(key))) return false
  if (!settings.home || settings.home.mode !== 'legacy') return false
  const homeKeys = Object.keys(settings.home)
  return homeKeys.length === 1 && homeKeys[0] === 'mode'
}

export function isMeaningfulSettings(settings: UserPagesSettingsV1 | null): settings is UserPagesSettingsV1 {
  if (!settings || settings.version !== 1) return false
  if (isValidPageConfig(settings.home)) return true
  return Object.values(settings.pages ?? {}).some(isValidPageConfig)
}

export function ensurePageConfig(settings: UserPagesSettingsV1, key: string): UserPageConfig {
  if (key === 'home') {
    settings.home ??= { mode: 'block', block: createDefaultProject() }
    if (!isValidPageConfig(settings.home)) {
      settings.home.mode = 'block'
      settings.home.block ??= createDefaultProject()
    }
    return settings.home
  }

  settings.pages ??= {}
  settings.pages[key] ??= { mode: 'block', block: createDefaultProject() }
  if (!isValidPageConfig(settings.pages[key])) {
    settings.pages[key].mode = 'block'
    settings.pages[key].block ??= createDefaultProject()
  }
  return settings.pages[key]
}

export function getPageModeLabel(mode: UserPageConfig['mode']) {
  if (mode === 'legacy') return '传统模式'
  if (mode === 'block') return '区块模式'
  return '自定义页'
}
