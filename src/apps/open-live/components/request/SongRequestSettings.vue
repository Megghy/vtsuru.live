<script setup lang="ts">
import { Plus, X } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { SaveSetting, useAccount } from '@/api/account'
import { QueueGiftFilterType, QueueSortType, type SettingSongRequest } from '@/api/generated/model'
import StickyDraftSaveBar from '@/apps/open-live/components/shared/StickyDraftSaveBar.vue'
import { useLiveRequest } from '@/composables/useLiveRequest'
import { useUnsavedChangesGuard } from '@/shared/composables/useUnsavedChangesGuard'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

function createDefaultSongRequestSetting(): SettingSongRequest {
  return {
    orderPrefix: '点播',
    sortType: QueueSortType.TimeFirst,
    enableOnStreaming: false,
    onlyAllowSongList: false,
    queueMaxSize: 10,
    allowAllDanmaku: true,
    allowFromWeb: true,
    allowAnonymousFromWeb: false,
    needWearFanMedal: false,
    needJianzhang: false,
    needTidu: false,
    needZongdu: false,
    allowSC: true,
    scIgnoreLimit: true,
    scMinPrice: 30,
    fanMedalMinLevel: 0,
    allowReorderSong: false,
    allowGift: false,
    giftNames: [],
    minGiftPrice: null,
    giftFilterType: QueueGiftFilterType.Or,
    allowIncreasePaymentBySendGift: false,
    allowIncreaseByAnyPayment: false,
    enableCooldown: false,
    cooldownSecond: 1200,
    zongduCooldownSecond: 300,
    tiduCooldownSecond: 600,
    jianzhangCooldownSecond: 900,
    enableWebCooldown: true,
    webCooldownSecond: 600,
    showRequireInfo: true,
    showUserName: true,
    showFanMadelInfo: true,
    obsTitle: '点播',
    obsTitleToday: '今日已唱',
    isReverse: false,
    enablePointRequest: false,
    pointRequestCost: 0,
    pointIgnoreLimit: false,
    allowPointPriority: false,
    pointPriorityKeyword: '插队',
    pointPriorityCost: 100,
    maxSongsPerUserInQueue: 0,
    preventSameSongToday: false,
    songCooldownMinute: 0,
    songNameBlacklist: [],
    autoClearOnLiveStart: false,
    showAuthor: false,
    showDescription: false,
    showPrice: false,
    hideWhenEmpty: false,
  }
}

function normalizeSetting(raw?: Partial<SettingSongRequest> | null): SettingSongRequest {
  const base = createDefaultSongRequestSetting()
  return {
    ...base,
    ...raw,
    giftNames: [...(raw?.giftNames ?? base.giftNames ?? [])],
    songNameBlacklist: [...(raw?.songNameBlacklist ?? base.songNameBlacklist ?? [])],
  }
}

const liveRequest = useLiveRequest()
const accountInfo = useAccount()

const draft = ref<SettingSongRequest>(createDefaultSongRequestSetting())
const savedSnapshot = ref('')
const isSaving = ref(false)
const newGiftName = ref('')
const newBlacklistWord = ref('')

function addGiftName() {
  const val = newGiftName.value.trim()
  if (!val) return
  const list = draft.value.giftNames ?? []
  if (!list.includes(val)) {
    draft.value.giftNames = [...list, val]
  }
  newGiftName.value = ''
}

function removeGiftName(name: string) {
  draft.value.giftNames = (draft.value.giftNames ?? []).filter((g) => g !== name)
}

function addBlacklistWord() {
  const val = newBlacklistWord.value.trim()
  if (!val) return
  const list = draft.value.songNameBlacklist ?? []
  if (!list.includes(val)) {
    draft.value.songNameBlacklist = [...list, val]
  }
  newBlacklistWord.value = ''
}

function removeBlacklistWord(word: string) {
  draft.value.songNameBlacklist = (draft.value.songNameBlacklist ?? []).filter((w) => w !== word)
}

const canEdit = computed(() => liveRequest.configCanEdit)

function syncDraftFromSource(raw?: Partial<SettingSongRequest> | null) {
  const normalized = normalizeSetting(raw)
  draft.value = normalized
  savedSnapshot.value = JSON.stringify(normalized)
}

