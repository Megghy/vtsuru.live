import type { MenuOption } from 'naive-ui'
import type { BlockType } from '@/apps/user-page/block/schema'
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
import { NIcon } from 'naive-ui'
import { computed, h, inject, ref } from 'vue'
import { UserPageEditorKey } from '../context'
import { createId } from '../editorHelpers'

interface BlockTemplate {
  key: string
  label: string
  blocks: Array<{ type: BlockType, props?: Record<string, unknown> }>
}

const blockTemplates: BlockTemplate[] = [
  {
    key: 'live-home',
    label: '直播主页',
    blocks: [
      { type: 'profile' },
      { type: 'liveStatus' },
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
  { key: 'live', label: '直播与日程', types: ['liveStatus', 'streamSchedule'] },
  { key: 'profile', label: '资料与品牌', types: ['profile', 'biliInfo', 'tags', 'milestone', 'faq', 'quote'] },
  { key: 'content', label: '内容与媒体', types: ['videoList', 'embed', 'image', 'imageGallery', 'musicPlayer'] },
  { key: 'social', label: '社交与运营', types: ['socialLinks', 'links', 'button', 'buttons', 'supporter', 'feedback'] },
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

  const showAddMenu = ref(false)
  const blockSearch = ref('')
  const blockTypeSet = new Set<string>(BLOCK_LIBRARY.map(item => item.type))
  const templateOptions = blockTemplates.map(template => ({ label: template.label, key: template.key }))

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

  const blockActionOptions = computed<MenuOption[]>(() => [
    { label: '上移', key: 'move-up', icon: () => h(NIcon, null, { default: () => h(ArrowUpOutline) }) },
    { label: '下移', key: 'move-down', icon: () => h(NIcon, null, { default: () => h(ArrowDownOutline) }) },
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

  function insertTemplate(key: string) {
    const template = blockTemplates.find(item => item.key === key)
    const project = editor.currentProject.value
    if (!template || !project) return
    const nodes = template.blocks.map(({ type, props }) => {
      const node = createBlockNode(type, createId())
      if (props) node.props = { ...node.props as Record<string, unknown>, ...props }
      return node
    })
    editor.batchHistory(() => {
      project.blocks.push(...nodes)
      editor.selectedBlockIds.value = nodes.map(node => node.id)
    })
    editor.message.success(`已插入“${template.label}”模板`)
  }

  function handleAddBlockMenuSelect(key: string) {
    if (!blockTypeSet.has(key)) return
    editor.addBlock(key as BlockType)
    showAddMenu.value = false
  }

  return {
    showAddMenu,
    blockSearch,
    templateOptions,
    addBlockOptions,
    blockActionOptions,
    insertTemplate,
    handleAddBlockMenuSelect,
  }
}
