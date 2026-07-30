<script setup lang="ts">
import { NForm, NFormItem, NInput, NInputNumber, NSelect, NText } from 'naive-ui'

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
  <NForm
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem
        v-if="propertyAvailable('borderTitle')"
        label="边框标题"
      >
        <NInput
          v-model:value="blockProps.borderTitle"
          placeholder="例如：导航"
        />
      </NFormItem>
      <NFormItem
        v-if="propertyAvailable('borderTitleAlign')"
        label="标题对齐"
      >
        <NSelect
          v-model:value="blockProps.borderTitleAlign"
          :options="[
            { label: '左', value: 'left' },
            { label: '中', value: 'center' },
            { label: '右', value: 'right' },
          ]"
        />
      </NFormItem>
      <NFormItem label="排列方向">
        <NSelect
          v-model:value="blockProps.direction"
          :options="[
            { label: '竖向', value: 'vertical' },
            { label: '横向 - 自动换行', value: 'horizontal' },
          ]"
        />
      </NFormItem>
      <ButtonAppearanceFields :block="props.block" />
      <NFormItem label="间距 px">
        <NInputNumber
          v-model:value="blockProps.gap"
          :min="0"
          :max="32"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem
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
              <NFormItem label="标题">
                <NInput v-model:value="item.label" />
              </NFormItem>
              <NFormItem label="跳转类型">
                <NSelect
                  :value="getNavigationTargetType(item)"
                  :options="[
                    { label: '页面', value: 'page' },
                    { label: '外链', value: 'external' },
                    { label: '返回', value: 'back' },
                  ]"
                  @update:value="(value) => setNavigationTargetType(item, value)"
                />
              </NFormItem>
              <NFormItem
                class="span-full"
                label="目标"
              >
                <NSelect
                  v-if="item.page"
                  v-model:value="item.page"
                  :options="internalPageOptions"
                />
                <NInput
                  v-else-if="!item.back"
                  v-model:value="item.url"
                  placeholder="https://..."
                />
                <NText
                  v-else
                  depth="3"
                >
                  点击后返回上一页
                </NText>
              </NFormItem>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
