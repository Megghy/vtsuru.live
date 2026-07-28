import type { MenuOption } from 'naive-ui'
import type { BlockNode, BlockType } from '@/apps/user-page/block/schema'
import { BLOCK_LIBRARY, createBlockNode } from '@/apps/user-page/block/registry'
import {
  AddCircleOutline,
  ArrowDownOutline,
  ArrowUpOutline,
  CopyOutline,
  CreateOutline,
  LayersOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { NIcon, useDialog } from 'naive-ui'
import { computed, h, inject, ref } from 'vue'
import { UserPageEditorKey } from '../context'
import { cloneBlockNode, createId, deepCloneJson } from '../editorHelpers'
import { USER_PAGE_BLOCK_TEMPLATES_KEY } from '../storageKeys'
import { usePersistedStorage } from '@/shared/storage/persist'

interface BlockTemplate {
  key: string
  label: string
  blocks: Array<{ type: BlockType, props?: Record<string, unknown> }>
}

interface PersonalBlockTemplate {
  id: string
  label: string
  blocks: BlockNode[]
}

const blockTemplates: BlockTemplate[] = [
  {
    key: 'live-home',
    label: '直播主页',
    blocks: [
      { type: 'profile' },
      { type: 'liveStatus' },
      { type: 'featureNav' },
      { type: 'streamSchedule' },
      { type: 'socialLinks' },
      { type: 'footer' },
    ],
  },
  {
    key: 'portfolio',
    label: '作品展示',
    blocks: [
      { type: 'profile' },
      { type: 'heading', props: { text: '作品展示', level: 2 } },
      { type: 'imageGallery' },
      { type: 'videoList' },
      { type: 'footer' },
    ],
  },
  {
    key: 'schedule',
    label: '直播日程',
    blocks: [
      { type: 'heading', props: { text: '近期直播安排', level: 1 } },
      { type: 'streamSchedule' },
      { type: 'countdown' },
      { type: 'footer' },
    ],
  },
]

const blockGroups = [
  { key: 'live', label: '直播与日程', types: ['liveStatus', 'streamSchedule', 'songList', 'nowPlaying', 'checkInRanking', 'featuredGoods', 'videoCollect'] },
  { key: 'profile', label: '资料与品牌', types: ['profile', 'biliInfo', 'tags', 'milestone', 'faq', 'quote'] },
  { key: 'content', label: '内容与媒体', types: ['cardList', 'videoList', 'embed', 'image', 'imageGallery', 'musicPlayer'] },
  { key: 'social', label: '社交与运营', types: ['featureNav', 'sectionNav', 'socialLinks', 'links', 'button', 'buttons', 'supporter', 'feedback'] },
  { key: 'base', label: '布局与基础', types: ['layout', 'heading', 'text', 'richText', 'alert', 'marquee', 'countdown', 'divider', 'spacer', 'footer'] },
] as const

function createBlockOption(item: (typeof BLOCK_LIBRARY)[number]): MenuOption {
  return {
    label: item.label,
    key: item.type,
    icon: item.icon ? () => h(NIcon, null, { default: () => h(item.icon) }) : undefined,
  }
}

function createGroupLabel(label: string, key: string): MenuOption {
  return {
    key: `divider:${key}`,
    label: () => h('div', { style: 'display:flex; align-items:center; gap: 10px; width: 100%;' }, [
      h('span', { style: 'font-size: 12px; font-weight: 700; color: var(--vtsuru-fg-muted);' }, label),
      h('div', { style: 'height: 1px; flex: 1; background: var(--vtsuru-border);' }),
    ]),
    disabled: true,
  }
}

export function useBlockManagerLibrary() {
  const editor = inject(UserPageEditorKey)
  if (!editor) throw new Error('UserPageEditor context is missing')
  const dialog = useDialog()
  const showAddMenu = ref(false)
  const blockSearch = ref('')
  const blockTypeSet = new Set<string>(BLOCK_LIBRARY.map(item => item.type))
  const personalTemplates = usePersistedStorage<PersonalBlockTemplate[]>(USER_PAGE_BLOCK_TEMPLATES_KEY, [])
  const templateOptions = computed(() => [
    ...blockTemplates.map(template => ({ label: template.label, key: template.key })),
    ...personalTemplates.value.map(template => ({ label: template.label, key: `personal:${template.id}` })),
  ])

  const filteredLibrary = computed(() => {
    const query = blockSearch.value.trim().toLocaleLowerCase()
    if (!query) return BLOCK_LIBRARY
    return BLOCK_LIBRARY.filter(item => [item.label, item.type, ...item.keywords]
      .some(term => term.toLocaleLowerCase().includes(query)))
  })

  const addBlockOptions = computed<MenuOption[]>(() => {
    const available = new Map(filteredLibrary.value.map(item => [item.type, item]))
    const options: MenuOption[] = []
    const used = new Set<BlockType>()

    for (const group of blockGroups) {
      const items = group.types.flatMap(type => {
        const item = available.get(type as BlockType)
        if (!item) return []
        used.add(item.type)
        return createBlockOption(item)
      })
      if (!items.length) continue
      options.push(createGroupLabel(group.label, group.key), ...items)
    }

    const rest = filteredLibrary.value
      .filter(item => !used.has(item.type))
      .toSorted((a, b) => a.label.localeCompare(b.label))
    if (rest.length) options.push(createGroupLabel('其他', 'rest'), ...rest.map(createBlockOption))
    return options
  })

  const moveTargets = computed<MenuOption[]>(() => {
    const layouts: MenuOption[] = []
    const visit = (blocks: BlockNode[]) => blocks.forEach((block) => {
      if (block.type !== 'layout') return
      layouts.push({ label: `移入 ${block.name?.trim() || '布局容器'}`, key: `move-to:${block.id}` })
      const props = block.props as { children?: BlockNode[] } | undefined
      if (Array.isArray(props?.children)) visit(props.children)
    })
    visit(editor.currentProject.value?.blocks ?? [])
    return [
      { label: '页面顶部', key: 'move-to:top' },
      { label: '页面底部', key: 'move-to:bottom' },
      ...layouts,
    ]
  })

  const blockActionOptions = computed<MenuOption[]>(() => [
    { label: '上移', key: 'move-up', icon: () => h(NIcon, null, { default: () => h(ArrowUpOutline) }) },
    { label: '下移', key: 'move-down', icon: () => h(NIcon, null, { default: () => h(ArrowDownOutline) }) },
    { label: '移动到', key: 'move-to', children: moveTargets.value, icon: () => h(NIcon, null, { default: () => h(LayersOutline) }) },
    { type: 'divider', key: 'movement-divider' },
    { label: '重命名', key: 'rename', icon: () => h(NIcon, null, { default: () => h(CreateOutline) }) },
    { label: '复制', key: 'copy', icon: () => h(NIcon, null, { default: () => h(CopyOutline) }) },
    { label: '粘贴到下方', key: 'paste-after', disabled: editor.getClipboardBlocksCount() === 0, icon: () => h(NIcon, null, { default: () => h(AddCircleOutline) }) },
    { type: 'divider', key: 'duplicate-divider' },
    { label: '在上方插入副本', key: 'dup-up', icon: () => h(NIcon, null, { default: () => h(AddCircleOutline) }) },
    { label: '在下方插入副本', key: 'dup-down', icon: () => h(NIcon, null, { default: () => h(AddCircleOutline) }) },
    { type: 'divider', key: 'layout-divider' },
    { label: '解散分组 - 仅布局', key: 'ungroup', icon: () => h(NIcon, null, { default: () => h(LayersOutline) }) },
    { type: 'divider', key: 'delete-divider' },
    { label: '删除区块', key: 'delete', icon: () => h(NIcon, null, { default: () => h(TrashOutline) }), props: { style: 'color: #d03050' } },
  ])

  function createTemplateNodes(key: string) {
    if (key.startsWith('personal:')) {
      const template = personalTemplates.value.find(item => item.id === key.slice(9))
      return template ? { label: template.label, nodes: template.blocks.map(cloneBlockNode) } : null
    }
    const template = blockTemplates.find(item => item.key === key)
    if (!template) return null
    const nodes = template.blocks.map(({ type, props }) => {
      const node = createBlockNode(type, createId())
      if (props) node.props = { ...node.props as Record<string, unknown>, ...props }
      return node
    })
    return { label: template.label, nodes }
  }

  function applyTemplate(key: string, replace: boolean) {
    const template = createTemplateNodes(key)
    const project = editor.currentProject.value
    if (!template || !project) return
    editor.batchHistory(() => {
      if (replace) project.blocks = template.nodes
      else project.blocks.push(...template.nodes)
      editor.selectedBlockIds.value = template.nodes.map(node => node.id)
    })
    editor.message.success(`${replace ? '已替换为' : '已追加'}“${template.label}”模板`)
  }

  function insertTemplate(key: string) {
    const project = editor.currentProject.value
    if (!project) return
    if (!project.blocks.length) {
      applyTemplate(key, false)
      return
    }
    dialog.warning({
      title: '应用起始模板',
      content: '当前页面已有区块，请选择追加模板内容或替换当前页面。',
      positiveText: '追加',
      negativeText: '替换',
      onPositiveClick: () => applyTemplate(key, false),
      onNegativeClick: () => applyTemplate(key, true),
    })
  }

  function handleAddBlockMenuSelect(key: string) {
    if (!blockTypeSet.has(key)) return
    showAddMenu.value = false
    const selected = editor.selectedBlock.value
    if (selected?.type !== 'layout') {
      editor.addBlock(key as BlockType)
      return
    }
    dialog.info({
      title: '添加到布局附近',
      content: '将新区块加入当前布局，或插入到布局下方。',
      positiveText: '加入布局',
      negativeText: '插到下方',
      onPositiveClick: () => editor.addBlock(key as BlockType, 'inside'),
      onNegativeClick: () => editor.addBlock(key as BlockType, 'after'),
    })
  }

  function saveSelectionAsTemplate() {
    const blocks = editor.selectedBlocks.value
    if (!blocks.length) return
    const firstName = blocks[0].name?.trim()
    personalTemplates.value.push({
      id: String(Date.now()),
      label: firstName || `个人模板 ${personalTemplates.value.length + 1}`,
      blocks: blocks.map(block => deepCloneJson(block)),
    })
    editor.message.success(`已保存 ${blocks.length} 个区块为个人模板`)
  }

  return {
    showAddMenu,
    blockSearch,
    templateOptions,
    addBlockOptions,
    blockActionOptions,
    insertTemplate,
    handleAddBlockMenuSelect,
    saveSelectionAsTemplate,
  }
}
