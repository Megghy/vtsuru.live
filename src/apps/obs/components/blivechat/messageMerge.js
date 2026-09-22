import * as constants from './constants'

export default {
  methods: {
    // 后悔加这个功能了
    mergeSimilarText(content) {
      content = content.trim().toLowerCase()
      for (const message of this.iterRecentMessages(5)) {
        if (message.type === constants.MESSAGE_TYPE_SUPER_CHAT || message.type === constants.MESSAGE_TYPE_GIFT && message.price >= this.appearance.pinnedMinPrice) {
          continue
        }

        const messageContent = message.content.trim().toLowerCase()
        let longer, shorter
        if (messageContent.length > content.length) {
          longer = messageContent
          shorter = content
        } else {
          longer = content
          shorter = messageContent
        }

        if (
          longer.includes(shorter) && // 长的包含短的
          longer.length - shorter.length < shorter.length // 长度差较小
        ) {
          this.updateMessage(message.id, {
            $add: {
              repeated: 1,
            },
          })
          return true
        }
      }
      return false
    },
    mergeSimilarGift(authorName, price, _freePrice, giftName, num) {
      for (const message of this.iterRecentMessages(5)) {
        if (
          message.type === constants.MESSAGE_TYPE_GIFT &&
          message.authorName === authorName &&
          message.giftName === giftName
        ) {
          this.updateMessage(message.id, {
            $add: {
              price,
              // freePrice: freePrice, // 暂时没用到
              num,
            },
          })
          return true
        }
      }
      return false
    },
  },
}
