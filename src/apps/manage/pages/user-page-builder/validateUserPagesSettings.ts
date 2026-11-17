import { GLOBAL_CUSTOM_CSS_MAX_BYTES, utf8ByteLength } from '@/apps/user-page/block/customHtmlContract'
import { inspectCustomCss } from '@/apps/user-page/block/customHtmlRuntime'
import { validateCustomHtmlConfig } from '@/apps/user-page/block/customHtmlValidation'
import { validateBlockPageProject, validateRenderableBlockPageProject } from '@/apps/user-page/block/schema'
import { isValidGoogleFontFamily } from '@/apps/user-page/googleFonts'
import { isUserPageNavIcon } from '@/apps/user-page/pageIcons'
import { isNormalizedUserPageColor, USER_PAGE_THEME_COLOR_KEYS } from '@/apps/user-page/themeColor'
import {
  isValidPageMaxWidth,
  PAGE_BORDER_STRENGTHS,
  PAGE_BORDER_STYLES,
  PAGE_CONTROL_SIZES,
  PAGE_SHADOW_LEVELS,
  PAGE_SPACING_LEVELS,
} from '@/apps/user-page/themeConfig'
import type { UserPageConfig, UserPagesSettings } from '@/apps/user-page/types'

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
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownObject) : null
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
  USER_PAGE_THEME_COLOR_KEYS.forEach((key) => {
    if (theme[key] !== undefined && typeof theme[key] !== 'string')
      report(issues, target, `${fieldRoot}.${key}`, `${key} 必须是 string`)
    else if (typeof theme[key] === 'string' && !isNormalizedUserPageColor(theme[key]))
      report(issues, target, `${fieldRoot}.${key}`, `${key} 必须是十六进制颜色`)
  })
  if (theme.fontFamily !== undefined) {
    if (typeof theme.fontFamily !== 'string')
      report(issues, target, `${fieldRoot}.fontFamily`, 'fontFamily 必须是 string')
    else if (!isValidGoogleFontFamily(theme.fontFamily))
      report(issues, target, `${fieldRoot}.fontFamily`, 'fontFamily 格式不合法')
  }
  if (theme.autoTextContrast !== undefined && typeof theme.autoTextContrast !== 'boolean') {
    report(issues, target, `${fieldRoot}.autoTextContrast`, 'autoTextContrast 必须是 boolean')
  }
  if (
    theme.radius !== undefined &&
    (typeof theme.radius !== 'number' || !Number.isFinite(theme.radius) || theme.radius < 0 || theme.radius > 32)
  ) {
    report(issues, target, `${fieldRoot}.radius`, 'radius 必须是 0~32 的数字')
  }
  if (
    theme.surfaceOpacity !== undefined &&
    (typeof theme.surfaceOpacity !== 'number' ||
      !Number.isFinite(theme.surfaceOpacity) ||
      theme.surfaceOpacity < 15 ||
      theme.surfaceOpacity > 100)
  ) {
    report(issues, target, `${fieldRoot}.surfaceOpacity`, 'surfaceOpacity 必须是 15~100 的数字')
  }
  const enumFields = [
    ['borderStrength', PAGE_BORDER_STRENGTHS],
    ['borderStyle', PAGE_BORDER_STYLES],
    ['shadowLevel', PAGE_SHADOW_LEVELS],
    ['spacing', PAGE_SPACING_LEVELS],
    ['controlSize', PAGE_CONTROL_SIZES],
  ] as const
  enumFields.forEach(([key, values]) => {
    if (theme[key] !== undefined && !(values as readonly unknown[]).includes(theme[key])) {
      report(issues, target, `${fieldRoot}.${key}`, `${key} 不合法`)
    }
  })
  if (
    theme.pageMaxWidth !== undefined &&
    (typeof theme.pageMaxWidth !== 'string' || !isValidPageMaxWidth(theme.pageMaxWidth))
  ) {
    report(issues, target, `${fieldRoot}.pageMaxWidth`, 'pageMaxWidth 仅支持 none / 100% / 1200px 这类格式')
  }
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
  if (!['none', 'color', 'image'].includes(String(type)))
    report(issues, target, `${fieldRoot}.pageBackgroundType`, `背景类型不合法：${String(type)}`)
  if (background.pageBackgroundCoverSidebar !== undefined && typeof background.pageBackgroundCoverSidebar !== 'boolean')
    report(issues, target, `${fieldRoot}.pageBackgroundCoverSidebar`, '侧栏背景设置必须是 boolean')
  if (
    background.pageBackgroundImageFit !== undefined &&
    !['cover', 'contain', 'fill', 'none'].includes(String(background.pageBackgroundImageFit))
  )
    report(
      issues,
      target,
      `${fieldRoot}.pageBackgroundImageFit`,
      `图片填充方式不合法：${String(background.pageBackgroundImageFit)}`,
    )
  if (
    background.pageBackgroundBlurMode !== undefined &&
    !['none', 'background', 'glass'].includes(String(background.pageBackgroundBlurMode))
  )
    report(
      issues,
      target,
      `${fieldRoot}.pageBackgroundBlurMode`,
      `模糊模式不合法：${String(background.pageBackgroundBlurMode)}`,
    )
  if (background.pageBackgroundBlur !== undefined && typeof background.pageBackgroundBlur !== 'number')
    report(issues, target, `${fieldRoot}.pageBackgroundBlur`, '模糊强度必须是 number')
  if (
    background.pageBackgroundScrimMode !== undefined &&
    !['auto', 'black', 'white'].includes(String(background.pageBackgroundScrimMode))
  )
    report(
      issues,
      target,
      `${fieldRoot}.pageBackgroundScrimMode`,
      `遮罩模式不合法：${String(background.pageBackgroundScrimMode)}`,
    )
  const strength = background.pageBackgroundScrimStrength
  if (
    strength !== undefined &&
    (typeof strength !== 'number' || !Number.isFinite(strength) || strength < 0 || strength > 100)
  )
    report(issues, target, `${fieldRoot}.pageBackgroundScrimStrength`, '遮罩强度必须是 0~100 的数字')
  if (background.pageBackgroundColor !== undefined) {
    if (typeof background.pageBackgroundColor !== 'string')
      report(issues, target, `${fieldRoot}.pageBackgroundColor`, '背景颜色必须是 string')
    else if (!isNormalizedUserPageColor(background.pageBackgroundColor))
      report(issues, target, `${fieldRoot}.pageBackgroundColor`, '背景颜色必须是十六进制颜色')
  }
  const file = background.pageBackgroundImageFile
  if (
    file !== undefined &&
    (!asObject(file) || !Number.isInteger(asObject(file)?.id) || Number(asObject(file)?.id) <= 0)
  )
    report(issues, target, `${fieldRoot}.pageBackgroundImageFile`, '背景图片文件无效')
  if (type === 'image' && file === undefined)
    report(issues, target, `${fieldRoot}.pageBackgroundImageFile`, '图片背景必须选择图片文件')
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
  if (!['legacy', 'block', 'contrib', 'custom'].includes(page.mode)) {
    report(issues, pageTarget, 'mode', `页面模式不合法：${String(page.mode)}`)
    return
  }
  if (page.navIcon !== undefined && !isUserPageNavIcon(page.navIcon))
    report(issues, pageTarget, 'navIcon', '导航图标不合法')
  validateTheme((page as unknown as UnknownObject).theme, 'theme', pageTarget, issues)
  validateBackground(page.background, 'background', pageTarget, issues)
  if (page.mode === 'block') {
    const result = validateBlockProject(page.block)
    if (result.ok === false) {
      result.issues.forEach((issue) =>
        issues.push({
          message: issue.message,
          severity: issue.severity,
          scope: 'block',
          pageKey,
          blockId: issue.blockId,
          fieldPath: issue.fieldPath,
        }),
      )
    }
  } else if (page.mode === 'contrib') {
    if (!page.contrib) report(issues, pageTarget, 'contrib', '缺少贡献页配置')
    else {
      if (!page.contrib.pageId) report(issues, pageTarget, 'contrib.pageId', '贡献页 ID 不能为空')
      if (page.contrib.scope === 'streamer' && !page.contrib.streamerId)
        report(issues, pageTarget, 'contrib.streamerId', '主播 ID 不能为空')
    }
  } else if (page.mode === 'custom') {
    validateCustomHtmlConfig(page.custom).forEach((issue) => report(issues, pageTarget, issue.fieldPath, issue.message))
  }
}

