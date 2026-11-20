<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import type { ResponsePointGoodModel } from '@/api/client-types'
import { GoodsTypes, type VirtualAttachmentModel } from '@/api/generated/model'
import { postApiPointUpdateGoods } from '@/api/generated/point/point'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { ImageUpload, type UploadImageItem } from '@/shared/ui/image-upload'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Tag } from '@/shared/ui/tag'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import GoodsDeliverySection from './goods-dialog/GoodsDeliverySection.vue'
import {
  buildGoodsSubmitPayload,
  buildPreviewGoods,
  createDefaultGoodsModel,
  type GoodsModel,
  initGoodsDraft,
  validateGoodsDraft,
} from './goods-dialog/goodsFormHelpers'
import GoodsPrivilegeSection from './goods-dialog/GoodsPrivilegeSection.vue'
import GoodsScheduleSection from './goods-dialog/GoodsScheduleSection.vue'
import GoodsSubItemsSection from './goods-dialog/GoodsSubItemsSection.vue'

const props = defineProps<{
  editingGoods?: ResponsePointGoodModel
  duplicateFrom?: ResponsePointGoodModel
  existTags: string[]
}>()

const emit = defineEmits<{
  saved: [goods: ResponsePointGoodModel]
}>()

const open = defineModel<boolean>('open', { required: true })

const goodsTypeOptions = [
  { label: '虚拟礼物', value: GoodsTypes.Virtual },
  { label: '实体礼物', value: GoodsTypes.Physical },
  { label: '服务礼物', value: GoodsTypes.Service },
]

const currentGoodsModel = ref<GoodsModel>(createDefaultGoodsModel())
const subItemCoverFiles = ref<Record<number, UploadImageItem[]>>({})
const privateAttachments = ref<VirtualAttachmentModel[]>([])
const shouldWatermarkCover = ref(true)
const isAllowedPrivacyPolicy = ref(false)
const isLoading = ref(false)
const tagInput = ref('')
const openAccordions = ref<string[]>([])
const highlightedFieldId = ref<string | null>(null)

const isEditMode = computed(() => Boolean(currentGoodsModel.value.goods.id))
const previewGoods = computed(() => buildPreviewGoods(currentGoodsModel.value))

const availableQuickTags = computed(() => {
  const current = new Set(currentGoodsModel.value.goods.tags ?? [])
  return props.existTags.filter((tag) => !current.has(tag))
})

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return
    const initialized = props.duplicateFrom
      ? initGoodsDraft(props.duplicateFrom, true)
      : initGoodsDraft(props.editingGoods, false)
    currentGoodsModel.value = initialized.model
    subItemCoverFiles.value = initialized.subItemCoverFiles
    privateAttachments.value = initialized.privateAttachments
    isAllowedPrivacyPolicy.value = initialized.isAllowedPrivacyPolicy
    openAccordions.value = initialized.defaultAccordionValues
    shouldWatermarkCover.value = true
    tagInput.value = ''
    highlightedFieldId.value = null
  },
  { immediate: true },
)

function addTag(raw?: string) {
  const value = (raw ?? tagInput.value).trim()
  if (!value) return
  const tags = currentGoodsModel.value.goods.tags ?? []
  if (!tags.includes(value)) {
    currentGoodsModel.value.goods.tags = [...tags, value]
  }
  if (!raw) tagInput.value = ''
}

function removeTag(tag: string) {
  currentGoodsModel.value.goods.tags = (currentGoodsModel.value.goods.tags ?? []).filter((t) => t !== tag)
}

function onGoodsTypeChange(raw: string | undefined) {
  if (raw === undefined) return
  const type = Number(raw) as GoodsTypes
  if (type === currentGoodsModel.value.goods.type) return

  currentGoodsModel.value.goods.type = type
  if (type === GoodsTypes.Service) {
    currentGoodsModel.value.goods.serviceConfig ??= { fields: [], rules: '', paused: false }
  }
}

async function revealValidationError(accordion?: 'subItems' | 'rules' | 'schedule', fieldId?: string) {
  if (accordion && !openAccordions.value.includes(accordion)) {
    openAccordions.value = [...openAccordions.value, accordion]
  }
  if (!fieldId) return
  highlightedFieldId.value = fieldId
  await nextTick()
  const el = document.getElementById(fieldId)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const focusable = el.querySelector<HTMLElement>('input, textarea, button')
    focusable?.focus({ preventScroll: true })
  }
  window.setTimeout(() => {
    if (highlightedFieldId.value === fieldId) highlightedFieldId.value = null
  }, 2400)
}

