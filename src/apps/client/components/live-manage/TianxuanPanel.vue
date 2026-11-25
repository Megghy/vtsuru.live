<script setup lang="ts">
import { Gift, Mail, Plus, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { recordTianxuanWinners } from '@/api/bili-extra'
import {
  checkTianxuanStatus,
  createTianxuanLottery,
  type TianxuanStatusInfo,
} from '@/apps/client/api/bili-tianxuan'
import { useBatchPrivateMessageQueue } from '@/apps/client/store/useBatchPrivateMessageQueue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

interface TianxuanPreset {
  id: string
  name: string
  awardName: string
  awardNum: number
  danmu: string
  timeSeconds: number
  requireType: 0 | 1 | 2 | 3
  requireValue: number
}

const account = useAccount()
const pmQueue = useBatchPrivateMessageQueue()
const roomId = computed(() => account.value?.biliRoomId ?? 0)

const presets = usePersistedStorage<TianxuanPreset[]>('Client.TianxuanPresets', [
  {
    id: 'default-follow',
    name: '关注抽福利',
    awardName: '周边小礼物',
    awardNum: 1,
    danmu: '好运来',
    timeSeconds: 300,
    requireType: 1,
    requireValue: 0,
  },
])

const awardName = ref('周边小礼物')
const awardNum = ref(1)
const danmu = ref('好运来')
const timeSeconds = ref(300)
const requireType = ref<'0' | '1' | '2' | '3'>('1')
const requireValue = ref(1)

const creating = ref(false)
const checking = ref(false)
const syncingWinners = ref(false)
const activeStatus = ref<TianxuanStatusInfo | null>(null)

function applyPreset(preset: TianxuanPreset) {
  awardName.value = preset.awardName
  awardNum.value = preset.awardNum
  danmu.value = preset.danmu
  timeSeconds.value = preset.timeSeconds
  requireType.value = String(preset.requireType) as '0' | '1' | '2' | '3'
  requireValue.value = preset.requireValue
  toast.info(`已套用模板「${preset.name}」`)
}

function saveAsPreset() {
  if (!awardName.value.trim()) return
  presets.value = [
    ...presets.value,
    {
      id: `preset-${Date.now()}`,
      name: `${awardName.value.trim().slice(0, 10)} (${danmu.value.trim().slice(0, 8)})`,
      awardName: awardName.value.trim(),
      awardNum: awardNum.value,
      danmu: danmu.value.trim(),
      timeSeconds: timeSeconds.value,
      requireType: Number(requireType.value) as 0 | 1 | 2 | 3,
      requireValue: requireValue.value,
    },
  ]
  toast.success('已保存为天选模板')
}

function deletePreset(id: string) {
  presets.value = presets.value.filter((p) => p.id !== id)
}

async function refreshStatus() {
  if (!roomId.value) return
  checking.value = true
  try {
    activeStatus.value = await checkTianxuanStatus(roomId.value)
  } catch (err) {
    toast.error('查询天选状态失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    checking.value = false
  }
}

async function handleCreate() {
  if (!roomId.value) {
    toast.error('未获取到直播间 ID')
    return
  }
  creating.value = true
  try {
    const res = await createTianxuanLottery({
      roomId: roomId.value,
      awardName: awardName.value,
      awardNum: awardNum.value,
      danmu: danmu.value,
      timeSeconds: timeSeconds.value,
      requireType: Number(requireType.value) as 0 | 1 | 2 | 3,
      requireValue: Number(requireType.value) >= 2 ? requireValue.value : 0,
    })
    toast.success(`天选时刻已发起（ID: ${res.id}）`)
    await refreshStatus()
  } catch (err) {
    toast.error('发起天选时刻失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    creating.value = false
  }
}

async function handleRecordWinners() {
  const s = activeStatus.value
  if (!s || s.awardUsers.length === 0) return
  syncingWinners.value = true
  try {
    const res = await recordTianxuanWinners({
      lotteryId: s.id,
      awardName: s.awardName,
      danmu: s.danmu,
      winners: s.awardUsers,
    })
    toast.success(`已同步 ${res.recorded} 位中奖观众到站内记录`)
  } catch (err) {
    toast.error('同步中奖名单失败', { description: err instanceof Error ? err.message : String(err) })
  } finally {
    syncingWinners.value = false
  }
}

function enqueueWinnersPm() {
  const s = activeStatus.value
  if (!s || s.awardUsers.length === 0) return
  const added = pmQueue.addRecipients(
    s.awardUsers.map((u) => ({
      uid: u.uid,
      uname: u.uname,
      extra: `恭喜在天选时刻中奖【${s.awardName}】，请前往 VTsuru 主页填写收货地址或联系房管领奖！`,
    })),
  )
  toast.success(`已将 ${added} 位中奖观众加入批量私信队列（可在「粉丝查看 -> 批量私信」发送）`)
}

onMounted(() => {
  void refreshStatus()
})
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
    <!-- 发起天选 -->
    <Card>
      <CardHeader class="p-3 border-b">
        <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
          <Sparkles class="size-3.5 text-amber-500" />
          发起天选时刻
        </CardTitle>
        <CardDescription class="text-[11px]">支持模板套用与一键发起，开奖后可直接入库与发私信领奖通知</CardDescription>
      </CardHeader>
      <CardContent class="p-3 space-y-3">
        <!-- 预设模板栏 -->
        <div
          v-if="presets.length > 0"
          class="flex flex-wrap gap-1.5"
        >
          <div
            v-for="p in presets"
            :key="p.id"
            class="inline-flex items-center rounded-md border border-border bg-muted/40 overflow-hidden"
          >
            <button
              type="button"
              class="px-2 py-1 text-[11px] hover:bg-muted transition-colors"
              @click="applyPreset(p)"
            >
              {{ p.name }}
            </button>
            <button
              type="button"
              class="px-1.5 py-1 text-muted-foreground hover:text-destructive border-l border-border"
              @click="deletePreset(p.id)"
            >
              <Trash2 class="size-3" />
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <FormField label="奖品名称">
            <Input
              v-model="awardName"
              placeholder="例如：立牌 / 舰长礼盒"
              maxlength="30"
            />
          </FormField>
          <FormField label="参与弹幕口令">
            <Input
              v-model="danmu"
              placeholder="例如：好运来"
              maxlength="30"
            />
          </FormField>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <FormField label="中奖人数">
            <NumberField
              v-model="awardNum"
              :min="1"
              :max="100"
            />
          </FormField>
          <FormField label="开奖时长（秒）">
            <NumberField
              v-model="timeSeconds"
              :min="60"
              :max="1800"
              :step="60"
            />
          </FormField>
          <FormField label="参与条件">
            <Select v-model="requireType">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">无门槛</SelectItem>
                <SelectItem value="1">关注主播</SelectItem>
                <SelectItem value="2">粉丝勋章</SelectItem>
                <SelectItem value="3">大航海</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField
          v-if="requireType === '2' || requireType === '3'"
          :label="requireType === '2' ? '最低粉丝牌等级' : '最低大航海等级（3舰长/2提督/1总督）'"
        >
          <NumberField
            v-model="requireValue"
            :min="1"
            :max="requireType === '2' ? 40 : 3"
          />
        </FormField>

        <div class="flex items-center gap-2 pt-1">
          <Button
            :disabled="creating || !roomId"
            @click="handleCreate"
          >
            <Plus class="size-3.5 mr-1" />
            {{ creating ? '发起中...' : '发起天选时刻' }}
          </Button>
          <Button
            variant="outline"
            @click="saveAsPreset"
          >
            <Save class="size-3.5 mr-1" />
            存为模板
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- 当前状态与中奖名单 -->
    <Card>
      <CardHeader class="p-3 border-b flex-between flex-row">
        <div>
          <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
            <Gift class="size-3.5 text-brand" />
            当前天选状态与中奖名单
          </CardTitle>
          <CardDescription class="text-[11px]">开奖后可一键同步中奖记录并推送领奖私信</CardDescription>
        </div>
        <Button
          variant="outline"
          size="xs"
          :disabled="checking || !roomId"
          @click="refreshStatus"
        >
          <RefreshCw
            class="size-3.5 mr-1"
            :class="{ 'animate-spin': checking }"
          />
          刷新
        </Button>
      </CardHeader>
      <CardContent class="p-3 space-y-3">
        <Empty
          v-if="!activeStatus"
          description="当前直播间暂无进行中或最近一次天选时刻"
        />
        <template v-else>
          <div class="rounded-md border border-border bg-muted/30 p-2.5 space-y-1">
            <div class="flex-between gap-2">
              <span class="text-xs font-semibold">{{ activeStatus.awardName }} × {{ activeStatus.awardNum }}</span>
              <Badge :variant="activeStatus.status === 1 ? 'default' : 'secondary'">
                {{ activeStatus.status === 1 ? `进行中（剩余 ${activeStatus.timeLeft}s）` : '已开奖' }}
              </Badge>
            </div>
            <div class="text-[11px] text-muted-foreground">
              口令：{{ activeStatus.danmu }} · ID {{ activeStatus.id }}
            </div>
          </div>

          <div
            v-if="activeStatus.awardUsers.length > 0"
            class="space-y-2"
          >
            <div class="flex-between gap-2 flex-wrap">
              <span class="text-xs font-semibold">中奖名单 ({{ activeStatus.awardUsers.length }})</span>
              <div class="flex items-center gap-1.5">
                <Button
                  size="xs"
                  :disabled="syncingWinners"
                  @click="handleRecordWinners"
                >
                  <Save class="size-3.5 mr-1" />
                  同步入库
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  @click="enqueueWinnersPm"
                >
                  <Mail class="size-3.5 mr-1" />
                  发中奖私信
                </Button>
              </div>
            </div>
            <div class="space-y-1 max-h-56 overflow-y-auto scrollbar-thin">
              <div
                v-for="u in activeStatus.awardUsers"
                :key="u.uid"
                class="flex items-center gap-2 rounded border border-border px-2.5 py-1.5 text-xs"
              >
                <img
                  v-if="u.face"
                  :src="u.face"
                  referrerpolicy="no-referrer"
                  class="size-6 rounded-full object-cover"
                />
                <span class="font-medium truncate">{{ u.uname }}</span>
                <span class="text-[11px] font-mono text-muted-foreground ml-auto">UID {{ u.uid }}</span>
              </div>
            </div>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
