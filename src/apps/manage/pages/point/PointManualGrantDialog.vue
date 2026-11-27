<script setup lang="ts">
import { Check, Gift, RefreshCw, Search, Send, Users } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import type { ResponsePointGoodModel } from '@/api/client-types'
import { GoodsStatus, GoodsTypes } from '@/api/generated/model'
import {
  type ActiveGuardMemberItem,
  fetchActiveGuardMembers,
  type ManualGrantRecipient,
  manualGrantRewards,
  RewardGrantStatus,
} from '@/api/point-grants'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'
import { toast } from '@/shared/utils'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  goodsList: ResponsePointGoodModel[]
}>()

const emit = defineEmits<{
  granted: []
}>()

const availableGoods = computed(() =>
  props.goodsList.filter((g) => g.status === GoodsStatus.Normal),
)

const selectedGoodsId = ref<string>('')
const selectedSubItemId = ref<string>('')
const quantity = ref<number>(1)
const expireDays = ref<number>(30)
const remark = ref('')
const recipientMode = ref<'uid' | 'guard'>('uid')

// 按 UID 批量输入
const rawUidText = ref('')

// 从在舰成员勾选
const guards = ref<ActiveGuardMemberItem[]>([])
const loadingGuards = ref(false)
const guardLoaded = ref(false)
const guardSearch = ref('')
const guardLevelFilter = ref<'all' | '舰长' | '提督' | '总督'>('all')
const selectedGuardIds = ref<string[]>([])

const submitting = ref(false)

const currentGoods = computed(() =>
  availableGoods.value.find((g) => String(g.id) === selectedGoodsId.value),
)
const subItems = computed(() => currentGoods.value?.subItems ?? [])
const hasSubItems = computed(() => subItems.value.length > 0)

watch(selectedGoodsId, () => {
  const subs = subItems.value
  selectedSubItemId.value = subs.length > 0 ? String(subs[0].id) : ''
})

watch(open, (isOpen) => {
  if (!isOpen) return
  if (!selectedGoodsId.value && availableGoods.value.length > 0) {
    selectedGoodsId.value = String(availableGoods.value[0].id)
  }
})

watch(recipientMode, (mode) => {
  if (mode === 'guard' && !guardLoaded.value) {
    void loadGuards()
  }
})

async function loadGuards() {
  loadingGuards.value = true
  try {
    guards.value = await fetchActiveGuardMembers(true)
    guardLoaded.value = true
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '加载在舰成员失败')
  } finally {
    loadingGuards.value = false
  }
}

