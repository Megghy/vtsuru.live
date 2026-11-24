<script setup lang="ts">
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  AlertCircle,
  AppWindow,
  ArrowUpRight,
  BookOpen,
  Code2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Home,
  Laptop,
  Layers,
  Mic,
  Monitor,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import ThemeToggleButton from '@/shared/components/ThemeToggleButton.vue'
import {
  CLIENT_GITHUB_RELEASES_URL,
  CLIENT_REPO_URL,
  CLIENT_WEB_LOGIC_URL,
  type ClientPlatform,
  type ClientReleaseAsset,
  type ClientReleaseManifest,
  detectClientEnvironment,
  detectClientEnvironmentSync,
  fetchClientRelease,
  formatFileSize,
  getArchLabel,
  getInstallerLabel,
  getPlatformLabel,
} from '@/shared/services/clientRelease'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { copyToClipboard } from '@/shared/utils'
import vtb from '@/svgs/ic_vtuber.svg'

const router = useRouter()

const initialEnv = detectClientEnvironmentSync()
const detectedEnv = ref(initialEnv)
const activePlatform = ref<ClientPlatform>(initialEnv.platform)

const manifest = ref<ClientReleaseManifest | null>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)

const previewTab = ref<'fetcher' | 'auto' | 'vts'>('fetcher')

const previewScreens = [
  {
    id: 'fetcher',
    label: 'EventFetcher 采集',
    src: '/docs-images/client-fetcher.png',
    caption: '支持开放平台 / 直接连接双模式，实时监控长连接心跳、采集统计与浮窗开关',
  },
  {
    id: 'auto',
    label: '自动操作与脚本',
    src: '/docs-images/client-auto-action.png',
    caption: '按弹幕、礼物、上舰事件触发模板或 JS 脚本，支持多账号池独立发送',
  },
  {
    id: 'vts',
    label: 'VTS / 本地联动',
    src: '/docs-images/client-vts.png',
    caption: '直连本机 VTube Studio 与 OBS WebSocket，低延迟响应直播间互动事件',
  },
] as const

const activePreview = computed(
  () => previewScreens.find((item) => item.id === previewTab.value) ?? previewScreens[0],
)

const capabilities = [
  {
    icon: Radio,
    title: '一键拿推流码开播',
    desc: '免开官方直播姬，直接在客户端修改标题、分区与封面并获取推流地址，配合干净的 OBS 开播。',
  },
  {
    icon: ShieldCheck,
    title: 'EventFetcher 稳定采集',
    desc: '独立本地进程持续维持直播间事件流，不受浏览器后台标签页休眠限制，实时同步礼物、SC 与舰长。',
  },
  {
    icon: AppWindow,
    title: '桌面置顶透明浮窗',
    desc: '提供透明弹幕窗与礼物/舰队排行窗，单显示器全屏游戏时无需切屏即可查看实时互动。',
  },
  {
    icon: Zap,
    title: '自动操作与 JS 脚本',
    desc: '内置事件触发管线，支持模板回复、定时播报、多 B 站辅助账号池自动答谢与自定义脚本。',
  },
  {
    icon: Cpu,
    title: 'OBS 与 VTube Studio 联动',
    desc: '通过本地 RPC 桥接本机 OBS WebSocket 与 VTS 模型热键，网页端场景编辑器也能直连本机设备。',
  },
  {
    icon: Mic,
    title: '本地语音同传与备份',
    desc: '支持本地实时语音识别字幕推送至 OBS 挂件，支持客户端配置脱敏备份导出与一键恢复。',
  },
]

const platformOrder: ClientPlatform[] = ['windows', 'macos', 'linux']

const assetsByPlatform = computed<Record<ClientPlatform, ClientReleaseAsset[]>>(() => {
  const grouped: Record<ClientPlatform, ClientReleaseAsset[]> = {
    windows: [],
    macos: [],
    linux: [],
  }
  for (const asset of manifest.value?.assets ?? []) {
    grouped[asset.platform]?.push(asset)
  }
  for (const p of platformOrder) {
    grouped[p].sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.name.localeCompare(b.name))
  }
  return grouped
})

const recommendedDownloads = computed<ClientReleaseAsset[]>(() => {
  const list = assetsByPlatform.value[detectedEnv.value.platform] ?? []
  if (list.length === 0) return []

  if (detectedEnv.value.platform === 'macos' && detectedEnv.value.isMacUncertainArch) {
    const dmgs = list.filter((item) => item.installerType === 'dmg')
    return dmgs.length > 0 ? dmgs : list.slice(0, 2)
  }

  const exact =
    list.find((item) => item.recommended && item.arch === detectedEnv.value.arch) ??
    list.find((item) => item.recommended) ??
    list[0]
  return exact ? [exact] : []
})

