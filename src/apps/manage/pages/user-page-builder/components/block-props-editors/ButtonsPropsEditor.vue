<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
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
      <FormField
        v-if="propertyAvailable('borderTitle')"
        label="边框标题"
      >
        <Input
          v-model="blockProps.borderTitle"
          placeholder="例如：导航"
        />
      </FormField>
      <FormField
        v-if="propertyAvailable('borderTitleAlign')"
        label="标题对齐"
      >
        <Select v-model="blockProps.borderTitleAlign">
          <SelectTrigger>
            <SelectValue placeholder="标题对齐" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">左</SelectItem>
            <SelectItem value="center">中</SelectItem>
            <SelectItem value="right">右</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="排列方向">
        <Select v-model="blockProps.direction">
          <SelectTrigger>
            <SelectValue placeholder="排列方向" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vertical">竖向</SelectItem>
            <SelectItem value="horizontal">横向 - 自动换行</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <ButtonAppearanceFields :block="props.block" />
      <FormField label="间距 px">
        <NumberField
          v-model="blockProps.gap"
          :min="0"
          :max="32"
          class="w-full"
        />
      </FormField>
      <FormField
        label="按钮项"
        class="span-full"
      >
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
              <FormField label="标题">
                <Input v-model="item.label" />
              </FormField>
              <FormField label="跳转类型">
                <Select
                  :model-value="getNavigationTargetType(item)"
                  @update:model-value="(value) => setNavigationTargetType(item, value as any)"
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
              </FormField>
              <FormField
                label="目标"
                class="span-full"
              >
                <Select
                  v-if="item.page"
                  v-model="item.page"
                >
                  <SelectTrigger>
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
                />
                <span
                  v-else
                  class="text-xs text-muted-foreground"
                >
                  点击后返回上一页
                </span>
              </FormField>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </FormField>
    </PropsGrid>
  </div>
</template>
