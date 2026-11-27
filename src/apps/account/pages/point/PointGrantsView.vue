<script setup lang="ts">
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Gift,
  Package,
  Paperclip,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import {
  GoodsTypes,
  type ResponsePointOrder2UserModel,
  ServiceFieldType,
  type ShippingAddressInfo,
} from '@/api/generated/model'
import { getApiPointUserOrderAttachment } from '@/api/generated/point/point'
import {
  claimUserGrant,
  fetchUserGrants,
  RewardGrantSource,
  RewardGrantStatus,
  type UserGrantRecordModel,
} from '@/api/point-grants'
import AccountPageHeader from '@/apps/account/components/AccountPageHeader.vue'
import ShippingAddressPicker from '@/shared/components/points/ShippingAddressPicker.vue'
import { IMGUR_URL } from '@/shared/config'
import { transformImageUrl } from '@/shared/services/imageTransform'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { copyToClipboard, toast } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const auth = useBiliAuth()
const router = useRouter()

const emptyCover = transformImageUrl(`${IMGUR_URL}None.png`, 'card')

const grants = ref<UserGrantRecordModel[]>([])
const loading = ref(false)
const filterTab = ref<'unclaimed' | 'claimed' | 'all'>('unclaimed')

// 领取弹窗状态
const claimTarget = ref<UserGrantRecordModel | null>(null)
const showClaimDialog = ref(false)
const selectedAddress = ref<ShippingAddressInfo | undefined>(undefined)
const serviceAnswers = ref<Record<string, string>>({})
const claimRemark = ref('')
const claiming = ref(false)

// 领取成功展示弹窗
const claimedOrder = ref<ResponsePointOrder2UserModel | null>(null)
const showResultDialog = ref(false)
const downloadingFileId = ref<number | null>(null)

const unclaimedCount = computed(
  () => grants.value.filter((g) => g.status === RewardGrantStatus.Unclaimed).length,
)
const claimedCount = computed(
  () => grants.value.filter((g) => g.status === RewardGrantStatus.Claimed).length,
)

const filteredGrants = computed(() => {
  if (filterTab.value === 'unclaimed') {
    return grants.value.filter((g) => g.status === RewardGrantStatus.Unclaimed)
  }
  if (filterTab.value === 'claimed') {
    return grants.value.filter((g) => g.status === RewardGrantStatus.Claimed)
  }
  return grants.value
})

async function loadGrants() {
  loading.value = true
  try {
    const headers = Object.fromEntries(await auth.getBiliAuthHeaders())
    grants.value = await fetchUserGrants(headers)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '获取待领取列表失败')
  } finally {
    loading.value = false
  }
}

function openClaimDialog(grant: UserGrantRecordModel) {
  claimTarget.value = grant
  selectedAddress.value = undefined
  serviceAnswers.value = {}
  claimRemark.value = ''
  showClaimDialog.value = true
}

function getMultiSelectValues(fieldId: string): string[] {
  const raw = serviceAnswers.value[fieldId]
  if (!raw) return []
  return raw.split('\n').filter(Boolean)
}

function toggleMultiSelectOption(fieldId: string, opt: string, checked: boolean) {
  const current = getMultiSelectValues(fieldId)
  const next = checked
    ? current.includes(opt)
      ? current
      : [...current, opt]
    : current.filter((item) => item !== opt)
  serviceAnswers.value[fieldId] = next.join('\n')
}

async function handleConfirmClaim() {
  const target = claimTarget.value
  if (!target) return

  if (target.needAddress && !selectedAddress.value) {
    toast.error('请选择收货地址')
    return
  }

  if (target.goodsType === GoodsTypes.Service && target.serviceConfig?.fields?.length) {
    for (const field of target.serviceConfig.fields) {
      if (field.required && !serviceAnswers.value[field.id]?.trim()) {
        toast.error(`请填写：${field.label}`)
        return
      }
    }
  }

  claiming.value = true
  try {
    const headers = Object.fromEntries(await auth.getBiliAuthHeaders())
    const order = await claimUserGrant(headers, {
      grantId: target.id,
      address: target.needAddress ? selectedAddress.value : undefined,
      answers: target.goodsType === GoodsTypes.Service ? serviceAnswers.value : undefined,
      remark: claimRemark.value.trim() || undefined,
    })

    showClaimDialog.value = false
    claimedOrder.value = order
    showResultDialog.value = true
    toast.success('领取成功，已存入「我的订单」')
    await loadGrants()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '领取失败')
  } finally {
    claiming.value = false
  }
}

