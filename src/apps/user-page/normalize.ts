import type { BlockNode } from './block/schema'
import { BLOCK_PAGE_VERSION } from './block/schema'
import type { UserPagesSettingsV1 } from './types'

export const USER_PAGES_SETTINGS_VERSION = 1 as const

type JsonObject = Record<string, unknown>
type Migration = (input: JsonObject) => JsonObject

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : null
}

function migrateLegacyToV1(input: JsonObject): JsonObject {
  const output = structuredClone(input)
  output.version = USER_PAGES_SETTINGS_VERSION
  forEachBlockProject(output, (project) => {
    if (project.version === undefined) project.version = BLOCK_PAGE_VERSION
  })
  return output
}

const MIGRATIONS: Readonly<Record<number, Migration>> = {
  0: migrateLegacyToV1,
}

function forEachBlockProject(settings: JsonObject, visit: (project: JsonObject) => void) {
  const pages: unknown[] = [settings.home]
  const pageMap = asObject(settings.pages)
  if (pageMap) pages.push(...Object.values(pageMap))

  pages.forEach((pageValue) => {
    const page = asObject(pageValue)
    if (page?.mode !== 'block') return
    const project = asObject(page.block)
    if (project) visit(project)
  })
}

function normalizeCountdownTargets(blocks: unknown) {
  if (!Array.isArray(blocks)) return
  blocks.forEach((value) => {
    const block = asObject(value) as (JsonObject & Partial<BlockNode>) | null
    if (!block) return
    const props = asObject(block.props)
    if (!props) return
    if (block.type === 'layout') normalizeCountdownTargets(props.children)
    if (block.type !== 'countdown') return

    const target = props.target
    if (target instanceof Date && Number.isFinite(target.getTime())) props.target = target.toISOString()
    else if (typeof target === 'number' && Number.isFinite(target)) {
      const milliseconds = target > 0 && target < 1_000_000_000_000 ? target * 1000 : target
      const date = new Date(milliseconds)
      if (Number.isFinite(date.getTime())) props.target = date.toISOString()
    }
  })
}

function normalizeCurrentVersion(settings: JsonObject) {
  forEachBlockProject(settings, (project) => normalizeCountdownTargets(project.blocks))
  return settings
}

function validatePageModes(settings: JsonObject) {
  const validatePage = (value: unknown, path: string) => {
    const page = asObject(value)
    if (!page) throw new Error(`${path} 必须是 object`)
    if (page.mode !== 'legacy' && page.mode !== 'block' && page.mode !== 'contrib') {
      throw new Error(`${path}.mode 不支持: ${String(page.mode)}`)
    }
  }
  if (settings.home !== undefined) validatePage(settings.home, 'home')
  const pages = asObject(settings.pages)
  if (pages) Object.entries(pages).forEach(([slug, page]) => validatePage(page, `pages.${slug}`))
}

export function migrateUserPagesSettings(input: unknown): UserPagesSettingsV1 {
  const source = asObject(input)
  if (!source) throw new Error('用户页面配置必须是 object')

  let current = structuredClone(source)
  const rawVersion = current.version === undefined ? 0 : current.version
  if (
    typeof rawVersion !== 'number' ||
    !Number.isInteger(rawVersion) ||
    rawVersion < 0 ||
    rawVersion > USER_PAGES_SETTINGS_VERSION
  ) {
    throw new Error(`用户页面配置 version 不支持: ${String(current.version)}`)
  }
  let version = rawVersion
  if (source.home === undefined && source.pages === undefined) throw new Error('用户页面配置缺少 home 或 pages')
  if (source.home !== undefined && !asObject(source.home)) throw new Error('用户页面配置 home 必须是 object')
  if (source.pages !== undefined && !asObject(source.pages)) throw new Error('用户页面配置 pages 必须是 object')

  while (version < USER_PAGES_SETTINGS_VERSION) {
    const migrate = MIGRATIONS[version]
    if (!migrate) throw new Error(`缺少用户页面配置 v${version} 迁移器`)
    current = migrate(current)
    const migratedVersion = current.version
    if (typeof migratedVersion !== 'number') throw new Error('迁移器没有生成有效的 version')
    version = migratedVersion
  }

  const normalized = normalizeCurrentVersion(current)
  validatePageModes(normalized)
  return normalized as unknown as UserPagesSettingsV1
}

export function migrateBlockPageProject(project: unknown) {
  const object = asObject(project)
  if (!object) throw new Error('BlockPageProject 必须是 object')
  const output = structuredClone(object)
  if (output.version === undefined) output.version = BLOCK_PAGE_VERSION
  if (output.version !== BLOCK_PAGE_VERSION)
    throw new Error(`BlockPageProject.version 不支持: ${String(output.version)}`)
  normalizeCountdownTargets(output.blocks)
  return output
}
