<script setup lang="ts">
import BlockPropertyEditor from './BlockPropertyEditor.vue'

defineOptions({ name: 'BuilderPropsPane' })
</script>

<template>
  <div class="builder-scroll pane-scroll">
    <BlockPropertyEditor />
  </div>
</template>
