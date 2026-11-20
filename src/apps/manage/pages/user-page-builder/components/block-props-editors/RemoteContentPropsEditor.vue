<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
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
      <FormField label="样式">
        <Select v-model="blockProps.variant">
          <SelectTrigger>
            <SelectValue placeholder="样式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="card">大卡片</SelectItem>
            <SelectItem value="compact">紧凑</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <SettingRow
        title="显示标题"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showTitle" />
      </SettingRow>
      <SettingRow
        title="显示分区"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showArea" />
      </SettingRow>
      <SettingRow
        title="显示封面"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showCover" />
      </SettingRow>
      <SettingRow
        title="显示按钮"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showButtons" />
      </SettingRow>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'streamSchedule'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField
        v-if="propertyAvailable('layout')"
        label="布局"
      >
        <Select v-model="blockProps.layout">
          <SelectTrigger>
            <SelectValue placeholder="布局" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="list">列表</SelectItem>
            <SelectItem value="table">表格</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="展示周数 1~8">
        <NumberField
          v-model="blockProps.weeksCount"
          :min="1"
          :max="8"
          class="w-full"
        />
      </FormField>
      <SettingRow
        title="显示订阅(ICS)"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showIcs" />
      </SettingRow>
      <SettingRow
        title="高亮今天"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.highlightToday" />
      </SettingRow>
      <SettingRow
        title="显示标签"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showTag" />
      </SettingRow>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'biliInfo'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField label="样式">
        <Select v-model="blockProps.variant">
          <SelectTrigger>
            <SelectValue placeholder="样式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="card">大卡片</SelectItem>
            <SelectItem value="compact">紧凑</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <SettingRow
        title="显示头像"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showAvatar" />
      </SettingRow>
      <SettingRow
        title="显示昵称"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showName" />
      </SettingRow>
      <SettingRow
        title="显示签名"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showSign" />
      </SettingRow>
      <SettingRow
        title="显示统计"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showStats" />
      </SettingRow>
      <SettingRow
        title="显示按钮"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showButtons" />
      </SettingRow>
      <SettingRow
        v-if="propertyAvailable('showLiveRoom')"
        title="显示直播间按钮"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showLiveRoom" />
      </SettingRow>
      <FormField
        v-if="propertyAvailable('spaceUrl')"
        label="个人主页链接"
        class="span-full"
      >
        <Input
          v-model="blockProps.spaceUrl"
          placeholder="https://space.bilibili.com/..."
        />
      </FormField>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'videoList'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField label="数据源">
        <Select v-model="blockProps.source">
          <SelectTrigger>
            <SelectValue placeholder="数据源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">手动列表</SelectItem>
            <SelectItem value="userIndex">用户主页数据 - 近期视频</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="布局">
        <Select v-model="blockProps.layout">
          <SelectTrigger>
            <SelectValue placeholder="布局" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">网格</SelectItem>
            <SelectItem value="row">横向滚动</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        v-if="propertyAvailable('columns')"
        label="网格列数"
      >
        <NumberField
          v-model="blockProps.columns"
          :min="1"
          :max="6"
          class="w-full"
        />
      </FormField>
      <FormField label="最多数量">
        <NumberField
          v-model="blockProps.maxItems"
          :min="1"
          :max="50"
          class="w-full"
        />
      </FormField>
      <SettingRow
        title="显示标题栏"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showTitle" />
      </SettingRow>
      <FormField
        v-if="propertyAvailable('title')"
        label="标题"
        class="span-full"
      >
        <Input
          v-model="blockProps.title"
          placeholder="例如：最近视频"
        />
      </FormField>
      <FormField
        v-if="propertyAvailable('items')"
        label="手动视频列表"
        class="span-full"
      >
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
              <FormField label="标题">
                <Input
                  v-model="item.title"
                  placeholder="可选"
                />
              </FormField>
              <FormField label="链接">
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

  <div
    v-else-if="props.block.type === 'musicPlayer'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField label="平台">
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
      </FormField>
      <FormField
        v-if="propertyAvailable('height')"
        label="高度 px"
      >
        <NumberField
          v-model="blockProps.height"
          :min="propertyNumberRange('height')?.min"
          :max="propertyNumberRange('height')?.max"
          class="w-full"
        />
      </FormField>
      <SettingRow
        title="紧凑模式"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.compact" />
      </SettingRow>
      <FormField
        label="链接"
        class="span-full"
      >
        <Input
          v-model="blockProps.url"
          placeholder="https://..."
        />
      </FormField>
    </PropsGrid>
  </div>
</template>
