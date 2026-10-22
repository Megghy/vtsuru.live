<script setup lang="ts">
import BlockPropertyEditor from './BlockPropertyEditor.vue'

defineOptions({ name: 'BuilderPropsPane' })
</script>

<template>
  <div class="pane-scroll h-full overflow-y-auto">
    <BlockPropertyEditor />
  </div>
</template>
