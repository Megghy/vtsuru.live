<script setup lang="ts">
import { NFlex, NForm, NFormItem, NInput, NSelect, NSwitch, NText } from 'naive-ui'

import type { BlockNode } from '@/apps/user-page/block/schema'
import { SOCIAL_PLATFORM_OPTIONS } from '@/apps/user-page/block/socialPlatforms'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import ButtonAppearanceFields from './ButtonAppearanceFields.vue'
import { getNavigationTargetType, setNavigationTargetType } from './navigationTargets'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, ensureArrayProp, internalPageOptions } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <NForm
    v-if="props.block.type === 'links'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem
        class="span-full"
        label="链接项"
      >
        <RepeaterEditor
          :items="ensureArrayProp('items')"
          :create-item="() => ({ label: '', url: 'https://' })"
          add-text="添加链接"
        >
          <template #title="{ item, index }">
            {{ item.label || `链接 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <NFormItem label="标题">
                <NInput v-model:value="item.label" />
              </NFormItem>
              <NFormItem label="链接">
                <NInput
                  v-model:value="item.url"
                  placeholder="https://..."
                />
              </NFormItem>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'button'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <ButtonAppearanceFields :block="props.block" />
      <NFormItem
        class="span-full"
        label="按钮文本"
      >
        <NInput
          v-model:value="blockProps.label"
          placeholder="例如：衣柜"
        />
      </NFormItem>
      <NFormItem
        class="span-full"
        label="跳转类型"
      >
        <NSelect
          :value="getNavigationTargetType(blockProps)"
          :options="[
            { label: '页面', value: 'page' },
            { label: '外链', value: 'external' },
            { label: '返回', value: 'back' },
          ]"
          @update:value="(value) => setNavigationTargetType(blockProps, value)"
        />
      </NFormItem>
      <NFormItem
        class="span-full"
        label="目标"
      >
        <NSelect
          v-if="blockProps.page"
          v-model:value="blockProps.page"
          :options="internalPageOptions"
        />
        <NInput
          v-else-if="!blockProps.back"
          v-model:value="blockProps.url"
          placeholder="链接 https://..."
        />
        <NText
          v-else
          depth="3"
        >
          点击后返回上一页
        </NText>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'socialLinks'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem label="大小">
        <NSelect
          v-model:value="blockProps.size"
          :options="[
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' },
          ]"
        />
      </NFormItem>
      <NFormItem label="形状">
        <NSelect
          v-model:value="blockProps.variant"
          :options="[
            { label: 'round', value: 'round' },
            { label: 'square', value: 'square' },
          ]"
        />
      </NFormItem>
      <NFormItem label="显示文字">
        <NFlex justify="end">
          <NSwitch
            v-model:value="blockProps.showLabel"
            size="small"
          />
        </NFlex>
      </NFormItem>
      <NFormItem
        class="span-full"
        label="链接项"
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
              <NFormItem label="平台">
                <NSelect
                  v-model:value="item.platform"
                  :options="SOCIAL_PLATFORM_OPTIONS"
                />
              </NFormItem>
              <NFormItem label="显示名 / 无障碍名称">
                <NInput
                  v-model:value="item.label"
                  placeholder="可选"
                />
              </NFormItem>
              <NFormItem
                class="span-full"
                label="链接"
              >
                <NInput
                  v-model:value="item.url"
                  placeholder="https://..."
                />
              </NFormItem>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
