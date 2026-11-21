<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import {
  normalizeVoteConfig,
  VOTE_MULTI_MODE_OPTIONS,
  type VoteConfigModel,
  VoteMultiMode,
  VoteResultMode,
} from '@/api/vote'
import { SYSTEM_CHINESE_FONT_OPTIONS } from '@/shared/questionDisplayPresets'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const props = defineProps<{
  open: boolean
  config: VoteConfigModel
  saving: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [config: VoteConfigModel]
}>()

const draft = ref<VoteConfigModel>(normalizeVoteConfig(props.config))
const defaultOptionsText = ref('')
const activeTab = ref('rules')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      draft.value = normalizeVoteConfig(structuredClone(props.config))
      defaultOptionsText.value = (draft.value.defaultOptions ?? []).join('\n')
    }
  },
  { immediate: true },
)

const fontScaleSlider = computed<number[]>({
  get: () => [Math.round((draft.value.fontScale || 1) * 100)],
  set: (v) => {
    draft.value.fontScale = Number(((v[0] ?? 100) / 100).toFixed(2))
  },
})

const opacitySlider = computed<number[]>({
  get: () => [Math.round((draft.value.cardOpacity || 0.88) * 100)],
  set: (v) => {
    draft.value.cardOpacity = Number(((v[0] ?? 88) / 100).toFixed(2))
  },
})

const blurSlider = computed<number[]>({
  get: () => [draft.value.backdropBlur ?? 24],
  set: (v) => {
    draft.value.backdropBlur = v[0] ?? 24
  },
})

const radiusSlider = computed<number[]>({
  get: () => [draft.value.borderRadius ?? 20],
  set: (v) => {
    draft.value.borderRadius = v[0] ?? 20
    draft.value.roundedCorners = draft.value.borderRadius > 0
  },
})

function resetCustomColors() {
  draft.value.accentColor = ''
  draft.value.leadingColor = ''
  draft.value.duelLeftColor = ''
  draft.value.duelRightColor = ''
}

