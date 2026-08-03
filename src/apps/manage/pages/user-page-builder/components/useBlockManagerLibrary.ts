import { computed, inject, ref } from 'vue'

import { BLOCK_LIBRARY, createBlockNode } from '@/apps/user-page/block/registry'
import type { BlockNode, BlockType } from '@/apps/user-page/block/schema'
import { usePersistedStorage } from '@/shared/storage/persist'

import { UserPageEditorKey } from '../context'
import { cloneBlockNode, createId, deepCloneJson } from '../editorHelpers'
import { USER_PAGE_BLOCK_TEMPLATES_KEY } from '../storageKeys'

interface BlockTemplate {
  key: string
  label: string
  blocks: Array<{ type: BlockType; props?: Record<string, unknown> }>
}

interface PersonalBlockTemplate {
  id: string
  label: string
  blocks: BlockNode[]
}

export interface BuilderMenuItem {
  label?: string
  key?: string
  type?: 'label' | 'separator' | 'link'
  icon?: string
  disabled?: boolean
  children?: BuilderMenuItem[]
  onSelect?: (event: Event) => void
  class?: string
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
  {
    key: 'live',
    label: '直播与日程',
    types: [
      'liveStatus',
      'streamSchedule',
      'songList',
      'nowPlaying',
      'checkInRanking',
      'featuredGoods',
      'videoCollect',
    ],
  },
  { key: 'profile', label: '资料与品牌', types: ['profile', 'biliInfo', 'tags', 'milestone', 'faq', 'quote'] },
  {
    key: 'content',
    label: '内容与媒体',
    types: ['cardList', 'videoList', 'embed', 'image', 'imageGallery', 'musicPlayer'],
  },
  {
    key: 'social',
    label: '社交与运营',
    types: ['featureNav', 'sectionNav', 'socialLinks', 'links', 'button', 'buttons', 'supporter', 'feedback'],
  },
  {
    key: 'base',
    label: '布局与基础',
    types: ['layout', 'heading', 'text', 'richText', 'alert', 'marquee', 'countdown', 'divider', 'spacer', 'footer'],
  },
] as const

function createBlockOption(item: (typeof BLOCK_LIBRARY)[number]): BuilderMenuItem {
  return {
    label: item.label,
    key: item.type,
  }
}

function createGroupLabel(label: string, key: string): BuilderMenuItem {
  return {
    key: `divider:${key}`,
    label,
    disabled: true,
    type: 'label',
  }
}

