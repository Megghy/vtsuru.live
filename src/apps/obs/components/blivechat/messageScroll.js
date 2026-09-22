const CHAT_SMOOTH_ANIMATION_TIME_MS = 84
const SCROLLED_TO_BOTTOM_EPSILON = 15

export default {
  methods: {
    showNewMessages() {
      const refs = this.scrollRefs()
      if (!refs) return
      const hasScrollBar = refs.items.clientHeight > refs.scroller.clientHeight
      refs.itemOffset.style.height = `${refs.items.clientHeight}px`
      if (!this.canScrollToBottomOrTimedOut() || !hasScrollBar) {
        return
      }

      // 计算剩余像素
      this.scrollPixelsRemaining += refs.items.clientHeight - this.preinsertHeight
      this.scrollToBottom()

      // 计算是否平滑滚动、剩余时间
      if (!this.lastSmoothChatMessageAddMs) {
        this.lastSmoothChatMessageAddMs = performance.now()
      }
      const interval = performance.now() - this.lastSmoothChatMessageAddMs
      this.chatRateMs = 0.9 * this.chatRateMs + 0.1 * interval
      if (this.isSmoothed) {
        if (this.chatRateMs < 400) {
          this.isSmoothed = false
        }
      } else {
        if (this.chatRateMs > 450) {
          this.isSmoothed = true
        }
      }
      this.scrollTimeRemainingMs += this.isSmoothed ? CHAT_SMOOTH_ANIMATION_TIME_MS : 0

      if (!this.smoothScrollRafHandle) {
        this.smoothScrollRafHandle = window.requestAnimationFrame(this.smoothScroll)
      }
      this.lastSmoothChatMessageAddMs = performance.now()
    },
    smoothScroll(time) {
      if (!this.lastSmoothScrollUpdate) {
        // 第一帧
        this.lastSmoothScrollUpdate = time
        this.smoothScrollRafHandle = window.requestAnimationFrame(this.smoothScroll)
        return
      }

      const interval = time - this.lastSmoothScrollUpdate
      if (
        this.scrollPixelsRemaining <= 0 ||
        this.scrollPixelsRemaining >= 400 || // 已经滚动到底部或者离底部太远则结束
        interval >= 1000 || // 离上一帧时间太久，可能用户切换到其他网页
        this.scrollTimeRemainingMs <= 0 // 时间已结束
      ) {
        this.resetSmoothScroll()
        return
      }

      const pixelsToScroll = (interval / this.scrollTimeRemainingMs) * this.scrollPixelsRemaining
      this.scrollPixelsRemaining -= pixelsToScroll
      if (this.scrollPixelsRemaining < 0) {
        this.scrollPixelsRemaining = 0
      }
      this.scrollTimeRemainingMs -= interval
      if (this.scrollTimeRemainingMs < 0) {
        this.scrollTimeRemainingMs = 0
      }
      this.lastSmoothScrollUpdate = time
      this.smoothScrollRafHandle = window.requestAnimationFrame(this.smoothScroll)
    },
    resetSmoothScroll() {
      this.scrollTimeRemainingMs = this.scrollPixelsRemaining = 0
      this.lastSmoothScrollUpdate = null
      if (this.smoothScrollRafHandle) {
        window.cancelAnimationFrame(this.smoothScrollRafHandle)
        this.smoothScrollRafHandle = null
      }
    },

    scrollRefs() {
      const itemOffset = this.$refs.itemOffset
      const items = this.$refs.items
      const scroller = this.$refs.scroller
      if (!itemOffset || !items || !scroller) return null
      return { itemOffset, items, scroller }
    },
    maybeResizeScrollContainer() {
      const refs = this.scrollRefs()
      if (!refs) return
      refs.itemOffset.style.height = `${refs.items.clientHeight}px`
      refs.itemOffset.style.minHeight = `${refs.scroller.clientHeight}px`
      this.maybeScrollToBottom()
    },
    maybeScrollToBottom() {
      if (this.canScrollToBottomOrTimedOut()) {
        this.scrollToBottom()
      }
    },
    scrollToBottom() {
      const refs = this.scrollRefs()
      if (!refs) return
      refs.scroller.scrollTop = this.appearance.reverse ? 2 ** 24 : 0
      this.atBottom = true
    },
    onScroll() {
      this.refreshCantScrollStartTime()
      const refs = this.scrollRefs()
      if (!refs) return
      const { scroller } = refs
      this.atBottom = this.appearance.reverse
        ? scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < SCROLLED_TO_BOTTOM_EPSILON
        : scroller.scrollTop < SCROLLED_TO_BOTTOM_EPSILON
      this.flushMessagesBuffer()
    },
    canScrollToBottomOrTimedOut() {
      if (this.canScrollToBottom) {
        return true
      }
      // 防止在OBS中卡住，超过一定时间也可以自动滚动
      return new Date() - this.cantScrollStartTime >= 5 * 1000
    },
    refreshCantScrollStartTime() {
      // 有鼠标事件时刷新，防止用户看弹幕时自动滚动
      if (this.cantScrollStartTime) {
        this.cantScrollStartTime = new Date()
      }
    },
  },
}
