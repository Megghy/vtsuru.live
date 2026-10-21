<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import ButtonAppearanceFields from './ButtonAppearanceFields.vue'
import { getNavigationTargetType, setNavigationTargetType } from './navigationTargets'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps, propertyAvailable, internalPageOptions } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <div class="space-y-3">
    <PropsGrid>
      <div
        v-if="propertyAvailable('borderTitle')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">边框标题</label>
        <Input
          v-model="blockProps.borderTitle"
          placeholder="例如：导航"
          class="h-8 text-xs"
        />
      </div>
      <div
        v-if="propertyAvailable('borderTitleAlign')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">标题对齐</label>
        <Select v-model="blockProps.borderTitleAlign">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="标题对齐" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">左</SelectItem>
            <SelectItem value="center">中</SelectItem>
            <SelectItem value="right">右</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">排列方向</label>
        <Select v-model="blockProps.direction">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="排列方向" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vertical">竖向</SelectItem>
            <SelectItem value="horizontal">横向 - 自动换行</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ButtonAppearanceFields :block="props.block" />
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">间距 px</label>
        <NInputNumber
          v-model:value="blockProps.gap"
          :min="0"
          :max="32"
          class="w-full"
        />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">按钮项</label>
        <RepeaterEditor
          :items="editor.ensureItems(props.block)"
          :create-item="() => ({ label: '', url: 'https://' })"
          add-text="添加按钮"
        >
          <template #title="{ item, index }">
            {{ item.label || `按钮 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">标题</label>
                <Input
                  v-model="item.label"
                  class="h-8 text-xs"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">跳转类型</label>
                <Select
                  :model-value="getNavigationTargetType(item)"
                  @update:model-value="(value) => setNavigationTargetType(item, value as any)"
                >
                  <SelectTrigger class="h-8 text-xs">
                    <SelectValue placeholder="跳转类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="page">页面</SelectItem>
                    <SelectItem value="external">外链</SelectItem>
                    <SelectItem value="back">返回</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="span-full space-y-1">
                <label class="text-xs text-muted-foreground">目标</label>
                <Select
                  v-if="item.page"
                  v-model="item.page"
                >
                  <SelectTrigger class="h-8 text-xs">
                    <SelectValue placeholder="选择内部页面" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in internalPageOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  v-else-if="!item.back"
                  v-model="item.url"
                  placeholder="https://..."
                  class="h-8 text-xs"
                />
                <span
                  v-else
                  class="text-xs text-muted-foreground"
                >
                  点击后返回上一页
                </span>
              </div>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </div>
    </PropsGrid>
  </div>
</template>
