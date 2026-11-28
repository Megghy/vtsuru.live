<script setup lang="ts">
import {
  AlertTriangle,
  ArrowRightLeft,
  Award,
  CheckCircle2,
  Mail,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Square,
  Trash2,
  UploadCloud,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { syncFanMedalsToProfiles } from '@/api/bili-extra'
import {
  type AnchorGuardMemberItem,
  type FansMedalMemberItem,
  fetchAnchorGuardExpireList,
  fetchFansMedalMemberList,
} from '@/apps/client/api/bili-guard-fans'
import { useBatchPrivateMessageQueue } from '@/apps/client/store/useBatchPrivateMessageQueue'
import GuardReconcilePanel from './GuardReconcilePanel.vue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { Spin } from '@/shared/ui/spin'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'

const account = useAccount()
const pmQueue = useBatchPrivateMessageQueue()
const roomId = computed(() => account.value?.biliRoomId ?? 0)
const subTab = ref('guard')

// 在舰到期
const loadingGuard = ref(false)
const guards = ref<AnchorGuardMemberItem[]>([])
const guardTotal = ref(0)
const expiringSoonDays = ref(7)

const expiringSoonGuards = computed(() =>
  guards.value.filter((g) => g.daysLeft !== null && g.daysLeft >= 0 && g.daysLeft <= expiringSoonDays.value),
)

// 粉丝团
const loadingMedals = ref(false)
const syncingMedals = ref(false)
const medals = ref<FansMedalMemberItem[]>([])
const medalTotal = ref(0)

// 批量导入 UID
const manualUidInput = ref('')

function guardLevelLabel(level: number) {
  if (level === 1) return '总督'
  if (level === 2) return '提督'
  if (level === 3) return '舰长'
  return ''
}

async function loadGuards() {
  if (!roomId.value) return
  loadingGuard.value = true
  try {
    const res = await fetchAnchorGuardExpireList(roomId.value, 1, 50)
    guards.value = res.items.toSorted((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
    guardTotal.value = res.total
  } catch (err) {
    toast.error('拉取大航海列表失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    loadingGuard.value = false
  }
}

async function loadMedals() {
  loadingMedals.value = true
  try {
    const all: FansMedalMemberItem[] = []
    let page = 1
    let hasMore = true
    let total = 0
    while (hasMore && page <= 10) {
      const res = await fetchFansMedalMemberList(page, 30)
      all.push(...res.items)
      total = res.total
      hasMore = res.hasMore
      page++
    }
    medals.value = all
    medalTotal.value = total
  } catch (err) {
    toast.error('拉取粉丝团列表失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    loadingMedals.value = false
  }
}

async function handleSyncMedalsToProfiles() {
  if (medals.value.length === 0) return
  syncingMedals.value = true
  try {
    const res = await syncFanMedalsToProfiles(
      medals.value.map((m) => ({
        uid: m.uid,
        uname: m.uname,
        medalLevel: m.medalLevel,
        intimacy: m.intimacy,
        guardLevel: m.guardLevel,
        isLighted: m.isLighted,
      })),
    )
    toast.success(`已同步粉丝团至粉丝档案（新增 ${res.created} / 更新 ${res.updated}）`)
  } catch (err) {
    toast.error('同步至粉丝档案失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    syncingMedals.value = false
  }
}

function enqueueExpiringGuards() {
  const targets = expiringSoonGuards.value.length > 0 ? expiringSoonGuards.value : guards.value
  const added = pmQueue.addRecipients(
    targets.map((g) => ({
      uid: g.uid,
      uname: g.uname,
      extra: g.daysLeft !== null ? `你的${guardLevelLabel(g.guardLevel)}还有 ${g.daysLeft} 天到期（${g.expireText}）` : '',
    })),
  )
  if (added > 0) {
    toast.success(`已添加 ${added} 位舰长到批量私信队列`)
    subTab.value = 'pm'
  } else {
    toast.info('没有可新增的收件人（可能已在队列中）')
  }
}

function handleImportManualUids() {
  const lines = manualUidInput.value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const parsed: Array<{ uid: number; uname?: string; extra?: string }> = []
  for (const line of lines) {
    const [rawUid, uname, extra] = line.split(/[,\t，]/).map((s) => s.trim())
    const uid = Number(rawUid)
    if (Number.isInteger(uid) && uid > 0) {
      parsed.push({ uid, uname, extra })
    }
  }
  const added = pmQueue.addRecipients(parsed)
  if (added > 0) {
    manualUidInput.value = ''
    toast.success(`已导入 ${added} 位收件人`)
  } else {
    toast.warning('未识别到有效 UID（每行格式：UID 或 UID,昵称,备注）')
  }
}

async function handleStartQueue() {
  try {
    await pmQueue.start()
    toast.success(`批量私信队列执行结束（成功 ${pmQueue.stats.sent} / 失败 ${pmQueue.stats.failed}）`)
  } catch (err) {
    toast.error('启动私信队列失败', { description: err instanceof Error ? err.message : String(err) })
  }
}

onMounted(() => {
  void loadGuards()
})
</script>

<template>
  <Tabs
    v-model="subTab"
    class="w-full"
  >
    <TabsList class="inline-flex flex-wrap h-auto gap-1">
      <TabsTrigger
        value="guard"
        class="gap-1.5"
      >
        <AlertTriangle class="size-3.5" />
        在舰到期提醒
        <Badge
          v-if="expiringSoonGuards.length > 0"
          variant="destructive"
          class="px-1.5 py-0 text-[10px] tabular-nums"
        >
          {{ expiringSoonGuards.length }}
        </Badge>
      </TabsTrigger>
      <TabsTrigger
        value="reconcile"
        class="gap-1.5"
      >
        <ArrowRightLeft class="size-3.5" />
        舰长事件对账
      </TabsTrigger>
      <TabsTrigger
        value="medals"
        class="gap-1.5"
      >
        <Award class="size-3.5" />
        粉丝团与档案同步
      </TabsTrigger>
      <TabsTrigger
        value="pm"
        class="gap-1.5"
      >
        <Mail class="size-3.5" />
        批量限速私信队列
        <Badge
          v-if="pmQueue.stats.pending > 0"
          variant="secondary"
          class="px-1.5 py-0 text-[10px] tabular-nums"
        >
          {{ pmQueue.stats.pending }}
        </Badge>
      </TabsTrigger>
    </TabsList>

    <!-- 在舰到期提醒 -->
    <TabsContent
      value="guard"
      class="pt-3 space-y-3"
    >
      <Card>
        <CardHeader class="p-3 border-b flex-between flex-row flex-wrap gap-2">
          <div>
            <CardTitle class="text-xs font-semibold">
              当前大航海成员 ({{ guardTotal }}) · {{ expiringSoonDays }} 天内到期 {{ expiringSoonGuards.length }} 人
            </CardTitle>
            <CardDescription class="text-[11px]">
              从主播后台拉取精确到期时间，便于续舰关怀或月度福利核对
            </CardDescription>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="xs"
              :disabled="guards.length === 0"
              @click="enqueueExpiringGuards"
            >
              <Mail class="size-3.5 mr-1" />
              加入私信队列
            </Button>
            <Button
              variant="outline"
              size="xs"
              :disabled="loadingGuard || !roomId"
              @click="loadGuards"
            >
              <RefreshCw
                class="size-3.5 mr-1"
                :class="{ 'animate-spin': loadingGuard }"
              />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent class="p-3">
          <div
            v-if="loadingGuard && guards.length === 0"
            class="flex-center py-8"
          >
            <Spin />
          </div>
          <Empty
            v-else-if="guards.length === 0"
            description="暂无在舰成员数据"
          />
          <div
            v-else
            class="space-y-1.5 max-h-[420px] overflow-y-auto scrollbar-thin"
          >
            <div
              v-for="item in guards"
              :key="item.uid"
              class="flex-between gap-2 rounded-md border border-border px-2.5 py-1.5"
              :class="item.daysLeft !== null && item.daysLeft <= expiringSoonDays ? 'bg-amber-500/10 border-amber-500/40' : 'bg-muted/20'"
            >
              <div class="flex items-center gap-2 min-w-0">
                <img
                  v-if="item.face"
                  :src="item.face"
                  referrerpolicy="no-referrer"
                  class="size-7 rounded-full object-cover shrink-0"
                />
                <div class="min-w-0">
                  <div class="text-xs font-medium truncate flex items-center gap-1.5">
                    <span>{{ item.uname }}</span>
                    <Badge
                      variant="secondary"
                      class="text-[10px] px-1 py-0"
                    >
                      {{ guardLevelLabel(item.guardLevel) }}
                    </Badge>
                  </div>
                  <div class="text-[11px] text-muted-foreground tabular-nums">
                    UID {{ item.uid }} · 陪伴 {{ item.accompanyDays }} 天 · 到期：{{ item.expireText }}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <Badge
                  v-if="item.daysLeft !== null"
                  :variant="item.daysLeft <= 3 ? 'destructive' : item.daysLeft <= expiringSoonDays ? 'default' : 'outline'"
                  class="tabular-nums"
                >
                  剩余 {{ item.daysLeft }} 天
                </Badge>
                <Button
                  variant="ghost"
                  size="xs"
                  @click="
                    pmQueue.addRecipients([
                      { uid: item.uid, uname: item.uname, extra: `到期时间 ${item.expireText}` },
                    ]);
                    toast.success(`已将 ${item.uname} 加入私信队列`)
                  "
                >
                  <Send class="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    <!-- 舰长事件对账与补录 -->
    <TabsContent
      value="reconcile"
      class="pt-3 space-y-3"
    >
      <GuardReconcilePanel />
    </TabsContent>

    <!-- 粉丝团 -->
    <TabsContent
      value="medals"
      class="pt-3 space-y-3"
    >
      <Card>
        <CardHeader class="p-3 border-b flex-between flex-row flex-wrap gap-2">
          <div>
            <CardTitle class="text-xs font-semibold">粉丝团成员 ({{ medalTotal }})</CardTitle>
            <CardDescription class="text-[11px]">
              同步粉丝牌等级、亲密度与点亮状态至站内粉丝档案，辅助 AI 粉丝画像与等级识别
            </CardDescription>
          </div>
          <div class="flex items-center gap-2">
            <Button
              size="xs"
              :disabled="syncingMedals || medals.length === 0"
              @click="handleSyncMedalsToProfiles"
            >
              <UploadCloud class="size-3.5 mr-1" />
              {{ syncingMedals ? '同步中...' : '同步至粉丝档案' }}
            </Button>
            <Button
              variant="outline"
              size="xs"
              :disabled="loadingMedals"
              @click="loadMedals"
            >
              <RefreshCw
                class="size-3.5 mr-1"
                :class="{ 'animate-spin': loadingMedals }"
              />
              拉取粉丝团
            </Button>
          </div>
        </CardHeader>
        <CardContent class="p-3">
          <div
            v-if="loadingMedals && medals.length === 0"
            class="flex-center py-8"
          >
            <Spin />
          </div>
          <Empty
            v-else-if="medals.length === 0"
            description="点击右上角「拉取粉丝团」加载成员列表"
          />
          <div
            v-else
            class="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[420px] overflow-y-auto scrollbar-thin"
          >
            <div
              v-for="m in medals"
              :key="m.uid"
              class="flex-between gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-1.5"
            >
              <div class="min-w-0">
                <div class="text-xs font-medium truncate">{{ m.uname }}</div>
                <div class="text-[11px] text-muted-foreground tabular-nums">
                  UID {{ m.uid }} · 亲密度 {{ m.intimacy }} · 今日 +{{ m.todayFeed }}
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <Badge
                  :variant="m.isLighted ? 'default' : 'outline'"
                  class="tabular-nums text-[10px]"
                >
                  Lv.{{ m.medalLevel }}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    <!-- 批量限速私信队列 -->
    <TabsContent
      value="pm"
      class="pt-3 space-y-3"
    >
      <Alert>
        <AlertDescription class="text-xs">
          B 站对未互关账号私信有严格条数与频率限制，本队列强制 ≥ 3 秒安全间隔，建议仅用于舰长福利发货、中奖通知与续舰关怀。
        </AlertDescription>
      </Alert>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader class="p-3 border-b">
            <CardTitle class="text-xs font-semibold">模板与限速设置</CardTitle>
          </CardHeader>
          <CardContent class="p-3 space-y-3">
            <FormField
              label="私信内容模板"
              description="支持变量：{uname} 昵称、{uid} UID、{extra} 附加备注"
            >
              <Textarea
                v-model="pmQueue.template"
                class="min-h-[84px]"
              />
            </FormField>

            <FormField
              label="发送间隔（毫秒）"
              description="最低 3000ms，建议保持 4000ms 以上"
            >
              <NumberField
                v-model="pmQueue.intervalMs"
                :min="3000"
                :max="60000"
                :step="500"
              />
            </FormField>

            <FormField
              label="手动批量导入收件人"
              description="每行一条：UID 或 UID,昵称,备注"
            >
              <Textarea
                v-model="manualUidInput"
                class="min-h-[68px]"
                placeholder="123456,张三,9月舰长礼盒已发货"
              />
            </FormField>
            <Button
              variant="outline"
              size="xs"
              @click="handleImportManualUids"
            >
              导入到队列
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="p-3 border-b flex-between flex-row flex-wrap gap-2">
            <div>
              <CardTitle class="text-xs font-semibold tabular-nums">
                发送队列（待发 {{ pmQueue.stats.pending }} / 成功 {{ pmQueue.stats.sent }} / 失败 {{ pmQueue.stats.failed }}）
              </CardTitle>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <Button
                v-if="!pmQueue.running || pmQueue.paused"
                size="xs"
                :disabled="pmQueue.stats.pending === 0"
                @click="handleStartQueue"
              >
                <Play class="size-3.5 mr-1" />
                {{ pmQueue.paused ? '继续' : '开始发送' }}
              </Button>
              <Button
                v-else
                variant="outline"
                size="xs"
                @click="pmQueue.pause()"
              >
                <Pause class="size-3.5 mr-1" />
                暂停
              </Button>
              <Button
                v-if="pmQueue.running"
                variant="destructive"
                size="xs"
                @click="pmQueue.stop()"
              >
                <Square class="size-3.5 mr-1" />
                停止
              </Button>
              <Button
                v-if="pmQueue.stats.failed > 0 && !pmQueue.running"
                variant="outline"
                size="xs"
                @click="pmQueue.retryFailed()"
              >
                <RotateCcw class="size-3.5 mr-1" />
                重试失败
              </Button>
              <Button
                variant="ghost"
                size="xs"
                :disabled="pmQueue.running || pmQueue.recipients.length === 0"
                @click="pmQueue.clearAll()"
              >
                清空
              </Button>
            </div>
          </CardHeader>
          <CardContent class="p-3">
            <Empty
              v-if="pmQueue.recipients.length === 0"
              description="队列为空，可从在舰列表、天选中奖名单或左侧文本导入"
            />
            <div
              v-else
              class="space-y-1.5 max-h-[340px] overflow-y-auto scrollbar-thin"
            >
              <div
                v-for="r in pmQueue.recipients"
                :key="r.id"
                class="flex-between gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-1.5"
              >
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-medium truncate">
                    {{ r.uname }} <span class="text-[11px] font-mono text-muted-foreground">{{ r.uid }}</span>
                  </div>
                  <div class="text-[11px] text-muted-foreground truncate">
                    {{ r.error || pmQueue.renderMessage(r) }}
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <Badge
                    v-if="r.status === 'sent'"
                    variant="secondary"
                    class="text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle2 class="size-3 mr-0.5" />
                    已发
                  </Badge>
                  <Badge
                    v-else-if="r.status === 'failed'"
                    variant="destructive"
                  >
                    失败
                  </Badge>
                  <Badge
                    v-else-if="r.status === 'sending'"
                    variant="default"
                  >
                    发送中
                  </Badge>
                  <Badge
                    v-else
                    variant="outline"
                  >
                    待发
                  </Badge>
                  <Button
                    v-if="!pmQueue.running"
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-destructive"
                    @click="pmQueue.removeRecipient(r.id)"
                  >
                    <Trash2 class="size-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  </Tabs>
</template>
