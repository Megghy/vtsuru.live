<script setup lang="ts">
import {
  Add24Regular,
  Checkmark12Regular,
  Color24Regular,
  Copy24Regular,
  Desktop24Regular,
  Eye24Regular,
  Flash24Regular,
  History24Regular,
  PeopleQueue24Filled,
  PeopleQueue24Regular,
  PersonAdd24Regular,
  Search24Regular,
  Settings24Regular,
  ShieldCheckmark24Regular,
} from '@vicons/fluent'
import { isSameDay } from 'date-fns'
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { OpenLiveInfo, ResponseQueueModel } from '@/api/api-models'
import { FunctionTypes, QueueFrom, QueueStatus } from '@/api/api-models'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import QueueOBS from '@/apps/obs/pages/QueueOBS.vue'
import QueueItem from '@/apps/open-live/components/queue/QueueItem.vue'
import QueueSettingsTab from '@/apps/open-live/components/queue/QueueSettingsTab.vue'
import { getQueueSourceText, useQueue } from '@/composables/useQueue'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useMessage } from '@/shared/utils'
import { copyToClipboard } from '@/shared/utils'
import { formatListForCopy } from '@/shared/utils/queue'
import { useDanmakuClient } from '@/store/useDanmakuClient'

defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

const message = useMessage()
const accountInfo = useAccount()
const client = await useDanmakuClient().initOpenlive()
const store = useQueue()

// 主 Tab
const activeMainTab = ref<'queue' | 'preview' | 'settings'>('queue')

// OBS 调试与样式参数
const obsStyleType = ref<'glass' | 'transparent' | 'classic' | 'fresh' | 'minimal'>('glass')
const obsScrollSpeed = ref(1.0)
const previewBg = ref<'checker' | 'dark' | 'light' | 'game'>('checker')

// 计算完整的 OBS 链接
const obsUrl = computed(() => {
  const params: Record<string, string> = {
    style: obsStyleType.value,
  }
  if (obsScrollSpeed.value !== 1.0) {
    params.speed = obsScrollSpeed.value.toString()
  }
  return buildObsSourceUrl({
    path: 'obs/queue',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
    params,
  })
})

const todayFinishedCount = computed(
  () =>
    store.historySongs.filter((s) => s.status === QueueStatus.Finish && isSameDay(s.finishAt ?? 0, Date.now())).length,
)
const waitingCount = computed(() => store.queue.filter((s) => s.status === QueueStatus.Waiting).length)

function copyQueueList() {
  const text = formatListForCopy(store.queue, (q) => q.user?.name ?? '未知用户')
  if (!text) {
    message.warning('当前队列为空')
    return
  }
  copyToClipboard(text)
  message.success('排队名单已复制到剪贴板')
}

async function copyObsLink() {
  if (!obsUrl.value) {
    message.warning('尚未登录或未生成有效链接')
    return
  }
  await copyToClipboard(obsUrl.value)
  message.success('OBS 源链接已复制 (已携带当前调试样式参数)')
}

// 模拟加人与测试
const sampleNames = ['小鱼干爱好者', '星尘远航者', '魔法少女喵', '橘子汽水', '秋风扫落叶', '可乐要加冰', '月下漫步']
function injectMockUser() {
  const name = sampleNames[Math.floor(Math.random() * sampleNames.length)]
  store.newQueueName = `${name} #${Math.floor(Math.random() * 100)}`
  store.addManual()
  message.success(`已添加模拟观众「${store.newQueueName}」`)
  store.newQueueName = ''
}

// 历史分页状态
const historyPage = ref(1)
const historyPageSize = 8
const totalHistoryPages = computed(() => Math.ceil(store.historySongs.length / historyPageSize) || 1)
const paginatedHistory = computed(() => {
  const start = (historyPage.value - 1) * historyPageSize
  return store.historySongs.slice(start, start + historyPageSize)
})

