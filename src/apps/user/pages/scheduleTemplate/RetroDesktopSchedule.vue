<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import { defineTemplateConfig } from '@/shared/types/VTsuruConfigTypes'

import { ensureGoogleFont } from './scheduleFonts'
import { useScheduleWeek } from './scheduleTemplateUtils'
import ScheduleWeekToolbar from './ScheduleWeekToolbar.vue'

import './scheduleTemplateTheme.css'

interface RetroDesktopConfig {
  windowTitle: string
  desktopStyle: 'teal' | 'checker'
  titleBarStyle: 'classic' | 'pink'
}

const props = defineProps<ScheduleConfigTypeWithConfig<RetroDesktopConfig>>()

ensureGoogleFont('DotGothic16')

const Config = defineTemplateConfig([
  { name: '窗口标题', type: 'string', key: 'windowTitle', default: 'Schedule.exe' },
  {
    name: '桌面背景',
    type: 'select',
    key: 'desktopStyle',
    default: 'teal',
    options: [
      { label: 'Windows 蓝绿色', value: 'teal' },
      { label: '粉黑棋盘格', value: 'checker' },
    ],
  },
  {
    name: '标题栏',
    type: 'select',
    key: 'titleBarStyle',
    default: 'classic',
    options: [
      { label: '经典深蓝', value: 'classic' },
      { label: '紫粉渐变', value: 'pink' },
    ],
  },
])

const DefaultConfig: RetroDesktopConfig = {
  windowTitle: 'Schedule.exe',
  desktopStyle: 'teal',
  titleBarStyle: 'classic',
}

const boardRef = ref<HTMLElement>()
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, currentWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
const streamerName = computed(() => props.userInfo?.name || 'VTUBER')

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface retro-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="boardRef"
      :file-name="`像素桌面周表_${selectedWeek || '本周'}_${streamerName}`"
    />

    <div
      ref="boardRef"
      class="retro-board"
      :class="`retro-board--${effectiveConfig.desktopStyle}`"
    >
      <div
        class="retro-scanlines"
        aria-hidden="true"
      />

      <div
        class="retro-desktop-icon retro-desktop-icon--trash"
        aria-hidden="true"
      >
        <span class="retro-icon retro-icon--trash" />
        <b>回收站</b>
      </div>
      <div
        class="retro-desktop-icon retro-desktop-icon--heart"
        aria-hidden="true"
      >
        <span class="retro-icon retro-icon--heart">
          <i />
          <i />
        </span>
        <b>BROKEN HEART</b>
      </div>
      <div
        class="retro-desktop-icon retro-desktop-icon--internet"
        aria-hidden="true"
      >
        <span class="retro-icon retro-icon--internet">e</span>
        <b>Internet Explorer</b>
      </div>

      <div
        class="retro-cursor retro-cursor--first"
        aria-hidden="true"
      />
      <div
        class="retro-cursor retro-cursor--second"
        aria-hidden="true"
      />

      <main class="retro-window">
        <header
          class="retro-titlebar"
          :class="`retro-titlebar--${effectiveConfig.titleBarStyle}`"
        >
          <span
            class="retro-titlebar__app-icon"
            aria-hidden="true"
            >S</span
          >
          <h2>{{ effectiveConfig.windowTitle }}</h2>
          <div
            class="retro-window-controls"
            aria-hidden="true"
          >
            <span>_</span>
            <span>□</span>
            <span>X</span>
          </div>
        </header>

        <nav
          class="retro-menubar"
          aria-label="程序菜单"
        >
          <span><u>文</u>件(F)</span>
          <span><u>编</u>辑(E)</span>
          <span><u>查</u>看(V)</span>
          <span><u>帮</u>助(H)</span>
        </nav>

        <div class="retro-addressbar">
          <span>地址(D)</span>
          <strong>C:\STREAM\SCHEDULE\WEEK_{{ String(currentWeek?.week || '--').padStart(2, '0') }}</strong>
          <span class="retro-addressbar__go">转到</span>
        </div>

        <section class="retro-workspace">
          <header class="retro-hero">
            <div>
              <p>WEEKLY STREAM PROGRAM</p>
              <h3>{{ streamerName }} 的直播日程</h3>
            </div>
            <dl>
              <div>
                <dt>DATE</dt>
                <dd>{{ weekLabel }}</dd>
              </div>
              <div>
                <dt>FILES</dt>
                <dd>{{ eventCount }} 个直播项目</dd>
              </div>
            </dl>
          </header>

          <ol class="retro-days">
            <li
              v-for="day in days"
              :key="day.english"
              class="retro-day"
              :class="{ 'is-today': day.isToday, 'is-rest': !day.items.length }"
            >
              <header class="retro-day__folder">
                <span
                  class="retro-folder-icon"
                  aria-hidden="true"
                />
                <span class="retro-day__name">{{ day.english }}_{{ day.shortLabel }}</span>
                <time>{{ day.date }}</time>
              </header>

              <div
                v-if="day.items.length"
                class="retro-day__files"
              >
                <article
                  v-for="(item, itemIndex) in day.items"
                  :key="item.id || itemIndex"
                  class="retro-file"
                  :style="item.tagColor ? { '--file-accent': item.tagColor } : undefined"
                >
                  <span
                    class="retro-txt-icon"
                    aria-hidden="true"
                    >TXT</span
                  >
                  <div class="retro-file__copy">
                    <strong>{{ item.title || '未命名直播' }}</strong>
                    <span>{{ item.tag || '直播' }}_{{ itemIndex + 1 }}.txt</span>
                  </div>
                  <time>{{ item.time || '待定' }}</time>
                </article>
              </div>

              <div
                v-else
                class="retro-error"
                role="status"
              >
                <div class="retro-error__title">
                  <span>Error</span>
                  <b aria-hidden="true">X</b>
                </div>
                <div class="retro-error__body">
                  <span
                    class="retro-error__icon"
                    aria-hidden="true"
                    >!</span
                  >
                  <p><strong>Error 404:</strong> 肝脏未找到，主播正在休眠</p>
                </div>
                <div
                  class="retro-error__actions"
                  aria-hidden="true"
                >
                  <span>确定</span>
                  <span>取消</span>
                </div>
              </div>
            </li>
          </ol>
        </section>

        <footer class="retro-statusbar">
          <span>{{ days.length }} 个文件夹</span>
          <span>{{ eventCount }} 个对象</span>
          <span>系统状态: ONLINE</span>
        </footer>
      </main>

      <div
        class="retro-taskbar"
        aria-hidden="true"
      >
        <span class="retro-start">▰ 开始</span>
        <span class="retro-task">S {{ effectiveConfig.windowTitle }}</span>
        <time>20:00</time>
      </div>
    </div>
  </section>
</template>

<style scoped src="./retroDesktopSchedule.css"></style>