const formattedPublishedAt = computed(() => {
  const raw = manifest.value?.publishedAt
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return {
    full: format(d, 'yyyy-MM-dd HH:mm'),
    relative: formatDistanceToNow(d, { addSuffix: true, locale: zhCN }),
  }
})

const formattedSyncedAt = computed(() => {
  const raw = manifest.value?.syncedAt
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return formatDistanceToNow(d, { addSuffix: true, locale: zhCN })
})

async function loadRelease() {
  isLoading.value = true
  loadError.value = null
  try {
    manifest.value = await fetchClientRelease()
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载发行清单失败'
  } finally {
    isLoading.value = false
  }
}

function getPlatformIcon(platform: ClientPlatform) {
  switch (platform) {
    case 'windows':
      return Monitor
    case 'macos':
      return Laptop
    case 'linux':
      return Terminal
  }
}

onMounted(async () => {
  void loadRelease()
  const env = await detectClientEnvironment()
  detectedEnv.value = env
  activePlatform.value = env.platform
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground flex flex-col">
    <!-- 顶部导航栏 -->
    <header class="sticky top-0 z-40 h-13 border-b border-border bg-background/88 backdrop-blur-md">
      <div class="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div class="flex items-center gap-2 min-w-0">
          <RouterLink
            :to="{ name: 'index' }"
            class="inline-flex items-center gap-2 rounded-md px-1 py-0.5 hover:opacity-90 shrink-0"
          >
            <span class="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft ring-1 ring-brand/25">
              <vtb class="size-4" />
            </span>
            <span class="text-sm font-bold tracking-tight text-foreground whitespace-nowrap">VTSURU</span>
            <span class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Download class="size-3 shrink-0 text-brand" />
              <span>桌面客户端</span>
            </span>
          </RouterLink>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="xs"
            class="hidden sm:inline-flex gap-1 text-muted-foreground hover:text-foreground"
            @click="router.push({ name: 'index' })"
          >
            <Home class="size-3.5" />
            <span>首页</span>
          </Button>

          <Button
            variant="ghost"
            size="xs"
            class="gap-1 text-muted-foreground hover:text-foreground"
            @click="router.push({ name: 'docs-index' })"
          >
            <BookOpen class="size-3.5" />
            <span>使用文档</span>
          </Button>

          <ThemeToggleButton variant="ghost" />

          <Button
            size="xs"
            class="gap-1"
            @click="router.push({ name: 'manage-index' })"
          >
            <span>{{ isLoggedIn ? '进入工作台' : '登录后台' }}</span>
            <ArrowUpRight class="size-3.5" />
          </Button>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 space-y-8">
      <!-- 首屏主下载与实机预览区 -->
      <section class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
        <div class="lg:col-span-6 space-y-5">
          <div class="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              class="gap-1.5"
            >
              <Monitor class="size-3 text-brand" />
              <span>Tauri 轻量桌面端</span>
            </Badge>

            <Skeleton
              v-if="isLoading"
              class="h-5 w-24 rounded-full"
            />
            <Badge
              v-else-if="manifest"
              variant="outline"
              class="gap-1 font-mono tabular-nums"
            >
              <span>v{{ manifest.version }}</span>
              <span
                v-if="formattedPublishedAt"
                class="text-muted-foreground font-sans"
              >
                · {{ formattedPublishedAt.relative }}
              </span>
            </Badge>

            <Badge
              variant="outline"
              class="gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/8"
            >
              <Server class="size-3" />
              <span>国内节点高速直连</span>
            </Badge>
          </div>

          <div class="space-y-2.5">
            <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              VTsuru 桌面客户端
            </h1>
            <p class="text-sm leading-relaxed text-muted-foreground">
              面向 B 站主播的轻量本地客户端，整合 EventFetcher 弹幕与礼物稳定采集、一键获取推流码开播、透明桌面浮窗、自动操作脚本与本机 OBS / VTS 联动。
            </p>
          </div>

          <!-- 推荐下载操作区 -->
          <div
            v-if="isLoading"
            class="flex flex-wrap gap-2.5"
          >
            <Skeleton class="h-10 w-56 rounded-md" />
            <Skeleton class="h-10 w-36 rounded-md" />
          </div>

          <div
            v-else-if="recommendedDownloads.length > 0"
            class="space-y-2.5"
          >
            <div class="flex flex-wrap items-center gap-2.5">
              <Button
                v-for="(asset, idx) in recommendedDownloads"
                :key="asset.name"
                as="a"
                :href="asset.url"
                :variant="idx === 0 ? 'default' : 'outline'"
                size="lg"
                class="gap-2"
              >
                <Download class="size-4" />
                <span>
                  下载 {{ getPlatformLabel(asset.platform) }}
                  {{ asset.platform === 'macos' ? (asset.arch === 'arm64' ? '(Apple Silicon)' : '(Intel)') : '' }}
                </span>
                <span class="text-[11px] opacity-80 font-normal tabular-nums">
                  .{{ asset.installerType }} · {{ formatFileSize(asset.size) }}
                </span>
              </Button>
            </div>
            <p
              v-if="detectedEnv.platform === 'macos' && detectedEnv.isMacUncertainArch"
              class="text-[11px] text-muted-foreground"
            >
              M1 / M2 / M3 / M4 系列 Mac 请选 Apple Silicon，老款 Intel Mac 请选 Intel。
            </p>
          </div>

          <Alert
            v-else-if="loadError"
            variant="warning"
          >
            <AlertCircle class="size-4" />
            <AlertTitle>国内镜像清单暂时不可用（{{ loadError }}）</AlertTitle>
            <AlertDescription class="mt-1.5 flex flex-wrap items-center gap-2">
              <span>若服务器正在同步新版本，可先前往 GitHub Releases 下载或稍后重试。</span>
              <div class="flex items-center gap-2 mt-1">
                <Button
                  as="a"
                  :href="CLIENT_GITHUB_RELEASES_URL"
                  target="_blank"
                  rel="noreferrer"
                  size="xs"
                  class="gap-1.5"
                >
                  <ExternalLink class="size-3" />
                  <span>前往 GitHub Releases</span>
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  class="gap-1.5"
                  @click="loadRelease"
                >
                  <RefreshCw class="size-3" />
                  <span>重试加载</span>
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="outline"
              class="gap-1.5"
              @click="router.push({ name: 'docs-article', params: { slug: ['getting-started', 'client-guide'] } })"
            >
              <BookOpen class="size-3.5" />
              <span>使用与配置指南</span>
            </Button>
            <Button
              variant="outline"
              class="gap-1.5"
              @click="router.push({ name: 'client-index' })"
            >
              <Layers class="size-3.5" />
              <span>网页预览客户端界面</span>
            </Button>
            <Button
              as="a"
              :href="CLIENT_REPO_URL"
              target="_blank"
              rel="noreferrer"
              variant="ghost"
              class="gap-1.5 text-muted-foreground"
            >
              <Code2 class="size-3.5" />
              <span>GitHub 源码</span>
              <ExternalLink class="size-3 opacity-70" />
            </Button>
          </div>
        </div>

        <!-- 右侧实机截图切换 -->
        <div class="lg:col-span-6">
          <Card class="overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <div class="flex flex-wrap items-center gap-1">
                <Button
                  v-for="item in previewScreens"
                  :key="item.id"
                  size="xs"
                  :variant="previewTab === item.id ? 'secondary' : 'ghost'"
                  @click="previewTab = item.id"
                >
                  {{ item.label }}
                </Button>
              </div>
              <span class="text-[11px] text-muted-foreground">实机界面</span>
            </div>
            <div class="bg-inset p-2.5">
              <img
                :src="activePreview.src"
                :alt="activePreview.label"
                class="w-full rounded-md border border-border object-cover aspect-[16/10]"
                loading="lazy"
              />
            </div>
            <div class="border-t border-border px-3.5 py-2 text-[11px] text-muted-foreground">
              {{ activePreview.caption }}
            </div>
          </Card>
        </div>
      </section>

      <!-- 全平台安装包列表 -->
      <section class="space-y-3">
        <div class="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 class="text-base font-semibold text-foreground">全平台安装包</h2>
            <p class="text-xs text-muted-foreground mt-0.5">
              安装包由国内节点定时从 GitHub Release 同步校验，提供高速直连下载并保留 GitHub 原链对照。
            </p>
          </div>
          <div
            v-if="manifest"
            class="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums"
          >
            <span>当前版本 {{ manifest.tag }}</span>
            <span v-if="formattedSyncedAt">· 镜像同步于 {{ formattedSyncedAt }}</span>
          </div>
        </div>

        <Card>
          <CardHeader class="pb-3">
            <Tabs v-model="activePlatform">
              <TabsList>
                <TabsTrigger
                  v-for="platform in platformOrder"
                  :key="platform"
                  :value="platform"
                  class="gap-1.5"
                >
                  <component
                    :is="getPlatformIcon(platform)"
                    class="size-3.5"
                  />
                  <span>{{ getPlatformLabel(platform) }}</span>
                  <Badge
                    v-if="detectedEnv.platform === platform"
                    variant="secondary"
                    size="xs"
                  >
                    当前系统
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent
                v-for="platform in platformOrder"
                :key="platform"
                :value="platform"
                class="mt-4 space-y-2.5"
              >
                <div
                  v-if="isLoading"
                  class="space-y-2"
                >
                  <Skeleton class="h-14 w-full rounded-md" />
                  <Skeleton class="h-14 w-full rounded-md" />
                </div>

                <div
                  v-else-if="assetsByPlatform[platform].length === 0"
                  class="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground space-y-2"
                >
                  <p>暂无该平台的同步安装包，请前往 GitHub Releases 查看。</p>
                  <Button
                    as="a"
                    :href="CLIENT_GITHUB_RELEASES_URL"
                    target="_blank"
                    rel="noreferrer"
                    variant="outline"
                    size="xs"
                    class="gap-1.5"
                  >
                    <ExternalLink class="size-3" />
                    <span>打开 GitHub Releases</span>
                  </Button>
                </div>

                <div
                  v-else
                  class="divide-y divide-border rounded-md border border-border"
                >
                  <div
                    v-for="asset in assetsByPlatform[platform]"
                    :key="asset.name"
                    class="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div class="min-w-0 space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs font-semibold text-foreground">
                          {{ getInstallerLabel(asset) }}
                        </span>
                        <Badge
                          v-if="asset.recommended"
                          variant="secondary"
                          size="xs"
                        >
                          推荐
                        </Badge>
                        <Badge
                          variant="outline"
                          size="xs"
                        >
                          {{ getArchLabel(asset.arch) }}
                        </Badge>
                      </div>

                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span class="font-mono truncate max-w-full">{{ asset.name }}</span>
                        <span class="tabular-nums">{{ formatFileSize(asset.size) }}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <button
                                type="button"
                                class="inline-flex items-center gap-1 font-mono hover:text-foreground transition-colors"
                                @click="copyToClipboard(asset.sha256, '已复制 SHA-256 校验值')"
                              >
                                <Copy class="size-3" />
                                <span>SHA256: {{ asset.sha256.slice(0, 12) }}...</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent class="font-mono text-[11px]">
                              点击复制完整 SHA-256：{{ asset.sha256 }}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                      <Button
                        as="a"
                        :href="asset.url"
                        :variant="asset.recommended ? 'default' : 'outline'"
                        class="gap-1.5"
                      >
                        <Download class="size-3.5" />
                        <span>国内直连下载</span>
                      </Button>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              as="a"
                              :href="asset.githubUrl"
                              target="_blank"
                              rel="noreferrer"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="通过 GitHub 原链下载"
                            >
                              <ExternalLink class="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>GitHub 原链下载</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardHeader>

          <CardContent
            v-if="manifest"
            class="pt-0 space-y-3"
          >
            <div
              v-if="manifest.notes"
              class="rounded-md bg-muted/50 border border-border p-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed"
            >
              {{ manifest.notes }}
            </div>

            <Separator />

            <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>客户端内置自动更新（基于 Tauri Updater）</span>
                <span v-if="formattedPublishedAt">· 发布于 {{ formattedPublishedAt.full }}</span>
              </div>
              <div class="flex items-center gap-3">
                <a
                  :href="manifest.releaseUrl || CLIENT_GITHUB_RELEASES_URL"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <span>GitHub Release</span>
                  <ExternalLink class="size-3" />
                </a>
                <a
                  :href="CLIENT_WEB_LOGIC_URL"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <span>前端逻辑源码</span>
                  <ExternalLink class="size-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <!-- 核心能力介绍 -->
      <section class="space-y-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">为什么推荐搭配桌面客户端使用</h2>
          <p class="text-xs text-muted-foreground mt-0.5">
            网页端覆盖日常配置与 OBS 挂件，桌面端负责稳定的事件采集、推流与本地软件控制。
          </p>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card
            v-for="item in capabilities"
            :key="item.title"
          >
            <CardHeader class="pb-2">
              <CardTitle class="flex items-center gap-2 text-xs font-semibold">
                <span class="flex size-7 items-center justify-center rounded-md bg-brand-soft text-brand shrink-0">
                  <component
                    :is="item.icon"
                    class="size-4"
                  />
                </span>
                <span>{{ item.title }}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription class="text-xs leading-relaxed">
                {{ item.desc }}
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      <!-- 快速上手引导 -->
      <Card>
        <CardContent class="p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="space-y-1">
            <div class="text-xs font-semibold text-foreground">
              首次安装上手顺序
            </div>
            <p class="text-xs text-muted-foreground leading-relaxed">
              1. 安装并启动客户端并登录你的 VTsuru 账号 → 2. 在「账号与凭据」绑定 B 站 Cookie → 3. 开启 EventFetcher 采集或桌面透明浮窗。
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              class="gap-1.5"
              @click="router.push({ name: 'docs-article', params: { slug: ['getting-started', 'client-guide'] } })"
            >
              <BookOpen class="size-3.5" />
              <span>客户端指南</span>
            </Button>
            <Button
              variant="outline"
              class="gap-1.5"
              @click="router.push({ name: 'docs-article', params: { slug: ['client', 'auto-action'] } })"
            >
              <Zap class="size-3.5" />
              <span>自动操作文档</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  </div>
</template>
