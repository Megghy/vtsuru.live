<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, ensureArrayProp, propertyAvailable, propertyNumberRange } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <div
    class="builder-form"
    v-if="props.block.type === 'liveStatus'"
  >
    <PropsGrid>
      <UFormField label="样式">
        <USelect
          v-model="blockProps.variant"
          :items="[
            { label: '大卡片', value: 'card' },
            { label: '紧凑', value: 'compact' },
          ]"
        />
      </UFormField>
      <UFormField label="显示标题">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showTitle"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示分区">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showArea"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示封面">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showCover"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示按钮">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showButtons"
            size="small"
          />
        </div>
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'streamSchedule'"
  >
    <PropsGrid>
      <UFormField
        v-if="propertyAvailable('layout')"
        label="布局"
      >
        <USelect
          v-model="blockProps.layout"
          :items="[
            { label: '列表', value: 'list' },
            { label: '表格', value: 'table' },
          ]"
        />
      </UFormField>
      <UFormField label="展示周数 1~8">
        <UInputNumber
          v-model="blockProps.weeksCount"
          :min="1"
          :max="8"
          style="width: 100%"
        />
      </UFormField>
      <UFormField label="显示订阅(ICS)">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showIcs"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="高亮今天">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.highlightToday"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示标签">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showTag"
            size="small"
          />
        </div>
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'biliInfo'"
  >
    <PropsGrid>
      <UFormField label="样式">
        <USelect
          v-model="blockProps.variant"
          :items="[
            { label: '大卡片', value: 'card' },
            { label: '紧凑', value: 'compact' },
          ]"
        />
      </UFormField>
      <UFormField label="显示头像">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showAvatar"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示昵称">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showName"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示签名">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showSign"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示统计">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showStats"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示按钮">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showButtons"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField
        v-if="propertyAvailable('showLiveRoom')"
        label="显示直播间按钮"
      >
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showLiveRoom"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField
        v-if="propertyAvailable('spaceUrl')"
        class="span-full"
        label="个人主页链接"
      >
        <UInput
          v-model="blockProps.spaceUrl"
          placeholder="https://space.bilibili.com/..."
        />
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'videoList'"
  >
    <PropsGrid>
      <UFormField label="数据源">
        <USelect
          v-model="blockProps.source"
          :items="[
            { label: '手动列表', value: 'manual' },
            { label: '用户主页数据 - 近期视频', value: 'userIndex' },
          ]"
        />
      </UFormField>
      <UFormField label="布局">
        <USelect
          v-model="blockProps.layout"
          :items="[
            { label: '网格', value: 'grid' },
            { label: '横向滚动', value: 'row' },
          ]"
        />
      </UFormField>
      <UFormField
        v-if="propertyAvailable('columns')"
        label="网格列数"
      >
        <UInputNumber
          v-model="blockProps.columns"
          :min="1"
          :max="6"
          style="width: 100%"
        />
      </UFormField>
      <UFormField label="最多数量">
        <UInputNumber
          v-model="blockProps.maxItems"
          :min="1"
          :max="50"
          style="width: 100%"
        />
      </UFormField>
      <UFormField label="显示标题栏">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showTitle"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField
        v-if="propertyAvailable('title')"
        class="span-full"
        label="标题"
      >
        <UInput
          v-model="blockProps.title"
          placeholder="例如：最近视频"
        />
      </UFormField>
      <UFormField
        v-if="propertyAvailable('items')"
        class="span-full"
        label="手动视频列表"
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
              <UFormField label="标题">
                <UInput
                  v-model="item.title"
                  placeholder="可选"
                />
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
    v-else-if="props.block.type === 'musicPlayer'"
  >
    <PropsGrid>
      <UFormField label="平台">
        <USelect
          v-model="blockProps.provider"
          :items="[
            { label: 'netease', value: 'netease' },
            { label: 'spotify', value: 'spotify' },
            { label: 'custom', value: 'custom' },
          ]"
        />
      </UFormField>
      <UFormField
        v-if="propertyAvailable('height')"
        label="高度 px"
      >
        <UInputNumber
          v-model="blockProps.height"
          :min="propertyNumberRange('height')?.min"
          :max="propertyNumberRange('height')?.max"
          style="width: 100%"
        />
      </UFormField>
      <UFormField label="紧凑模式">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.compact"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField
        class="span-full"
        label="链接"
      >
        <UInput
          v-model="blockProps.url"
          placeholder="https://..."
        />
      </UFormField>
    </PropsGrid>
  </div>
</template>
