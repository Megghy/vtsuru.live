<script setup lang="ts">
import { AppWindow, Compass, CornerDownLeft, Monitor, Palette, Search, Sparkles, Wrench } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import { useAssistantStore } from '@/apps/assistant/store/useAssistantStore'
import { obsComponentList } from '@/apps/obs-store/registry'
import { useCommandPalette } from '@/shared/composables/useCommandPalette'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { cycleThemeType, getThemeTypeLabel, themeType } from '@/shared/utils'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

type CommandItem = {
  id: string
  group: string
  label: string
  description?: string
  keywords: string[]
  icon: any
  shortcut?: string
  run: () => void | Promise<void>
}

const router = useRouter()
const route = useRoute()
const accountInfo = useAccount()
const assistant = useAssistantStore()
const { open, togglePalette, closePalette } = useCommandPalette()

const query = ref('')
const activeIndex = ref(0)
const inputWrapperRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const isInClient = computed(() => route.path.startsWith('/client'))
const isInOpenLive = computed(() => route.path.startsWith('/open-live'))
const isInManage = computed(() => route.path.startsWith('/manage'))

function goRoute(name: string, params?: Record<string, string>, queryParams?: Record<string, string>) {
  void router.push({ name, params, query: queryParams })
}

const allItems = computed<CommandItem[]>(() => {
  const items: CommandItem[] = []
  const nextTheme = cycleThemeType(themeType.value)

  // 1. 快捷操作
  items.push({
    id: 'action-theme',
    group: '快捷操作',
    label: `切换主题（当前：${getThemeTypeLabel(themeType.value)}）`,
    description: `切换为${getThemeTypeLabel(nextTheme)}`,
    keywords: ['theme', 'dark', 'light', 'auto', '主题', '暗色', '浅色', '深色'],
    icon: Palette,
    run: () => {
      themeType.value = cycleThemeType(themeType.value)
    },
  })

  if (isInManage.value) {
    items.push({
      id: 'action-assistant',
      group: '快捷操作',
      label: '打开 VTsuru 助手',
      description: '针对当前页面提问或执行辅助操作',
      keywords: ['assistant', 'ai', 'bot', '助手'],
      icon: Sparkles,
      run: () => {
        assistant.open({
          routeName: route.name?.toString() ?? '',
          title: (route.meta?.title as string) ?? '管理后台',
          path: route.path,
        })
      },
    })
  }

  if (accountInfo.value?.id > 0 && accountInfo.value?.name) {
    items.push({
      id: 'action-public-page',
      group: '快捷操作',
      label: `打开我的公开展示页 (@${accountInfo.value.name})`,
      description: '预览观众看到的主播主页与各模块',
      keywords: ['home', 'public', 'user', '展示页', '主页', accountInfo.value.name],
      icon: Compass,
      run: () => goRoute('user-index', { id: accountInfo.value.name }),
    })
  }

  // 2. 管理后台与直播互动
  const manageEntries: { name: string; label: string; desc?: string; kw: string[] }[] = [
    { name: 'manage-index', label: '管理面板', desc: '账号状态、Token 与功能开关', kw: ['dashboard', 'panel', '面板'] },
    {
      name: 'manage-userPageBuilder',
      label: '主页装修',
      desc: '积木化页面编排与自定义代码',
      kw: ['builder', 'page', '装修', '积木'],
    },
    { name: 'manage-liveQueue', label: '排队管理', desc: '弹幕排队与队列 OBS 源', kw: ['queue', '排队'] },
    { name: 'manage-musicRequest', label: '点歌机', desc: '曲库管理与网页音乐播放', kw: ['music', 'song', '点歌机'] },
    { name: 'manage-liveRequest', label: '弹幕点播', desc: '点播队列与点歌记录', kw: ['request', '点播'] },
    {
      name: 'manage-danmuji',
      label: '弹幕机',
      desc: 'OBS 弹幕姬样式与规则编辑',
      kw: ['danmuji', '弹幕机', 'blivechat'],
    },
    { name: 'manage-liveLottery', label: '弹幕抽奖', desc: '直播间关键词/条件弹幕抽奖', kw: ['lottery', '抽奖'] },
    { name: 'manage-danmakuVote', label: '弹幕投票', desc: '直播间实时弹幕投票统计', kw: ['vote', '投票'] },
    { name: 'manage-speech', label: '读弹幕', desc: '语音播报与 TTS 配置', kw: ['speech', 'tts', '读弹幕'] },
    { name: 'manage-songList', label: '歌单管理', desc: '维护与批量编辑主播歌单', kw: ['songlist', '歌单'] },
    { name: 'manage-schedule', label: '日程管理', desc: '周日程表与 B 站直播预约同步', kw: ['schedule', '日程'] },
    { name: 'manage-questionBox', label: '提问箱', desc: '收到的匿名提问与展示管理', kw: ['qa', 'question', '提问箱'] },
    {
      name: 'manage-point',
      label: '积分与商城',
      desc: '观众积分规则、兑换商品与订单核销',
      kw: ['point', 'goods', '积分', '商城'],
    },
    {
      name: 'manage-event',
      label: '舰长与 SC 记录',
      desc: '历史大航海与醒目留言流水',
      kw: ['event', 'guard', 'sc', '舰长'],
    },
    { name: 'manage-live', label: '直播记录', desc: '场次统计与语音转写字幕查看', kw: ['live', 'record', '直播记录'] },
    {
      name: 'manage-history',
      label: '历史趋势',
      desc: '粉丝与舰长增长趋势图表',
      kw: ['history', 'chart', '历史', '趋势'],
    },
    { name: 'manage-analyze', label: '直播数据分析', desc: '直播互动与收益分析', kw: ['analyze', '数据分析'] },
    {
      name: 'manage-videoCollect',
      label: '视频征集',
      desc: '观众投稿视频征集活动',
      kw: ['video', 'collect', '视频征集'],
    },
    { name: 'manage-lottery', label: '动态抽奖', desc: 'B 站动态转发/评论抽奖', kw: ['dynamic', '动态抽奖'] },
    { name: 'manage-forum', label: '粉丝讨论区', desc: '讨论区帖子与版务管理', kw: ['forum', '讨论区'] },
    { name: 'manage-obsStore', label: 'OBS 组件库', desc: '纯前端轻量 OBS 挂件生态', kw: ['obs', 'store', '组件库'] },
    { name: 'manage-qqBot', label: 'QQ 群机器人', desc: '开播通知与群指令绑定', kw: ['qq', 'bot', '机器人'] },
    { name: 'manage-feedback', label: '反馈工单', desc: '问题反馈与进度追踪', kw: ['feedback', '工单'] },
    {
      name: 'live-dashboard',
      label: '直播中控台',
      desc: '全屏多栏实时弹幕/礼物/投票中控',
      kw: ['live-dashboard', '中控台'],
    },
  ]

  for (const entry of manageEntries) {
    items.push({
      id: `manage-${entry.name}`,
      group: '管理后台',
      label: entry.label,
      description: entry.desc,
      keywords: [entry.label, ...entry.kw],
      icon: Compass,
      run: () => goRoute(entry.name),
    })
  }

  // 3. OBS 组件库直达
  for (const comp of obsComponentList) {
    if (comp.status === 'planned') continue
    items.push({
      id: `obs-${comp.id}`,
      group: 'OBS 组件库',
      label: comp.name,
      description: comp.shortDescription,
      keywords: [comp.id, comp.name, ...comp.tags],
      icon: Monitor,
      run: () => goRoute('manage-obsStore', undefined, { component: comp.id }),
    })
  }

  // 4. 直播工具箱 (11 个本地/浏览器工具)
  const toolScopePrefix = isInOpenLive.value ? 'open-live-tool-' : null
  const toolEntries: { path: string; manageName: string; label: string; kw: string[] }[] = [
    {
      path: 'dynamic-nine-grid',
      manageName: 'ManageToolDynamicNineGrid',
      label: '动态九图生成器',
      kw: ['nine', 'grid', '九图'],
    },
    { path: 'image-stitch', manageName: 'ManageToolImageStitch', label: '图片拼接', kw: ['stitch', '拼图'] },
    {
      path: 'media-convert',
      manageName: 'ManageToolMediaConvert',
      label: '音视频转换/压缩',
      kw: ['ffmpeg', 'media', '转换', '压缩'],
    },
    { path: 'cover-maker', manageName: 'ManageToolCoverMaker', label: '直播封面生成器', kw: ['cover', '封面'] },
    { path: 'text-to-image', manageName: 'ManageToolTextToImage', label: '文字转图片', kw: ['text', 'image', '长图'] },
    { path: 'sticker-maker', manageName: 'ManageToolStickerMaker', label: '表情包制作', kw: ['sticker', '表情包'] },
    { path: 'image-compress', manageName: 'ManageToolImageCompress', label: '图片压缩', kw: ['compress', '压缩'] },
    { path: 'qrcode', manageName: 'ManageToolQrcode', label: '二维码生成', kw: ['qr', 'qrcode', '二维码'] },
    { path: 'remove-bg', manageName: 'tools-remove-bg', label: 'AI 去背景', kw: ['remove-bg', '抠图', '去背景'] },
    { path: 'ocr', manageName: 'ManageToolOcr', label: '文字识别 (OCR)', kw: ['ocr', '识字'] },
    { path: 'translate', manageName: 'ManageToolTranslate', label: '翻译工具', kw: ['translate', '翻译'] },
  ]
  for (const tool of toolEntries) {
    items.push({
      id: `tool-${tool.path}`,
      group: '直播工具箱',
      label: tool.label,
      description: '纯浏览器本地处理',
      keywords: ['tool', '工具', tool.label, ...tool.kw],
      icon: Wrench,
      run: () => goRoute(toolScopePrefix ? `${toolScopePrefix}${tool.path}` : tool.manageName),
    })
  }

  // 5. 客户端工作台
  const clientEntries: { name: string; label: string; kw: string[] }[] = [
    { name: 'client-index', label: '客户端首页', kw: ['client', '客户端'] },
    { name: 'client-fetcher', label: 'EventFetcher 采集端', kw: ['fetcher', '采集'] },
    { name: 'client-account-manage', label: '客户端账号与凭据', kw: ['cookie', 'account', '凭据'] },
    { name: 'client-live-manage', label: '客户端直播管理', kw: ['live', '开播'] },
    { name: 'client-live-dashboard', label: '客户端中控台', kw: ['dashboard', '中控台'] },
    { name: 'client-auto-action-manage', label: '自动操作与签到', kw: ['auto', '签到', '自动'] },
    { name: 'client-vts', label: 'VTubeStudio 控制', kw: ['vts', 'vtubestudio'] },
    { name: 'client-read-danmaku', label: '客户端读弹幕', kw: ['tts', '读弹幕'] },
    { name: 'client-transcription', label: '实时语音转写', kw: ['asr', 'transcription', '字幕', '转写'] },
    { name: 'client-fans-viewer', label: '粉丝查看', kw: ['fans', '粉丝'] },
    { name: 'client-settings', label: '客户端设置', kw: ['settings', '设置'] },
  ]
  for (const c of clientEntries) {
    items.push({
      id: `client-${c.name}`,
      group: isInClient.value ? '客户端功能' : '桌面客户端',
      label: c.label,
      keywords: ['client', '客户端', c.label, ...c.kw],
      icon: AppWindow,
      run: () => goRoute(c.name),
    })
  }

  return items
})

