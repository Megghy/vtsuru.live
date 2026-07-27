import { SHARED_BLOCK_DEFINITION_MAP } from './definitions'
import { BLOCK_PAGE_VERSION, BLOCK_TYPES, MAX_PAGE_IMAGES } from './schemaTypes'
import type { BlockNode, BlockPageProject, BlockType } from './schemaTypes'
import { validateBlockPageTheme } from './themeValidation'
import { asObject, isNonEmptyString, optionalBoolean } from './validationUtils'

export * from './schemaTypes'

export interface BlockValidationResult {
  ok: boolean
  errors: string[]
}

interface ValidationState {
  errors: string[]
  ids: Map<string, string>
  primaryHeadingPath?: string
}

function validateNodeName(node: Record<string, unknown>, path: string, errors: string[]) {
  if (node.name === undefined) return
  if (typeof node.name !== 'string') errors.push(`${path}: name 必须是 string`)
  else if (!node.name.trim()) errors.push(`${path}: name 不能为空`)
  else if (node.name.length > 50) errors.push(`${path}: name 不能超过 50 字符`)
}

function validateNode(value: unknown, path: string, depth: number, state: ValidationState) {
  const node = asObject(value)
  if (!node) {
    state.errors.push(`${path} 必须是 object`)
    return
  }

  const id = node.id
  const type = node.type
  if (!isNonEmptyString(id)) state.errors.push(`${path}: id 不能为空`)
  else {
    const firstPath = state.ids.get(id)
    if (firstPath) state.errors.push(`${path}: id "${id}" 与 ${firstPath} 重复`)
    else state.ids.set(id, path)
  }

  if (!isNonEmptyString(type)) {
    state.errors.push(`${path}: type 不能为空`)
    return
  }
  if (!BLOCK_TYPES.includes(type as BlockType)) {
    state.errors.push(`${path}: 不支持的 block type: ${type}`)
    return
  }

  validateNodeName(node, path, state.errors)
  optionalBoolean(node, 'hidden', path, state.errors)
  const definition = SHARED_BLOCK_DEFINITION_MAP[type as BlockType]
  const props = node.props === undefined ? null : asObject(node.props)
  if (node.props !== undefined && !props) state.errors.push(`${path}: props 必须是 object`)
  if (definition.requiresProps && !props) state.errors.push(`${path}: 缺少 props`)
  if (props) {
    optionalBoolean(props, 'framed', path, state.errors)
    optionalBoolean(props, 'backgrounded', path, state.errors)
  }
  definition.validate(props, path, state.errors, { hidden: node.hidden === true })

  if (type === 'heading' && node.hidden !== true && props?.level === 1) {
    if (state.primaryHeadingPath) state.errors.push(`${path}: 一级标题与 ${state.primaryHeadingPath} 重复`)
    else state.primaryHeadingPath = path
  }

  if (type !== 'layout' || !props || !Array.isArray(props.children)) return
  if (depth >= 8) {
    state.errors.push(`${path}: layout 嵌套过深（最多 8 层）`)
    return
  }
  props.children.forEach((child, index) => validateNode(child, `${path}.children[${index}]`, depth + 1, state))
}

export function validateBlockPageProject(project: unknown):
  | { ok: true, project: BlockPageProject, errors: [] }
  | { ok: false, errors: string[] } {
  const object = asObject(project)
  if (!object) return { ok: false, errors: ['BlockPageProject 必须是 object'] }

  const state: ValidationState = { errors: [], ids: new Map() }
  if (object.version !== BLOCK_PAGE_VERSION) state.errors.push(`BlockPageProject.version 不支持: ${String(object.version)}`)
  if (!Array.isArray(object.blocks)) state.errors.push('BlockPageProject.blocks 必须是 array')
  validateBlockPageTheme(object.theme, state.errors)

  if (Array.isArray(object.blocks)) {
    object.blocks.forEach((node, index) => validateNode(node, `blocks[${index}]`, 0, state))
    if (!state.errors.length) {
      const imageCount = countImagesInBlocks(object.blocks as BlockNode[])
      if (imageCount > MAX_PAGE_IMAGES) state.errors.push(`图片数量超出上限：${imageCount}/${MAX_PAGE_IMAGES}`)
    }
  }

  return state.errors.length
    ? { ok: false, errors: state.errors }
    : { ok: true, project: object as unknown as BlockPageProject, errors: [] }
}

function removeHiddenNodes(nodes: unknown[]): unknown[] {
  return nodes.flatMap((value) => {
    const node = asObject(value)
    if (node?.hidden === true) return []
    if (node?.type !== 'layout') return [value]
    const props = asObject(node.props)
    if (!Array.isArray(props?.children)) return [value]
    return [{ ...node, props: { ...props, children: removeHiddenNodes(props.children) } }]
  })
}

export function validateRenderableBlockPageProject(project: unknown) {
  const object = asObject(project)
  if (!object || !Array.isArray(object.blocks)) return validateBlockPageProject(project)
  return validateBlockPageProject({ ...object, blocks: removeHiddenNodes(object.blocks) })
}

export function countImagesInBlocks(blocks: BlockNode[], includeHidden = false): number {
  let count = 0
  for (const block of blocks) {
    if (!includeHidden && block.hidden) continue
    const props = asObject(block.props)
    if (block.type === 'layout') {
      if (Array.isArray(props?.children)) count += countImagesInBlocks(props.children as BlockNode[], includeHidden)
    } else if (block.type === 'image') {
      if (props?.imageFile) count += 1
    } else if (block.type === 'imageGallery' && Array.isArray(props?.items)) {
      count += props.items.filter((item) => {
        const object = asObject(item)
        return Boolean(object?.imageFile) || isNonEmptyString(object?.url)
      }).length
    }
  }
  return count
}