function validateSettings(settings: UserPagesSettings, validateBlockProject: BlockProjectValidator) {
  const issues: UserPageValidationIssue[] = []
  const settingsTarget: IssueTarget = { scope: 'settings', pageKey: null, blockId: null }
  const customCss = (settings as unknown as UnknownObject).customCss
  if (customCss !== undefined) {
    if (typeof customCss !== 'string') report(issues, settingsTarget, 'customCss', '全局 CSS 必须是 string')
    else {
      if (utf8ByteLength(customCss) > GLOBAL_CUSTOM_CSS_MAX_BYTES)
        report(issues, settingsTarget, 'customCss', `全局 CSS 不能超过 ${GLOBAL_CUSTOM_CSS_MAX_BYTES / 1024} KiB`)
      inspectCustomCss(customCss).issues.forEach((item) =>
        report(issues, settingsTarget, `customCss:${item.line}:${item.column}`, item.message),
      )
    }
  }
  validateTheme((settings as unknown as UnknownObject).theme, 'theme', settingsTarget, issues)
  validateBackground(settings.background, 'background', settingsTarget, issues)
  validatePage('home', settings.home, issues, validateBlockProject)
  Object.entries(settings.pages ?? {}).forEach(([pageKey, page]) =>
    validatePage(pageKey, page, issues, validateBlockProject),
  )
  return issues
}

