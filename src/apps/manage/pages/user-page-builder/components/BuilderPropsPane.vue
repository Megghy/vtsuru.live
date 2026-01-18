<script setup lang="ts">
import { NScrollbar } from 'naive-ui';
import BlockPropertyEditor from './BlockPropertyEditor.vue'

defineOptions({ name: 'BuilderPropsPane' })
</script>

<template>
  <NScrollbar class="pane-scroll">
    <BlockPropertyEditor />
  </NScrollbar>
</template>

