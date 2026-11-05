<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  ArrowDownload20Regular,
  ArrowSync20Regular,
  Checkmark16Regular,
  Open20Regular,
  PeopleCommunity20Regular,
  PersonAdd24Regular,
  Search24Regular,
  Stop20Regular,
} from '@vicons/fluent'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import {
  batchFetchFollowerStats,
  fetchFollowersList,
  followBiliUser,
  getFansViewerCache,
  saveFansViewerCache,
  type BiliFollowerItem,
} from '../api/fans-viewer'

const accountStore = useAccount()
const biliCookieStore = useBiliCookie()

const followers = ref<BiliFollowerItem[]>([])
const totalFollowers = ref(0)
const currentPage = ref(1)
const hasMore = ref(true)
const isLoading = ref(false)
const isLoadingMore = ref(false)
const isFetchingAll = ref(false)
let abortFetchAll = false
const progressText = ref('')
const cacheUpdatedAt = ref<number>(0)

// 搜索与过滤
const searchQuery = ref('')
const filterType = ref<'all' | 'unreciprocated' | 'mutual'>('all')
const minFansThreshold = ref<number>(0)
const sortBy = ref<'fans_desc' | 'time_desc'>('fans_desc')

const filterOptions = [
  { label: '全部关注', value: 'all' },
  { label: '仅看未回关', value: 'unreciprocated' },
  { label: '互相关注', value: 'mutual' },
]

const thresholdOptions = [
  { label: '全部门槛', value: 0 },
  { label: '1,000+', value: 1000 },
  { label: '1万+ 大V', value: 10000 },
  { label: '10万+ 头部', value: 100000 },
]

const sortOptions = [
  { label: '粉丝数 (多到少)', value: 'fans_desc' },
  { label: '关注时间 (新到旧)', value: 'time_desc' },
]

function getVmid(): number {
  return accountStore.value?.biliId || biliCookieStore.uId || 0
}

