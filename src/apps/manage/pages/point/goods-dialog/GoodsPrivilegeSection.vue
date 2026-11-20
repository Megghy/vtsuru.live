<script setup lang="ts">
import Info24Regular from '@vicons/fluent/es/Info24Regular'
import { computed } from 'vue'

import type { UploadPointGoodsModel } from '@/api/client-types'
import { GuardLevel } from '@/api/generated/model'
import { Checkbox } from '@/shared/ui/checkbox'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import GuardMonthRulePicker from './GuardMonthRulePicker.vue'

const goods = defineModel<UploadPointGoodsModel>('goods', { required: true })

const guardLevelOptions = [
  { label: '不限', value: GuardLevel.None },
  { label: '舰长', value: GuardLevel.Jianzhang },
  { label: '提督', value: GuardLevel.Tidu },
  { label: '总督', value: GuardLevel.Zongdu },
]

const guardThresholdOptions = [
  { label: '不限', value: GuardLevel.None },
  { label: '舰长及以上', value: GuardLevel.Jianzhang },
  { label: '提督及以上', value: GuardLevel.Tidu },
  { label: '仅总督', value: GuardLevel.Zongdu },
]

const currentSetting = computed(() => goods.value.setting!)
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField label="重复兑换">
        <div class="flex items-center gap-2 min-h-8">
          <Checkbox
            id="goods-rebuy"
            :checked="Boolean(goods.isAllowRebuy)"
            @update:checked="(v) => (goods.isAllowRebuy = Boolean(v))"
          />
          <label
            for="goods-rebuy"
            class="text-xs cursor-pointer"
          >
            允许同一用户多次重复兑换
          </label>
        </div>
      </FormField>

      <div
        v-if="goods.isAllowRebuy"
        id="goods-max-buy-count"
      >
        <FormField label="单人最大兑换数量">
          <NumberField
            :model-value="goods.maxBuyCount ?? 1"
            :min="1"
            @update:model-value="goods.maxBuyCount = $event ?? 1"
          />
        </FormField>
      </div>
    </div>

    <!-- 舰长免费特权 -->
    <div class="rounded-md border p-3 bg-muted/20 space-y-3">
      <GuardMonthRulePicker
        v-model:months="currentSetting.guardFreeMonths"
        enable-checkbox-id="goods-guard-free"
        enable-label="允许舰长免费兑换"
        current-only-checkbox-id="goods-guard-free-current"
        current-only-label="当前在舰即可生效（不限特定上舰月份）"
        specific-title="指定上舰月份（在以下任意月份有上舰记录即可免费兑换）："
      >
        <template #header-extra>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Info24Regular class="size-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent> 符合条件的舰长在兑换此礼物时无需消耗积分（仍受限购数量与库存限制） </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </template>

        <template #before-months>
          <FormField label="最低免费兑换等级">
            <ToggleGroup
              type="single"
              size="xs"
              :model-value="String(currentSetting.allowGuardFreeMinLevel ?? GuardLevel.None)"
              @update:model-value="
                (val) => val !== undefined && (currentSetting.allowGuardFreeMinLevel = Number(val) as GuardLevel)
              "
            >
              <ToggleGroupItem
                v-for="opt in guardLevelOptions"
                :key="opt.value"
                :value="String(opt.value)"
              >
                {{ opt.label }}
              </ToggleGroupItem>
            </ToggleGroup>
          </FormField>
        </template>
      </GuardMonthRulePicker>
    </div>

    <!-- 舰长门槛限制 -->
    <div class="rounded-md border p-3 bg-muted/20 space-y-3">
      <FormField label="兑换门槛 (最低舰长等级限制)">
        <ToggleGroup
          type="single"
          size="xs"
          :model-value="String(currentSetting.allowGuardLevel ?? GuardLevel.None)"
          @update:model-value="
            (val) => val !== undefined && (currentSetting.allowGuardLevel = Number(val) as GuardLevel)
          "
        >
          <ToggleGroupItem
            v-for="opt in guardThresholdOptions"
            :key="opt.value"
            :value="String(opt.value)"
          >
            {{ opt.label }}
          </ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <div
        v-if="(currentSetting.allowGuardLevel ?? GuardLevel.None) !== GuardLevel.None"
        class="pl-3 border-l-2 border-primary/30"
      >
        <GuardMonthRulePicker
          v-model:months="currentSetting.guardLevelMonths"
          enable-checkbox-id="goods-guard-level-limit"
          enable-label="限定特定上舰月份（不勾选则仅要求当前在舰）"
          current-only-checkbox-id="goods-guard-level-current"
          current-only-label="当前在舰即可"
          specific-title="指定上舰月份（在以下任意月份有上舰记录即可满足条件）："
        />
      </div>
    </div>
  </div>
</template>
