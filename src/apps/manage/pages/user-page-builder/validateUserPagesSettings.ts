import { validateBlockPageProject, validateRenderableBlockPageProject } from '@/apps/user-page/block/schema'
import type { UserPageConfig, UserPagesSettingsV1 } from '@/apps/user-page/types'

export type UserPageValidationScope = 'settings' | 'page' | 'block'

export interface UserPageValidationIssue {
  message: string
  severity: 'error'
  scope: UserPageValidationScope
  pageKey: string | null
  blockId: string | null
  fieldPath: string | null
}

type IssueTarget = Pick<UserPageValidationIssue, 'scope' | 'pageKey' | 'blockId'>
type UnknownObject = Record<string, unknown>

function asObject(value: unknown): UnknownObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownObject : null
}

function report(issues: UserPageValidationIssue[], target: IssueTarget, fieldPath: string | null, message: string) {
  issues.push({ ...target, fieldPath, message, severity: 'error' })
}

function validateTheme(value: unknown, fieldRoot: string, target: IssueTarget, issues: UserPageValidationIssue[]) {
  if (value === undefined) return
  const theme = asObject(value)
  if (!theme) {
    report(issues, target, fieldRoot, '主题设置必须是 object')
    return
  }
  const colors = ['primaryColor', 'textColor', 'backgroundColor']
  colors.forEach((key) => {
    if (theme[key] !== undefined && typeof theme[key] !== 'string') report(issues, target, `${fieldRoot}.${key}`, `${key} 必须是 string`)
  })
  const mode = theme.pageThemeMode
  if (mode !== undefined && !['auto', 'light', 'dark'].includes(String(mode))) {
    report(issues, target, `${fieldRoot}.pageThemeMode`, `主题模式不合法：${String(mode)}`)
  }
}

function validateBackground(value: unknown, fieldRoot: string, target: IssueTarget, issues: UserPageValidationIssue[]) {
  if (value === undefined) return
  const background = asObject(value)
  if (!background) {
    report(issues, target, fieldRoot, '背景设置必须是 object')
    return
  }
  const type = background.pageBackgroundType ?? 'none'
  if (!['none', 'color', 'image'].includes(String(type))) report(issues, target, `${fieldRoot}.pageBackgroundType`, `背景类型不合法：${String(type)}`)
  if (background.pageBackgroundCoverSidebar !== undefined && typeof background.pageBackgroundCoverSidebar !== 'boolean') report(issues, target, `${fieldRoot}.pageBackgroundCoverSidebar`, '侧栏背景设置必须是 boolean')
  if (background.pageBackgroundImageFit !== undefined && !['cover', 'contain', 'fill', 'none'].includes(String(background.pageBackgroundImageFit))) report(issues, target, `${fieldRoot}.pageBackgroundImageFit`, `图片填充方式不合法：${String(background.pageBackgroundImageFit)}`)
  if (background.pageBackgroundBlurMode !== undefined && !['none', 'background', 'glass'].includes(String(background.pageBackgroundBlurMode))) report(issues, target, `${fieldRoot}.pageBackgroundBlurMode`, `模糊模式不合法：${String(background.pageBackgroundBlurMode)}`)
  if (background.pageBackgroundBlur !== undefined && typeof background.pageBackgroundBlur !== 'number') report(issues, target, `${fieldRoot}.pageBackgroundBlur`, '模糊强度必须是 number')
  if (background.pageBackgroundScrimMode !== undefined && !['auto', 'black', 'white'].includes(String(background.pageBackgroundScrimMode))) report(issues, target, `${fieldRoot}.pageBackgroundScrimMode`, `遮罩模式不合法：${String(background.pageBackgroundScrimMode)}`)
  const strength = background.pageBackgroundScrimStrength
  if (strength !== undefined && (typeof strength !== 'number' || !Number.isFinite(strength) || strength < 0 || strength > 100)) report(issues, target, `${fieldRoot}.pageBackgroundScrimStrength`, '遮罩强度必须是 0~100 的数字')
  if (type === 'color' && background.pageBackgroundColor !== undefined && typeof background.pageBackgroundColor !== 'string') report(issues, target, `${fieldRoot}.pageBackgroundColor`, '背景颜色必须是 string')
  const file = background.pageBackgroundImageFile
  if (file !== undefined && (!asObject(file) || !Number.isInteger(asObject(file)?.id) || Number(asObject(file)?.id) <= 0)) report(issues, target, `${fieldRoot}.pageBackgroundImageFile`, '背景图片文件无效')
  if (type === 'image' && file === undefined) report(issues, target, `${fieldRoot}.pageBackgroundImageFile`, '图片背景必须选择图片文件')
}

type BlockProjectValidator = typeof validateBlockPageProject

function validatePage(
  pageKey: string,
  page: UserPageConfig | undefined,
  issues: UserPageValidationIssue[],
  validateBlockProject: BlockProjectValidator,
) {
  if (!page) return
  const pageTarget: IssueTarget = { scope: 'page', pageKey, blockId: null }
  if (!['legacy', 'block', 'contrib'].includes(page.mode)) {
    report(issues, pageTarget, 'mode', `页面模式不合法：${String(page.mode)}`)
    return
  }
  validateTheme((page as unknown as UnknownObject).theme, 'theme', pageTarget, issues)
  validateBackground(page.background, 'background', pageTarget, issues)
  if (page.mode === 'block') {
    const result = validateBlockProject(page.block)
    if (result.ok === false) {
      result.issues.forEach(issue => issues.push({
        message: issue.message,
        severity: issue.severity,
        scope: 'block',
        pageKey,
        blockId: issue.blockId,
        fieldPath: issue.fieldPath,
      }))
    }
  } else if (page.mode === 'contrib') {
    if (!page.contrib) report(issues, pageTarget, 'contrib', '缺少贡献页配置')
    else {
      if (!page.contrib.pageId) report(issues, pageTarget, 'contrib.pageId', '贡献页 ID 不能为空')
      if (page.contrib.scope === 'streamer' && !page.contrib.streamerId) report(issues, pageTarget, 'contrib.streamerId', '主播 ID 不能为空')
    }
  }
}

function validateSettings(settings: UserPagesSettingsV1, validateBlockProject: BlockProjectValidator) {
  const issues: UserPageValidationIssue[] = []
  const settingsTarget: IssueTarget = { scope: 'settings', pageKey: null, blockId: null }
  validateTheme((settings as unknown as UnknownObject).theme, 'theme', settingsTarget, issues)
  validateBackground(settings.background, 'background', settingsTarget, issues)
  validatePage('home', settings.home, issues, validateBlockProject)
  Object.entries(settings.pages ?? {}).forEach(([pageKey, page]) => validatePage(pageKey, page, issues, validateBlockProject))
  return issues
}

export function validateUserPagesSettings(settings: UserPagesSettingsV1) {
  return validateSettings(settings, validateBlockPageProject)
}

export function validateRenderableUserPagesSettings(settings: UserPagesSettingsV1) {
  return validateSettings(settings, validateRenderableBlockPageProject)
}