const filteredItems = computed(() => {
  const raw = query.value.trim().toLowerCase()
  if (!raw) return allItems.value
  const tokens = raw.split(/\s+/).filter(Boolean)
  return allItems.value.filter((item) => {
    const haystack = `${item.group} ${item.label} ${item.description ?? ''} ${item.keywords.join(' ')}`.toLowerCase()
    return tokens.every((t) => haystack.includes(t))
  })
})

const groupedItems = computed(() => {
  const groups: { name: string; items: { item: CommandItem; flatIndex: number }[] }[] = []
  const map = new Map<string, { item: CommandItem; flatIndex: number }[]>()
  filteredItems.value.forEach((item, flatIndex) => {
    let list = map.get(item.group)
    if (!list) {
      list = []
      map.set(item.group, list)
      groups.push({ name: item.group, items: list })
    }
    list.push({ item, flatIndex })
  })
  return groups
})

watch(filteredItems, () => {
  activeIndex.value = 0
})

watch(open, async (val) => {
  if (!val) {
    query.value = ''
    activeIndex.value = 0
    return
  }
  await nextTick()
  const el = inputWrapperRef.value?.querySelector('input')
  el?.focus()
})

function executeItem(item: CommandItem | undefined) {
  if (!item) return
  closePalette()
  void item.run()
}