export function validateUserPagesSettings(settings: UserPagesSettings) {
  return validateSettings(settings, validateBlockPageProject)
}

export function validateRenderableUserPagesSettings(settings: UserPagesSettings) {
  return validateSettings(settings, validateRenderableBlockPageProject)
}

function resolveBlockIdByIndexPath(settings: UserPagesSettings, pageKey: string, indices: number[]): string | null {
  const page = pageKey === 'home' ? settings.home : settings.pages?.[pageKey]
  if (!page || page.mode !== 'block' || !page.block?.blocks) return null
  let list = page.block.blocks
  let current: any = null
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]
    current = list[idx]
    if (!current) return null
    if (i < indices.length - 1) {
      if (current.type !== 'layout' || !Array.isArray(current.props?.children)) return null
      list = current.props.children
    }
  }
  return typeof current?.id === 'string' && current.id ? current.id : null
}

function inferPageFieldPath(detail: string): string | null {
  if (detail.startsWith('theme')) return 'theme'
  if (detail.startsWith('background')) return 'background'
  if (detail.startsWith('navIcon')) return 'navIcon'
  if (detail.startsWith('contrib')) return detail.split(/\s+/)[0]
  if (detail.startsWith('customHtml') || detail.includes('custom 配置')) return 'custom'
  return null
}

export function parseServerValidationIssues(errorText: string, settings: UserPagesSettings): UserPageValidationIssue[] {
  const lines = errorText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const issues: UserPageValidationIssue[] = []

  for (const line of lines) {
    if (line.startsWith('settings:')) {
      const detail = line.slice('settings:'.length).trim()
      issues.push({
        message: line,
        severity: 'error',
        scope: 'settings',
        pageKey: null,
        blockId: null,
        fieldPath: detail.startsWith('customCss')
          ? 'customCss'
          : detail.startsWith('background')
            ? 'background'
            : detail.startsWith('theme')
              ? 'theme'
              : null,
      })
      continue
    }

    if (line.startsWith('pages:')) {
      issues.push({
        message: line,
        severity: 'error',
        scope: 'settings',
        pageKey: null,
        blockId: null,
        fieldPath: 'pages',
      })
      continue
    }

    const pageMatch = line.match(/^(home|pages\.([a-z0-9-]+)):\s*(.+)$/)
    if (!pageMatch) continue
    const pageKey = pageMatch[1] === 'home' ? 'home' : pageMatch[2]
    const detail = pageMatch[3]

    const rootBlockMatch = detail.match(/^block\.blocks\[(\d+)\](.*)$/)
    if (rootBlockMatch) {
      const indices = [Number(rootBlockMatch[1])]
      let rest = rootBlockMatch[2]
      const childRegex = /^\s*:\s*layout\.children\[(\d+)\](.*)$/
      while (true) {
        const childMatch = rest.match(childRegex)
        if (!childMatch) break
        indices.push(Number(childMatch[1]))
        rest = childMatch[2]
      }
      const blockId = resolveBlockIdByIndexPath(settings, pageKey, indices)
      const cleanedField = rest.replace(/^\s*:\s*/, '').trim()
      if (blockId) {
        issues.push({
          message: line,
          severity: 'error',
          scope: 'block',
          pageKey,
          blockId,
          fieldPath: cleanedField.split(/\s+/)[0] || null,
        })
        continue
      }
    }

    issues.push({
      message: line,
      severity: 'error',
      scope: 'page',
      pageKey,
      blockId: null,
      fieldPath: detail.startsWith('block.theme') ? 'theme' : inferPageFieldPath(detail),
    })
  }

  return issues
}
