<template>
  <yt-img-shadow class="no-transition" :height="height" :width="width" style="background-color: transparent;" loaded>
    <img id="img" class="style-scope yt-img-shadow" alt="" :height="height" :width="width" :src="showImgUrl"
      @error="onLoadError" referrerpolicy="no-referrer">
  </yt-img-shadow>
</template>

<script>
import * as models from './models'

export default {
  name: 'ImgShadow',
  props: {
    imgUrl: String,
    height: String,
    width: String
  },
  data() {
    return {
      showImgUrl: this.imgUrl
    }
  },
  watch: {
    imgUrl(val) {
      this.showImgUrl = val
    }
  },
  methods: {
    onLoadError() {
      if (this.showImgUrl !== models.DEFAULT_AVATAR_URL) {
        this.showImgUrl = models.DEFAULT_AVATAR_URL
      }
    }
  }
}
</script>

<style src="@/assets/css/youtube/yt-img-shadow.css"></style>
