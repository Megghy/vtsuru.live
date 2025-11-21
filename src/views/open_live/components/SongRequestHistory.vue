<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import type { SongRequestInfo } from '@/api/api-models'
import { ArrowCounterclockwise24Regular, Delete24Filled } from '@vicons/fluent'
import { NButton, NCard, NCheckbox, NDataTable, NIcon, NInput, NInputGroup, NInputGroupLabel, NPopconfirm, NSpace, NTag, NText, NTime, NTooltip } from 'naive-ui'
import { computed, h, ref } from 'vue'
import { SongRequestFrom, SongRequestStatus } from '@/api/api-models'
import { useLiveRequest } from '@/composables/useLiveRequest'

// 使用useLiveRequest
const songRequest = useLiveRequest()

const table = ref()

const statusFilterOptions = computed(() => {
  return Object.values(SongRequestStatus)
    .filter(t => /^\d+$/.test(t.toString()))
    .map((t) => {
      return {
        label: songRequest.STATUS_MAP[t as SongRequestStatus],
        value: t,
      }
    })
})

const columns: DataTableColumns<SongRequestInfo> = [
  {
    title: '曲名',
    key: 'songName',
  },
  {
    title: '用户名',
    key: 'user.name',
    render: (row: SongRequestInfo) => {
      return h(
        NTooltip,
        { trigger: 'hover' },
        {
          trigger: () =>
            h(
              NTag,
              { bordered: false, size: 'small' },
              row.from == 3 // Manual
                ? () => h(NText, { italic: true }, () => '手动添加')
                : () => row.user?.name || '未知用户',
            ),
          default: () => (row.from == 3 ? '就是主播自己' : row.user?.uid || '未知ID'),
        },
      )
    },
  },
  {
    title: '来自',
    key: 'from',
    render(row: SongRequestInfo) {
      let fromType: 'info' | 'success' | 'default' | 'error' = 'info'
      switch (row.from) {
        case SongRequestFrom.Danmaku: { // Danmaku
          fromType = 'info'
          break
        }
        case SongRequestFrom.SC: { // SC
          fromType = 'error'
          break
        }
        case SongRequestFrom.Web: { // Web
          fromType = 'success'
          break
        }
        case SongRequestFrom.Manual: { // Manual
          fromType = 'default'
          break
        }
      }
      return h(NTag, { size: 'small', type: fromType }, () => {
        switch (row.from) {
          case SongRequestFrom.Danmaku: {
            return '弹幕'
          }
          case SongRequestFrom.SC: {
            return `SuperChat${row.price ? ` | ${row.price}` : ''}`
          }
          case SongRequestFrom.Gift: {
            return `礼物${row.price ? ` | ${row.price}` : ''}`
          }
          case SongRequestFrom.Manual: {
            return '手动添加'
          }
          case SongRequestFrom.Web: {
            return '网页添加'
          }
          default:
            return '未知'
        }
      })
    },
  },
  {
    title: '状态',
    key: 'status',
    filter(value, row: SongRequestInfo) {
      return ~row.status == Number(value)
    },
    filterOptions: statusFilterOptions.value,
    render(row: SongRequestInfo) {
      let statusType: 'info' | 'success' | 'warning' | 'error' = 'info'
      switch (row.status) {
        case SongRequestStatus.Singing: {
          statusType = 'success'
          break
        }
        case SongRequestStatus.Waiting: {
          statusType = 'warning'
          break
        }
        case SongRequestStatus.Finish: {
          statusType = 'info'
          break
        }
        case SongRequestStatus.Cancel: {
          statusType = 'error'
          break
        }
      }
      return h(
        NTag,
        {
          type: statusType,
          size: 'small',
          style: row.status == SongRequestStatus.Singing ? 'animation: animated-border 2.5s infinite;' : '',
        },
        () => songRequest.STATUS_MAP[row.status],
      )
    },
  },
  {
    title: '时间',
    key: 'time',
    sorter: (a: SongRequestInfo, b: SongRequestInfo) => a.createAt - b.createAt,
    render: (row: SongRequestInfo) => {
      return h(NTime, { time: row.createAt })
    },
  },
  {
    title: '操作',
    key: 'manage',
    width: 100,
    render(row: SongRequestInfo) {
      return h(
        NSpace,
        {
          justify: 'center',
          size: 10,
        },
        () => [
          row.status == SongRequestStatus.Finish || row.status == SongRequestStatus.Cancel
            ? h(NTooltip, null, {
                trigger: () =>
                  h(
                    NButton,
                    {
                      size: 'small',
                      type: 'info',
                      circle: true,
                      loading: songRequest.isLoading,
                      onClick: () => {
                        songRequest.updateSongStatus(row, SongRequestStatus.Waiting)
                      },
                    },
                    {
                      icon: () => h(NIcon, { component: ArrowCounterclockwise24Regular }),
                    },
                  ),
                default: () => '重新放回等待列表',
              })
            : undefined,
          h(
            NPopconfirm,
            { onPositiveClick: () => songRequest.deleteSongs([row]) },
            {
              trigger: () =>
                h(NTooltip, null, {
                  trigger: () =>
                    h(
                      NButton,
                      {
                        size: 'small',
                        type: 'error',
                        circle: true,
                        loading: songRequest.isLoading,
                      },
                      {
                        icon: () => h(NIcon, { component: Delete24Filled }),
                      },
                    ),
                  default: () => '删除记录',
                }),
              default: () => '确定删除?',
            },
          ),
        ],
      )
    },
  },
]
</script>

<template>
  <NSpace vertical :size="12">
    <NSpace>
      <NInputGroup style="width: 250px">
        <NInputGroupLabel> 筛选曲名 </NInputGroupLabel>
        <NInput
          :value="songRequest.filterSongName"
          clearable
          placeholder="搜索歌曲..."
          @update:value="songRequest.filterSongName = $event"
        >
          <template #suffix>
            <NCheckbox
              :checked="songRequest.filterSongNameContains"
              @update:checked="songRequest.filterSongNameContains = $event"
            >
              包含
            </NCheckbox>
          </template>
        </NInput>
      </NInputGroup>
      <NInputGroup style="width: 250px">
        <NInputGroupLabel> 筛选用户 </NInputGroupLabel>
        <NInput
          :value="songRequest.filterName"
          clearable
          placeholder="搜索用户..."
          @update:value="songRequest.filterName = $event"
        >
          <template #suffix>
            <NCheckbox
              :checked="songRequest.filterNameContains"
              @update:checked="songRequest.filterNameContains = $event"
            >
              包含
            </NCheckbox>
          </template>
        </NInput>
      </NInputGroup>
    </NSpace>
    <NDataTable
      ref="table"
      size="small"
      :columns="columns"
      :data="songRequest.songs"
      :bordered="false"
      :loading="songRequest.isLoading"
      :pagination="{ pageSize: 10 }"
      :row-class-name="(row, index) => (row.status == SongRequestStatus.Singing || row.status == SongRequestStatus.Waiting ? 'song-active' : '')"
    />
  </NSpace>
</template>

<style>
.song-active {
  color: white;
  background-color: #24292e;
}

.song-active:hover {
  background-color: #586069 !important;
}
</style>
