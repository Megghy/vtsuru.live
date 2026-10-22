<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { SOCIAL_PLATFORM_OPTIONS } from '@/apps/user-page/block/socialPlatforms'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import ButtonAppearanceFields from './ButtonAppearanceFields.vue'
import { getNavigationTargetType, setNavigationTargetType } from './navigationTargets'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, ensureArrayProp, internalPageOptions } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <div
    v-if="props.block.type === 'links'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">链接项</label>
        <RepeaterEditor
          :items="ensureArrayProp('items')"
          :create-item="() => ({ label: '', url: 'https://' })"
          add-text="添加链接"
        >
          <template #title="{ item, index }: { item: any; index: number }">
            {{ item.label || `链接 ${index + 1}` }}
          </template>
          <template #default="{ item }: { item: any }">
            <PropsGrid>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">标题</label>
                <Input v-model="item.label" />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">链接</label>
                <Input
                  v-model="item.url"
                  placeholder="https://..."
                />
              </div>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'button'"
    class="space-y-3"
  >
    <PropsGrid>
      <ButtonAppearanceFields :block="props.block" />
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">按钮文本</label>
        <Input
          v-model="blockProps.label"
          placeholder="例如：衣柜"
        />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">跳转类型</label>
        <Select
          :model-value="getNavigationTargetType(blockProps)"
          @update:model-value="(value) => setNavigationTargetType(blockProps, value as any)"
        >
          <SelectTrigger>
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
          v-if="blockProps.page"
          v-model="blockProps.page"
        >
          <SelectTrigger>
            <SelectValue placeholder="选择目标页面" />
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
          v-else-if="!blockProps.back"
          v-model="blockProps.url"
          placeholder="链接 https://..."
        />
        <div
          v-else
          class="text-xs text-muted-foreground py-1"
        >
          点击后返回上一页
        </div>
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'socialLinks'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">大小</label>
        <Select v-model="blockProps.size">
          <SelectTrigger>
            <SelectValue placeholder="大小" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">sm</SelectItem>
            <SelectItem value="md">md</SelectItem>
            <SelectItem value="lg">lg</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">形状</label>
        <Select v-model="blockProps.variant">
          <SelectTrigger>
            <SelectValue placeholder="形状" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round">round</SelectItem>
            <SelectItem value="square">square</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示文字</label>
        <Switch v-model:checked="blockProps.showLabel" />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">链接项</label>
        <RepeaterEditor
          :items="ensureArrayProp('items')"
          :create-item="() => ({ platform: 'bilibili', url: 'https://', label: '' })"
          add-text="添加社交链接"
        >
          <template #title="{ item, index }">
            {{ item.label || item.platform || `平台 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">平台</label>
                <Select v-model="item.platform">
                  <SelectTrigger>
                    <SelectValue placeholder="平台" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in SOCIAL_PLATFORM_OPTIONS"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">显示名 / 无障碍名称</label>
                <Input
                  v-model="item.label"
                  placeholder="可选"
                />
              </div>
              <div class="span-full space-y-1">
                <label class="text-xs text-muted-foreground">链接</label>
                <Input
                  v-model="item.url"
                  placeholder="https://..."
                />
              </div>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </div>
    </PropsGrid>
  </div>
</template>
