<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { computed } from 'vue'
import type { BlockPageProject } from './schema'
import ProfileBlock from './blocks/ProfileBlock.vue'
import HeadingBlock from './blocks/HeadingBlock.vue'
import TextBlock from './blocks/TextBlock.vue'
import LinksBlock from './blocks/LinksBlock.vue'
import ButtonsBlock from './blocks/ButtonsBlock.vue'
import ImageBlock from './blocks/ImageBlock.vue'
import EmbedBlock from './blocks/EmbedBlock.vue'
import DividerBlock from './blocks/DividerBlock.vue'
import SpacerBlock from './blocks/SpacerBlock.vue'
import FooterBlock from './blocks/FooterBlock.vue'

const props = defineProps<{
  project: BlockPageProject
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
}>()

const radius = computed(() => props.project.theme?.radius ?? 12)
const spacing = computed(() => {
  const v = props.project.theme?.spacing ?? 'normal'
  if (v === 'compact') return 10
  if (v === 'relaxed') return 18
  return 14
})
const containerStyle = computed(() => ({
  '--vtsuru-page-radius': `${radius.value}px`,
  '--vtsuru-page-spacing': `${spacing.value}px`,
  '--vtsuru-page-primary': props.project.theme?.primaryColor ?? 'var(--n-color)',
  '--vtsuru-page-bg': props.project.theme?.backgroundColor ?? 'transparent',
  '--vtsuru-page-text': props.project.theme?.textColor ?? 'inherit',
}))

const blockComponents = {
  profile: ProfileBlock,
  heading: HeadingBlock,
  text: TextBlock,
  links: LinksBlock,
  buttons: ButtonsBlock,
  image: ImageBlock,
  embed: EmbedBlock,
  divider: DividerBlock,
  spacer: SpacerBlock,
  footer: FooterBlock,
} as const
</script>

<template>
  <div
    class="page"
    :style="containerStyle"
  >
    <div
      v-for="block in project.blocks"
      :key="block.id"
      class="block"
    >
      <component
        :is="blockComponents[block.type]"
        v-if="!block.hidden"
        :block-props="block.props"
        :user-info="userInfo"
        :bili-info="biliInfo"
      />
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 820px;
  margin: 0 auto;
  padding: 8px 0;
  color: var(--vtsuru-page-text);
  background: var(--vtsuru-page-bg);
}
.block {
  padding: var(--vtsuru-page-spacing);
  border-radius: var(--vtsuru-page-radius);
}
</style>