async function loadData(page = 1, append = false) {
  const vmid = getVmid()
  if (!vmid) {
    toast.error('未获取到主播 UID，请先绑定或登录 B 站账号')
    return
  }

  if (append) {
    isLoadingMore.value = true
  } else {
    isLoading.value = true
    currentPage.value = 1
  }

  try {
    // 采用允许的最大单页 ps=50，减少网络往返与接口调用次数
    const res = await fetchFollowersList(vmid, page, 50)
    totalFollowers.value = res.total

    if (append) {
      followers.value.push(...res.list)
    } else {
      followers.value = res.list
    }

    hasMore.value = followers.value.length < res.total && res.list.length >= 50
    currentPage.value = page

    // 增量合并持久化缓存
    if (vmid) {
      void saveFansViewerCache(vmid, followers.value, totalFollowers.value)
      cacheUpdatedAt.value = Date.now()
    }

    // 触发后台轻量并发队列拉取粉丝量
    void runStatFetch()
  } catch (err) {
    toast.error(`加载粉丝列表失败: ${String(err)}`)
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

async function runStatFetch() {
  const unpopulated = followers.value.filter((item) => !item.statLoaded)
  if (unpopulated.length === 0) {
    progressText.value = ''
    return
  }

  progressText.value = `解析粉丝量中 (0/${followers.value.length})...`
  await batchFetchFollowerStats(followers.value, (done, total) => {
    progressText.value = done === total ? '' : `解析粉丝量中 (${done}/${total})...`
  })

  // 统计拉取完成后持久化落盘，避免下次重复查询
  const vmid = getVmid()
  if (vmid) {
    void saveFansViewerCache(vmid, followers.value, totalFollowers.value)
  }
}

async function handleLoadMore() {
  if (isLoadingMore.value || !hasMore.value || isFetchingAll.value) return
  await loadData(currentPage.value + 1, true)
}

/**
 * 一键获取完全部粉丝 (受 B 站接口限制最多前 1,000 位)
 */
async function handleFetchAll() {
  if (isFetchingAll.value) {
    abortFetchAll = true
    isFetchingAll.value = false
    progressText.value = '已终止一键获取'
    return
  }

  const vmid = getVmid()
  if (!vmid) {
    toast.error('未获取到主播 UID，请先绑定或登录 B 站账号')
    return
  }

  isFetchingAll.value = true
  abortFetchAll = false
  progressText.value = '准备一键获取全部粉丝 (上限 1,000 人)...'

  try {
    // B站开放接口上限：单页50条，最多允许翻到第20页 (20 * 50 = 1000条)
    const MAX_PAGES = 20
    const PAGE_SIZE = 50
    const existingMap = new Map(followers.value.map((item) => [item.mid, item]))

    for (let p = 1; p <= MAX_PAGES; p++) {
      if (abortFetchAll) break

      progressText.value = `正在拉取第 ${p}/${MAX_PAGES} 页 (已获取 ${existingMap.size} 人)...`
      const res = await fetchFollowersList(vmid, p, PAGE_SIZE)
      totalFollowers.value = res.total

      for (const item of res.list) {
        const old = existingMap.get(item.mid)
        if (old?.statLoaded) {
          item.followerCount = old.followerCount
          item.followingCount = old.followingCount
          item.statLoaded = true
        }
        existingMap.set(item.mid, item)
      }

      followers.value = Array.from(existingMap.values())
      currentPage.value = p
      hasMore.value = followers.value.length < res.total && res.list.length >= PAGE_SIZE

      // 实时保存到持久化缓存
      void saveFansViewerCache(vmid, followers.value, totalFollowers.value)
      cacheUpdatedAt.value = Date.now()

      // 若当前页返回条数不足 PAGE_SIZE，说明已拉取完全部粉丝
      if (res.list.length < PAGE_SIZE) {
        break
      }

      // 翻页安全延时 300ms，平滑限速防风控
      await new Promise((r) => setTimeout(r, 300))
    }

    if (abortFetchAll) {
      toast.info(`已停止获取，当前已保留 ${followers.value.length} 位粉丝`)
    } else {
      toast.success(`前 ${followers.value.length} 位粉丝获取完毕，正在后台解析粉丝量`)
    }

    // 后台轻量限流并发解析粉丝数量
    void runStatFetch()
  } catch (err) {
    toast.error(`一键获取失败: ${String(err)}`)
  } finally {
    isFetchingAll.value = false
  }
}

async function handleFollow(item: BiliFollowerItem) {
  if (item.isFollowingAction) return
  item.isFollowingAction = true

  try {
    await followBiliUser(item.mid)
    // 成功回关：对方之前已关注我，因此双方变为互相关注 (6)
    item.attribute = 6
    toast.success(`已成功回关 [${item.uname}]`)
  } catch (err) {
    toast.error(`回关失败: ${String(err)}`)
  } finally {
    item.isFollowingAction = false
  }
}

function openSpace(mid: number) {
  void openUrl(`https://space.bilibili.com/${mid}`)
}

function formatFans(num?: number): string {
  if (num === undefined) return '获取中...'
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}亿`
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`
  return num.toLocaleString()
}

function formatTime(sec: number): string {
  if (!sec) return ''
  const d = new Date(sec * 1000)
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const DEFAULT_AVATAR = 'https://i0.hdslb.com/bfs/face/member/noface.jpg'

function formatAvatarUrl(url?: string): string {
  if (!url) return DEFAULT_AVATAR
  let res = url.replace(/^http:\/\//i, 'https://')
  if (res.startsWith('//')) {
    res = `https:${res}`
  }
  if (res.includes('.hdslb.com') && !res.includes('@')) {
    res += '@96w_96h_1c.webp'
  }
  return res
}

function handleAvatarError(e: Event) {
  const target = e.target as HTMLImageElement | null
  if (target && target.src !== DEFAULT_AVATAR) {
    target.src = DEFAULT_AVATAR
  }
}

const filteredFollowers = computed(() => {
  let list = followers.value.slice()

  // 搜索关键字
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((item) => item.uname.toLowerCase().includes(q) || String(item.mid).includes(q))
  }

  // 关系过滤
  if (filterType.value === 'unreciprocated') {
    list = list.filter((item) => item.attribute === 0)
  } else if (filterType.value === 'mutual') {
    list = list.filter((item) => item.attribute === 6)
  }

  // 粉丝门槛过滤
  if (minFansThreshold.value > 0) {
    list = list.filter((item) => (item.followerCount || 0) >= minFansThreshold.value)
  }

  // 排序
  if (sortBy.value === 'fans_desc') {
    list.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0))
  } else if (sortBy.value === 'time_desc') {
    list.sort((a, b) => b.mtime - a.mtime)
  }

  return list
})

const unreciprocatedCount = computed(() => {
  return followers.value.filter((item) => item.attribute === 0).length
})

onMounted(async () => {
  const vmid = getVmid()
  if (vmid) {
    // 优先读取本地持久化缓存，秒开呈现已排序好的粉丝列表
    const cached = await getFansViewerCache(vmid)
    if (cached && cached.list.length > 0) {
      followers.value = cached.list
      totalFollowers.value = cached.total
      cacheUpdatedAt.value = cached.updatedAt
      hasMore.value = followers.value.length < cached.total
      // 若缓存中仍有未解析粉丝数的条目，静默增量拉取
      const hasUnpopulated = cached.list.some((i) => !i.statLoaded)
      if (hasUnpopulated) {
        void runStatFetch()
      }
      return
    }
  }

  void loadData(1, false)
})
</script>

