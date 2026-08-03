<script setup lang="ts">
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
  <div
    v-if="props.block.type === 'links'"
    class="builder-form"
  >
    <PropsGrid>
      <UFormField
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
              <UFormField label="标题">
                <UInput v-model="item.label" />
              </UFormField>
              <UFormField label="链接">
                <UInput
                  v-model="item.url"
                  placeholder="https://..."
                />
              </UFormField>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'button'"
  >
    <PropsGrid>
      <ButtonAppearanceFields :block="props.block" />
      <UFormField
        class="span-full"
        label="按钮文本"
      >
        <UInput
          v-model="blockProps.label"
          placeholder="例如：衣柜"
        />
      </UFormField>
      <UFormField
        class="span-full"
        label="跳转类型"
      >
        <USelect
          :value="getNavigationTargetType(blockProps)"
          :items="[
            { label: '页面', value: 'page' },
            { label: '外链', value: 'external' },
            { label: '返回', value: 'back' },
          ]"
          @update:model-value="(value) => setNavigationTargetType(blockProps, value as 'page' | 'external' | 'back')"
        />
      </UFormField>
      <UFormField
        class="span-full"
        label="目标"
      >
        <USelect
          v-if="blockProps.page"
          v-model="blockProps.page"
          :items="internalPageOptions"
        />
        <UInput
          v-else-if="!blockProps.back"
          v-model="blockProps.url"
          placeholder="链接 https://..."
        />
        <span
          class="builder-text"
          v-else
        >
          点击后返回上一页
        </span>
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'socialLinks'"
  >
    <PropsGrid>
      <UFormField label="大小">
        <USelect
          v-model="blockProps.size"
          :items="[
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' },
          ]"
        />
      </UFormField>
      <UFormField label="形状">
        <USelect
          v-model="blockProps.variant"
          :items="[
            { label: 'round', value: 'round' },
            { label: 'square', value: 'square' },
          ]"
        />
      </UFormField>
      <UFormField label="显示文字">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showLabel"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField
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
              <UFormField label="平台">
                <USelect
                  v-model="item.platform"
                  :items="SOCIAL_PLATFORM_OPTIONS"
                />
              </UFormField>
              <UFormField label="显示名 / 无障碍名称">
                <UInput
                  v-model="item.label"
                  placeholder="可选"
                />
              </UFormField>
              <UFormField
                class="span-full"
                label="链接"
              >
                <UInput
                  v-model="item.url"
                  placeholder="https://..."
                />
              </UFormField>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </UFormField>
    </PropsGrid>
  </div>
</template>
