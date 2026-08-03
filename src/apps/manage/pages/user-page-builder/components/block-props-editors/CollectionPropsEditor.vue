<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, ensureArrayProp, propertyAvailable } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <div
    class="builder-form"
    v-if="props.block.type === 'tags'"
  >
    <PropsGrid>
      <UFormField
        v-if="propertyAvailable('borderTitle')"
        label="边框标题"
      >
        <UInput
          v-model="blockProps.borderTitle"
          placeholder="例如：标签"
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
      <UFormField label="大小">
        <USelect
          v-model="blockProps.size"
          :items="[
            { label: 'small', value: 'small' },
            { label: 'medium', value: 'medium' },
          ]"
        />
      </UFormField>
      <UFormField label="圆角">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.rounded"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField
        class="span-full"
        label="标签项"
      >
        <RepeaterEditor
          :items="ensureArrayProp('items')"
          :create-item="() => ({ text: '#唱见', type: 'default', color: '' })"
          add-text="添加标签"
        >
          <template #title="{ item, index }">
            {{ item.text || `标签 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <UFormField label="文本">
                <UInput
                  v-model="item.text"
                  placeholder="#标签"
                />
              </UFormField>
              <UFormField label="类型">
                <USelect
                  v-model="item.type"
                  :items="['default', 'info', 'success', 'warning', 'error'].map((value) => ({ label: value, value }))"
                />
              </UFormField>
              <UFormField
                class="span-full"
                label="自定义颜色"
              >
                <UInput
                  v-model="item.color"
                  placeholder="#fb7299，可选"
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
    v-else-if="props.block.type === 'milestone'"
  >
    <PropsGrid>
      <UFormField label="区块标题">
        <UInput
          v-model="blockProps.title"
          placeholder="里程碑"
        />
      </UFormField>
      <UFormField label="展示方式">
        <USelect
          v-model="blockProps.mode"
          :items="[
            { label: 'timeline', value: 'timeline' },
            { label: 'list', value: 'list' },
          ]"
        />
      </UFormField>
      <UFormField
        class="span-full"
        label="条目"
      >
        <RepeaterEditor
          :items="ensureArrayProp('items')"
          :create-item="() => ({ date: '', title: '', description: '' })"
          add-text="添加条目"
        >
          <template #title="{ item, index }">
            {{ item.title || `条目 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <UFormField label="日期">
                <UInput
                  v-model="item.date"
                  type="date"
                />
              </UFormField>
              <UFormField label="标题">
                <UInput v-model="item.title" />
              </UFormField>
              <UFormField
                class="span-full"
                label="内容"
              >
                <UTextarea
                  v-model="item.description"
                  :autosize="{ minRows: 2, maxRows: 4 }"
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
    v-else-if="props.block.type === 'faq'"
  >
    <PropsGrid>
      <UFormField label="手风琴模式">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.accordion"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField
        class="span-full"
        label="问答"
      >
        <RepeaterEditor
          :items="ensureArrayProp('items')"
          :create-item="() => ({ q: '', a: '' })"
          add-text="添加问答"
        >
          <template #title="{ item, index }">
            {{ item.q || `问题 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <UFormField
                class="span-full"
                label="问题"
              >
                <UInput v-model="item.q" />
              </UFormField>
              <UFormField
                class="span-full"
                label="回答"
              >
                <UTextarea
                  v-model="item.a"
                  :autosize="{ minRows: 2, maxRows: 6 }"
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
    v-else-if="props.block.type === 'supporter'"
  >
    <PropsGrid>
      <UFormField label="标题">
        <UInput v-model="blockProps.title" />
      </UFormField>
      <UFormField
        class="span-full"
        label="描述"
      >
        <UTextarea
          v-model="blockProps.description"
          :autosize="{ minRows: 2, maxRows: 6 }"
        />
      </UFormField>
      <UFormField
        class="span-full"
        label="赞助平台"
      >
        <RepeaterEditor
          :items="ensureArrayProp('items')"
          :create-item="() => ({ platform: 'afdian', url: 'https://', label: '' })"
          add-text="添加平台"
        >
          <template #title="{ item, index }">
            {{ item.label || item.platform || `平台 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <UFormField label="平台">
                <USelect
                  v-model="item.platform"
                  :items="['afdian', 'kofi', 'patreon', 'paypal', 'other'].map((value) => ({ label: value, value }))"
                />
              </UFormField>
              <UFormField label="显示名">
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