<template>
  <div class="h-full flex flex-col p-4 space-y-3 overflow-hidden">
    <!-- 顶部标题与总体统计 -->
    <div class="flex flex-col gap-1.5 flex-shrink-0">
      <div class="flex-between gap-3">
        <div class="flex flex-wrap items-center gap-2 min-w-0">
          <h2 class="text-base font-semibold tracking-tight text-foreground">粉丝查看</h2>
          <Badge
            v-if="totalFollowers > 0"
            variant="secondary"
            class="px-1.5 py-0 text-[11px]"
          >
            共 {{ totalFollowers.toLocaleString() }} 粉丝
          </Badge>
          <Badge
            variant="outline"
            class="px-1.5 py-0 text-[10px] text-muted-foreground border-border/70"
          >
            接口上限前 1,000 人
          </Badge>
          <span
            v-if="cacheUpdatedAt > 0"
            class="text-[11px] text-muted-foreground"
          >
            · 上次更新: {{ formatTime(Math.floor(cacheUpdatedAt / 1000)) }}
          </span>
          <span
            v-if="progressText"
            class="text-xs text-primary font-medium animate-pulse"
          >
            {{ progressText }}
          </span>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <Button
            :variant="isFetchingAll ? 'destructive' : 'default'"
            :disabled="isLoading"
            class="gap-1.5 shadow-sm"
            @click="handleFetchAll"
          >
            <Stop20Regular
              v-if="isFetchingAll"
              class="size-3.5"
            />
            <ArrowDownload20Regular
              v-else
              class="size-3.5"
            />
            <span>{{ isFetchingAll ? '终止获取' : '一键获取全部' }}</span>
          </Button>

          <Button
            variant="outline"
            :disabled="isLoading || isFetchingAll"
            class="gap-1.5"
            @click="loadData(1, false)"
          >
            <ArrowSync20Regular
              class="size-3.5"
              :class="{ 'animate-spin': isLoading }"
            />
            <span>刷新最新</span>
          </Button>
        </div>
      </div>

      <p class="text-xs text-muted-foreground leading-normal">
        按粉丝体量洞察关注你的粉丝与大V同行，快速发现未回关用户并一键互关（受 B 站官方接口限制，最多仅可获取最新 1,000 位粉丝）
      </p>
    </div>

    <!-- 筛选、搜索与排序工具栏 -->
    <Card class="flex-shrink-0 border-border/60 shadow-none">
      <CardContent class="p-3 space-y-2.5">
        <div class="flex flex-wrap items-center gap-2.5">
          <!-- 搜索输入 -->
          <div class="relative flex-1 min-w-[200px] max-w-sm">
            <Search24Regular class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="搜索粉丝昵称或 UID..."
              class="pl-8"
            />
          </div>

          <!-- 关系过滤 -->
          <ToggleGroup
            type="single"
            :model-value="filterType"
            @update:model-value="(val) => { if (val) filterType = val as any }"
          >
            <ToggleGroupItem
              v-for="opt in filterOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
              <span
                v-if="opt.value === 'unreciprocated' && unreciprocatedCount > 0"
                class="ml-1 text-[10px] text-amber-500 font-bold"
              >
                ({{ unreciprocatedCount }})
              </span>
            </ToggleGroupItem>
          </ToggleGroup>

          <!-- 粉丝量级门槛 -->
          <ToggleGroup
            type="single"
            :model-value="minFansThreshold"
            @update:model-value="(val) => { if (val !== undefined && val !== null) minFansThreshold = Number(val) }"
          >
            <ToggleGroupItem
              v-for="opt in thresholdOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </ToggleGroupItem>
          </ToggleGroup>

          <!-- 排序 -->
          <div class="ml-auto flex items-center gap-1.5">
            <span class="text-xs text-muted-foreground">排序:</span>
            <ToggleGroup
              type="single"
              :model-value="sortBy"
              @update:model-value="(val) => { if (val) sortBy = val as any }"
            >
              <ToggleGroupItem
                v-for="opt in sortOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 列表展示区 -->
    <div class="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-0.5">
      <!-- 加载中空态 -->
      <div
        v-if="isLoading"
        class="h-64 flex-col-center gap-2 text-muted-foreground"
      >
        <ArrowSync20Regular class="size-6 animate-spin text-primary" />
        <span class="text-xs">正在拉取粉丝列表...</span>
      </div>

      <!-- 空结果提示 -->
      <div
        v-else-if="filteredFollowers.length === 0"
        class="h-64 flex-col-center gap-2 text-muted-foreground"
      >
        <PeopleCommunity20Regular class="size-8 opacity-40" />
        <span class="text-xs">暂无匹配的粉丝记录</span>
      </div>

      <!-- 粉丝卡片条目 -->
      <div
        v-for="item in filteredFollowers"
        :key="item.mid"
        class="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/40 transition-colors gap-3"
      >
        <!-- 左侧: 头像与用户信息 -->
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <img
            :src="formatAvatarUrl(item.face)"
            referrerpolicy="no-referrer"
            loading="lazy"
            class="size-10 rounded-full object-cover flex-shrink-0 bg-muted"
            alt=""
            @error="handleAvatarError"
          />
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="font-medium text-xs text-foreground truncate max-w-[200px]">
                {{ item.uname }}
              </span>
              <!-- 自身粉丝数徽章 (视觉分级: 10w+ 金橙, 1w+ 蓝标, 普通 灰色) -->
              <Badge
                v-if="item.statLoaded && (item.followerCount || 0) >= 100000"
                variant="outline"
                class="px-1.5 py-0 text-[10px] font-semibold border-amber-500/40 bg-amber-500/10 text-amber-500"
              >
                {{ formatFans(item.followerCount) }} 粉丝
              </Badge>
              <Badge
                v-else-if="item.statLoaded && (item.followerCount || 0) >= 10000"
                variant="outline"
                class="px-1.5 py-0 text-[10px] font-medium border-sky-500/40 bg-sky-500/10 text-sky-400"
              >
                {{ formatFans(item.followerCount) }} 粉丝
              </Badge>
              <Badge
                v-else-if="item.statLoaded"
                variant="outline"
                class="px-1.5 py-0 text-[10px] text-muted-foreground border-border/40"
              >
                {{ formatFans(item.followerCount) }} 粉丝
              </Badge>
              <span
                v-else
                class="text-[10px] text-muted-foreground/60 animate-pulse"
              >
                解析中...
              </span>

              <!-- 互相关注 / 已关注 标记 -->
              <span
                v-if="item.attribute === 6"
                class="text-[10px] text-emerald-400 font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20"
              >
                互相关注
              </span>
              <span
                v-else-if="item.attribute === 2"
                class="text-[10px] text-primary font-medium px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20"
              >
                已关注
              </span>
            </div>

            <!-- 签名 / 个人简介 -->
            <p class="text-[11px] text-muted-foreground truncate">
              {{ item.sign || '这个人很神秘，什么都没写' }}
            </p>

            <!-- 关注时间 -->
            <span class="text-[10px] text-muted-foreground/60 block">
              关注于 {{ formatTime(item.mtime) }}
            </span>
          </div>
        </div>

        <!-- 右侧操作栏 -->
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <!-- 回关按钮 (当且仅当未关注时显示) -->
          <Button
            v-if="item.attribute === 0"
            variant="default"
            class="gap-1 active:scale-[0.98]"
            :disabled="item.isFollowingAction"
            @click="handleFollow(item)"
          >
            <PersonAdd24Regular class="size-3.5" />
            <span>{{ item.isFollowingAction ? '回关中...' : '回关' }}</span>
          </Button>
          <div
            v-else
            class="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1"
          >
            <Checkmark16Regular class="size-3.5 text-emerald-400" />
            <span>已在关注列表</span>
          </div>

          <!-- 打开空间主页 -->
          <Button
            variant="ghost"
            class="text-muted-foreground hover:text-foreground"
            title="在浏览器中查看个人主页"
            @click="openSpace(item.mid)"
          >
            <Open20Regular class="size-3.5" />
          </Button>
        </div>
      </div>

      <!-- 加载更多按钮 (每次拉取单页上限 50 条) -->
      <div
        v-if="hasMore"
        class="pt-2 pb-4 flex-center"
      >
        <Button
          variant="outline"
          class="gap-1.5 w-48"
          :disabled="isLoadingMore"
          @click="handleLoadMore"
        >
          <ArrowSync20Regular
            v-if="isLoadingMore"
            class="size-3.5 animate-spin"
          />
          <span>{{ isLoadingMore ? '正在加载...' : '加载下一批 (50人)' }}</span>
        </Button>
      </div>
      <div
        v-else-if="followers.length > 0 && !isLoading"
        class="py-4 text-center text-xs text-muted-foreground/50"
      >
        已加载全部已关注粉丝 (共 {{ followers.length }} 人)
      </div>
    </div>
  </div>
</template>