export function useBlockManagerLibrary() {
  const editor = inject(UserPageEditorKey)
  if (!editor) throw new Error('UserPageEditor context is missing')
  const showAddMenu = ref(false)
  const blockSearch = ref('')
  const blockTypeSet = new Set<string>(BLOCK_LIBRARY.map((item) => item.type))
  const personalTemplates = usePersistedStorage<PersonalBlockTemplate[]>(USER_PAGE_BLOCK_TEMPLATES_KEY, [])
  const templateOptions = computed(() => [
    ...blockTemplates.map((template) => ({
      label: template.label,
      key: template.key,
      onSelect: () => insertTemplate(template.key),
    })),
    ...personalTemplates.value.map((template) => ({
      label: template.label,
      key: `personal:${template.id}`,
      onSelect: () => insertTemplate(`personal:${template.id}`),
    })),
  ])

  const filteredLibrary = computed(() => {
    const query = blockSearch.value.trim().toLocaleLowerCase()
    if (!query) return BLOCK_LIBRARY
    return BLOCK_LIBRARY.filter((item) =>
      [item.label, item.type, ...item.keywords].some((term) => term.toLocaleLowerCase().includes(query)),
    )
  })

  const addBlockOptions = computed<BuilderMenuItem[]>(() => {
    const available = new Map(filteredLibrary.value.map((item) => [item.type, item]))
    const options: BuilderMenuItem[] = []
    const used = new Set<BlockType>()

    for (const group of blockGroups) {
      const items = group.types.flatMap((type) => {
        const item = available.get(type as BlockType)
        if (!item) return []
        used.add(item.type)
        return createBlockOption(item)
      })
      if (!items.length) continue
      options.push(createGroupLabel(group.label, group.key), ...items)
    }

    const rest = filteredLibrary.value
      .filter((item) => !used.has(item.type))
      .toSorted((a, b) => a.label.localeCompare(b.label))
    if (rest.length) options.push(createGroupLabel('其他', 'rest'), ...rest.map(createBlockOption))
    return options.map((item) =>
      item.key && blockTypeSet.has(item.key) ? { ...item, onSelect: () => handleAddBlockMenuSelect(item.key!) } : item,
    )
  })

  const moveTargets = computed<BuilderMenuItem[]>(() => {
    const layouts: BuilderMenuItem[] = []
    const visit = (blocks: BlockNode[]) =>
      blocks.forEach((block) => {
        if (block.type !== 'layout') return
        layouts.push({ label: `移入 ${block.name?.trim() || '布局容器'}`, key: `move-to:${block.id}` })
        const props = block.props as { children?: BlockNode[] } | undefined
        if (Array.isArray(props?.children)) visit(props.children)
      })
    visit(editor.currentProject.value?.blocks ?? [])
    return [{ label: '页面顶部', key: 'move-to:top' }, { label: '页面底部', key: 'move-to:bottom' }, ...layouts]
  })

  const blockActionOptions = computed<BuilderMenuItem[]>(() => [
    { label: '上移', key: 'move-up', icon: 'i-lucide-arrow-up' },
    { label: '下移', key: 'move-down', icon: 'i-lucide-arrow-down' },
    {
      label: '移动到',
      key: 'move-to',
      children: moveTargets.value,
      icon: 'i-lucide-layers',
    },
    { type: 'separator', key: 'movement-divider' },
    { label: '重命名', key: 'rename', icon: 'i-lucide-square-pen' },
    { label: '复制', key: 'copy', icon: 'i-lucide-copy' },
    {
      label: '粘贴到下方',
      key: 'paste-after',
      disabled: editor.getClipboardBlocksCount() === 0,
      icon: 'i-lucide-plus',
    },
    { type: 'separator', key: 'duplicate-divider' },
    { label: '在上方插入副本', key: 'dup-up', icon: 'i-lucide-plus' },
    { label: '在下方插入副本', key: 'dup-down', icon: 'i-lucide-plus' },
    { type: 'separator', key: 'layout-divider' },
    { label: '解散分组 - 仅布局', key: 'ungroup', icon: 'i-lucide-layers' },
    { type: 'separator', key: 'delete-divider' },
    {
      label: '删除区块',
      key: 'delete',
      icon: 'i-lucide-trash-2',
      class: 'text-red-500',
    },
  ])

  function createTemplateNodes(key: string) {
    if (key.startsWith('personal:')) {
      const template = personalTemplates.value.find((item) => item.id === key.slice(9))
      return template ? { label: template.label, nodes: template.blocks.map(cloneBlockNode) } : null
    }
    const template = blockTemplates.find((item) => item.key === key)
    if (!template) return null
    const nodes = template.blocks.map(({ type, props }) => {
      const node = createBlockNode(type, createId())
      if (props) node.props = { ...(node.props as Record<string, unknown>), ...props }
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
      editor.selectedBlockIds.value = template.nodes.map((node) => node.id)
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
    if (window.confirm('当前页面已有区块，确定追加模板内容吗？取消将替换当前页面。')) applyTemplate(key, false)
    else applyTemplate(key, true)
  }

  function handleAddBlockMenuSelect(key: string) {
    if (!blockTypeSet.has(key)) return
    showAddMenu.value = false
    const selected = editor.selectedBlock.value
    if (selected?.type !== 'layout') {
      editor.addBlock(key as BlockType)
      return
    }
    if (window.confirm('将新区块加入当前布局吗？取消将插入到布局下方。')) editor.addBlock(key as BlockType, 'inside')
    else editor.addBlock(key as BlockType, 'after')
  }

  function saveSelectionAsTemplate() {
    const blocks = editor.selectedBlocks.value
    if (!blocks.length) return
    const firstName = blocks[0].name?.trim()
    personalTemplates.value.push({
      id: String(Date.now()),
      label: firstName || `个人模板 ${personalTemplates.value.length + 1}`,
      blocks: blocks.map((block) => deepCloneJson(block)),
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
