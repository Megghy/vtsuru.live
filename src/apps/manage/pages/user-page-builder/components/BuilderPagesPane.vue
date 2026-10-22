<script setup lang="ts">
import { ChevronBackOutline, ChevronForwardOutline, HomeOutline } from '@vicons/ionicons5'
import { inject } from 'vue'

import { resolveUserPageNavIcon } from '@/apps/user-page/pageIcons'
import { Button } from '@/shared/ui/button'
import { Card, CardHeader, CardTitle } from '@/shared/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

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
</script>

<template>
  <Card
    class="pane-card pages-pane w-full h-full flex flex-col overflow-hidden relative"
    :class="{ 'pages-pane--collapsed': props.collapsed }"
  >
    <CardHeader
      class="p-2 border-b border-border flex flex-row items-center space-y-0"
      :class="props.collapsed ? 'justify-center' : 'justify-between'"
    >
      <Transition name="fade">
        <CardTitle
          v-if="!props.collapsed"
          class="text-xs font-semibold"
        >
          页面
        </CardTitle>
      </Transition>
      <TooltipProvider v-if="props.collapsible">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-xs"
              class="rounded-md shrink-0"
              :aria-label="props.collapsed ? '展开页面栏' : '收起页面栏'"
              @click="emit('toggle-collapse')"
            >
              <component
                :is="props.collapsed ? ChevronForwardOutline : ChevronBackOutline"
                class="size-3.5"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {{ props.collapsed ? '展开页面栏' : '收起页面栏' }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </CardHeader>

    <div class="pages-pane__views flex-1 min-h-0 relative overflow-hidden">
      <div
        class="pages-pane__view pages-pane__view--expanded"
        :class="{ 'is-active': !props.collapsed }"
        :aria-hidden="props.collapsed"
      >
        <div class="pane-scroll h-full w-full overflow-y-auto p-3">
          <PageManager />
        </div>
      </div>
      <div
        class="pages-pane__view pages-pane__view--collapsed"
        :class="{ 'is-active': props.collapsed }"
        :aria-hidden="!props.collapsed"
      >
        <div class="compact-page-scroll h-full w-full overflow-y-auto">
          <div class="compact-page-nav flex flex-col items-center gap-2 py-2.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    size="icon-xs"
                    class="rounded-full shrink-0 aspect-square"
                    :variant="editor.currentKey.value === 'home' ? 'default' : 'ghost'"
                    aria-label="主页"
                    @click="editor.currentKey.value = 'home'"
                  >
                    <component
                      :is="HomeOutline"
                      class="size-3.5"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">主页</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider
              v-for="page in pageEntries"
              :key="page.slug"
            >
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    size="icon-xs"
                    class="rounded-full shrink-0 aspect-square"
                    :variant="editor.currentKey.value === page.slug ? 'default' : 'ghost'"
                    :class="{ 'opacity-60': !page.navVisible }"
                    :aria-label="page.title"
                    @click="editor.currentKey.value = page.slug"
                  >
                    <component
                      :is="resolveUserPageNavIcon(page.navIcon)"
                      class="size-3.5"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {{ page.title }}{{ page.navVisible ? '' : '（导航隐藏）' }}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped src="./ui-transitions.css"></style>

<style scoped>
.pages-pane {
  transition: box-shadow 180ms ease;
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
</style>
