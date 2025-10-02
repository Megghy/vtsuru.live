<script setup>
import { ref, watch } from 'vue'
import * as models from '../../../data/chat/models'

const props = defineProps({
  imgUrl: String,
  height: String,
  width: String,
})

const showImgUrl = ref(props.imgUrl)

watch(() => props.imgUrl, (val) => {
  showImgUrl.value = val
})

function onLoadError() {
  if (showImgUrl.value !== models.DEFAULT_AVATAR_URL) {
    showImgUrl.value = models.DEFAULT_AVATAR_URL
  }
}
</script>

<template>
  <yt-img-shadow
    class="no-transition"
    :height="height"
    :width="width"
    style="background-color: transparent;"
    loaded
  >
    <img
      id="img"
      class="style-scope yt-img-shadow"
      alt=""
      :height="height"
      :width="width"
      :src="showImgUrl"
      referrerpolicy="no-referrer"
      @error="onLoadError"
    >
  </yt-img-shadow>
</template>

<style src="@/assets/css/youtube/yt-img-shadow.css"></style>
