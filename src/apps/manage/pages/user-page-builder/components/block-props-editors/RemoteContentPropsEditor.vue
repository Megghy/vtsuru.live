<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, ensureArrayProp, propertyAvailable, propertyNumberRange } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <div
    v-if="props.block.type === 'liveStatus'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">样式</label>
        <Select v-model="blockProps.variant">
          <SelectTrigger>
            <SelectValue placeholder="样式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="card">大卡片</SelectItem>
            <SelectItem value="compact">紧凑</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示标题</label>
        <Switch v-model:checked="blockProps.showTitle" />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示分区</label>
        <Switch v-model:checked="blockProps.showArea" />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示封面</label>
        <Switch v-model:checked="blockProps.showCover" />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示按钮</label>
        <Switch v-model:checked="blockProps.showButtons" />
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'streamSchedule'"
    class="space-y-3"
  >
    <PropsGrid>
      <div
        v-if="propertyAvailable('layout')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">布局</label>
        <Select v-model="blockProps.layout">
          <SelectTrigger>
            <SelectValue placeholder="布局" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="list">列表</SelectItem>
            <SelectItem value="table">表格</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">展示周数 1~8</label>
        <NInputNumber
          v-model:value="blockProps.weeksCount"
          :min="1"
          :max="8"
          class="w-full"
        />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示订阅(ICS)</label>
        <Switch v-model:checked="blockProps.showIcs" />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">高亮今天</label>
        <Switch v-model:checked="blockProps.highlightToday" />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示标签</label>
        <Switch v-model:checked="blockProps.showTag" />
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'biliInfo'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">样式</label>
        <Select v-model="blockProps.variant">
          <SelectTrigger>
            <SelectValue placeholder="样式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="card">大卡片</SelectItem>
            <SelectItem value="compact">紧凑</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示头像</label>
        <Switch v-model:checked="blockProps.showAvatar" />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示昵称</label>
        <Switch v-model:checked="blockProps.showName" />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示签名</label>
        <Switch v-model:checked="blockProps.showSign" />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示统计</label>
        <Switch v-model:checked="blockProps.showStats" />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示按钮</label>
        <Switch v-model:checked="blockProps.showButtons" />
      </div>
      <div
        v-if="propertyAvailable('showLiveRoom')"
        class="flex items-center justify-between py-1"
      >
        <label class="text-xs text-muted-foreground">显示直播间按钮</label>
        <Switch v-model:checked="blockProps.showLiveRoom" />
      </div>
      <div
        v-if="propertyAvailable('spaceUrl')"
        class="span-full space-y-1"
      >
        <label class="text-xs text-muted-foreground">个人主页链接</label>
        <Input v-model="blockProps.spaceUrl" placeholder="https://space.bilibili.com/..." />
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'videoList'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">数据源</label>
        <Select v-model="blockProps.source">
          <SelectTrigger>
            <SelectValue placeholder="数据源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">手动列表</SelectItem>
            <SelectItem value="userIndex">用户主页数据 - 近期视频</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">布局</label>
        <Select v-model="blockProps.layout">
          <SelectTrigger>
            <SelectValue placeholder="布局" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">网格</SelectItem>
            <SelectItem value="row">横向滚动</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div
        v-if="propertyAvailable('columns')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">网格列数</label>
        <NInputNumber
          v-model:value="blockProps.columns"
          :min="1"
          :max="6"
          class="w-full"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">最多数量</label>
        <NInputNumber
          v-model:value="blockProps.maxItems"
          :min="1"
          :max="50"
          class="w-full"
        />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示标题栏</label>
        <Switch v-model:checked="blockProps.showTitle" />
      </div>
      <div
        v-if="propertyAvailable('title')"
        class="span-full space-y-1"
      >
        <label class="text-xs text-muted-foreground">标题</label>
        <Input v-model="blockProps.title" placeholder="例如：最近视频" />
      </div>
      <div
        v-if="propertyAvailable('items')"
        class="span-full space-y-1"
      >
        <label class="text-xs text-muted-foreground">手动视频列表</label>
        <RepeaterEditor
          :items="ensureArrayProp('items')"
          :create-item="() => ({ title: '', url: 'https://' })"
          add-text="添加视频"
        >
          <template #title="{ item, index }">
            {{ item.title || `视频 ${index + 1}` }}
          </template>
          <template #default="{ item }">
            <PropsGrid>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">标题</label>
                <Input v-model="item.title" placeholder="可选" />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">链接</label>
                <Input v-model="item.url" placeholder="https://..." />
              </div>
            </PropsGrid>
          </template>
        </RepeaterEditor>
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'musicPlayer'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">平台</label>
        <Select v-model="blockProps.provider">
          <SelectTrigger>
            <SelectValue placeholder="平台" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="netease">netease</SelectItem>
            <SelectItem value="spotify">spotify</SelectItem>
            <SelectItem value="custom">custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div
        v-if="propertyAvailable('height')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">高度 px</label>
        <NInputNumber
          v-model:value="blockProps.height"
          :min="propertyNumberRange('height')?.min"
          :max="propertyNumberRange('height')?.max"
          class="w-full"
        />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">紧凑模式</label>
        <Switch v-model:checked="blockProps.compact" />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">链接</label>
        <Input v-model="blockProps.url" placeholder="https://..." />
      </div>
    </PropsGrid>
  </div>
</template>