const parsedUids = computed(() => {
  const parts = rawUidText.value
    .split(/[\s,，;；]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const valid: number[] = []
  const seen = new Set<number>()
  let invalidCount = 0
  for (const part of parts) {
    if (/^\d{1,16}$/.test(part)) {
      const num = Number(part)
      if (num > 0 && !seen.has(num)) {
        seen.add(num)
        valid.push(num)
      }
    } else {
      invalidCount += 1
    }
  }
  return { valid, invalidCount }
})

const filteredGuards = computed(() => {
  const kw = guardSearch.value.trim().toLocaleLowerCase()
  return guards.value.filter((g) => {
    if (guardLevelFilter.value !== 'all' && g.guardLevel !== guardLevelFilter.value) return false
    if (!kw) return true
    return g.username.toLocaleLowerCase().includes(kw)
  })
})

function toggleGuard(ouid: string, checked: boolean) {
  if (checked) {
    if (!selectedGuardIds.value.includes(ouid)) {
      selectedGuardIds.value = [...selectedGuardIds.value, ouid]
    }
  } else {
    selectedGuardIds.value = selectedGuardIds.value.filter((id) => id !== ouid)
  }
}

function selectAllFilteredGuards() {
  const next = new Set(selectedGuardIds.value)
  filteredGuards.value.forEach((g) => next.add(g.guardOUId))
  selectedGuardIds.value = [...next]
}

function clearSelectedGuards() {
  selectedGuardIds.value = []
}

const totalRecipientCount = computed(() =>
  recipientMode.value === 'uid' ? parsedUids.value.valid.length : selectedGuardIds.value.length,
)

function goodsTypeLabel(type: GoodsTypes) {
  if (type === GoodsTypes.Physical) return '实物'
  if (type === GoodsTypes.Service) return '服务'
  return '虚拟'
}

function formatStock(stock?: number | null) {
  return stock == null ? '不限' : `余 ${stock}`
}

async function handleSubmit() {
  if (!currentGoods.value) {
    toast.error('请选择要发放的礼物')
    return
  }
  if (hasSubItems.value && !selectedSubItemId.value) {
    toast.error('请选择具体发放款式')
    return
  }

  let recipients: ManualGrantRecipient[] = []
  if (recipientMode.value === 'uid') {
    if (parsedUids.value.valid.length === 0) {
      toast.error('请输入至少一个有效的 B 站 UID')
      return
    }
    recipients = parsedUids.value.valid.map((uId) => ({ uId }))
  } else {
    if (selectedGuardIds.value.length === 0) {
      toast.error('请至少勾选一位在舰成员')
      return
    }
    const map = new Map(guards.value.map((g) => [g.guardOUId, g]))
    recipients = selectedGuardIds.value.map((ouId) => ({
      ouId,
      name: map.get(ouId)?.username,
    }))
  }

  if (recipients.length > 200) {
    toast.error('单次最多发放 200 位观众')
    return
  }

  submitting.value = true
  try {
    const created = await manualGrantRewards({
      goodsId: currentGoods.value.id,
      subItemId: hasSubItems.value ? Number(selectedSubItemId.value) : null,
      quantity: quantity.value || 1,
      expireDays: expireDays.value > 0 ? expireDays.value : null,
      remark: remark.value.trim() || undefined,
      recipients,
    })

    const okCount = created.filter((r) => r.status === RewardGrantStatus.Unclaimed).length
    const failCount = created.filter((r) => r.status === RewardGrantStatus.Failed).length
    if (failCount === 0) {
      toast.success(`已成功向 ${okCount} 位观众发放待领取礼物`)
    } else if (okCount > 0) {
      toast.warning(`发放完成：成功 ${okCount} 人，失败 ${failCount} 人（可在发放记录中查看原因并重试）`)
    } else {
      toast.error(`发放失败（${failCount} 人），请检查库存或商品状态`)
    }

    rawUidText.value = ''
    selectedGuardIds.value = []
    remark.value = ''
    open.value = false
    emit('granted')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '手动发放失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-xl max-h-[88vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-sm font-semibold">
          <Gift class="size-4 text-brand" />
          手动定向发放礼物
        </DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground">
          直接将礼物发放到指定观众的待领取信箱，未认证观众完成 B 站认证后将自动认领，无需手动积分兑换。
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="发放礼物"
            required
          >
            <Select v-model="selectedGoodsId">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择积分礼物" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="item in availableGoods"
                  :key="item.id"
                  :value="String(item.id)"
                >
                  [{{ goodsTypeLabel(item.type) }}] {{ item.name }} ({{ formatStock(item.count) }})
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            v-if="hasSubItems"
            label="发放款式"
            required
          >
            <Select v-model="selectedSubItemId">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择具体款式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="sub in subItems"
                  :key="sub.id"
                  :value="String(sub.id)"
                >
                  {{ sub.name }} ({{ formatStock(sub.count) }})
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="每人发放份数"
            required
          >
            <NumberField
              :model-value="quantity"
              :min="1"
              :max="99"
              @update:model-value="quantity = $event ?? 1"
            />
          </FormField>

          <FormField
            label="领取有效期 (天)"
            description="填 0 表示永不过期，超时未领将自动归还库存"
          >
            <NumberField
              :model-value="expireDays"
              :min="0"
              :max="3650"
              @update:model-value="expireDays = $event ?? 0"
            />
          </FormField>
        </div>

        <FormField label="发放留言（观众可见）">
          <Input
            v-model="remark"
            maxlength="300"
            placeholder="例如：感谢本月上舰支持，请查收舰长礼"
          />
        </FormField>

        <div class="space-y-2">
          <div class="flex-between">
            <span class="text-xs font-medium text-foreground">接收观众</span>
            <Badge
              v-if="totalRecipientCount > 0"
              variant="secondary"
              size="xs"
              class="tabular-nums"
            >
              已选 {{ totalRecipientCount }} 人
            </Badge>
          </div>

          <Tabs
            v-model="recipientMode"
            class="w-full"
          >
            <TabsList class="w-full grid grid-cols-2">
              <TabsTrigger value="uid">按 B 站 UID 输入</TabsTrigger>
              <TabsTrigger value="guard">从当前在舰成员勾选</TabsTrigger>
            </TabsList>

            <TabsContent
              value="uid"
              class="pt-2.5 space-y-2"
            >
              <Textarea
                v-model="rawUidText"
                rows="4"
                placeholder="输入 B 站 UID，支持换行、逗号或空格分隔批量发放（单次最多 200 人）"
                class="font-mono text-xs resize-none"
              />
              <div class="flex-between text-[11px] text-muted-foreground">
                <span>已识别有效 UID：<strong class="text-foreground tabular-nums">{{ parsedUids.valid.length }}</strong> 个</span>
                <span
                  v-if="parsedUids.invalidCount > 0"
                  class="text-amber-600"
                >
                  已忽略 {{ parsedUids.invalidCount }} 项无效格式
                </span>
              </div>
            </TabsContent>

            <TabsContent
              value="guard"
              class="pt-2.5 space-y-2.5"
            >
              <div class="flex flex-wrap items-center gap-2">
                <div class="relative flex-1 min-w-36">
                  <Search class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    v-model="guardSearch"
                    placeholder="搜索在舰昵称"
                    class="pl-8"
                  />
                </div>
                <Select v-model="guardLevelFilter">
                  <SelectTrigger class="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部等级</SelectItem>
                    <SelectItem value="舰长">舰长</SelectItem>
                    <SelectItem value="提督">提督</SelectItem>
                    <SelectItem value="总督">总督</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="xs"
                  @click="selectAllFilteredGuards"
                >
                  全选当前
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  :disabled="selectedGuardIds.length === 0"
                  @click="clearSelectedGuards"
                >
                  清空
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  :disabled="loadingGuards"
                  aria-label="刷新在舰列表"
                  @click="loadGuards"
                >
                  <RefreshCw
                    class="size-3.5"
                    :class="{ 'animate-spin': loadingGuards }"
                  />
                </Button>
              </div>

              <div class="rounded-lg border border-border/80 bg-muted/15">
                <Spin :show="loadingGuards">
                  <ScrollArea class="h-48">
                    <div
                      v-if="filteredGuards.length === 0"
                      class="py-10"
                    >
                      <Empty description="暂无匹配的在舰成员">
                        <template #icon>
                          <Users class="size-8 mb-2 text-muted-foreground/40 stroke-[1.5]" />
                        </template>
                      </Empty>
                    </div>
                    <div
                      v-else
                      class="divide-y divide-border/50"
                    >
                      <label
                        v-for="guard in filteredGuards"
                        :key="guard.guardOUId"
                        class="flex-between gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-accent/30 transition-colors"
                      >
                        <div class="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            :checked="selectedGuardIds.includes(guard.guardOUId)"
                            @update:checked="(v) => toggleGuard(guard.guardOUId, Boolean(v))"
                          />
                          <span class="font-medium text-foreground truncate">{{ guard.username }}</span>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            size="xs"
                          >
                            {{ guard.guardLevel }}
                          </Badge>
                          <span
                            v-if="guard.accompanyDays > 0"
                            class="text-[11px] text-muted-foreground tabular-nums"
                          >
                            陪伴 {{ guard.accompanyDays }} 天
                          </span>
                        </div>
                      </label>
                    </div>
                  </ScrollArea>
                </Spin>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <DialogFooter class="pt-2 border-t border-border/60">
        <Button
          variant="outline"
          @click="open = false"
        >
          取消
        </Button>
        <Button
          :disabled="submitting || totalRecipientCount === 0 || !currentGoods"
          @click="handleSubmit"
        >
          <Check
            v-if="submitting"
            class="size-3.5 mr-1 animate-pulse"
          />
          <Send
            v-else
            class="size-3.5 mr-1"
          />
          确认发放 ({{ totalRecipientCount }} 人)
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
