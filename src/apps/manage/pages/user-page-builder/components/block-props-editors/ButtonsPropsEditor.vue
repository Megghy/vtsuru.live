<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import ButtonAppearanceFields from './ButtonAppearanceFields.vue'
import { getNavigationTargetType, setNavigationTargetType } from './navigationTargets'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps, propertyAvailable, internalPageOptions } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <div class="builder-form">
    <PropsGrid>
      <UFormField
        v-if="propertyAvailable('borderTitle')"
        label="边框标题"
      >
        <UInput
          v-model="blockProps.borderTitle"
          placeholder="例如：导航"
        />
      </UFormField>
      <UFormField
        v-if="propertyAvailable('borderTitleAlign')"
        label="标题对齐"
      >
        <USelect
          v-model="blockProps.borderTitleAlign"
          :items="[
            { label: '左', value: 'left' },
            { label: '中', value: 'center' },
            { label: '右', value: 'right' },
          ]"
        />
      </UFormField>
      <UFormField label="排列方向">
        <USelect
          v-model="blockProps.direction"
          :items="[
            { label: '竖向', value: 'vertical' },
            { label: '横向 - 自动换行', value: 'horizontal' },
          ]"
        />
      </UFormField>
      <ButtonAppearanceFields :block="props.block" />
      <UFormField label="间距 px">
        <UInputNumber
          v-model="blockProps.gap"
          :min="0"
          :max="32"
          style="width: 100%"
        />
      </UFormField>
      <UFormField
        class="span-full"
        label="按钮项"
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
              <UFormField label="标题">
                <UInput v-model="item.label" />
              </UFormField>
              <UFormField label="跳转类型">
                <USelect
                  :value="getNavigationTargetType(item)"
                  :items="[
                    { label: '页面', value: 'page' },
                    { label: '外链', value: 'external' },
                    { label: '返回', value: 'back' },
                  ]"
                  @update:model-value="(value) => setNavigationTargetType(item, value as 'page' | 'external' | 'back')"
                />
              </UFormField>
              <UFormField
                class="span-full"
                label="目标"
              >
                <USelect
                  v-if="item.page"
                  v-model="item.page"
                  :items="internalPageOptions"
                />
                <UInput
                  v-else-if="!item.back"
                  v-model="item.url"
                  placeholder="https://..."
                />
                <span
                  class="builder-text"
                  v-else
                >
                  点击后返回上一页
                </span>
              </UFormField>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </UFormField>
    </PropsGrid>
  </div>
</template>