function scrollActiveIntoView() {
  void nextTick(() => {
    const el = listRef.value?.querySelector(`[data-cmd-index="${activeIndex.value}"]`)
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
}

function handlePaletteKeydown(event: KeyboardEvent) {
  const total = filteredItems.value.length
  if (total === 0) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % total
    scrollActiveIntoView()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + total) % total
    scrollActiveIntoView()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    executeItem(filteredItems.value[activeIndex.value])
  }
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    togglePalette()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="p-0 gap-0 overflow-hidden sm:max-w-lg [&>button]:hidden"
      @keydown="handlePaletteKeydown"
    >
      <DialogTitle class="sr-only">全局命令面板</DialogTitle>
      <DialogDescription class="sr-only">搜索并快速跳转到功能页面、工具箱或执行快捷操作</DialogDescription>

      <div
        ref="inputWrapperRef"
        class="flex items-center gap-2 border-b border-border px-3 py-2"
      >
        <Search class="size-4 text-muted-foreground shrink-0" />
        <Input
          v-model="query"
          size="default"
          placeholder="搜索页面、OBS 组件、工具箱或操作..."
          class="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <kbd
          class="pointer-events-none inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
        >
          Esc
        </kbd>
      </div>

      <div
        ref="listRef"
        class="max-h-[min(60vh,420px)] overflow-y-auto p-1.5 scrollbar-thin"
      >
        <div
          v-if="groupedItems.length === 0"
          class="py-10 text-center text-xs text-muted-foreground"
        >
          未找到匹配的命令或页面
        </div>

        <template
          v-for="group in groupedItems"
          :key="group.name"
        >
          <div class="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">
            {{ group.name }}
          </div>
          <Button
            v-for="{ item, flatIndex } in group.items"
            :key="item.id"
            :data-cmd-index="flatIndex"
            variant="ghost"
            class="flex w-full h-auto justify-start items-center gap-2.5 rounded-md px-2.5 py-2 text-left font-normal"
            :class="flatIndex === activeIndex ? 'bg-accent text-accent-foreground' : ''"
            @mouseenter="activeIndex = flatIndex"
            @click="executeItem(item)"
          >
            <component
              :is="item.icon"
              class="size-4 shrink-0 text-muted-foreground"
            />
            <div class="min-w-0 flex-1">
              <div class="font-medium truncate">{{ item.label }}</div>
              <div
                v-if="item.description"
                class="text-[11px] text-muted-foreground truncate"
              >
                {{ item.description }}
              </div>
            </div>
            <CornerDownLeft
              v-if="flatIndex === activeIndex"
              class="size-3.5 shrink-0 text-muted-foreground"
            />
          </Button>
        </template>
      </div>

      <div class="flex-between border-t border-border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span>↑↓ 选择 · Enter 确认</span>
        <span>Ctrl+K 呼出</span>
      </div>
    </DialogContent>
  </Dialog>
</template>
