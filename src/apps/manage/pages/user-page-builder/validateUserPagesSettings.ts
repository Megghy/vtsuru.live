import { validateBlockPageProject } from '@/apps/user-page/block/schema'
import type { UserPageBackgroundConfigV1, UserPageConfig, UserPagesSettingsV1, UserPageThemeConfigV1 } from '@/apps/user-page/types'

export function validateUserPagesSettings(settingsToValidate: UserPagesSettingsV1) {
  const problems: string[] = []

  const asObject = (v: unknown) => {
    if (!v || typeof v !== 'object') return null
    if (Array.isArray(v)) return null
    return v as Record<string, unknown>
  }

  const validateBackground = (label: string, bg: UserPageBackgroundConfigV1 | undefined) => {
    if (bg === undefined) return
    const obj = asObject(bg)
    if (!obj) {
      problems.push(`${label}: background 必须是 object`)
      return
    }

    const t = obj.pageBackgroundType === undefined ? 'none' : String(obj.pageBackgroundType)
    const typeOk = t === 'none' || t === 'color' || t === 'image'
    if (!typeOk) problems.push(`${label}: background.pageBackgroundType 不合法（${t}）`)

    if (obj.pageBackgroundCoverSidebar !== undefined && typeof obj.pageBackgroundCoverSidebar !== 'boolean') {
      problems.push(`${label}: background.pageBackgroundCoverSidebar 必须是 boolean`)
    }
    if (obj.pageBackgroundImageFit !== undefined) {
      const fit = String(obj.pageBackgroundImageFit)
      if (!(fit === 'cover' || fit === 'contain' || fit === 'fill' || fit === 'none')) problems.push(`${label}: background.pageBackgroundImageFit 不合法（${fit}）`)
    }
    if (obj.pageBackgroundBlurMode !== undefined) {
      const m = String(obj.pageBackgroundBlurMode)
      if (!(m === 'none' || m === 'background' || m === 'glass')) problems.push(`${label}: background.pageBackgroundBlurMode 不合法（${m}）`)
    }
    if (obj.pageBackgroundBlur !== undefined && typeof obj.pageBackgroundBlur !== 'number') {
      problems.push(`${label}: background.pageBackgroundBlur 必须是 number`)
    }

    if (t === 'color' && obj.pageBackgroundColor !== undefined && typeof obj.pageBackgroundColor !== 'string') {
      problems.push(`${label}: background.pageBackgroundColor 必须是 string`)
    }

    if (obj.pageBackgroundImageFile !== undefined) {
      const f = asObject(obj.pageBackgroundImageFile)
      const id = f?.id
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) problems.push(`${label}: background.pageBackgroundImageFile.id 必须是正整数`)
    }
    if (t === 'image' && obj.pageBackgroundImageFile === undefined) {
      problems.push(`${label}: background.pageBackgroundType=image 时必须提供 pageBackgroundImageFile`)
    }
  }

  const validateTheme = (label: string, theme: UserPageThemeConfigV1 | undefined) => {
    if (theme === undefined) return
    const obj = asObject(theme)
    if (!obj) {
      problems.push(`${label}: theme 必须是 object`)
      return
    }
    if (obj.primaryColor !== undefined && typeof obj.primaryColor !== 'string') problems.push(`${label}: theme.primaryColor 必须是 string`)
    if (obj.textColor !== undefined && typeof obj.textColor !== 'string') problems.push(`${label}: theme.textColor 必须是 string`)
    if (obj.backgroundColor !== undefined && typeof obj.backgroundColor !== 'string') problems.push(`${label}: theme.backgroundColor 必须是 string`)
    if (obj.pageThemeMode !== undefined) {
      const m = String(obj.pageThemeMode)
      if (!(m === 'auto' || m === 'light' || m === 'dark')) problems.push(`${label}: theme.pageThemeMode 不合法（${m}）`)
    }
  }

  const validatePage = (label: string, cfg: UserPageConfig | undefined) => {
    if (!cfg) return
    validateTheme(label, (cfg as any).theme)
    validateBackground(label, cfg.background)
    if (cfg.mode === 'block') {
      const v = validateBlockPageProject(cfg.block)
      if (!v.ok) problems.push(`${label}: ${v.errors.join('；')}`)
      return
    }
    if (cfg.mode === 'contrib') {
      const c = cfg.contrib
      if (!c) {
        problems.push(`${label}: 缺少 contrib 配置`)
        return
      }
      if (!c.pageId) problems.push(`${label}: contrib.pageId 不能为空`)
      if (c.scope === 'streamer' && !c.streamerId) problems.push(`${label}: contrib.streamerId 不能为空`)
    }
  }

  validateTheme('settings', (settingsToValidate as any).theme)
  validateBackground('settings', settingsToValidate.background)
  validatePage('home', settingsToValidate.home)
  Object.entries(settingsToValidate.pages ?? {}).forEach(([slug, cfg]) => validatePage(`pages.${slug}`, cfg))

  if (problems.length) throw new Error(problems.join('\n'))
}