async function downloadAttachment(orderId: number, fileId: number) {
  downloadingFileId.value = fileId
  try {
    const res = await getApiPointUserOrderAttachment(
      { orderId, fileId },
      { headers: Object.fromEntries(await auth.getBiliAuthHeaders()) },
    )
    if (res.code === 200 && res.data) {
      window.open(res.data, '_blank', 'noopener,noreferrer')
    } else {
      toast.error(res.message || '获取下载链接失败')
    }
  } catch {
    toast.error('获取下载链接失败')
  } finally {
    downloadingFileId.value = null
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function typeMeta(type: GoodsTypes) {
  if (type === GoodsTypes.Physical) return { label: '实物', icon: Package }
  if (type === GoodsTypes.Service) return { label: '服务', icon: Wrench }
  return { label: '虚拟', icon: Sparkles }
}

function statusMeta(status: RewardGrantStatus) {
  switch (status) {
    case RewardGrantStatus.Unclaimed:
      return { label: '待领取', variant: 'warning' as const }
    case RewardGrantStatus.Claimed:
      return { label: '已领取', variant: 'success' as const }
    case RewardGrantStatus.Expired:
      return { label: '已过期', variant: 'secondary' as const }
    case RewardGrantStatus.Revoked:
      return { label: '已撤回', variant: 'outline' as const }
    default:
      return { label: '不可用', variant: 'outline' as const }
  }
}

function formatDateTime(ts?: number | null) {
  if (!ts) return '-'
  const d = new Date(ts)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function formatRemaining(expireAt?: number | null) {
  if (!expireAt) return '长期有效'
  const diff = expireAt - Date.now()
  if (diff <= 0) return '已过期'
  const days = Math.floor(diff / 86400000)
  if (days >= 1) return `剩余 ${days} 天`
  const hours = Math.max(1, Math.floor(diff / 3600000))
  return `剩余 ${hours} 小时`
}

function resolveCoverUrl(grant: UserGrantRecordModel) {
  return grant.cover?.path ? transformImageUrl(grant.cover.path, 'card') : emptyCover
}

const claimedAssignedKeys = computed(() => {
  const subs = claimedOrder.value?.selectedSubItems ?? []
  return subs.flatMap((s) => s.assignedVirtualKeys ?? []).filter(Boolean)
})

watch(
  () => auth.biliAuth.id,
  () => {
    if (auth.biliAuth.id) {
      void loadGrants()
    }
  },
)

onMounted(() => {
  void loadGrants()
})
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <AccountPageHeader
      title="待领取礼物"
      subtitle="主播为你发放的上舰礼遇与定向赠礼会直接出现在这里，点击领取即可查看内容或填写收货信息。"
    >
      <template #actions>
        <Button
          variant="outline"
          :disabled="loading"
          class="flex items-center gap-1.5"
          @click="loadGrants"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': loading }"
          />
          刷新
        </Button>
      </template>
    </AccountPageHeader>

    <div class="flex-between flex-wrap gap-2">
      <ToggleGroup
        type="single"
        :model-value="filterTab"
        @update:model-value="(v) => v && (filterTab = v as 'unclaimed' | 'claimed' | 'all')"
      >
        <ToggleGroupItem value="unclaimed">
          待领取
          <Badge
            v-if="unclaimedCount > 0"
            variant="warning"
            size="xs"
            class="ml-1.5 font-mono"
          >
            {{ unclaimedCount }}
          </Badge>
        </ToggleGroupItem>
        <ToggleGroupItem value="claimed">
          已领取
          <span
            v-if="claimedCount > 0"
            class="ml-1 text-muted-foreground tabular-nums"
          >
            ({{ claimedCount }})
          </span>
        </ToggleGroupItem>
        <ToggleGroupItem value="all">全部记录</ToggleGroupItem>
      </ToggleGroup>

      <Button
        variant="ghost"
        size="xs"
        @click="router.push({ name: 'bili-user-orders' })"
      >
        查看我的全部订单
        <ExternalLink class="size-3 ml-1" />
      </Button>
    </div>

    <div
      v-if="loading"
      class="py-16 flex-center"
    >
      <Spin />
    </div>

    <div
      v-else-if="filteredGrants.length === 0"
      class="py-12 px-4 border border-dashed border-border rounded-lg bg-card"
    >
      <Empty :description="filterTab === 'unclaimed' ? '当前没有待领取的礼物' : '暂无发放记录'">
        <template #icon>
          <Gift class="size-9 mb-2 text-muted-foreground/40 stroke-[1.5]" />
        </template>
        <template #extra>
          <span class="text-xs text-muted-foreground">
            在支持自动发礼的主播直播间上舰，或主播向你的 UID 定向发放礼物后，会直接出现在这里。
          </span>
        </template>
      </Empty>
    </div>

    <div
      v-else
      class="grid grid-cols-1 md:grid-cols-2 gap-3"
    >
      <Card
        v-for="item in filteredGrants"
        :key="item.id"
        class="overflow-hidden border-border/80"
        :class="{ 'opacity-70': item.status !== RewardGrantStatus.Unclaimed }"
      >
        <CardContent class="p-3.5 flex flex-col gap-3">
          <!-- 顶部：主播信息 + 来源 + 状态 -->
          <div class="flex-between gap-2 text-xs">
            <div class="flex items-center gap-2 min-w-0">
              <img
                v-if="item.owner?.faceUrl"
                :src="item.owner.faceUrl"
                :alt="item.owner.name"
                referrerpolicy="no-referrer"
                class="size-5 rounded-full object-cover shrink-0 border border-border/60"
              />
              <span class="font-medium text-foreground truncate">
                {{ item.owner?.name || '主播' }}
              </span>
              <Badge
                variant="outline"
                size="xs"
              >
                {{ item.source === RewardGrantSource.GuardAuto ? '上舰礼遇' : '定向发放' }}
              </Badge>
            </div>

            <Badge
              :variant="statusMeta(item.status).variant"
              size="xs"
            >
              {{ statusMeta(item.status).label }}
            </Badge>
          </div>

          <!-- 中部：礼物封面 + 信息 -->
          <div class="flex items-start gap-3">
            <img
              :src="resolveCoverUrl(item)"
              :alt="item.goodsName"
              referrerpolicy="no-referrer"
              class="size-16 rounded-md object-cover shrink-0 border border-border/60 bg-muted"
            />
            <div class="flex-1 min-w-0 space-y-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-sm font-semibold text-foreground line-clamp-1">
                  {{ item.goodsName }}
                </span>
                <Badge
                  variant="secondary"
                  size="xs"
                  class="tabular-nums"
                >
                  ×{{ item.quantity }}
                </Badge>
              </div>

              <div class="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
                <span class="inline-flex items-center gap-1">
                  <component
                    :is="typeMeta(item.goodsType).icon"
                    class="size-3"
                  />
                  {{ typeMeta(item.goodsType).label }}
                </span>
                <template v-if="item.subItemName">
                  <span>·</span>
                  <span>款式：{{ item.subItemName }}</span>
                </template>
                <template v-if="item.hasPrivateAttachments">
                  <span>·</span>
                  <span class="inline-flex items-center gap-0.5 text-brand">
                    <Paperclip class="size-3" />
                    含专属附件
                  </span>
                </template>
              </div>

              <p
                v-if="item.remark"
                class="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 line-clamp-2"
              >
                {{ item.remark }}
              </p>
            </div>
          </div>

          <!-- 底部：时间与操作 -->
          <div class="flex-between gap-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
            <div class="flex items-center gap-2 min-w-0 flex-wrap">
              <span class="tabular-nums">发放：{{ formatDateTime(item.createAt) }}</span>
              <span
                v-if="item.status === RewardGrantStatus.Unclaimed"
                class="inline-flex items-center gap-1 text-amber-600 font-medium"
              >
                <Clock class="size-3" />
                {{ formatRemaining(item.expireAt) }}
              </span>
              <span
                v-else-if="item.claimedAt"
                class="tabular-nums"
              >
                领取：{{ formatDateTime(item.claimedAt) }}
              </span>
            </div>

            <div class="shrink-0">
              <Button
                v-if="item.status === RewardGrantStatus.Unclaimed"
                @click="openClaimDialog(item)"
              >
                <Gift class="size-3.5 mr-1" />
                立即领取
              </Button>
              <Button
                v-else-if="item.status === RewardGrantStatus.Claimed"
                variant="outline"
                size="xs"
                @click="router.push({ name: 'bili-user-orders' })"
              >
                查看订单 #{{ item.orderId }}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 领取确认弹窗 -->
    <Dialog v-model:open="showClaimDialog">
      <DialogContent class="sm:max-w-lg max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">
            领取礼物：{{ claimTarget?.goodsName }}
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            无需消耗积分，领取后将自动生成订单并保存在「我的订单」中以便随时查看。
          </DialogDescription>
        </DialogHeader>

        <div
          v-if="claimTarget"
          class="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 space-y-4"
        >
          <div class="p-3 rounded-lg border border-border/70 bg-muted/20 flex items-center gap-3">
            <img
              :src="resolveCoverUrl(claimTarget)"
              :alt="claimTarget.goodsName"
              referrerpolicy="no-referrer"
              class="size-12 rounded-md object-cover shrink-0 border border-border/60"
            />
            <div class="min-w-0 flex-1 text-xs space-y-0.5">
              <div class="font-semibold text-foreground truncate">
                {{ claimTarget.goodsName }}
                <template v-if="claimTarget.subItemName"> · {{ claimTarget.subItemName }}</template>
                ×{{ claimTarget.quantity }}
              </div>
              <p
                v-if="claimTarget.goodsDescription"
                class="text-[11px] text-muted-foreground line-clamp-2"
              >
                {{ claimTarget.goodsDescription }}
              </p>
            </div>
          </div>

          <!-- 实物：需要站内收货地址 -->
          <div
            v-if="claimTarget.needAddress"
            class="space-y-2"
          >
            <FormField
              label="收货地址"
              required
              description="用于主播寄送实物礼物"
            >
              <ShippingAddressPicker v-model="selectedAddress" />
            </FormField>
          </div>

          <!-- 实物：站外收集表提示 -->
          <Alert v-else-if="claimTarget.goodsType === GoodsTypes.Physical && claimTarget.collectUrl">
            <AlertDescription class="text-xs">
              该实物礼物由主播通过外部表单收集收货信息，确认领取后即可打开收集链接填写。
            </AlertDescription>
          </Alert>

          <!-- 服务商品：填写需求表单 -->
          <div
            v-if="claimTarget.goodsType === GoodsTypes.Service"
            class="space-y-3"
          >
            <Alert v-if="claimTarget.serviceConfig?.rules">
              <AlertDescription class="text-xs whitespace-pre-wrap">
                {{ claimTarget.serviceConfig.rules }}
              </AlertDescription>
            </Alert>

            <div
              v-if="claimTarget.serviceConfig?.fields?.length"
              class="space-y-3 p-3 rounded-lg bg-muted/20 border border-border/60"
            >
              <FormField
                v-for="field in claimTarget.serviceConfig.fields"
                :key="field.id"
                :label="field.label"
                :required="field.required"
              >
                <Select
                  v-if="field.type === ServiceFieldType.Select"
                  :model-value="serviceAnswers[field.id] || ''"
                  @update:model-value="serviceAnswers[field.id] = String($event)"
                >
                  <SelectTrigger class="w-full">
                    <SelectValue :placeholder="`请选择${field.label}`" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in field.options"
                      :key="opt"
                      :value="opt"
                    >
                      {{ opt }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div
                  v-else-if="field.type === ServiceFieldType.MultiSelect"
                  class="flex flex-wrap gap-2 pt-1"
                >
                  <label
                    v-for="opt in field.options"
                    :key="opt"
                    class="inline-flex items-center gap-1.5 text-xs cursor-pointer"
                  >
                    <Checkbox
                      :checked="getMultiSelectValues(field.id).includes(opt)"
                      @update:checked="(v) => toggleMultiSelectOption(field.id, opt, Boolean(v))"
                    />
                    <span>{{ opt }}</span>
                  </label>
                </div>

                <Input
                  v-else-if="field.type === ServiceFieldType.Date"
                  :model-value="serviceAnswers[field.id] || ''"
                  type="date"
                  @update:model-value="serviceAnswers[field.id] = String($event ?? '')"
                />

                <NumberField
                  v-else-if="field.type === ServiceFieldType.Number"
                  :model-value="serviceAnswers[field.id] ? Number(serviceAnswers[field.id]) : undefined"
                  :show-buttons="false"
                  @update:model-value="serviceAnswers[field.id] = $event == null ? '' : String($event)"
                />

                <Textarea
                  v-else-if="field.type === ServiceFieldType.Textarea"
                  :model-value="serviceAnswers[field.id] || ''"
                  rows="3"
                  maxlength="2000"
                  class="resize-none"
                  :placeholder="`请输入${field.label}`"
                  @update:model-value="serviceAnswers[field.id] = String($event ?? '')"
                />

                <Input
                  v-else-if="field.type === ServiceFieldType.Url"
                  :model-value="serviceAnswers[field.id] || ''"
                  type="url"
                  maxlength="300"
                  placeholder="请输入完整链接"
                  @update:model-value="serviceAnswers[field.id] = String($event ?? '')"
                />

                <Input
                  v-else
                  :model-value="serviceAnswers[field.id] || ''"
                  type="text"
                  maxlength="300"
                  :placeholder="`请输入${field.label}`"
                  @update:model-value="serviceAnswers[field.id] = String($event ?? '')"
                />
              </FormField>
            </div>
          </div>

          <!-- 虚拟商品说明 -->
          <Alert v-if="claimTarget.goodsType === GoodsTypes.Virtual">
            <AlertDescription class="text-xs">
              点击确认后将立即解锁该虚拟礼物的交付内容{{ claimTarget.hasPrivateAttachments ? '与专属附件下载' : '' }}。
            </AlertDescription>
          </Alert>

          <FormField
            v-if="claimTarget.goodsType !== GoodsTypes.Virtual"
            label="给主播的备注（可选）"
          >
            <Input
              v-model="claimRemark"
              maxlength="300"
              placeholder="如有特殊说明可在此填写"
            />
          </FormField>
        </div>

        <DialogFooter class="pt-2 border-t border-border/60">
          <Button
            variant="outline"
            @click="showClaimDialog = false"
          >
            取消
          </Button>
          <Button
            :disabled="claiming"
            @click="handleConfirmClaim"
          >
            {{ claiming ? '领取中...' : '确认领取' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 领取成功结果弹窗 -->
    <Dialog v-model:open="showResultDialog">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 class="size-4 text-emerald-600" />
            领取成功
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            已生成订单 #{{ claimedOrder?.id }}，后续随时可在「我的订单」中重新查看。
          </DialogDescription>
        </DialogHeader>

        <div
          v-if="claimedOrder"
          class="space-y-3 text-xs"
        >
          <!-- 虚拟内容 -->
          <div
            v-if="claimedOrder.type === GoodsTypes.Virtual && claimedOrder.goods.content"
            class="space-y-1.5"
          >
            <div class="flex-between">
              <span class="font-medium text-foreground">交付内容</span>
              <Button
                variant="ghost"
                size="xs"
                @click="copyToClipboard(claimedOrder.goods.content!)"
              >
                <Copy class="size-3 mr-1" />
                复制内容
              </Button>
            </div>
            <div class="p-3 rounded-md border border-border bg-muted/30 whitespace-pre-wrap break-all font-mono">
              {{ claimedOrder.goods.content }}
            </div>
          </div>

          <!-- 子款式分配卡密 -->
          <div
            v-if="claimedAssignedKeys.length > 0"
            class="space-y-1.5"
          >
            <div class="flex-between">
              <span class="font-medium text-foreground">专属兑换码 / 卡密</span>
              <Button
                variant="ghost"
                size="xs"
                @click="copyToClipboard(claimedAssignedKeys.join('\n'))"
              >
                <Copy class="size-3 mr-1" />
                复制全部
              </Button>
            </div>
            <div class="p-3 rounded-md border border-border bg-muted/30 font-mono space-y-1">
              <div
                v-for="k in claimedAssignedKeys"
                :key="k"
                class="break-all"
              >
                {{ k }}
              </div>
            </div>
          </div>

          <!-- 虚拟私有附件下载 -->
          <div
            v-if="claimedOrder.privateAttachments?.length"
            class="space-y-1.5"
          >
            <span class="font-medium text-foreground block">专属附件</span>
            <div class="space-y-1.5">
              <div
                v-for="att in claimedOrder.privateAttachments"
                :key="att.id"
                class="flex-between gap-2 p-2.5 rounded-md border border-border bg-card"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <Paperclip class="size-3.5 text-muted-foreground shrink-0" />
                  <span class="truncate font-medium text-foreground">{{ att.name }}</span>
                  <span class="text-[11px] text-muted-foreground shrink-0">
                    ({{ formatFileSize(att.size) }})
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  :disabled="downloadingFileId === att.id"
                  @click="downloadAttachment(claimedOrder.id, att.id)"
                >
                  <Download class="size-3 mr-1" />
                  下载
                </Button>
              </div>
            </div>
          </div>

          <!-- 站外收集表链接 -->
          <div
            v-if="claimedOrder.type === GoodsTypes.Physical && claimedOrder.goods.collectUrl"
            class="p-3 rounded-md border border-border bg-muted/20 flex-between gap-2"
          >
            <span class="text-muted-foreground">请前往主播提供的收集表填写收货地址：</span>
            <Button
              as="a"
              :href="claimedOrder.goods.collectUrl"
              target="_blank"
              rel="noopener noreferrer"
              size="xs"
            >
              前往填写
              <ExternalLink class="size-3 ml-1" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="showResultDialog = false"
          >
            留在此页
          </Button>
          <Button @click="(showResultDialog = false), router.push({ name: 'bili-user-orders' })">
            前往我的订单
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