const isDirty = computed(() => {
  if (!canEdit.value || !savedSnapshot.value) return false
  return JSON.stringify(draft.value) !== savedSnapshot.value
})

useUnsavedChangesGuard(() => isDirty.value, '点播规则存在未保存的更改，离开后将会丢失，确定要离开吗？')

function initDraft() {
  if (accountInfo.value?.settings?.songRequest) {
    syncDraftFromSource(accountInfo.value.settings.songRequest)
  } else {
    syncDraftFromSource(undefined)
  }
}

onMounted(() => {
  initDraft()
})

watch(
  [() => accountInfo.value?.id, () => accountInfo.value?.settings?.songRequest],
  () => {
    if (!isDirty.value) {
      initDraft()
    }
  },
  { deep: true },
)

function resetDraft() {
  if (!savedSnapshot.value) return
  syncDraftFromSource(JSON.parse(savedSnapshot.value) as SettingSongRequest)
  toast.info('已还原未保存的更改')
}

async function saveSettings() {
  if (!accountInfo.value?.id) return
  isSaving.value = true
  try {
    const payload = normalizeSetting(draft.value)
    await SaveSetting('SongRequest', payload)
    accountInfo.value.settings.songRequest = payload
    syncDraftFromSource(payload)
    toast.success('点播规则已保存')
  } catch (err) {
    toast.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <StickyDraftSaveBar
      v-if="canEdit"
      :is-dirty="isDirty"
      :is-saving="isSaving"
      :can-edit="canEdit"
      dirty-title="点播规则存在未保存的更改"
      dirty-hint="修改各项前缀、门槛、冷却或 OBS 标题后，点击「保存设置」统一提交"
      clean-hint="所有点播规则均支持预览对比，调整完成后点击「保存设置」统一生效。"
      @reset="resetDraft"
      @save="saveSettings"
    />

    <!-- 点播指令与资格门槛 -->
    <Card>
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-sm font-semibold">指令、队列上限与准入门槛</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-2 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="点播弹幕前缀">
            <Input
              v-if="canEdit"
              v-model="draft.orderPrefix"
              placeholder="例如：点播"
            />
            <Input
              v-else
              v-model="liveRequest.defaultPrefix"
              placeholder="本地演示前缀"
            />
          </FormField>

          <FormField label="最大等待队列长度">
            <NumberField
              v-model="draft.queueMaxSize"
              :min="1"
              :max="500"
              :disabled="!canEdit"
            />
          </FormField>
        </div>

        <Alert
          v-if="draft.orderPrefix && draft.orderPrefix.includes(' ')"
          variant="info"
          class="py-1.5 px-3"
        >
          <AlertDescription class="text-xs m-0">
            点播前缀包含空格，部分观众发送弹幕时可能忘记加空格导致识别失败。
          </AlertDescription>
        </Alert>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <SettingRow
            v-model="draft.enableOnStreaming"
            type="switch"
            variant="card"
            title="仅在直播时允许加入"
            description="未开播期间自动拒收弹幕点播"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.allowAllDanmaku"
            type="switch"
            variant="card"
            title="允许所有普通弹幕点播"
            description="关闭后仅满足下方粉丝牌或大航海要求的用户可点播"
            :disabled="!canEdit"
          />
        </div>

        <div
          v-if="!draft.allowAllDanmaku"
          class="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3 text-xs"
        >
          <div class="flex items-center gap-4 flex-wrap">
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                v-model:checked="draft.needWearFanMedal"
                :disabled="!canEdit"
              />
              <span>需要佩戴主播粉丝牌</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                v-model:checked="draft.needJianzhang"
                :disabled="!canEdit"
              />
              <span>允许舰长</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                v-model:checked="draft.needTidu"
                :disabled="!canEdit"
              />
              <span>允许提督</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                v-model:checked="draft.needZongdu"
                :disabled="!canEdit"
              />
              <span>允许总督</span>
            </label>
          </div>

          <FormField
            v-if="draft.needWearFanMedal"
            label="最低粉丝牌等级"
            class="max-w-xs"
          >
            <NumberField
              v-model="draft.fanMedalMinLevel"
              :min="0"
              :max="40"
              :disabled="!canEdit"
            />
          </FormField>
        </div>

        <!-- SuperChat 点播 -->
        <div class="pt-2 border-t border-border/60 space-y-2.5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <SettingRow
              v-model="draft.allowSC"
              type="switch"
              variant="card"
              title="允许通过 SuperChat (SC) 点播"
              description="醒目留言附带点播前缀时直接加入队列"
              :disabled="!canEdit"
            />
            <SettingRow
              v-if="draft.allowSC"
              v-model="draft.scIgnoreLimit"
              type="switch"
              variant="card"
              title="SC 点播无视人数上限与资格"
              description="即使队列已满或非舰长，SC 仍可成功点播"
              :disabled="!canEdit"
            />
          </div>

          <FormField
            v-if="draft.allowSC"
            label="SC 点播最低金额 (元)"
            class="max-w-xs"
          >
            <NumberField
              v-model="draft.scMinPrice"
              :min="0"
              :disabled="!canEdit"
              @update:model-value="(v) => (draft.scMinPrice = v ?? 30)"
            />
          </FormField>
        </div>

        <!-- 礼物点播 -->
        <div class="pt-2 border-t border-border/60 space-y-2.5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <SettingRow
              v-model="draft.allowGift"
              type="switch"
              variant="card"
              title="允许送礼物解锁点播"
              description="观众送出符合条件的礼物后，5 分钟内发点播弹幕将跳过普通门槛"
              :disabled="!canEdit"
            />
            <SettingRow
              v-model="draft.allowIncreasePaymentBySendGift"
              type="switch"
              variant="card"
              title="送礼自动追加已点曲目付费金额"
              description="队列内已有待唱曲目时，送礼金额自动累加至付费排序权重"
              :disabled="!canEdit"
            />
          </div>

          <div
            v-if="draft.allowGift || draft.allowIncreasePaymentBySendGift"
            class="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3"
          >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="礼物最低价值 (元，0 表示不限)">
                <NumberField
                  :model-value="draft.minGiftPrice ?? 0"
                  :min="0"
                  :disabled="!canEdit"
                  @update:model-value="(v) => (draft.minGiftPrice = v && v > 0 ? v : null)"
                />
              </FormField>
              <FormField label="礼物名称与价格组合方式">
                <ToggleGroup
                  type="single"
                  size="xs"
                  :model-value="String(draft.giftFilterType)"
                  :disabled="!canEdit"
                  @update:model-value="(v) => v && (draft.giftFilterType = Number(v) as QueueGiftFilterType)"
                >
                  <ToggleGroupItem :value="String(QueueGiftFilterType.Or)">满足其一 (OR)</ToggleGroupItem>
                  <ToggleGroupItem :value="String(QueueGiftFilterType.And)">同时满足 (AND)</ToggleGroupItem>
                </ToggleGroup>
              </FormField>
            </div>

            <FormField label="指定礼物名称（留空则不限名称）">
              <div class="space-y-2">
                <div class="flex items-center gap-2 max-w-md">
                  <Input
                    v-model="newGiftName"
                    placeholder="输入礼物名，如：辣条、小花花"
                    :disabled="!canEdit"
                    @keyup.enter="addGiftName"
                  />
                  <Button
                    variant="outline"
                    :disabled="!canEdit || !newGiftName.trim()"
                    @click="addGiftName"
                  >
                    <Plus class="size-3.5 mr-1" />
                    添加
                  </Button>
                </div>
                <div
                  v-if="(draft.giftNames ?? []).length > 0"
                  class="flex flex-wrap gap-1.5"
                >
                  <Badge
                    v-for="gift in draft.giftNames"
                    :key="gift"
                    variant="secondary"
                    class="gap-1 pr-1"
                  >
                    {{ gift }}
                    <button
                      v-if="canEdit"
                      type="button"
                      class="rounded-full p-0.5 hover:bg-black/10"
                      @click="removeGiftName(gift)"
                    >
                      <X class="size-3" />
                    </button>
                  </Badge>
                </div>
              </div>
            </FormField>

            <SettingRow
              v-if="draft.allowIncreasePaymentBySendGift"
              v-model="draft.allowIncreaseByAnyPayment"
              type="switch"
              variant="none"
              title="任意付费礼物均可追加金额"
              description="关闭后仅满足上方名称/价格条件的礼物才追加付费金额"
              :disabled="!canEdit"
            />
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 歌单、防刷与网页点歌 -->
    <Card>
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-sm font-semibold">点歌范围、防刷限制与网页自助点歌</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-2 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <SettingRow
            v-model="draft.onlyAllowSongList"
            type="switch"
            variant="card"
            title="仅允许点歌单内的曲目"
            description="拦截主播歌单以外的陌生歌曲，可前往「我的歌单」维护曲库"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.allowReorderSong"
            type="switch"
            variant="card"
            title="允许队列内重复点播同首歌"
            description="开启后多名观众可同时点同一首歌"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.preventSameSongToday"
            type="switch"
            variant="card"
            title="今日已唱防重复"
            description="今天已经唱完的曲目自动拦截，避免反复点同一首歌"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.autoClearOnLiveStart"
            type="switch"
            variant="card"
            title="开播自动清空上次残留队列"
            description="检测到新开播场次时，自动清理上场未唱完的待唱曲目"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.allowFromWeb"
            type="switch"
            variant="card"
            title="允许观众从公开歌单页网页点歌"
            description="观众访问个人歌单页面即可一键提交点播"
            :disabled="!canEdit"
          />
          <SettingRow
            v-if="draft.allowFromWeb"
            v-model="draft.allowAnonymousFromWeb"
            type="switch"
            variant="card"
            title="允许未登录游客匿名网页点歌"
            description="关闭时需登录并绑定 B 站账号才可在网页点歌"
            :disabled="!canEdit"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/60">
          <FormField label="单人同时最多待唱曲数（0 表示不限）">
            <NumberField
              :model-value="draft.maxSongsPerUserInQueue ?? 0"
              :min="0"
              :max="50"
              :disabled="!canEdit"
              @update:model-value="(v) => (draft.maxSongsPerUserInQueue = v ?? 0)"
            />
          </FormField>
          <FormField label="同一首歌冷却时间（分钟，0 表示不限）">
            <NumberField
              :model-value="draft.songCooldownMinute ?? 0"
              :min="0"
              :max="1440"
              :disabled="!canEdit"
              @update:model-value="(v) => (draft.songCooldownMinute = v ?? 0)"
            />
          </FormField>
        </div>

        <FormField
          label="歌名关键词黑名单"
          class="pt-2 border-t border-border/60"
        >
          <div class="space-y-2">
            <div class="flex items-center gap-2 max-w-md">
              <Input
                v-model="newBlacklistWord"
                placeholder="输入禁点歌名或敏感词"
                :disabled="!canEdit"
                @keyup.enter="addBlacklistWord"
              />
              <Button
                variant="outline"
                :disabled="!canEdit || !newBlacklistWord.trim()"
                @click="addBlacklistWord"
              >
                <Plus class="size-3.5 mr-1" />
                添加
              </Button>
            </div>
            <div
              v-if="(draft.songNameBlacklist ?? []).length > 0"
              class="flex flex-wrap gap-1.5"
            >
              <Badge
                v-for="kw in draft.songNameBlacklist"
                :key="kw"
                variant="destructive"
                class="gap-1 pr-1"
              >
                {{ kw }}
                <button
                  v-if="canEdit"
                  type="button"
                  class="rounded-full p-0.5 hover:bg-white/20"
                  @click="removeBlacklistWord(kw)"
                >
                  <X class="size-3" />
                </button>
              </Badge>
            </div>
          </div>
        </FormField>
      </CardContent>
    </Card>

    <!-- 冷却时间控制 -->
    <Card>
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-sm font-semibold">点播冷却时间（秒）</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-2 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <SettingRow
            v-model="draft.enableCooldown"
            type="switch"
            variant="card"
            title="启用弹幕点播冷却"
            description="限制同一观众两次弹幕点播之间的最小间隔"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.enableWebCooldown"
            type="switch"
            variant="card"
            title="启用网页点歌冷却"
            description="独立控制观众在网页端发起点歌的冷却时间"
            :disabled="!canEdit"
          />
        </div>

        <div
          v-if="draft.enableCooldown"
          class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/60"
        >
          <FormField label="普通观众 (秒)">
            <NumberField
              v-model="draft.cooldownSecond"
              :min="0"
              :disabled="!canEdit"
            />
          </FormField>
          <FormField label="舰长 (秒)">
            <NumberField
              v-model="draft.jianzhangCooldownSecond"
              :min="0"
              :disabled="!canEdit"
            />
          </FormField>
          <FormField label="提督 (秒)">
            <NumberField
              v-model="draft.tiduCooldownSecond"
              :min="0"
              :disabled="!canEdit"
            />
          </FormField>
          <FormField label="总督 (秒)">
            <NumberField
              v-model="draft.zongduCooldownSecond"
              :min="0"
              :disabled="!canEdit"
            />
          </FormField>
        </div>

        <FormField
          v-if="draft.enableWebCooldown"
          label="网页点歌冷却 (秒)"
          class="max-w-xs"
        >
          <NumberField
            v-model="draft.webCooldownSecond"
            :min="0"
            :disabled="!canEdit"
          />
        </FormField>
      </CardContent>
    </Card>

    <!-- OBS 展示选项 -->
    <Card>
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-sm font-semibold">OBS 挂件显示设置</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-2 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="点播 OBS 标题">
            <Input
              v-model="draft.obsTitle"
              placeholder="默认为 点播"
              :disabled="!canEdit"
            />
          </FormField>
          <FormField label="今日已唱 OBS 标题">
            <Input
              v-model="draft.obsTitleToday"
              placeholder="默认为 今日已唱"
              :disabled="!canEdit"
            />
          </FormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <SettingRow
            v-model="draft.showRequireInfo"
            type="switch"
            variant="card"
            title="显示底部点播规则"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.showUserName"
            type="switch"
            variant="card"
            title="显示点播观众昵称"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.showFanMadelInfo"
            type="switch"
            variant="card"
            title="显示观众粉丝牌"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.showAuthor"
            type="switch"
            variant="card"
            title="显示歌曲原唱"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.showDescription"
            type="switch"
            variant="card"
            title="显示歌曲备注"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.showPrice"
            type="switch"
            variant="card"
            title="显示 SC / 礼物金额"
            :disabled="!canEdit"
          />
        </div>

        <SettingRow
          v-model="draft.hideWhenEmpty"
          type="switch"
          variant="card"
          title="队列为空时自动隐藏 OBS 面板"
          description="无正在演唱且无待唱曲目时保持透明隐藏，有新点歌时自动浮现"
          :disabled="!canEdit"
        />
      </CardContent>
    </Card>

    <!-- 积分消费、插队与本地通知 -->
    <Card>
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-sm font-semibold">积分点播、插队与提醒偏好</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-2 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <SettingRow
            v-model="draft.enablePointRequest"
            type="switch"
            variant="card"
            title="启用积分点播与网页积分点歌"
            description="开启后观众点播需消耗指定积分"
            :disabled="!canEdit"
          />
          <SettingRow
            v-if="draft.enablePointRequest"
            v-model="draft.pointIgnoreLimit"
            type="switch"
            variant="card"
            title="消耗积分时忽略门槛与冷却"
            description="使用积分点歌时跳过粉丝牌、舰长及冷却限制"
            :disabled="!canEdit"
          />
        </div>

        <FormField
          v-if="draft.enablePointRequest"
          label="每次点播消耗积分"
          class="max-w-xs"
        >
          <NumberField
            v-model="draft.pointRequestCost"
            :min="0"
            :disabled="!canEdit"
          />
        </FormField>

        <div class="pt-2 border-t border-border/60 space-y-2.5">
          <SettingRow
            v-model="draft.allowPointPriority"
            type="switch"
            variant="card"
            title="允许使用积分插队"
            description="支持在直播间发送插队关键词或在公开歌单页直接加价插队"
            :disabled="!canEdit"
          />

          <div
            v-if="draft.allowPointPriority"
            class="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <FormField label="弹幕插队触发前缀">
              <Input
                v-model="draft.pointPriorityKeyword"
                placeholder="例如：插队"
                :disabled="!canEdit"
              />
            </FormField>
            <FormField label="插队额外消耗积分">
              <NumberField
                v-model="draft.pointPriorityCost"
                :min="0"
                :disabled="!canEdit"
              />
            </FormField>
          </div>
        </div>

        <div class="pt-2 border-t border-border/60">
          <SettingRow
            variant="compact"
            title="自动关闭点播失败提醒通知"
            description="仅保存在当前浏览器本地，开启后失败弹窗将在 3 秒后自动关闭"
          >
            <Switch v-model:checked="liveRequest.isWarnMessageAutoClose" />
          </SettingRow>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
