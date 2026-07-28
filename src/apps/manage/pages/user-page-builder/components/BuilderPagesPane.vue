<script setup lang="ts">
import { NButton, NCard, NFlex, NIcon, NScrollbar, NText, NTooltip } from 'naive-ui';
import { computed, inject } from 'vue'
import { ChevronBackOutline, ChevronForwardOutline, HomeOutline } from '@vicons/ionicons5'
import PageManager from './PageManager.vue'
import { UserPageEditorKey } from '../context'
import { usePageEntries } from '../usePageEntries'

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
const compactPages = computed(() => pageEntries.value.map(page => ({
  ...page,
  shortLabel: page.title.replace(/^[/@]/, '').trim().slice(0, 1).toLocaleUpperCase() || '#',
})))
</script>

<template>
  <NCard
    class="pane-card pages-pane"
    :class="{ 'pages-pane--collapsed': props.collapsed }"
    content-style="padding: 0; height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; position: relative"
  >
    <template #header>
      <NFlex justify="space-between" align="center" :wrap="false" style="gap: 6px">
        <Transition name="fade">
          <NText v-if="!props.collapsed" strong>
            页面
          </NText>
        </Transition>
        <NTooltip v-if="props.collapsible" placement="right">
          <template #trigger>
            <NButton
              quaternary
              circle
              size="small"
              :aria-label="props.collapsed ? '展开页面栏' : '收起页面栏'"
              @click="emit('toggle-collapse')"
            >
              <template #icon>
                <NIcon>
                  <ChevronBackOutline v-if="!props.collapsed" />
                  <ChevronForwardOutline v-else />
                </NIcon>
              </template>
            </NButton>
          </template>
          {{ props.collapsed ? '展开页面栏' : '收起页面栏' }}
        </NTooltip>
      </NFlex>
    </template>
    <div class="pages-pane__views">
      <div
        class="pages-pane__view pages-pane__view--expanded"
        :class="{ 'is-active': !props.collapsed }"
        :aria-hidden="props.collapsed"
      >
        <div class="pane-scroll">
          <NScrollbar style="height: 100%">
            <div style="padding: 12px">
              <PageManager />
            </div>
          </NScrollbar>
        </div>
      </div>
      <div
        class="pages-pane__view pages-pane__view--collapsed"
        :class="{ 'is-active': props.collapsed }"
        :aria-hidden="!props.collapsed"
      >
        <NScrollbar class="compact-page-scroll">
          <NFlex class="compact-page-nav" vertical align="center" :wrap="false">
            <NTooltip placement="right">
              <template #trigger>
                <NButton
                  circle
                  size="tiny"
                  :type="editor.currentKey.value === 'home' ? 'primary' : 'default'"
                  aria-label="主页"
                  @click="editor.currentKey.value = 'home'"
                >
                  <template #icon>
                    <NIcon><HomeOutline /></NIcon>
                  </template>
                </NButton>
              </template>
              主页
            </NTooltip>
            <NTooltip
              v-for="page in compactPages"
              :key="page.slug"
              placement="right"
            >
              <template #trigger>
                <NButton
                  circle
                  size="tiny"
                  :type="editor.currentKey.value === page.slug ? 'primary' : 'default'"
                  :class="{ 'compact-page-button--hidden': !page.navVisible }"
                  :aria-label="page.title"
                  @click="editor.currentKey.value = page.slug"
                >
                  {{ page.shortLabel }}
                </NButton>
              </template>
              {{ page.title }}{{ page.navVisible ? '' : '（导航隐藏）' }}
            </NTooltip>
          </NFlex>
        </NScrollbar>
      </div>
    </div>
  </NCard>
</template>

<style scoped src="./ui-transitions.css"></style>

<style scoped>
.pages-pane {
  transition: box-shadow 180ms ease;
}

.pages-pane--collapsed :deep(.n-card-header) {
  padding-inline: 9px;
}

.pages-pane--collapsed :deep(.n-card-header__main) {
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
  transition: opacity 150ms ease, transform 180ms ease, visibility 0s linear 180ms;
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

.compact-page-nav :deep(.n-button) {
  flex: 0 0 auto;
  transition: transform 140ms ease, color 140ms ease, background-color 140ms ease;
}

.compact-page-nav :deep(.n-button:hover) {
  transform: translateY(-1px);
}

.compact-page-button--hidden {
  opacity: 0.58;
}
</style>
