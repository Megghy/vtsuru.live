<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
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
      <div
        v-if="propertyAvailable('borderTitle')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">边框标题</label>
        <Input
          v-model="blockProps.borderTitle"
          placeholder="例如：标签"
        />
      </div>
      <div
        v-if="propertyAvailable('borderTitleAlign')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">标题对齐</label>
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
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">大小</label>
        <Select v-model="blockProps.size">
          <SelectTrigger>
            <SelectValue placeholder="大小" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">small</SelectItem>
            <SelectItem value="medium">medium</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">圆角</label>
        <Switch v-model:checked="blockProps.rounded" />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">标签项</label>
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
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">文本</label>
                <Input
                  v-model="item.text"
                  placeholder="#标签"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">类型</label>
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
              </div>
              <div class="span-full space-y-1">
                <label class="text-xs text-muted-foreground">自定义颜色</label>
                <Input
                  v-model="item.color"
                  placeholder="#fb7299，可选"
                />
              </div>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'milestone'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">区块标题</label>
        <Input
          v-model="blockProps.title"
          placeholder="里程碑"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">展示方式</label>
        <Select v-model="blockProps.mode">
          <SelectTrigger>
            <SelectValue placeholder="展示方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="timeline">timeline</SelectItem>
            <SelectItem value="list">list</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">条目</label>
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
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">日期</label>
                <Input
                  v-model="item.date"
                  type="date"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">标题</label>
                <Input v-model="item.title" />
              </div>
              <div class="span-full space-y-1">
                <label class="text-xs text-muted-foreground">内容</label>
                <Textarea
                  v-model="item.description"
                  rows="2"
                  class="text-xs"
                />
              </div>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'faq'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">手风琴模式</label>
        <Switch v-model:checked="blockProps.accordion" />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">问答</label>
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
              <div class="span-full space-y-1">
                <label class="text-xs text-muted-foreground">问题</label>
                <Input v-model="item.q" />
              </div>
              <div class="span-full space-y-1">
                <label class="text-xs text-muted-foreground">回答</label>
                <Textarea
                  v-model="item.a"
                  rows="3"
                  class="text-xs"
                />
              </div>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'supporter'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">标题</label>
        <Input v-model="blockProps.title" />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">描述</label>
        <Textarea
          v-model="blockProps.description"
          rows="3"
          class="text-xs"
        />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">赞助平台</label>
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
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">平台</label>
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
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">显示名</label>
                <Input
                  v-model="item.label"
                  placeholder="可选"
                />
              </div>
              <div class="span-full space-y-1">
                <label class="text-xs text-muted-foreground">链接</label>
                <Input
                  v-model="item.url"
                  placeholder="https://..."
                />
              </div>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </div>
    </PropsGrid>
  </div>
</template>
