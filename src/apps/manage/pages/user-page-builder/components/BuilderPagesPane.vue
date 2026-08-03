<script setup lang="ts">
import { computed, inject } from 'vue'

import { UserPageEditorKey } from '../context'
import { usePageEntries } from '../usePageEntries'
import PageManager from './PageManager.vue'

defineOptions({ name: 'BuilderPagesPane' })

const props = defineProps<{
  collapsed: boolean
  collapsible: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-collapse'): void
}>()

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const { pageEntries } = usePageEntries(editor)
const compactPages = computed(() =>
  pageEntries.value.map((page) => ({
    ...page,
    shortLabel: page.title.replace(/^[/@]/, '').trim().slice(0, 1).toLocaleUpperCase() || '#',
  })),
)
</script>

<template>
  <UCard
    class="pane-card pages-pane"
    :class="{ 'pages-pane--collapsed': props.collapsed }"
    content-style="padding: 0; height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; position: relative"
  >
    <template #header>
      <div
        class="builder-row"
        style="gap: 6px"
      >
        <Transition name="fade">
          <span
            class="builder-text"
            v-if="!props.collapsed"
          >
            页面
          </span>
        </Transition>
        <UTooltip
          v-if="props.collapsible"
          placement="right"
        >
          <UButton
            variant="ghost"
            square
            size="sm"
            :aria-label="props.collapsed ? '展开页面栏' : '收起页面栏'"
            @click="emit('toggle-collapse')"
          >
            <template #icon>
              <UIcon :name="props.collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-left'" />
            </template>
          </UButton>

          <template #content>{{ props.collapsed ? '展开页面栏' : '收起页面栏' }}</template>
        </UTooltip>
      </div>
    </template>
    <div class="pages-pane__views">
      <div
        class="pages-pane__view pages-pane__view--expanded"
        :class="{ 'is-active': !props.collapsed }"
        :aria-hidden="props.collapsed"
      >
        <div class="pane-scroll">
          <div
            class="builder-scroll"
            style="height: 100%"
          >
            <div style="padding: 12px">
              <PageManager />
            </div>
          </div>
        </div>
      </div>
      <div
        class="pages-pane__view pages-pane__view--collapsed"
        :class="{ 'is-active': props.collapsed }"
        :aria-hidden="!props.collapsed"
      >
        <div class="builder-scroll compact-page-scroll">
          <div class="builder-stack compact-page-nav">
            <UTooltip placement="right">
              <UButton
                square
                size="xs"
                :color="editor.currentKey.value === 'home' ? 'primary' : 'default'"
                aria-label="主页"
                @click="editor.currentKey.value = 'home'"
              >
                <template #icon>
                  <UIcon name="i-lucide-house" />
                </template>
              </UButton>
              <template #content> 主页 </template></UTooltip
            >
            <UTooltip
              v-for="page in compactPages"
              :key="page.slug"
              placement="right"
            >
              <UButton
                square
                size="xs"
                :color="editor.currentKey.value === page.slug ? 'primary' : 'default'"
                :class="{ 'compact-page-button--hidden': !page.navVisible }"
                :aria-label="page.title"
                @click="editor.currentKey.value = page.slug"
              >
                {{ page.shortLabel }}
              </UButton>

              <template #content>{{ page.title }}{{ page.navVisible ? '' : '（导航隐藏）' }}</template>
            </UTooltip>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>

<style scoped src="./ui-transitions.css"></style>

<style scoped>
.pages-pane {
  transition: box-shadow 180ms ease;
}

.pages-pane--collapsed :deep([data-slot='header']) {
  padding-inline: 9px;
}

.pages-pane--collapsed :deep([data-slot='header'] > *) {
  min-width: 0;
}

.pages-pane__views {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.pages-pane__view {
  position: absolute;
  inset: 0;
  display: flex;
  min-width: 0;
  min-height: 0;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 150ms ease,
    transform 180ms ease,
    visibility 0s linear 180ms;
}

.pages-pane__view.is-active {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateX(0);
  transition-delay: 40ms, 40ms, 0s;
}

.pages-pane__view--expanded {
  transform: translateX(-5px);
}

.pages-pane__view--collapsed {
  transform: translateX(5px);
}

.pages-pane__view .pane-scroll {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.compact-page-scroll {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.compact-page-nav {
  gap: 8px;
  padding: 10px 0;
}

.compact-page-nav :deep(button) {
  flex: 0 0 auto;
  transition:
    transform 140ms ease,
    color 140ms ease,
    background-color 140ms ease;
}

.compact-page-nav :deep(button:hover) {
  transform: translateY(-1px);
}

.compact-page-button--hidden {
  opacity: 0.58;
}
</style>
