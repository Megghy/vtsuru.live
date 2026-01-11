import { validateBlockPageProject } from '@/features/user-page/block/schema'
import type { UserPageConfig, UserPagesSettingsV1 } from '@/features/user-page/types'

export function validateUserPagesSettings(settingsToValidate: UserPagesSettingsV1) {
  const problems: string[] = []

  const validatePage = (label: string, cfg: UserPageConfig | undefined) => {
    if (!cfg) return
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

  validatePage('home', settingsToValidate.home)
  Object.entries(settingsToValidate.pages ?? {}).forEach(([slug, cfg]) => validatePage(`pages.${slug}`, cfg))

  if (problems.length) throw new Error(problems.join('\n'))
}

