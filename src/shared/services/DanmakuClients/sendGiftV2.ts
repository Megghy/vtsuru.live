import { Field, Root, Type } from 'protobufjs'

export interface GiftV2Data {
  uid: number
  uname: string
  face: string
  guardLevel: number
  medal?: {
    level: number
    name: string
  }
  gifts: {
    id: number
    name: string
    num: number
    price: number
    timestamp: number
  }[]
}

const medalType = new Type('MedalInfo')
  .add(new Field('uid', 1, 'int64'))
  .add(new Field('level', 5, 'int32'))
  .add(new Field('medalName', 6, 'string'))

const mysteryBoxType = new Type('MysteryBox')
  .add(new Field('boxName', 3, 'string'))
  .add(new Field('boxPrice', 6, 'int32'))

const giftType = new Type('GiftInfo')
  .add(new Field('giftId', 1, 'int32'))
  .add(new Field('giftName', 2, 'string'))
  .add(new Field('num', 3, 'int32'))
  .add(new Field('demarcation', 4, 'int32'))
  .add(new Field('price', 5, 'int32'))
  .add(new Field('timestamp', 10, 'int32'))

const sendGiftType = new Type('SendGift')
  .add(new Field('uid', 1, 'int64'))
  .add(new Field('uname', 2, 'string'))
  .add(new Field('face', 3, 'string'))
  .add(new Field('guardLevel', 5, 'int32'))
  .add(new Field('medal', 8, 'MedalInfo'))
  .add(new Field('mysteryBox', 9, 'MysteryBox'))
  .add(new Field('giftInfo', 10, 'GiftInfo', 'repeated'))

new Root().add(medalType).add(mysteryBoxType).add(giftType).add(sendGiftType).resolveAll()

export function decodeSendGiftV2(pb: string): GiftV2Data {
  const bytes = Uint8Array.from(atob(pb), (char) => char.charCodeAt(0))
  const data = sendGiftType.toObject(sendGiftType.decode(bytes), {
    arrays: true,
    longs: Number,
  })

  return {
    uid: data.uid,
    uname: data.uname,
    face: data.face,
    guardLevel: data.guardLevel,
    medal: data.medal
      ? {
          level: data.medal.level,
          name: data.medal.medalName,
        }
      : undefined,
    gifts: data.giftInfo.map((gift: any) => ({
      id: gift.giftId,
      name: gift.giftName,
      num: gift.num,
      price: gift.price,
      timestamp: gift.timestamp,
    })),
  }
}
