<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { NButton, NFlex, NForm, NFormItem, NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, ensureArrayProp } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <NForm v-if="props.block.type === 'liveStatus'" label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="样式">
        <NSelect v-model:value="blockProps.variant" :options="[{ label: '大卡片', value: 'card' }, { label: '紧凑', value: 'compact' }]" />
      </NFormItem>
      <NFormItem label="显示标题">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showTitle" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示分区">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showArea" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示封面">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showCover" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示按钮">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showButtons" size="small" />
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm v-else-if="props.block.type === 'streamSchedule'" label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="布局">
        <NSelect v-model:value="blockProps.layout" :options="[{ label: '列表', value: 'list' }, { label: '表格', value: 'table' }]" />
      </NFormItem>
      <NFormItem label="展示周数 1~8">
        <NInputNumber v-model:value="blockProps.weeksCount" :min="1" :max="8" style="width: 100%" />
      </NFormItem>
      <NFormItem label="显示订阅(ICS)">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showIcs" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="高亮今天">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.highlightToday" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示标签">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showTag" size="small" />
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm v-else-if="props.block.type === 'biliInfo'" label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="样式">
        <NSelect v-model:value="blockProps.variant" :options="[{ label: '大卡片', value: 'card' }, { label: '紧凑', value: 'compact' }]" />
      </NFormItem>
      <NFormItem label="显示头像">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showAvatar" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示昵称">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showName" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示签名">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showSign" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示统计">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showStats" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示按钮">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showButtons" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示直播间按钮">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showLiveRoom" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem class="span-full" label="个人主页链接">
        <NInput v-model:value="blockProps.spaceUrl" placeholder="https://space.bilibili.com/..." />
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm v-else-if="props.block.type === 'videoList'" label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="数据源">
        <NSelect
          v-model:value="blockProps.source" :options="[
            { label: '手动列表', value: 'manual' },
            { label: '用户主页数据 - 近期视频', value: 'userIndex' },
          ]"
        />
      </NFormItem>
      <NFormItem label="布局">
        <NSelect v-model:value="blockProps.layout" :options="[{ label: '网格', value: 'grid' }, { label: '横向滚动', value: 'row' }]" />
      </NFormItem>
      <NFormItem label="网格列数">
        <NInputNumber v-model:value="blockProps.columns" :min="1" :max="6" style="width: 100%" />
      </NFormItem>
      <NFormItem label="最多数量">
        <NInputNumber v-model:value="blockProps.maxItems" :min="1" :max="50" style="width: 100%" />
      </NFormItem>
      <NFormItem label="显示标题栏">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showTitle" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem class="span-full" label="标题">
        <NInput v-model:value="blockProps.title" placeholder="例如：最近视频" />
      </NFormItem>
      <NFormItem v-if="blockProps.source === 'manual'" class="span-full" label="手动视频列表">
        <NFlex vertical style="width: 100%">
          <div v-for="(item, index) in ensureArrayProp('items')" :key="index" style="display: flex; gap: 8px">
            <NInput v-model:value="item.title" placeholder="标题，可选" />
            <NInput v-model:value="item.url" placeholder="视频链接 https://..." />
            <NButton type="error" secondary @click="ensureArrayProp('items').splice(index, 1)">
              删除
            </NButton>
          </div>
          <NButton type="info" secondary @click="ensureArrayProp('items').push({ title: '', url: 'https://' })">
            添加
          </NButton>
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm v-else-if="props.block.type === 'musicPlayer'" label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="平台">
        <NSelect
          v-model:value="blockProps.provider" :options="[
            { label: 'netease', value: 'netease' },
            { label: 'spotify', value: 'spotify' },
            { label: 'custom', value: 'custom' },
          ]"
        />
      </NFormItem>
      <NFormItem label="高度 px">
        <NInputNumber v-model:value="blockProps.height" :min="60" :max="900" style="width: 100%" />
      </NFormItem>
      <NFormItem label="紧凑模式">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.compact" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem class="span-full" label="链接">
        <NInput v-model:value="blockProps.url" placeholder="https://..." />
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
