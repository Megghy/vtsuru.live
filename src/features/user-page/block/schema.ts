export type BlockType =
  | 'profile'
  | 'heading'
  | 'text'
  | 'links'
  | 'buttons'
  | 'image'
  | 'embed'
  | 'divider'
  | 'spacer'
  | 'footer'

export interface BlockPageTheme {
  primaryColor?: string
  backgroundColor?: string
  textColor?: string
  radius?: number
  spacing?: 'compact' | 'normal' | 'relaxed'
}

export interface BlockNode {
  id: string
  type: BlockType
  hidden?: boolean
  props?: unknown
}

export interface BlockPageProject {
  version: 1
  theme?: BlockPageTheme
  blocks: BlockNode[]
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function isHttpsUrlString(v: unknown): v is string {
  if (!isNonEmptyString(v)) return false
  try {
    const u = new URL(v)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function validateBlockProps(block: BlockNode, userFacingName: string, errors: string[]) {
  const propsObj = block.props === undefined ? null : asObject(block.props)
  if (block.props !== undefined && !propsObj) {
    errors.push(`${userFacingName}: props 必须是 object`)
    return
  }

  switch (block.type) {
    case 'profile':
      if (!propsObj) break
      if (propsObj.avatarUrl !== undefined && !isHttpsUrlString(propsObj.avatarUrl)) errors.push(`${userFacingName}: avatarUrl 必须是 https URL`)
      if (propsObj.displayName !== undefined && typeof propsObj.displayName !== 'string') errors.push(`${userFacingName}: displayName 必须是 string`)
      if (propsObj.bio !== undefined && typeof propsObj.bio !== 'string') errors.push(`${userFacingName}: bio 必须是 string`)
      break
    case 'heading':
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (!isNonEmptyString(propsObj.text)) errors.push(`${userFacingName}: text 不能为空`)
      if (propsObj.level !== undefined && ![1, 2, 3].includes(Number(propsObj.level))) errors.push(`${userFacingName}: level 仅支持 1/2/3`)
      break
    case 'text':
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (typeof propsObj.text !== 'string') errors.push(`${userFacingName}: text 必须是 string`)
      break
    case 'links':
    case 'buttons': {
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      const items = propsObj.items
      if (!Array.isArray(items)) {
        errors.push(`${userFacingName}: items 必须是 array`)
        break
      }
      items.forEach((it, idx) => {
        const obj = asObject(it)
        if (!obj) {
          errors.push(`${userFacingName}: items[${idx}] 必须是 object`)
          return
        }
        if (!isNonEmptyString(obj.label)) errors.push(`${userFacingName}: items[${idx}].label 不能为空`)
        if (!isHttpsUrlString(obj.url)) errors.push(`${userFacingName}: items[${idx}].url 必须是 https URL`)
      })
      break
    }
    case 'image':
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (!isHttpsUrlString(propsObj.url)) errors.push(`${userFacingName}: url 必须是 https URL`)
      if (propsObj.alt !== undefined && typeof propsObj.alt !== 'string') errors.push(`${userFacingName}: alt 必须是 string`)
      break
    case 'embed':
      if (!propsObj) {
        errors.push(`${userFacingName}: 缺少 props`)
        break
      }
      if (!isHttpsUrlString(propsObj.url)) errors.push(`${userFacingName}: url 必须是 https URL`)
      if (propsObj.title !== undefined && typeof propsObj.title !== 'string') errors.push(`${userFacingName}: title 必须是 string`)
      break
    case 'divider':
      if (!propsObj) break
      if (propsObj.text !== undefined && typeof propsObj.text !== 'string') errors.push(`${userFacingName}: text 必须是 string`)
      break
    case 'spacer':
      if (!propsObj) break
      if (propsObj.size !== undefined && !['sm', 'md', 'lg'].includes(String(propsObj.size))) errors.push(`${userFacingName}: size 仅支持 sm/md/lg`)
      break
    case 'footer':
      if (!propsObj) break
      if (propsObj.text !== undefined && typeof propsObj.text !== 'string') errors.push(`${userFacingName}: text 必须是 string`)
      break
  }
}

export function validateBlockPageProject(project: unknown) {
  const errors: string[] = []
  const obj = asObject(project)
  if (!obj) return { ok: false as const, errors: ['BlockPageProject 必须是 object'] }
  if (obj.version !== 1) errors.push(`BlockPageProject.version 不支持: ${String(obj.version)}`)
  if (!Array.isArray(obj.blocks)) errors.push('BlockPageProject.blocks 必须是 array')

  const blocks = Array.isArray(obj.blocks) ? (obj.blocks as unknown[]) : []
  blocks.forEach((b, idx) => {
    const bObj = asObject(b)
    if (!bObj) {
      errors.push(`blocks[${idx}] 必须是 object`)
      return
    }
    const type = bObj.type
    const id = bObj.id
    const userFacingName = `blocks[${idx}]`
    if (!isNonEmptyString(id)) errors.push(`${userFacingName}: id 不能为空`)
    if (!isNonEmptyString(type)) {
      errors.push(`${userFacingName}: type 不能为空`)
      return
    }
    if (!['profile', 'heading', 'text', 'links', 'buttons', 'image', 'embed', 'divider', 'spacer', 'footer'].includes(String(type))) {
      errors.push(`${userFacingName}: 不支持的 block type: ${String(type)}`)
      return
    }
    if (bObj.hidden) return
    validateBlockProps(
      {
        id: String(id),
        type: type as any,
        hidden: Boolean(bObj.hidden),
        props: bObj.props,
      },
      userFacingName,
      errors,
    )
  })

  if (errors.length) return { ok: false as const, errors }
  return { ok: true as const, project: obj as unknown as BlockPageProject }
}
