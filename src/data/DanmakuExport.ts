import { AccountInfo, DanmakuModel, EventDataTypes, ResponseLiveInfoModel } from '@/api/api-models'
import { XMLBuilder } from 'fast-xml-parser'
import { List } from 'linqts'

const builder = new XMLBuilder({
  attributeNamePrefix: '@',
  ignoreAttributes: false,
  processEntities: false,
  format: true,
})

export function GetString(
  account: AccountInfo | undefined,
  live: ResponseLiveInfoModel,
  danmakus: DanmakuModel[],
  type: 'json' | 'xml' | 'csv',
) {
  const tempDanmakus = new List(danmakus)
    .Select((d) => {
      return {
        uId: d.uId,
        uName: d.uName,
        sendDate: d.time,
        type: d.type,
        message: d.msg,
        price: d.price,
      }
    })
    .ToArray()
  const obj = {
    live: live,
    danmakus: tempDanmakus,
  }
  switch (type) {
    case 'json': {
      return JSON.stringify(obj)
    }
    case 'xml': {
      const xmlJsonObj = {
        i: {
          chatserver: 'chat.bilibili.com',
          chatid: '0',
          mission: '0',
          maxlimit: '0',
          state: '0',
          real_name: '0',
          source: 'e-r',
          metadata: {
            user_name: account?.name,
            room_id: account?.biliRoomId,
            room_title: live.title,
            area: live.area,
            parent_area: live.parentArea,
            live_start_time: new Date(live.startAt),
            record_start_time: new Date(live.stopAt ?? 0),
            recorder: 'https://vtsuru.live/',
          },
          d: [] as any[],
          gift: [] as any[],
          sc: [] as any[],
        },
      }
      danmakus.forEach((danmaku) => {
        if (danmaku.type == EventDataTypes.Message) {
          xmlJsonObj.i.d.push({
            '@p': `${GetTime(danmaku)},1,25,16777215,${danmaku.time},0,-1`,
            '@uid': danmaku.uId,
            '@user': danmaku.uName,
            '#text': danmaku.msg,
          })
        } else if (danmaku.type == EventDataTypes.Gift) {
          xmlJsonObj.i.gift.push({
            '@ts': GetTime(danmaku),
            '@uid': danmaku.uId,
            '@user': danmaku.uName,
            '@giftname': danmaku.msg,
            '@giftcount': danmaku.num,
            '@cointype': (danmaku.price ?? 0) > 0 ? '金瓜子' : '银瓜子',
            '@price': (danmaku.price ?? 0) * 1000,
          })
        } else if (danmaku.type == EventDataTypes.Guard) {
          xmlJsonObj.i.gift.push({
            '@ts': GetTime(danmaku),
            '@uid': danmaku.uId,
            '@user': danmaku.uName,
            '@giftname': danmaku.msg,
            '@giftcount': danmaku.num,
            '@cointype': '舰长',
            '@price': danmaku.price,
          })
        } else if (danmaku.type == EventDataTypes.SC) {
          xmlJsonObj.i.sc.push({
            '@ts': GetTime(danmaku),
            '@uid': danmaku.uId,
            '@user': danmaku.uName,
            '@price': danmaku.price,
            '#text': danmaku.msg,
          })
        }
      })
      const GetTime = (danmaku: DanmakuModel) => {
        return ((danmaku.time - live.startAt) / 1000).toFixed(3)
      }
      return builder.build(xmlJsonObj)
    }
    case 'csv': {
      return objectsToCSV(tempDanmakus)
    }
  }
}
function objectsToCSV(arr: any[]) {
  const array = [Object.keys(arr[0])].concat(arr)
  return array
    .map((row) => {
      return Object.values(row)
        .map((value) => {
          return typeof value === 'string' ? JSON.stringify(value) : value
        })
        .toString()
    })
    .join('\n')
}
