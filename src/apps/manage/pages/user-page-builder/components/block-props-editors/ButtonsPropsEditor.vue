<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { ReorderThreeOutline } from '@vicons/ionicons5'
import { NButton, NFlex, NForm, NFormItem, NIcon, NInput, NInputNumber, NSelect, NText } from 'naive-ui'
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import PropsGrid from '../PropsGrid.vue'
import ButtonAppearanceFields from './ButtonAppearanceFields.vue'
import type { NavigationTarget } from './navigationTargets'
import { getNavigationTargetType, setNavigationTargetType } from './navigationTargets'
import { useBlockPropsEditor } from './useBlockPropsEditor'

interface ButtonItem extends NavigationTarget {
  label: string
}

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps, internalPageOptions } = useBlockPropsEditor(() => props.block)
const items = computed<ButtonItem[]>({
  get: () => editor.ensureItems(props.block),
  set(value) {
    editor.ensureItems(props.block).splice(0, Number.POSITIVE_INFINITY, ...value)
  },
})
const itemKeys = new WeakMap<ButtonItem, string>()
let nextItemKey = 0

function getItemKey(item: ButtonItem) {
  const existingKey = itemKeys.get(item)
  if (existingKey) return existingKey
  const key = `${props.block.id}:${nextItemKey++}`
  itemKeys.set(item, key)
  return key
}
</script>

<template>
  <NForm label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="边框标题">
        <NInput v-model:value="blockProps.borderTitle" placeholder="例如：导航" />
      </NFormItem>
      <NFormItem label="标题对齐">
        <NSelect
          v-model:value="blockProps.borderTitleAlign" :options="[
            { label: '左', value: 'left' }, { label: '中', value: 'center' }, { label: '右', value: 'right' },
          ]"
        />
      </NFormItem>
      <NFormItem label="排列方向">
        <NSelect
          v-model:value="blockProps.direction" :options="[
            { label: '竖向', value: 'vertical' }, { label: '横向 - 自动换行', value: 'horizontal' },
          ]"
        />
      </NFormItem>
      <ButtonAppearanceFields :block="props.block" />
      <NFormItem label="间距 px">
        <NInputNumber v-model:value="blockProps.gap" :min="0" :max="32" style="width: 100%" />
      </NFormItem>
      <NFormItem class="span-full" label="按钮项">
        <NFlex vertical style="width: 100%; padding-right: 10px">
          <VueDraggable v-model="items" handle=".drag-handle" :animation="160">
            <div
              v-for="(item, index) in items"
              :key="getItemKey(item)"
              style="width: 100%; min-width: 0; margin-bottom: 10px; padding: 10px; border-radius: 8px; border: 1px solid var(--vtsuru-border); background: var(--vtsuru-bg-muted); box-sizing: border-box"
            >
              <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%; min-width: 0">
                <NInput v-model:value="item.label" placeholder="标题" style="flex: 1 1 160px; min-width: 120px" />
                <NSelect
                  style="width: 110px; flex: 0 0 110px"
                  :value="getNavigationTargetType(item)"
                  :options="[
                    { label: '页面', value: 'page' }, { label: '外链', value: 'external' }, { label: '返回', value: 'back' },
                  ]"
                  @update:value="value => setNavigationTargetType(item, value)"
                />
              </div>
              <div style="margin-top: 8px; width: 100%; min-width: 0">
                <NSelect v-if="item.page" v-model:value="item.page" :options="internalPageOptions" style="width: 100%" />
                <NInput v-else-if="!item.back" v-model:value="item.url" placeholder="链接 https://..." style="width: 100%" />
                <NText v-else depth="3" style="display: block; padding: 6px 2px">
                  点击后返回上一页
                </NText>
              </div>
              <div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between; gap: 10px">
                <NButton type="error" secondary size="small" @click="items.splice(index, 1)">
                  删除
                </NButton>
                <NIcon class="drag-handle" size="18" style="cursor: grab; opacity: 0.75">
                  <ReorderThreeOutline />
                </NIcon>
              </div>
            </div>
          </VueDraggable>
          <NButton type="info" secondary @click="items.push({ label: '', url: 'https://' })">
            添加
          </NButton>
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