function handleSave() {
  const lines = defaultOptionsText.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  draft.value.defaultOptions = lines.length >= 2 ? lines : ['选项1', '选项2']
  draft.value.allowMultipleVotes =
    draft.value.multiVoteMode === VoteMultiMode.MultiOncePerOption ||
    draft.value.multiVoteMode === VoteMultiMode.MultiUnlimited
  emit('save', normalizeVoteConfig(draft.value))
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="(v) => emit('update:open', v)"
  >
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>弹幕投票全局设置</DialogTitle>
        <DialogDescription>
          修改计票规则、观众参与门槛、礼物加权与 OBS 画面默认外观，保存后实时同步生效
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="w-full grid grid-cols-3">
          <TabsTrigger value="rules">规则与指令</TabsTrigger>
          <TabsTrigger value="eligibility">门槛与加权</TabsTrigger>
          <TabsTrigger value="appearance">OBS 外观</TabsTrigger>
        </TabsList>

        <ScrollArea class="mt-3 max-h-[60vh] pr-3 [&_[data-reka-scroll-area-viewport]>div]:!block">
          <!-- Tab 1: 规则与指令 -->
          <TabsContent value="rules" class="space-y-3 mt-0">
            <SettingRow
              variant="compact"
              title="启用弹幕投票功能"
              description="关闭后不再接收弹幕与礼物计票"
            >
              <Switch v-model="draft.isEnabled" />
            </SettingRow>

            <SettingRow
              variant="compact"
              title="OBS 实时显示各选项票数"
              description="关闭时开启防从众保护：后端在投票结束前隐藏明细与排行，结算时统一揭晓"
            >
              <Switch v-model="draft.showResults" />
            </SettingRow>

            <SettingRow
              variant="compact"
              title="允许观众自由提名新选项"
              description="观众发送「命令词 + 新内容」时自动新增选项"
            >
              <Switch v-model="draft.allowCustomOptions" />
            </SettingRow>

            <FormField
              v-if="draft.allowCustomOptions"
              label="自定义提名选项上限"
              description="防止刷屏导致选项无限膨胀（2 ~ 50）"
            >
              <NumberField v-model="draft.maxCustomOptions" :min="2" :max="50" />
            </FormField>

            <SettingRow
              variant="compact"
              title="卡片底部显示最新投票人"
              description="实时轻提示刚参与投票的观众昵称（防从众模式下不暴露所投选项）"
            >
              <Switch v-model="draft.showRecentVoter" />
            </SettingRow>

            <Separator />

            <div class="grid gap-3 sm:grid-cols-2">
              <FormField label="弹幕投票命令前缀" description="观众发送「前缀 + 选项/序号」可触发">
                <Input v-model="draft.voteCommand" maxlength="20" placeholder="投票" />
              </FormField>

              <FormField label="主播弹幕结束命令" description="主播在直播间发送此弹幕立即结算">
                <Input v-model="draft.voteEndCommand" maxlength="20" placeholder="结束投票" />
              </FormField>

              <FormField label="默认投票标题">
                <Input v-model="draft.voteTitle" maxlength="50" placeholder="观众投票" />
              </FormField>

              <FormField label="默认持续时长（秒）" description="0 表示不限时">
                <NumberField v-model="draft.voteDurationSeconds" :min="0" :max="3600" :step="30" />
              </FormField>

              <FormField label="默认投票模式">
                <Select
                  :model-value="String(draft.multiVoteMode)"
                  @update:model-value="(v) => { draft.multiVoteMode = Number(v) as VoteMultiMode }"
                >
                  <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in VOTE_MULTI_MODE_OPTIONS"
                      :key="opt.value"
                      :value="String(opt.value)"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="结算画面停留时长（秒）" description="投票结束后在 OBS 保留展示的时间（5~300s）">
                <NumberField v-model="draft.resultHoldSeconds" :min="5" :max="300" :step="5" />
              </FormField>
            </div>

            <FormField label="默认选项列表" description="每行一个选项，新建投票表单默认带入">
              <Textarea v-model="defaultOptionsText" rows="3" placeholder="选项1&#10;选项2" />
            </FormField>
          </TabsContent>

          <!-- Tab 2: 门槛与礼物/加权 -->
          <TabsContent value="eligibility" class="space-y-3 mt-0">
            <div class="text-xs font-semibold text-foreground">观众参与门槛</div>

            <SettingRow
              variant="compact"
              title="仅限大航海成员参与"
              description="仅舰长、提督、总督的弹幕或礼物计入投票"
            >
              <Switch v-model="draft.requireGuard" />
            </SettingRow>

            <SettingRow
              variant="compact"
              title="仅限拥有粉丝牌的观众"
              description="未持有粉丝牌的观众弹幕将被忽略"
            >
              <Switch v-model="draft.requireFansMedal" />
            </SettingRow>

            <div class="grid gap-3 sm:grid-cols-2">
              <SettingRow
                variant="compact"
                title="需当前佩戴粉丝牌"
                description="检查粉丝牌点亮/佩戴状态"
              >
                <Switch v-model="draft.requireWearingFansMedal" />
              </SettingRow>

              <FormField label="最低粉丝牌等级" description="0 表示不限等级">
                <NumberField v-model="draft.minFansMedalLevel" :min="0" :max="60" />
              </FormField>
            </div>

            <Separator />

            <div class="text-xs font-semibold text-foreground">大航海票数加权（1 = 不加权）</div>
            <div class="grid gap-3 sm:grid-cols-3">
              <FormField label="舰长权重（票）">
                <NumberField v-model="draft.guardWeightJianzhang" :min="1" :max="100" />
              </FormField>
              <FormField label="提督权重（票）">
                <NumberField v-model="draft.guardWeightTidu" :min="1" :max="100" />
              </FormField>
              <FormField label="总督权重（票）">
                <NumberField v-model="draft.guardWeightZongdu" :min="1" :max="100" />
              </FormField>
            </div>

            <Separator />

            <div class="text-xs font-semibold text-foreground">礼物与醒目留言 (SC) 投票</div>

            <SettingRow
              variant="compact"
              title="开启礼物 / SC 投票"
              description="允许通过送礼或 SC 为选项加票或累加贡献（未带选项词时累加至该观众已投项）"
            >
              <Switch v-model="draft.allowGiftVoting" />
            </SettingRow>

            <div v-if="draft.allowGiftVoting" class="space-y-3">
              <div class="grid gap-3 sm:grid-cols-2">
                <FormField label="最低触发金额（元）" description="低于此金额的礼物不触发计票">
                  <NumberField
                    :model-value="draft.minGiftPrice ?? 1"
                    :min="0.1"
                    :max="10000"
                    :step="1"
                    @update:model-value="(v) => { draft.minGiftPrice = v ?? 1 }"
                  />
                </FormField>

                <FormField label="每满多少元折算 1 票" description="例如填 10 表示 ¥30 礼物折算 3 票（至少 1 票）">
                  <NumberField
                    v-model="draft.giftVoteStep"
                    :min="0.1"
                    :max="10000"
                    :step="1"
                  />
                </FormField>
              </div>

              <FormField
                label="计票与胜负排序口径"
                description="「按贡献金额」模式下，进度条、领先提示与胜出均按累计金额统计"
              >
                <ToggleGroup
                  type="single"
                  :model-value="String(draft.voteResultMode)"
                  class="w-full grid grid-cols-2"
                  @update:model-value="(v) => { if (v !== '') draft.voteResultMode = Number(v) as VoteResultMode }"
                >
                  <ToggleGroupItem :value="String(VoteResultMode.ByCount)">按票数统计</ToggleGroupItem>
                  <ToggleGroupItem :value="String(VoteResultMode.ByContribution)">按贡献金额统计</ToggleGroupItem>
                </ToggleGroup>
              </FormField>
            </div>
          </TabsContent>

          <!-- Tab 3: OBS 外观定制 -->
          <TabsContent value="appearance" class="space-y-3 mt-0">
            <div class="grid gap-3 sm:grid-cols-2">
              <FormField label="默认卡片主题">
                <Select v-model="draft.theme">
                  <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="glass">毛玻璃 (Glass)</SelectItem>
                    <SelectItem value="duel">红蓝对决 (Duel)</SelectItem>
                    <SelectItem value="minimal">极简深色 (Minimal)</SelectItem>
                    <SelectItem value="light">浅色通透 (Light)</SelectItem>
                    <SelectItem value="transparent">透明无底 (Transparent)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="默认停靠位置">
                <Select v-model="draft.displayPosition">
                  <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">左上</SelectItem>
                    <SelectItem value="top-center">顶部居中</SelectItem>
                    <SelectItem value="top-right">右上</SelectItem>
                    <SelectItem value="center-left">左中</SelectItem>
                    <SelectItem value="center">正中</SelectItem>
                    <SelectItem value="center-right">右中</SelectItem>
                    <SelectItem value="bottom-left">左下</SelectItem>
                    <SelectItem value="bottom-center">底部居中</SelectItem>
                    <SelectItem value="bottom-right">右下</SelectItem>
                    <SelectItem value="fill">铺满容器</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField label="卡片字体" description="支持全站 Google Fonts 字体库与常见中文字体">
              <GoogleFontPicker
                v-model="draft.fontFamily"
                :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
                placeholder="默认系统字体"
              />
            </FormField>

            <div class="grid gap-3 sm:grid-cols-2">
              <FormField label="字号缩放" :extra="`${Math.round(draft.fontScale * 100)}%`">
                <Slider v-model="fontScaleSlider" :min="75" :max="150" :step="5" />
              </FormField>

              <FormField label="卡片圆角" :extra="draft.borderRadius === 0 ? '直角' : `${draft.borderRadius}px`">
                <Slider v-model="radiusSlider" :min="0" :max="32" :step="2" />
              </FormField>

              <FormField label="卡片背景不透明度" :extra="`${Math.round(draft.cardOpacity * 100)}%`">
                <Slider v-model="opacitySlider" :min="15" :max="100" :step="2" />
              </FormField>

              <FormField label="毛玻璃模糊半径" :extra="`${draft.backdropBlur}px`">
                <Slider v-model="blurSlider" :min="0" :max="40" :step="2" />
              </FormField>
            </div>

            <Separator />

            <div class="flex-between">
              <span class="text-xs font-semibold text-foreground">自定义配色（留空沿用主题默认）</span>
              <Button variant="ghost" size="xs" @click="resetCustomColors">
                <RotateCcw class="size-3" />
                恢复默认配色
              </Button>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <FormField label="常规进度条主色">
                <ColorPicker v-model="draft.accentColor" />
              </FormField>
              <FormField label="领先 / 胜出高亮色">
                <ColorPicker v-model="draft.leadingColor" />
              </FormField>
              <FormField label="对决左侧配色">
                <ColorPicker v-model="draft.duelLeftColor" />
              </FormField>
              <FormField label="对决右侧配色">
                <ColorPicker v-model="draft.duelRightColor" />
              </FormField>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">取消</Button>
        <Button :disabled="saving" @click="handleSave">
          {{ saving ? '保存中...' : '保存设置' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
