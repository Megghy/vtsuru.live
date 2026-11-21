<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { SOCIAL_PLATFORM_OPTIONS } from '@/apps/user-page/block/socialPlatforms'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import ButtonAppearanceFields from './ButtonAppearanceFields.vue'
import { getNavigationTargetType, setNavigationTargetType } from './navigationTargets'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, ensureArrayProp, arrayProp, internalPageOptions } = useBlockPropsEditor(() => props.block)
const linkItems = arrayProp<Record<string, any>>('items')
</script>

<template>
  <div
    v-if="props.block.type === 'links'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField
        label="链接项"
        class="span-full"
      >
        <RepeaterEditor
          :items="linkItems"
          :create-item="() => ({ label: '', url: 'https://' })"
          add-text="添加链接"
        >
          <template #title="{ item, index }">
            {{ item.label || `链接 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <FormField label="标题">
                <Input v-model="item.label" />
              </FormField>
              <FormField label="链接">
                <Input
                  v-model="item.url"
                  placeholder="链接地址"
                />
              </FormField>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </FormField>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'button'"
    class="space-y-3"
  >
    <PropsGrid>
      <ButtonAppearanceFields :block="props.block" />
      <FormField
        label="按钮文本"
        class="span-full"
      >
        <Input
          v-model="blockProps.label"
          placeholder="例如：衣柜"
        />
      </FormField>
      <FormField
        label="跳转类型"
        class="span-full"
      >
        <Select
          :model-value="getNavigationTargetType(blockProps)"
          @update:model-value="(value) => setNavigationTargetType(blockProps, value as any)"
        >
          <SelectTrigger>
            <SelectValue placeholder="跳转类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="page">站内页面</SelectItem>
            <SelectItem value="external">外部链接</SelectItem>
            <SelectItem value="copy">复制文本</SelectItem>
            <SelectItem value="back">返回上页</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        :label="getNavigationTargetType(blockProps) === 'copy' ? '复制内容' : '目标'"
        class="span-full"
      >
        <Select
          v-if="getNavigationTargetType(blockProps) === 'page'"
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
        <div
          v-else-if="getNavigationTargetType(blockProps) === 'copy'"
          class="space-y-2"
        >
          <Input
            v-model="blockProps.copyText"
            placeholder="点击后自动复制的群号、口令或邮箱..."
          />
          <Input
            v-model="blockProps.copiedMessage"
            placeholder="复制成功提示（可选，默认“已复制到剪贴板”）"
          />
        </div>
        <Input
          v-else-if="getNavigationTargetType(blockProps) === 'external'"
          v-model="blockProps.url"
          placeholder="链接 https://..."
        />
        <div
          v-else
          class="text-xs text-muted-foreground py-1"
        >
          点击后返回上一页
        </div>
      </FormField>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'socialLinks'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField label="大小">
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
      </FormField>
      <FormField label="形状">
        <Select v-model="blockProps.variant">
          <SelectTrigger>
            <SelectValue placeholder="形状" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round">round</SelectItem>
            <SelectItem value="square">square</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <SettingRow
        title="显示文字"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showLabel" />
      </SettingRow>
      <FormField
        label="链接项"
        class="span-full"
      >
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
              <FormField label="平台">
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
              </FormField>
              <FormField label="显示名 / 无障碍名称">
                <Input
                  v-model="item.label"
                  placeholder="可选"
                />
              </FormField>
              <FormField
                label="链接"
                class="span-full"
              >
                <Input
                  v-model="item.url"
                  placeholder="链接地址"
                />
              </FormField>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </FormField>
    </PropsGrid>
  </div>
</template>
