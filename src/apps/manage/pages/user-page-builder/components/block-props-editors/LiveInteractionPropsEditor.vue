<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <PropsGrid v-if="props.block.type === 'danmakuVote'">
    <FormField
      label="区块标题"
      class="span-full"
    >
      <Input
        v-model="blockProps.title"
        maxlength="60"
        placeholder="直播弹幕投票"
      />
    </FormField>
    <FormField label="投票卡片主题">
      <Select v-model="blockProps.theme">
        <SelectTrigger class="w-full">
          <SelectValue placeholder="主题样式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="glass">磨砂玻璃</SelectItem>
          <SelectItem value="neon">霓虹炫彩</SelectItem>
          <SelectItem value="minimal">极简纯净</SelectItem>
          <SelectItem value="duel">双人对决</SelectItem>
          <SelectItem value="light">浅色通透</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    <FormField label="最多展示选项数">
      <NumberField
        :model-value="typeof blockProps.maxDisplay === 'number' ? blockProps.maxDisplay : 6"
        :min="2"
        :max="10"
        class="w-full"
        @update:model-value="blockProps.maxDisplay = $event"
      />
    </FormField>
    <SettingRow
      title="无投票时显示占位提示"
      variant="none"
      class="span-full py-1"
    >
      <Switch
        :checked="blockProps.showWhenIdle !== false"
        @update:checked="blockProps.showWhenIdle = $event"
      />
    </SettingRow>
    <FormField
      v-if="blockProps.showWhenIdle !== false"
      label="空闲提示文案"
      class="span-full"
    >
      <Input
        v-model="blockProps.idleText"
        maxlength="120"
        placeholder="当前暂无进行中的弹幕投票"
      />
    </FormField>
  </PropsGrid>

  <PropsGrid v-else-if="props.block.type === 'queueStatus'">
    <FormField
      label="区块标题"
      class="span-full"
    >
      <Input
        v-model="blockProps.title"
        maxlength="60"
        placeholder="当前排队状态"
      />
    </FormField>
    <SettingRow
      title="显示“前往排队”入口"
      variant="none"
      class="span-full py-1"
    >
      <Switch
        :checked="blockProps.showLink !== false"
        @update:checked="blockProps.showLink = $event"
      />
    </SettingRow>
    <SettingRow
      title="显示等待人数"
      variant="none"
      class="span-full py-1"
    >
      <Switch
        :checked="blockProps.showWaitingCount !== false"
        @update:checked="blockProps.showWaitingCount = $event"
      />
    </SettingRow>
    <SettingRow
      title="紧凑展示模式"
      variant="none"
      class="span-full py-1"
    >
      <Switch
        :checked="blockProps.compact === true"
        @update:checked="blockProps.compact = $event"
      />
    </SettingRow>
  </PropsGrid>
</template>
