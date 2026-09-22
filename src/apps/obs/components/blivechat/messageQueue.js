import * as constants from './constants'
const ADD_MESSAGE_TYPES = new Set([constants.MESSAGE_TYPE_TEXT, constants.MESSAGE_TYPE_GIFT, constants.MESSAGE_TYPE_MEMBER, constants.MESSAGE_TYPE_SUPER_CHAT])
const MESSAGE_MIN_INTERVAL = 80
const MESSAGE_MAX_INTERVAL = 1000

export default {
  methods: {
    enqueueMessages(messages) {
      // 估计进队列时间间隔
      if (!this.lastEnqueueTime) {
        this.lastEnqueueTime = new Date()
      } else {
        const curTime = new Date()
        const interval = curTime - this.lastEnqueueTime
        // 真实的进队列时间间隔模式大概是这样：2500, 300, 300, 300, 2500, 300, ...
        // B站消息有缓冲，会一次发多条消息。这里把波峰视为发送了一次真实的WS消息，所以要过滤掉间隔太小的
        if (interval > 1000 || this.enqueueIntervals.length < 5) {
          this.enqueueIntervals.push(interval)
          if (this.enqueueIntervals.length > 5) {
            this.enqueueIntervals.splice(0, this.enqueueIntervals.length - 5)
          }
          // 这边估计得尽量大，只要不太早把消息缓冲发完就是平滑的。有MESSAGE_MAX_INTERVAL保底，不会让消息延迟太大
          // 使用Math.max计算最大值来估计下次入队时间间隔
          this.estimatedEnqueueInterval = Math.max(...this.enqueueIntervals)
        }
        // 上次入队时间还是要设置，否则会太早把消息缓冲发完，然后较长时间没有新消息
        this.lastEnqueueTime = curTime
      }

      // 把messages分成messageGroup，每个组里最多有1个需要平滑的消息
      let messageGroup = []
      for (const message of messages) {
        messageGroup.push(message)
        if (this.isAddMessage(message)) {
          this.smoothedMessageQueue.push(messageGroup)
          messageGroup = []
        }
      }
      // 还剩下不需要平滑的消息
      if (messageGroup.length > 0) {
        if (this.smoothedMessageQueue.length > 0) {
          // 和上一组合并
          const lastMessageGroup = this.smoothedMessageQueue.at(-1)
          lastMessageGroup.push(...messageGroup)
        } else {
          // 自己一个组
          this.smoothedMessageQueue.push(messageGroup)
        }
      }

      if (!this.emitSmoothedMessageTimerId) {
        this.emitSmoothedMessageTimerId = window.setTimeout(this.emitSmoothedMessages)
      }
    },
    isAddMessage({ type }) {
      return ADD_MESSAGE_TYPES.has(type)
    },
    emitSmoothedMessages() {
      this.emitSmoothedMessageTimerId = null
      if (this.smoothedMessageQueue.length <= 0) {
        return
      }

      // 估计的下次进队列剩余时间
      let estimatedNextEnqueueRemainTime = 10 * 1000
      if (this.estimatedEnqueueInterval) {
        estimatedNextEnqueueRemainTime = Math.max(this.lastEnqueueTime - new Date() + this.estimatedEnqueueInterval, 1)
      }
      // 计算发送的消息数，保证在下次进队列之前发完
      // 下次进队列之前应该发多少条消息
      const shouldEmitGroupNum = Math.max(this.smoothedMessageQueue.length, 0)
      // 下次进队列之前最多能发多少次
      const maxCanEmitCount = estimatedNextEnqueueRemainTime / MESSAGE_MIN_INTERVAL
      // 这次发多少条消息
      let groupNumToEmit
      if (shouldEmitGroupNum < maxCanEmitCount) {
        // 队列中消息数很少，每次发1条也能发完
        groupNumToEmit = 1
      } else {
        // 每次发1条以上，保证按最快速度能发完
        groupNumToEmit = Math.ceil(shouldEmitGroupNum / maxCanEmitCount)
      }

      // 发消息
      const messageGroups = this.smoothedMessageQueue.splice(0, groupNumToEmit)
      const mergedGroup = messageGroups.flat()
      this.handleMessageGroup(mergedGroup)

      if (this.smoothedMessageQueue.length <= 0) {
        return
      }
      // 消息没发完，计算下次发消息时间
      let sleepTime
      if (groupNumToEmit === 1) {
        // 队列中消息数很少，随便定个[MESSAGE_MIN_INTERVAL, MESSAGE_MAX_INTERVAL]的时间
        sleepTime = estimatedNextEnqueueRemainTime / this.smoothedMessageQueue.length
        sleepTime *= 0.5 + Math.random()
        if (sleepTime > MESSAGE_MAX_INTERVAL) {
          sleepTime = MESSAGE_MAX_INTERVAL
        } else if (sleepTime < MESSAGE_MIN_INTERVAL) {
          sleepTime = MESSAGE_MIN_INTERVAL
        }
      } else {
        // 按最快速度发
        sleepTime = MESSAGE_MIN_INTERVAL
      }
      this.emitSmoothedMessageTimerId = window.setTimeout(this.emitSmoothedMessages, sleepTime)
    },

  },
}
