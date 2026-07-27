<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { SOCIAL_PLATFORM_OPTIONS } from '@/apps/user-page/block/socialPlatforms'
import { NButton, NFlex, NForm, NFormItem, NInput, NSelect, NSwitch, NText } from 'naive-ui'
import PropsGrid from '../PropsGrid.vue'
import ButtonAppearanceFields from './ButtonAppearanceFields.vue'
import { getNavigationTargetType, setNavigationTargetType } from './navigationTargets'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, ensureArrayProp, internalPageOptions } = useBlockPropsEditor(() => props.block)

</script>

<template>
  <NForm v-if="props.block.type === 'links'" label-placement="top" size="small">
    <PropsGrid>
      <NFormItem class="span-full" label="链接项">
        <NFlex vertical style="width: 100%">
          <div v-for="(item, index) in ensureArrayProp('items')" :key="index" style="display: flex; gap: 8px">
            <NInput v-model:value="item.label" placeholder="标题" />
            <NInput v-model:value="item.url" placeholder="链接 https://..." />
            <NButton type="error" secondary @click="ensureArrayProp('items').splice(index, 1)">
              删除
            </NButton>
          </div>
          <NButton type="info" secondary @click="ensureArrayProp('items').push({ label: '', url: 'https://' })">
            添加
          </NButton>
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm v-else-if="props.block.type === 'button'" label-placement="top" size="small">
    <PropsGrid>
      <ButtonAppearanceFields :block="props.block" />
      <NFormItem class="span-full" label="按钮文本">
        <NInput v-model:value="blockProps.label" placeholder="例如：衣柜" />
      </NFormItem>
      <NFormItem class="span-full" label="跳转类型">
        <NSelect
          :value="getNavigationTargetType(blockProps)"
          :options="[
            { label: '页面', value: 'page' }, { label: '外链', value: 'external' }, { label: '返回', value: 'back' },
          ]"
          @update:value="value => setNavigationTargetType(blockProps, value)"
        />
      </NFormItem>
      <NFormItem class="span-full" label="目标">
        <NSelect v-if="blockProps.page" v-model:value="blockProps.page" :options="internalPageOptions" />
        <NInput v-else-if="!blockProps.back" v-model:value="blockProps.url" placeholder="链接 https://..." />
        <NText v-else depth="3">
          点击后返回上一页
        </NText>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm v-else-if="props.block.type === 'socialLinks'" label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="大小">
        <NSelect v-model:value="blockProps.size" :options="[{ label: 'sm', value: 'sm' }, { label: 'md', value: 'md' }, { label: 'lg', value: 'lg' }]" />
      </NFormItem>
      <NFormItem label="形状">
        <NSelect v-model:value="blockProps.variant" :options="[{ label: 'round', value: 'round' }, { label: 'square', value: 'square' }]" />
      </NFormItem>
      <NFormItem label="显示文字">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showLabel" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem class="span-full" label="链接项">
        <NFlex vertical style="width: 100%">
          <div v-for="(item, index) in ensureArrayProp('items')" :key="index" style="display: flex; gap: 8px">
            <NSelect
              v-model:value="item.platform"
              style="width: 140px"
              :options="SOCIAL_PLATFORM_OPTIONS"
            />
            <NInput v-model:value="item.url" placeholder="https://..." />
            <NInput v-model:value="item.label" placeholder="可选显示名" />
            <NButton type="error" secondary @click="ensureArrayProp('items').splice(index, 1)">
              删除
            </NButton>
          </div>
          <NButton type="info" secondary @click="ensureArrayProp('items').push({ platform: 'bilibili', url: 'https://', label: '' })">
            添加
          </NButton>
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
