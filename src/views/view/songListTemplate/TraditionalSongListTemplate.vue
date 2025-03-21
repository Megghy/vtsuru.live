<script setup lang="ts">
import { SongListConfigTypeWithConfig } from '@/data/TemplateTypes';
import { TemplateConfig } from '@/data/VTsuruTypes';
import { FILE_BASE_URL } from '@/data/constants';

const props = defineProps<SongListConfigTypeWithConfig<TraditionalConfigType>>()
defineExpose({ Config, DefaultConfig })
</script>

<script lang="ts">
export type TraditionalConfigType = {
  background: string[],
  notice: string,
}
export const DefaultConfig = {} as TraditionalConfigType
export const Config: TemplateConfig<TraditionalConfigType> = {
  name: 'Template.SongList.Traditional',
  items: [
    {
      name: '背景',
      type: 'image',
      imageLimit: 1,
      key: 'background',
      onUploaded: (url, config) => {
        config.background = url
      },
    },
    {
      name: '公告',
      type: 'string',
      key: 'notice',
    },
  ],
}
</script>

<template>
  WIP...
  <div :style="{
    backgroundImage: `${props.config?.background ? 'url(' + FILE_BASE_URL + props.config?.background[0] + ')' : ''}`,
    height: '100%', 'max-width': '100%',
    minHeight: '400px',
    backgroundSize: 'cover',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  }">
    <div :style="{
      height: '100%',
      width: '100%',
      minHeight: '400px',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    }">
      <div style="
      border-radius: 20px;
      border: 3px solid var(--pinky-border-color-dark);
      height: 50px;
      width: 400px;
    ">
        <div v-for="song in props.data" :key="song.id">
          {{ song.name }}
        </div>
      </div>
    </div>
  </div>
</template>