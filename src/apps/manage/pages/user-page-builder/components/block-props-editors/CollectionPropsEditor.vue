<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, ensureArrayProp, propertyAvailable } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <div
    v-if="props.block.type === 'tags'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField
        v-if="propertyAvailable('borderTitle')"
        label="边框标题"
      >
        <Input
          v-model="blockProps.borderTitle"
          placeholder="例如：标签"
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
      <FormField label="大小">
        <Select v-model="blockProps.size">
          <SelectTrigger>
            <SelectValue placeholder="大小" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">small</SelectItem>
            <SelectItem value="medium">medium</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <SettingRow
        title="圆角"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.rounded" />
      </SettingRow>
      <FormField
        label="标签项"
        class="span-full"
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
              <FormField label="文本">
                <Input
                  v-model="item.text"
                  placeholder="#标签"
                />
              </FormField>
              <FormField label="类型">
                <Select v-model="item.type">
                  <SelectTrigger>
                    <SelectValue placeholder="类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="val in ['default', 'info', 'success', 'warning', 'error']"
                      :key="val"
                      :value="val"
                    >
                      {{ val }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="自定义颜色"
                class="span-full"
              >
                <Input
                  v-model="item.color"
                  placeholder="#fb7299，可选"
                />
              </FormField>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </FormField>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'milestone'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField label="区块标题">
        <Input
          v-model="blockProps.title"
          placeholder="里程碑"
        />
      </FormField>
      <FormField label="展示方式">
        <Select v-model="blockProps.mode">
          <SelectTrigger>
            <SelectValue placeholder="展示方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="timeline">timeline</SelectItem>
            <SelectItem value="list">list</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        label="条目"
        class="span-full"
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
              <FormField label="日期">
                <Input
                  v-model="item.date"
                  type="date"
                />
              </FormField>
              <FormField label="标题">
                <Input v-model="item.title" />
              </FormField>
              <FormField
                label="内容"
                class="span-full"
              >
                <Textarea
                  v-model="item.description"
                  rows="2"
                />
              </FormField>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </FormField>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'faq'"
    class="space-y-3"
  >
    <PropsGrid>
      <SettingRow
        title="手风琴模式"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.accordion" />
      </SettingRow>
      <FormField
        label="问答"
        class="span-full"
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
              <FormField
                label="问题"
                class="span-full"
              >
                <Input v-model="item.q" />
              </FormField>
              <FormField
                label="回答"
                class="span-full"
              >
                <Textarea
                  v-model="item.a"
                  rows="3"
                />
              </FormField>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </FormField>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'supporter'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField label="标题">
        <Input v-model="blockProps.title" />
      </FormField>
      <FormField
        label="描述"
        class="span-full"
      >
        <Textarea
          v-model="blockProps.description"
          rows="3"
        />
      </FormField>
      <FormField
        label="赞助平台"
        class="span-full"
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
              <FormField label="平台">
                <Select v-model="item.platform">
                  <SelectTrigger>
                    <SelectValue placeholder="平台" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="val in ['afdian', 'kofi', 'patreon', 'paypal', 'other']"
                      :key="val"
                      :value="val"
                    >
                      {{ val }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="显示名">
                <Input
                  v-model="item.label"
                  placeholder="可选"
                />
              </FormField>
              <FormField
                label="链接"
                class="span-full"
              >
                <Input
                  v-model="item.url"
                  placeholder="链接地址"
                />
              </FormField>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </FormField>
    </PropsGrid>
  </div>
</template>