async function updateGoods() {
  const validationError = validateGoodsDraft(currentGoodsModel.value, isAllowedPrivacyPolicy.value)
  if (validationError) {
    toast.error(validationError.message)
    await revealValidationError(validationError.accordion, validationError.fieldId)
    return
  }

  isLoading.value = true
  try {
    const payload = await buildGoodsSubmitPayload({
      model: currentGoodsModel.value,
      subItemCoverFiles: subItemCoverFiles.value,
      privateAttachments: privateAttachments.value,
      shouldWatermarkCover: shouldWatermarkCover.value,
    })
    const res = await postApiPointUpdateGoods(payload)
    if (res.code === 200 && res.data) {
      toast.success(isEditMode.value ? '修改礼物成功' : '添加礼物成功')
      emit('saved', res.data as ResponsePointGoodModel)
      open.value = false
    } else {
      toast.error(res.message || '保存失败')
    }
  } catch (err) {
    console.error(err)
    toast.error('保存失败')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
      <DialogHeader class="px-5 py-3.5 border-b border-border/70">
        <DialogTitle class="text-sm font-semibold">
          {{ isEditMode ? `修改礼物 · ${currentGoodsModel.goods.name || ''}` : '添加礼物' }}
        </DialogTitle>
      </DialogHeader>

      <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 scrollbar-thin">
        <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_272px] gap-6 items-start">
          <!-- 左侧单屏分组表单 -->
          <div class="space-y-5 min-w-0">
            <!-- 基本信息 -->
            <section class="space-y-3.5">
              <div class="text-xs font-semibold text-muted-foreground border-b pb-1">基本信息</div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div
                  id="goods-field-name"
                  :class="
                    highlightedFieldId === 'goods-field-name' ? 'ring-2 ring-destructive rounded-md p-1 -m-1' : ''
                  "
                >
                  <FormField
                    label="礼物名称"
                    required
                    v-model="currentGoodsModel.goods.name"
                    placeholder="请输入礼物名称"
                    :maxlength="200"
                  />
                </div>
                <div
                  id="goods-field-price"
                  :class="
                    highlightedFieldId === 'goods-field-price' ? 'ring-2 ring-destructive rounded-md p-1 -m-1' : ''
                  "
                >
                  <FormField
                    label="所需积分"
                    required
                  >
                    <NumberField
                      :model-value="currentGoodsModel.goods.price ?? 0"
                      :min="0"
                      @update:model-value="currentGoodsModel.goods.price = $event ?? 0"
                    />
                  </FormField>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div id="goods-field-stock">
                  <FormField label="库存设置">
                    <div class="flex items-center gap-3 min-h-8">
                      <div class="flex items-center gap-1.5 shrink-0">
                        <Checkbox
                          id="goods-unlimited-stock"
                          :checked="currentGoodsModel.goods.count == null"
                          @update:checked="(v) => (currentGoodsModel.goods.count = v ? undefined : 10)"
                        />
                        <label
                          for="goods-unlimited-stock"
                          class="text-xs cursor-pointer"
                        >
                          不限库存
                        </label>
                      </div>
                      <NumberField
                        v-if="currentGoodsModel.goods.count != null"
                        :model-value="currentGoodsModel.goods.count ?? 0"
                        :min="0"
                        class="flex-1"
                        @update:model-value="currentGoodsModel.goods.count = $event ?? 0"
                      />
                    </div>
                  </FormField>
                </div>

                <FormField label="展示与置顶">
                  <div class="flex items-center gap-2 min-h-8">
                    <Checkbox
                      id="goods-pinned"
                      :checked="Boolean(currentGoodsModel.goods.isPinned)"
                      @update:checked="(v) => (currentGoodsModel.goods.isPinned = Boolean(v))"
                    />
                    <label
                      for="goods-pinned"
                      class="text-xs cursor-pointer"
                    >
                      在礼物列表顶部置顶显示
                    </label>
                  </div>
                </FormField>
              </div>

              <FormField label="礼物类型">
                <ToggleGroup
                  type="single"
                  :model-value="String(currentGoodsModel.goods.type)"
                  @update:model-value="onGoodsTypeChange"
                >
                  <ToggleGroupItem
                    v-for="opt in goodsTypeOptions"
                    :key="opt.value"
                    :value="String(opt.value)"
                  >
                    {{ opt.label }}
                  </ToggleGroupItem>
                </ToggleGroup>
              </FormField>

              <FormField
                label="礼物描述"
                type="textarea"
                v-model="currentGoodsModel.goods.description"
                placeholder="可选，输入关于礼物的详细介绍与说明"
                :maxlength="500"
                :rows="2"
                :extra="`${(currentGoodsModel.goods.description ?? '').length}/500`"
              />

              <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3.5 items-start">
                <FormField
                  label="分类标签"
                  extra="可用于前台礼物筛选与分组展示"
                >
                  <div class="space-y-2">
                    <div class="flex items-center gap-2">
                      <Input
                        v-model="tagInput"
                        placeholder="输入标签名后回车添加"
                        class="flex-1"
                        @keydown.enter.prevent="addTag()"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        :disabled="!tagInput.trim()"
                        @click="addTag()"
                      >
                        添加
                      </Button>
                    </div>
                    <div
                      v-if="currentGoodsModel.goods.tags?.length"
                      class="flex flex-wrap gap-1.5"
                    >
                      <Tag
                        v-for="tag in currentGoodsModel.goods.tags"
                        :key="tag"
                        type="primary"
                        closable
                        @close="removeTag(tag)"
                      >
                        {{ tag }}
                      </Tag>
                    </div>
                    <div
                      v-if="availableQuickTags.length"
                      class="flex flex-wrap items-center gap-1"
                    >
                      <span class="text-xs text-muted-foreground">快速添加:</span>
                      <Button
                        v-for="tag in availableQuickTags"
                        :key="tag"
                        type="button"
                        variant="ghost"
                        size="xs"
                        class="text-muted-foreground hover:text-foreground"
                        @click="addTag(tag)"
                      >
                        + {{ tag }}
                      </Button>
                    </div>
                  </div>
                </FormField>

                <FormField label="礼物封面">
                  <div class="space-y-1.5">
                    <ImageUpload
                      v-model="currentGoodsModel.cover"
                      :max-files="1"
                      accept="image/*"
                      size="md"
                    />
                    <div class="flex items-center gap-1.5">
                      <Checkbox
                        id="goods-watermark"
                        :checked="shouldWatermarkCover"
                        @update:checked="(v) => (shouldWatermarkCover = Boolean(v))"
                      />
                      <label
                        for="goods-watermark"
                        class="text-[11px] text-muted-foreground cursor-pointer"
                      >
                        自动加水印
                      </label>
                    </div>
                  </div>
                </FormField>
              </div>
            </section>

            <!-- 交付配置 -->
            <section class="space-y-3">
              <div class="text-xs font-semibold text-muted-foreground border-b pb-1">交付配置</div>
              <GoodsDeliverySection
                v-model:goods="currentGoodsModel.goods"
                v-model:private-attachments="privateAttachments"
                v-model:is-allowed-privacy-policy="isAllowedPrivacyPolicy"
              />
            </section>

            <!-- 低频高级选项默认折叠 -->
            <Accordion
              v-model="openAccordions"
              type="multiple"
              class="space-y-2"
            >
              <AccordionItem
                value="subItems"
                class="rounded-lg border border-border/70 px-3"
              >
                <AccordionTrigger class="py-2.5 text-xs font-semibold hover:no-underline">
                  <div class="flex items-center gap-2">
                    <span>多款式 / 规格配置</span>
                    <Badge
                      v-if="currentGoodsModel.goods.subItems?.length"
                      variant="secondary"
                      size="xs"
                    >
                      {{ currentGoodsModel.goods.subItems.length }} 个款式
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent class="pt-1 pb-3">
                  <GoodsSubItemsSection
                    v-model:goods="currentGoodsModel.goods"
                    v-model:sub-item-cover-files="subItemCoverFiles"
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="schedule"
                class="rounded-lg border border-border/70 px-3"
              >
                <AccordionTrigger class="py-2.5 text-xs font-semibold hover:no-underline">
                  <div class="flex items-center gap-2">
                    <span>定时售卖与限时折扣</span>
                    <Badge
                      v-if="currentGoodsModel.goods.discountPrice != null"
                      variant="destructive"
                      size="xs"
                    >
                      限时 {{ currentGoodsModel.goods.discountPrice }} 积分
                    </Badge>
                    <Badge
                      v-else-if="currentGoodsModel.goods.saleStartTime || currentGoodsModel.goods.saleEndTime"
                      variant="secondary"
                      size="xs"
                    >
                      定时窗口
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent class="pt-1 pb-3">
                  <GoodsScheduleSection v-model:goods="currentGoodsModel.goods" />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="rules"
                class="rounded-lg border border-border/70 px-3"
              >
                <AccordionTrigger class="py-2.5 text-xs font-semibold hover:no-underline">
                  <div class="flex items-center gap-2">
                    <span>限购规则与舰长特权</span>
                    <Badge
                      v-if="currentGoodsModel.goods.setting?.guardFreeMonths != null"
                      variant="success"
                      size="xs"
                    >
                      舰长免费
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent class="pt-1 pb-3">
                  <GoodsPrivilegeSection v-model:goods="currentGoodsModel.goods" />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <!-- 右侧粘性实时预览 -->
          <aside class="lg:sticky lg:top-0 space-y-2.5">
            <div class="flex-between text-xs">
              <span class="font-semibold text-muted-foreground">前台卡片预览</span>
              <Badge
                variant="outline"
                size="xs"
              >
                实时
              </Badge>
            </div>
            <PointGoodsItem
              :goods="previewGoods"
              :is-manage="true"
            />
            <p class="text-[11px] text-muted-foreground leading-relaxed m-0">
              实际展示将根据观众认证状态、在舰等级与已兑换次数动态计算是否免费或限购。
            </p>
          </aside>
        </div>
      </div>

      <DialogFooter class="px-5 py-3 border-t bg-muted/20">
        <Button
          type="button"
          variant="ghost"
          @click="open = false"
        >
          取消
        </Button>
        <Button
          type="button"
          :loading="isLoading"
          @click="updateGoods"
        >
          保存礼物
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