function formatTime(timestamp?: number) {
  if (!timestamp) return '-'
  const ts = typeof timestamp === 'number' && timestamp < 1e12 ? timestamp * 1000 : timestamp
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function getFromBadgeVariant(from: QueueFrom) {
  switch (from) {
    case QueueFrom.Danmaku:
      return 'brand' as const
    case QueueFrom.Gift:
      return 'destructive' as const
    case QueueFrom.Web:
      return 'success' as const
    default:
      return 'outline' as const
  }
}

onMounted(() => {
  if (accountInfo.value?.id) {
    store.settings = accountInfo.value.settings.queue
  }
  client.onEvent('danmaku', store.onGetDanmaku)
  client.onEvent('gift', store.onGetGift)
})

onActivated(async () => {
  await store.init()
})

onDeactivated(() => {
  store.dispose()
})

onUnmounted(() => {
  client.offEvent('danmaku', store.onGetDanmaku)
  client.offEvent('gift', store.onGetGift)
  store.dispose()
})
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="弹幕排队系统"
      subtitle="观众通过发送指定弹幕或赠送礼物加入等待队列，支持多策略排序、过滤合并与 1080P OBS 动态呈现"
      :function-type="FunctionTypes.Queue"
      :links="[
        {
          label: 'OBS 浏览器源地址',
          value: obsUrl,
          description: '将此链接作为 OBS 浏览器源添加，建议分辨率 400x600 或按需调整',
        },
      ]"
    >
      <template #action>
        <Button
          size="xs"
          variant="outline"
          @click="copyQueueList"
        >
          <component
            :is="Copy24Regular"
            class="h-3.5 w-3.5 mr-1"
          />
          复制队列名单
        </Button>
      </template>
    </ManagePageHeader>

    <Tabs
      v-model="activeMainTab"
      class="w-full"
    >
      <TabsList class="grid w-full grid-cols-3 max-w-md p-0.5 bg-muted">
        <TabsTrigger
          value="queue"
          class="text-xs h-7 gap-1"
        >
          <component
            :is="PeopleQueue24Regular"
            class="h-3.5 w-3.5"
          />
          当前排队队列
        </TabsTrigger>
        <TabsTrigger
          value="preview"
          class="text-xs h-7 gap-1"
        >
          <component
            :is="Desktop24Regular"
            class="h-3.5 w-3.5"
          />
          OBS 舞台预览
        </TabsTrigger>
        <TabsTrigger
          value="settings"
          class="text-xs h-7 gap-1"
        >
          <component
            :is="Settings24Regular"
            class="h-3.5 w-3.5"
          />
          规则设置与历史
        </TabsTrigger>
      </TabsList>

      <!-- Tab 1: 当前队列 -->
      <TabsContent
        value="queue"
        class="mt-3 space-y-3"
      >
        <Card>
          <CardContent class="p-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <Badge
                variant="brand"
                class="text-xs gap-1"
              >
                <component
                  :is="PeopleQueue24Filled"
                  class="h-3.5 w-3.5"
                />
                等待中: {{ waitingCount }} 人
              </Badge>
              <Badge
                variant="success"
                class="text-xs gap-1"
              >
                <component
                  :is="Checkmark12Regular"
                  class="h-3.5 w-3.5"
                />
                今日已完成: {{ todayFinishedCount }} 人
              </Badge>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <div class="relative w-44">
                <component
                  :is="Search24Regular"
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                />
                <Input
                  v-model="store.activeFilterName"
                  placeholder="搜索队列用户"
                  class="pl-8 w-44"
                />
              </div>

              <div class="flex items-center gap-1.5">
                <Input
                  v-model="store.newQueueName"
                  placeholder="手动输入用户名"
                  class="w-40"
                  @keyup.enter="store.addManual"
                />
                <Button
                  variant="default"
                  @click="store.addManual"
                >
                  <component
                    :is="Add24Regular"
                    class="h-3.5 w-3.5 mr-1"
                  />
                  添加
                </Button>
              </div>

              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button
                    variant="ghost"
                    class="text-destructive hover:bg-destructive/10"
                    :disabled="store.queue.length === 0"
                  >
                    清空当前
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent class="sm:max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>清空排队队列？</AlertDialogTitle>
                    <AlertDialogDescription class="text-xs">
                      确定要清空全部当前正在等待中的排队记录吗？
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      @click="store.deleteQueue(store.queue)"
                    >
                      确认清空
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="p-3">
            <div
              v-if="store.queue.length > 0"
              class="space-y-2"
            >
              <QueueItem
                v-for="(queueData, index) in store.queue"
                :key="queueData.id"
                :queue-data="queueData"
                :index="index + 1"
              />
            </div>
            <div
              v-else
              class="text-center py-12 text-xs text-muted-foreground"
            >
              当前排队队列为空，等待观众发送弹幕或送礼加入
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- Tab 2: OBS 舞台预览 -->
      <TabsContent
        value="preview"
        class="mt-3"
      >
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <!-- 舞台视口 (8 列) -->
          <Card class="lg:col-span-8 flex flex-col">
            <CardHeader class="p-3.5 pb-2">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-2">
                  <component
                    :is="Eye24Regular"
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <CardTitle class="text-xs font-semibold"> OBS 画布实时预览 (1080P 比例视口) </CardTitle>
                </div>

                <div class="flex items-center gap-1 bg-muted p-0.5 rounded-md">
                  <Button
                    v-for="bg in [
                      { key: 'checker', label: '网格' },
                      { key: 'dark', label: '纯黑' },
                      { key: 'light', label: '浅色' },
                      { key: 'game', label: '模拟游戏' },
                    ]"
                    :key="bg.key"
                    size="xs"
                    :variant="previewBg === bg.key ? 'default' : 'ghost'"
                    class="h-6 px-2"
                    @click="previewBg = bg.key as any"
                  >
                    {{ bg.label }}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent class="p-4 flex-1 flex flex-col justify-between space-y-4">
              <div
                class="rounded-lg border border-border p-6 flex items-center justify-center min-h-[460px] transition-colors"
                :class="{
                  'bg-[#121214]': previewBg === 'dark',
                  'bg-[#f4f4f5]': previewBg === 'light',
                  'bg-[#0b132b]': previewBg === 'game',
                  'bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]':
                    previewBg === 'checker',
                }"
              >
                <div class="w-[380px] max-w-full">
                  <QueueOBS
                    :id="accountInfo?.id"
                    :key="`${accountInfo?.id}-${obsStyleType}-${obsScrollSpeed}`"
                    :style="obsStyleType"
                    :speed-multiplier="obsScrollSpeed"
                  />
                </div>
              </div>

              <div class="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-border/60">
                <span class="text-xs text-muted-foreground"
                  >推荐 OBS 来源尺寸：宽 360px ~ 420px，高 540px ~ 680px。</span
                >
                <Button
                  size="xs"
                  variant="brand"
                  @click="copyObsLink"
                >
                  <component
                    :is="Copy24Regular"
                    class="h-3.5 w-3.5 mr-1"
                  />
                  复制当前样式 OBS 链接
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- 样式与仿真控制器 (4 列) -->
          <div class="lg:col-span-4 space-y-4">
            <!-- 样式预设 -->
            <Card>
              <CardHeader class="p-3.5 pb-2">
                <div class="flex items-center gap-2">
                  <component
                    :is="Color24Regular"
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <CardTitle class="text-xs font-semibold uppercase tracking-wide"> OBS 视觉预设 </CardTitle>
                </div>
              </CardHeader>

              <CardContent class="p-3.5 space-y-3.5">
                <div class="grid grid-cols-1 gap-1.5">
                  <Button
                    v-for="st in [
                      { key: 'glass', label: '毛玻璃质感 (Modern Glass)' },
                      { key: 'transparent', label: '纯透明无底壳 (Transparent)' },
                      { key: 'minimal', label: '极简通透流 (Minimal Text)' },
                      { key: 'classic', label: '经典卡片 (Classic Dark)' },
                      { key: 'fresh', label: '清新自然 (Fresh Light)' },
                    ]"
                    :key="st.key"
                    :variant="obsStyleType === st.key ? 'default' : 'outline'"
                    class="w-full justify-start font-normal"
                    @click="obsStyleType = st.key as any"
                  >
                    {{ st.label }}
                  </Button>
                </div>

                <Separator />

                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs text-muted-foreground">滚动轮播速度</span>
                  <div class="flex items-center gap-1.5">
                    <Input
                      size="xs"
                      v-model.number="obsScrollSpeed"
                      type="number"
                      step="0.2"
                      min="0.5"
                      max="3"
                      class="w-20 font-mono"
                    />
                    <span class="text-xs text-muted-foreground">x</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <!-- 仿真调试工具 -->
            <Card>
              <CardHeader class="p-3.5 pb-2">
                <div class="flex items-center gap-2">
                  <component
                    :is="Flash24Regular"
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <CardTitle class="text-xs font-semibold uppercase tracking-wide"> 舞台仿真调试 </CardTitle>
                </div>
              </CardHeader>
              <CardContent class="p-3.5 space-y-2">
                <Button
                  variant="outline"
                  class="w-full justify-center"
                  @click="injectMockUser"
                >
                  <component
                    :is="PersonAdd24Regular"
                    class="h-3.5 w-3.5 mr-1"
                  />
                  注入测试观众 (+1)
                </Button>

                <Button
                  v-if="store.queue.length > 0"
                  size="sm"
                  variant="brand"
                  class="w-full justify-center text-xs"
                  @click="store.updateStatus(store.queue[0], QueueStatus.Finish)"
                >
                  <component
                    :is="Checkmark12Regular"
                    class="h-3.5 w-3.5 mr-1"
                  />
                  完成当前首位观众
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      <!-- Tab 3: 规则设置与历史 -->
      <TabsContent
        value="settings"
        class="mt-3"
      >
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <!-- 历史处理记录 (7 列) -->
          <div class="lg:col-span-7">
            <Card>
              <CardHeader class="p-3.5 pb-2 flex-row items-center justify-between">
                <div class="flex items-center gap-2">
                  <component
                    :is="History24Regular"
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <CardTitle class="text-xs font-semibold uppercase tracking-wide"> 历史处理记录 </CardTitle>
                </div>
                <span class="text-xs text-muted-foreground">共 {{ store.historySongs.length }} 条</span>
              </CardHeader>

              <CardContent class="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead class="text-xs"> 用户名 </TableHead>
                      <TableHead class="text-xs w-28"> 来源 </TableHead>
                      <TableHead class="text-xs w-36"> 加入时间 </TableHead>
                      <TableHead class="text-xs w-28 text-right"> 操作 </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <template v-if="paginatedHistory.length > 0">
                      <TableRow
                        v-for="item in paginatedHistory"
                        :key="item.id"
                        class="text-xs"
                      >
                        <TableCell class="font-medium">
                          {{ item.user?.name || '未知用户' }}
                        </TableCell>
                        <TableCell>
                          <Badge
                            :variant="getFromBadgeVariant(item.from)"
                            class="text-[10px] px-1.5 py-0 h-4"
                          >
                            {{ getQueueSourceText(item) }}
                          </Badge>
                        </TableCell>
                        <TableCell class="font-mono text-muted-foreground text-[11px]">
                          {{ formatTime(item.createAt) }}
                        </TableCell>
                        <TableCell class="text-right space-x-1">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            class="text-primary hover:bg-primary/10"
                            title="重置为等待状态"
                            @click="store.updateStatus(item, QueueStatus.Waiting)"
                          >
                            重置
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            class="text-destructive hover:bg-destructive/10"
                            title="删除"
                            @click="store.deleteQueue([item])"
                          >
                            删除
                          </Button>
                        </TableCell>
                      </TableRow>
                    </template>
                    <TableEmpty
                      v-else
                      :colspan="4"
                      class="text-xs text-muted-foreground py-8 text-center"
                    >
                      暂无历史排队记录
                    </TableEmpty>
                  </TableBody>
                </Table>

                <!-- 分页 -->
                <div
                  v-if="totalHistoryPages > 1"
                  class="flex items-center justify-between p-3 border-t border-border"
                >
                  <span class="text-xs text-muted-foreground">页码 {{ historyPage }} / {{ totalHistoryPages }}</span>
                  <div class="flex items-center gap-1">
                    <Button
                      size="xs"
                      variant="outline"
                      :disabled="historyPage <= 1"
                      @click="historyPage--"
                    >
                      上一页
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      :disabled="historyPage >= totalHistoryPages"
                      @click="historyPage++"
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- 规则配置 (5 列) -->
          <div class="lg:col-span-5">
            <Card>
              <CardHeader class="p-3.5 pb-2">
                <div class="flex items-center gap-2">
                  <component
                    :is="ShieldCheckmark24Regular"
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <CardTitle class="text-xs font-semibold uppercase tracking-wide"> 触发条件与防刷规则 </CardTitle>
                </div>
              </CardHeader>
              <CardContent class="p-3.5">
                <QueueSettingsTab
                  :is-loading="store.isLoading"
                  :settings="accountInfo.settings.queue"
                  @change="store.saveSettings"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
