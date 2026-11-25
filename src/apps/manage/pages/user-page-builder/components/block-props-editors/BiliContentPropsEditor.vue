<script setup lang="ts">
import { computed } from 'vue'

import type { BlockNode } from '@/apps/user-page/block/schema'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { SettingRow } from '@/shared/ui/setting-row'

import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)

const isVideos = computed(() => props.block.type === 'biliVideos')

const titleModel = computed({
  get: () => String(blockProps.value.title ?? (isVideos.value ? '最新视频' : 'B 站动态')),
  set: (v: string) => {
    blockProps.value.title = v
  },
})

const countModel = computed({
  get: () => Number(blockProps.value.count ?? (isVideos.value ? 6 : 5)),
  set: (v: number) => {
    blockProps.value.count = v
  },
})

const columnsModel = computed({
  get: () => Number(blockProps.value.columns ?? 3),
  set: (v: number) => {
    blockProps.value.columns = v
  },
})

const keywordModel = computed({
  get: () => String(blockProps.value.keyword ?? ''),
  set: (v: string) => {
    blockProps.value.keyword = v
  },
})

const seasonIdModel = computed({
  get: () => Number(blockProps.value.seasonId ?? 0),
  set: (v: number) => {
    blockProps.value.seasonId = v
  },
})

const showImagesModel = computed({
  get: () => blockProps.value.showImages !== false,
  set: (v: boolean) => {
    blockProps.value.showImages = v
  },
})
</script>

<template>
  <div class="space-y-3">
    <FormField label="区块标题">
      <Input
        v-model="titleModel"
        maxlength="60"
      />
    </FormField>

    <div class="grid grid-cols-2 gap-2.5">
      <FormField
        label="展示数量"
        class="min-w-0"
      >
        <NumberField
          v-model="countModel"
          :min="1"
          :max="isVideos ? 24 : 15"
        />
      </FormField>

      <FormField
        v-if="isVideos"
        label="每行列数"
        class="min-w-0"
      >
        <NumberField
          v-model="columnsModel"
          :min="1"
          :max="4"
        />
      </FormField>
    </div>

    <template v-if="isVideos">
      <FormField
        label="标题关键词过滤（可选）"
        description="例如只展示「翻唱」或「切片」"
      >
        <Input
          v-model="keywordModel"
          placeholder="留空展示全部最新投稿"
          maxlength="40"
        />
      </FormField>

      <FormField
        label="指定 B 站合集 ID（可选）"
        description="填合集 sid 时仅同步该合集视频，0 表示全部投稿"
      >
        <NumberField
          v-model="seasonIdModel"
          :min="0"
          :show-buttons="false"
        />
      </FormField>
    </template>

    <SettingRow
      v-else
      type="switch"
      variant="compact"
      title="展示动态配图"
      v-model="showImagesModel"
    />
  </div>
</template>
