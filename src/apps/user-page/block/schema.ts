import { SHARED_BLOCK_DEFINITION_MAP } from './definitions'
import { isBlockPropertyAvailable } from './propertyCapabilities'
import { BLOCK_PAGE_VERSION, BLOCK_TYPES, MAX_PAGE_IMAGES } from './schemaTypes'
import type { BlockNode, BlockPageProject, BlockType } from './schemaTypes'
import { validateBlockPageTheme } from './themeValidation'
import { asObject, isNonEmptyString, optionalBoolean, optionalEnum, optionalNumber } from './validationUtils'
import type { ValidationErrors } from './validationUtils'

export * from './schemaTypes'

export interface BlockValidationIssue {
  message: string
  severity: 'error'
  blockId: string | null
  ancestorLayoutIds: string[]
  fieldPath: string | null
}

interface ValidationState {
  issues: BlockValidationIssue[]
  ids: Map<string, string>
  primaryHeadingPath?: string
}

function cleanMessage(message: string, path: string) {
  return message.startsWith(`${path}: `) ? message.slice(path.length + 2) : message
}

function createReporter(state: ValidationState, path: string, blockId: string | null, ancestorLayoutIds: string[]): ValidationErrors {
  return {
    push(message, fieldPath = null) {
      state.issues.push({
        message: cleanMessage(message, path),
        severity: 'error',
        blockId,
        ancestorLayoutIds,
        fieldPath,
      })
    },
  }
}

function validateNodeName(node: Record<string, unknown>, errors: ValidationErrors) {
  if (node.name === undefined) return
  if (typeof node.name !== 'string') errors.push('name 必须是 string', 'name')
  else if (!node.name.trim()) errors.push('name 不能为空', 'name')
  else if (node.name.length > 50) errors.push('name 不能超过 50 字符', 'name')
}

function validateNodeVisibility(node: Record<string, unknown>, path: string, errors: ValidationErrors) {
  if (node.visibility === undefined) return
  const visibility = asObject(node.visibility)
  if (!visibility) {
    errors.push('visibility 必须是 object', 'visibility')
    return
  }
  const visibilityPath = `${path}: visibility`
  const visibilityErrors: ValidationErrors = {
    push: (message, fieldPath) => errors.push(message, fieldPath ?? 'visibility'),
  }
  optionalEnum(visibility, 'liveState', ['live', 'offline'], visibilityPath, visibilityErrors)
  optionalEnum(visibility, 'device', ['desktop', 'mobile'], visibilityPath, visibilityErrors)
  optionalNumber(visibility, 'startsAt', 0, 9_999_999_999, visibilityPath, visibilityErrors, true)
  optionalNumber(visibility, 'endsAt', 0, 9_999_999_999, visibilityPath, visibilityErrors, true)
  if (typeof visibility.startsAt === 'number' && typeof visibility.endsAt === 'number' && visibility.startsAt >= visibility.endsAt) {
    errors.push('开始时间必须早于结束时间', 'visibility.startsAt')
  }
}

function validateNode(value: unknown, path: string, depth: number, ancestorLayoutIds: string[], state: ValidationState) {
  const node = asObject(value)
  if (!node) {
    createReporter(state, path, null, ancestorLayoutIds).push('区块必须是 object')
    return
  }

  const id = node.id
  const type = node.type
  const blockId = isNonEmptyString(id) ? id : null
  const errors = createReporter(state, path, blockId, ancestorLayoutIds)
  if (!blockId) errors.push('id 不能为空', 'id')
  else {
    const firstPath = state.ids.get(blockId)
    if (firstPath) errors.push(`id "${blockId}" 与其他区块重复`, 'id')
    else state.ids.set(blockId, path)
  }

  if (!isNonEmptyString(type)) {
    errors.push('type 不能为空', 'type')
    return
  }
  if (!BLOCK_TYPES.includes(type as BlockType)) {
    errors.push(`不支持的 block type: ${type}`, 'type')
    return
  }

  validateNodeName(node, errors)
  optionalBoolean(node, 'hidden', path, errors)
  validateNodeVisibility(node, path, errors)
  const definition = SHARED_BLOCK_DEFINITION_MAP[type as BlockType]
  const props = node.props === undefined ? null : asObject(node.props)
  if (node.props !== undefined && !props) errors.push('props 必须是 object', 'props')
  if (definition.requiresProps && !props) errors.push('缺少 props', 'props')
  if (props) {
    if (isBlockPropertyAvailable(type as BlockType, props, 'framed')) optionalBoolean(props, 'framed', path, errors)
    if (isBlockPropertyAvailable(type as BlockType, props, 'backgrounded')) optionalBoolean(props, 'backgrounded', path, errors)
  }
  definition.validate(props, path, errors, { hidden: node.hidden === true })

  if (type === 'heading' && node.hidden !== true && props?.level === 1) {
    if (state.primaryHeadingPath) errors.push('一级标题与其他区块重复', 'level')
    else state.primaryHeadingPath = path
  }

  if (type !== 'layout' || !props || !Array.isArray(props.children)) return
  if (depth >= 8) {
    errors.push('layout 嵌套过深（最多 8 层）', 'children')
    return
  }
  const childAncestors = blockId ? [...ancestorLayoutIds, blockId] : ancestorLayoutIds
  props.children.forEach((child, index) => validateNode(child, `${path}.children[${index}]`, depth + 1, childAncestors, state))
}

export function validateBlockPageProject(project: unknown):
  | { ok: true, project: BlockPageProject, issues: [] }
  | { ok: false, issues: BlockValidationIssue[] } {
  const object = asObject(project)
  if (!object) return { ok: false, issues: [{ message: '页面区块配置必须是 object', severity: 'error', blockId: null, ancestorLayoutIds: [], fieldPath: null }] }

  const state: ValidationState = { issues: [], ids: new Map() }
  const projectErrors = createReporter(state, 'BlockPageProject', null, [])
  if (object.version !== BLOCK_PAGE_VERSION) projectErrors.push(`version 不支持: ${String(object.version)}`, 'version')
  if (!Array.isArray(object.blocks)) projectErrors.push('blocks 必须是 array', 'blocks')
  validateBlockPageTheme(object.theme, projectErrors)

  if (Array.isArray(object.blocks)) {
    object.blocks.forEach((node, index) => validateNode(node, `blocks[${index}]`, 0, [], state))
    if (!state.issues.length) {
      const imageCount = countImagesInBlocks(object.blocks as BlockNode[])
      if (imageCount > MAX_PAGE_IMAGES) projectErrors.push(`图片数量超出上限：${imageCount}/${MAX_PAGE_IMAGES}`, 'blocks')
    }
  }

  return state.issues.length
    ? { ok: false, issues: state.issues }
    : { ok: true, project: object as unknown as BlockPageProject, issues: [] }
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
    } else if (block.type === 'cardList' && Array.isArray(props?.items)) {
      count += props.items.filter(item => Boolean(asObject(item)?.imageFile)).length
    }
  }
  return count
}
