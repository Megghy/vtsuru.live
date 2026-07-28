<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { NDatePicker, NFlex, NForm, NFormItem, NInput, NSelect, NSwitch } from 'naive-ui'
import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, ensureArrayProp, propertyAvailable } = useBlockPropsEditor(() => props.block)

function parseLocalDate(value: unknown) {
  if (typeof value !== 'string') return null
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!parts) return null
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])).getTime()
}

function formatLocalDate(timestamp: number) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
</script>

<template>
  <NForm v-if="props.block.type === 'tags'" label-placement="top" size="small">
    <PropsGrid>
      <NFormItem v-if="propertyAvailable('borderTitle')" label="边框标题">
        <NInput v-model:value="blockProps.borderTitle" placeholder="例如：标签" />
      </NFormItem>
      <NFormItem v-if="propertyAvailable('borderTitleAlign')" label="标题对齐">
        <NSelect
          v-model:value="blockProps.borderTitleAlign" :options="[
            { label: '左', value: 'left' }, { label: '中', value: 'center' }, { label: '右', value: 'right' },
          ]"
        />
      </NFormItem>
      <NFormItem label="大小">
        <NSelect v-model:value="blockProps.size" :options="[{ label: 'small', value: 'small' }, { label: 'medium', value: 'medium' }]" />
      </NFormItem>
      <NFormItem label="圆角">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.rounded" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem class="span-full" label="标签项">
        <RepeaterEditor :items="ensureArrayProp('items')" :create-item="() => ({ text: '#唱见', type: 'default', color: '' })" add-text="添加标签">
          <template #title="{ item, index }">
            {{ item.text || `标签 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <NFormItem label="文本">
                <NInput v-model:value="item.text" placeholder="#标签" />
              </NFormItem>
              <NFormItem label="类型">
                <NSelect v-model:value="item.type" :options="['default', 'info', 'success', 'warning', 'error'].map(value => ({ label: value, value }))" />
              </NFormItem>
              <NFormItem class="span-full" label="自定义颜色">
                <NInput v-model:value="item.color" placeholder="#fb7299，可选" />
              </NFormItem>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm v-else-if="props.block.type === 'milestone'" label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="区块标题">
        <NInput v-model:value="blockProps.title" placeholder="里程碑" />
      </NFormItem>
      <NFormItem label="展示方式">
        <NSelect v-model:value="blockProps.mode" :options="[{ label: 'timeline', value: 'timeline' }, { label: 'list', value: 'list' }]" />
      </NFormItem>
      <NFormItem class="span-full" label="条目">
        <RepeaterEditor :items="ensureArrayProp('items')" :create-item="() => ({ date: '', title: '', description: '' })" add-text="添加条目">
          <template #title="{ item, index }">
            {{ item.title || `条目 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <NFormItem label="日期">
                <NDatePicker :value="parseLocalDate(item.date)" type="date" clearable style="width: 100%" @update:value="value => { item.date = value == null ? '' : formatLocalDate(value) }" />
              </NFormItem>
              <NFormItem label="标题">
                <NInput v-model:value="item.title" />
              </NFormItem>
              <NFormItem class="span-full" label="内容">
                <NInput v-model:value="item.description" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" />
              </NFormItem>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm v-else-if="props.block.type === 'faq'" label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="手风琴模式">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.accordion" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem class="span-full" label="问答">
        <RepeaterEditor :items="ensureArrayProp('items')" :create-item="() => ({ q: '', a: '' })" add-text="添加问答">
          <template #title="{ item, index }">
            {{ item.q || `问题 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <NFormItem class="span-full" label="问题">
                <NInput v-model:value="item.q" />
              </NFormItem>
              <NFormItem class="span-full" label="回答">
                <NInput v-model:value="item.a" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" />
              </NFormItem>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm v-else-if="props.block.type === 'supporter'" label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="标题">
        <NInput v-model:value="blockProps.title" />
      </NFormItem>
      <NFormItem class="span-full" label="描述">
        <NInput v-model:value="blockProps.description" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" />
      </NFormItem>
      <NFormItem class="span-full" label="赞助平台">
        <RepeaterEditor :items="ensureArrayProp('items')" :create-item="() => ({ platform: 'afdian', url: 'https://', label: '' })" add-text="添加平台">
          <template #title="{ item, index }">
            {{ item.label || item.platform || `平台 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <NFormItem label="平台">
                <NSelect v-model:value="item.platform" :options="['afdian', 'kofi', 'patreon', 'paypal', 'other'].map(value => ({ label: value, value }))" />
              </NFormItem>
              <NFormItem label="显示名">
                <NInput v-model:value="item.label" placeholder="可选" />
              </NFormItem>
              <NFormItem class="span-full" label="链接">
                <NInput v-model:value="item.url" placeholder="https://..." />
              </NFormItem>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
