<script setup lang="ts">
const ArrowCounterclockwise24Regular = 'i-lucide-circle'
const Delete24Filled = 'i-lucide-circle'
import { computed, h, ref, resolveComponent } from 'vue'

import type { SongRequestInfo } from '@/api/api-models'
import { SongRequestFrom, SongRequestStatus } from '@/api/api-models'
import { useLiveRequest } from '@/composables/useLiveRequest'

// 使用useLiveRequest
const songRequest = useLiveRequest()

const table = ref()

const statusFilterOptions = computed(() => {
  return Object.values(SongRequestStatus)
    .filter((t) => /^\d+$/.test(t.toString()))
    .map((t) => {
      return {
        label: songRequest.STATUS_MAP[t as SongRequestStatus],
        value: t,
      }
    })
})

const columns: any[] = [
  {
    title: '曲名',
    key: 'songName',
  },
  {
    title: '用户名',
    key: 'user.name',
    render: (row: SongRequestInfo) => {
      return h(
        resolveComponent('UTooltip'),
        { trigger: 'hover' },
        {
          trigger: () =>
            h(
              resolveComponent('UBadge'),
              { bordered: false, size: 'small' },
              row.from == 3 // Manual
                ? () => h('span', { italic: true }, () => '手动添加')
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
        case SongRequestFrom.Danmaku: {
          // Danmaku
          fromType = 'info'
          break
        }
        case SongRequestFrom.SC: {
          // SC
          fromType = 'error'
          break
        }
        case SongRequestFrom.Web: {
          // Web
          fromType = 'success'
          break
        }
        case SongRequestFrom.Manual: {
          // Manual
          fromType = 'default'
          break
        }
      }
      return h(resolveComponent('UBadge'), { size: 'small', type: fromType }, () => {
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
        resolveComponent('UBadge'),
        {
          type: statusType,
          size: 'small',
          bordered: false,
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
      return h('time', { time: row.createAt })
    },
  },
  {
    title: '操作',
    key: 'manage',
    width: 100,
    render(row: SongRequestInfo) {
      return h(
        'div',
        {
          justify: 'center',
          size: 10,
        },
        () => [
          row.status == SongRequestStatus.Finish || row.status == SongRequestStatus.Cancel
            ? h(resolveComponent('UTooltip'), null, {
                trigger: () =>
                  h(
                    resolveComponent('UButton'),
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
                      icon: () => h(resolveComponent('UIcon'), { component: ArrowCounterclockwise24Regular }),
                    },
                  ),
                default: () => '重新放回等待列表',
              })
            : undefined,
          h(
            resolveComponent('UPopover'),
            { onPositiveClick: () => songRequest.deleteSongs([row]) },
            {
              trigger: () =>
                h(resolveComponent('UTooltip'), null, {
                  trigger: () =>
                    h(
                      resolveComponent('UButton'),
                      {
                        size: 'small',
                        type: 'error',
                        circle: true,
                        loading: songRequest.isLoading,
                      },
                      {
                        icon: () => h(resolveComponent('UIcon'), { component: Delete24Filled }),
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
  <div
    vertical
    :size="12"
  >
    <div>
      <div style="width: 250px">
        <span> 筛选曲名 </span>
        <UInput
          :value="songRequest.filterSongName"
          clearable
          placeholder="搜索歌曲..."
          @update:value="songRequest.filterSongName = $event"
        >
          <template #trailing>
            <UCheckbox
              :model-value="songRequest.filterSongNameContains"
              @update:model-value="songRequest.filterSongNameContains = $event === true"
            >
              包含
            </UCheckbox>
          </template>
        </UInput>
      </div>
      <div style="width: 250px">
        <span> 筛选用户 </span>
        <UInput
          :value="songRequest.filterName"
          clearable
          placeholder="搜索用户..."
          @update:value="songRequest.filterName = $event"
        >
          <template #trailing>
            <UCheckbox
              :model-value="songRequest.filterNameContains"
              @update:model-value="songRequest.filterNameContains = $event === true"
            >
              包含
            </UCheckbox>
          </template>
        </UInput>
      </div>
    </div>
    <UTable
      ref="table"
      size="small"
      :columns="columns"
      :data="songRequest.songs"
      :bordered="false"
      :loading="songRequest.isLoading"
      :pagination="{ pageIndex: 1, pageSize: 10 }"
      :row-class-name="
        (row, index) =>
          row.status === SongRequestStatus.Singing || row.status === SongRequestStatus.Waiting ? 'song-active' : ''
      "
    />
  </div>
</template>

<style>
.song-active {
  color: var(--vtsuru-fg);
  background-color: rgba(var(--vtsuru-primary-rgb), 0.08);
}

.song-active:hover {
  background-color: rgba(var(--vtsuru-primary-rgb), 0.12) !important;
}
</style>
