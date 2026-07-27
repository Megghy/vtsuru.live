<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { NButton, NDatePicker, NFlex, NForm, NFormItem, NInput, NSelect, NSwitch } from 'naive-ui'
import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, ensureArrayProp } = useBlockPropsEditor(() => props.block)

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
      <NFormItem label="边框标题">
        <NInput v-model:value="blockProps.borderTitle" placeholder="例如：标签" />
      </NFormItem>
      <NFormItem label="标题对齐">
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
        <NFlex vertical style="width: 100%">
          <div v-for="(item, index) in ensureArrayProp('items')" :key="index" style="display: flex; gap: 8px">
            <NInput v-model:value="item.text" placeholder="#标签" />
            <NSelect
              v-model:value="item.type" style="width: 140px" :options="[
                'default', 'info', 'success', 'warning', 'error',
              ].map(value => ({ label: value, value }))"
            />
            <NInput v-model:value="item.color" placeholder="自定义色，可选，如 #fb7299" />
            <NButton type="error" secondary @click="ensureArrayProp('items').splice(index, 1)">
              删除
            </NButton>
          </div>
          <NButton type="info" secondary @click="ensureArrayProp('items').push({ text: '#唱见', type: 'default', color: '' })">
            添加
          </NButton>
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm v-else-if="props.block.type === 'milestone'" label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="展示方式">
        <NSelect v-model:value="blockProps.mode" :options="[{ label: 'timeline', value: 'timeline' }, { label: 'list', value: 'list' }]" />
      </NFormItem>
      <NFormItem class="span-full" label="条目">
        <NFlex vertical style="width: 100%">
          <div
            v-for="(item, index) in ensureArrayProp('items')"
            :key="index"
            style="display: grid; grid-template-columns: 160px 1fr 1.2fr auto; gap: 8px; align-items: start"
          >
            <NDatePicker
              :value="parseLocalDate(item.date)"
              type="date"
              clearable
              placeholder="选择日期"
              style="width: 100%"
              @update:value="value => { item.date = value == null ? '' : formatLocalDate(value) }"
            />
            <NInput v-model:value="item.title" placeholder="标题" />
            <NInput v-model:value="item.description" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" placeholder="描述，可选" />
            <NButton type="error" secondary @click="ensureArrayProp('items').splice(index, 1)">
              删除
            </NButton>
          </div>
          <NButton type="info" secondary @click="ensureArrayProp('items').push({ date: '', title: '', description: '' })">
            添加
          </NButton>
        </NFlex>
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
        <NFlex vertical style="width: 100%">
          <div
            v-for="(item, index) in ensureArrayProp('items')"
            :key="index"
            style="display: grid; grid-template-columns: 1fr 1.2fr auto; gap: 8px; align-items: start"
          >
            <NInput v-model:value="item.q" placeholder="问题" />
            <NInput v-model:value="item.a" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" placeholder="回答" />
            <NButton type="error" secondary @click="ensureArrayProp('items').splice(index, 1)">
              删除
            </NButton>
          </div>
          <NButton type="info" secondary @click="ensureArrayProp('items').push({ q: '', a: '' })">
            添加
          </NButton>
        </NFlex>
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
        <NFlex vertical style="width: 100%">
          <div v-for="(item, index) in ensureArrayProp('items')" :key="index" style="display: flex; gap: 8px">
            <NSelect
              v-model:value="item.platform"
              style="width: 140px"
              :options="['afdian', 'kofi', 'patreon', 'paypal', 'other'].map(value => ({ label: value, value }))"
              to="body"
              :consistent-menu-width="false"
              :menu-props="{ style: { minWidth: '180px' } }"
            />
            <NInput v-model:value="item.url" placeholder="https://..." />
            <NInput v-model:value="item.label" placeholder="显示名，可选" />
            <NButton type="error" secondary @click="ensureArrayProp('items').splice(index, 1)">
              删除
            </NButton>
          </div>
          <NButton type="info" secondary @click="ensureArrayProp('items').push({ platform: 'afdian', url: 'https://', label: '' })">
            添加
          </NButton>
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
