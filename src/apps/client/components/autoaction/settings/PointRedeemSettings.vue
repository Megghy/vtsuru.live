<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { getApiPointGetGoods } from '@/api/generated/point/point'
import type { AutoActionItem } from '@/apps/client/store/autoAction/types'
import { TriggerType } from '@/apps/client/store/autoAction/types'
import type { ResponseBasePointGoodsModel } from '@/api/generated/model'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'

const props = defineProps<{
  action: AutoActionItem
}>()

const goodsList = ref<ResponseBasePointGoodsModel[]>([])

onMounted(async () => {
  try {
    const res = await getApiPointGetGoods()
    if (res.code === 200 && res.data) {
      goodsList.value = res.data
    }
  } catch {
    // 非登录或无商品时保持手动输入 ID 即可
  }
})

const goodsIdsText = computed({
  get: () => (props.action.triggerConfig.pointGoodsIds ?? []).join(', '),
  set: (val: string) => {
    const ids = val
      .split(/[,，\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
    props.action.triggerConfig.pointGoodsIds = [...new Set(ids)]
  },
})

const keywordsText = computed({
  get: () => (props.action.triggerConfig.pointGoodsNameKeywords ?? []).join(', '),
  set: (val: string) => {
    props.action.triggerConfig.pointGoodsNameKeywords = val
      .split(/[,，]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  },
})

const includeFree = computed({
  get: () => props.action.triggerConfig.pointIncludeFree ?? true,
  set: (val: boolean) => {
    props.action.triggerConfig.pointIncludeFree = val
  },
})

function appendGoodsId(goodsIdStr: string) {
  const id = Number(goodsIdStr)
  if (!Number.isInteger(id) || id <= 0) return
  const current = props.action.triggerConfig.pointGoodsIds ?? []
  if (!current.includes(id)) {
    props.action.triggerConfig.pointGoodsIds = [...current, id]
  }
}
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.POINT_REDEEM"
    class="point-redeem-trigger-settings space-y-3"
  >
    <FormField
      label="限定商品 ID（留空则匹配全部）"
      hint="多个商品 ID 用逗号分隔；可从右侧快捷添加现有商品"
    >
      <div class="flex items-center gap-2">
        <Input
          v-model="goodsIdsText"
          placeholder="例如: 12, 18"
          class="flex-1"
        />
        <Select
          v-if="goodsList.length > 0"
          @update:model-value="(val) => typeof val === 'string' && appendGoodsId(val)"
        >
          <SelectTrigger class="w-44">
            <SelectValue placeholder="从积分商品添加" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="g in goodsList"
              :key="g.id"
              :value="String(g.id)"
            >
              #{{ g.id }} {{ g.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </FormField>

    <FormField
      label="限定商品名称关键词（留空不限）"
      hint="多个关键词用逗号分隔，商品名包含任一关键词即触发"
    >
      <Input
        v-model="keywordsText"
        placeholder="例如: 音效, 变声, 惩罚"
      />
    </FormField>

    <SettingRow
      type="switch"
      variant="compact"
      title="包含 0 积分免费兑换"
      hint="包含舰长免费领取等消耗为 0 积分的订单"
      v-model="includeFree"
    />
  </div>
</template>
