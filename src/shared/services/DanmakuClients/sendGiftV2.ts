import { Field, Root, Type } from 'protobufjs'

export interface GiftV2Data {
  uid: number
  uname: string
  face: string
  guardLevel: number
  medal?: {
    level: number
    name: string
    isLight?: boolean
  }
  mysteryBox?: {
    name: string
    price: number
  }
  gifts: {
    id: number
    name: string
    num: number
    price: number
    timestamp: number
  }[]
}

interface DecodedGiftV2 {
  uid: number
  uname: string
  face: string
  guardLevel: number
  medal?: { level: number; medalName: string }
  senderUinfo?: {
    uid: number
    medal?: { name: string; level: number; isLight: number }
  }
  mysteryBox?: { boxName: string; boxPrice: number }
  giftInfo: Array<{ giftId: number; giftName: string; num: number; price: number; timestamp: number }>
}

const medalType = new Type('MedalInfo')
  .add(new Field('uid', 1, 'int64'))
  .add(new Field('level', 5, 'int32'))
  .add(new Field('medalName', 6, 'string'))

const uinfoMedalType = new Type('UinfoMedal')
  .add(new Field('name', 1, 'string'))
  .add(new Field('level', 2, 'int32'))
  .add(new Field('isLight', 9, 'int32'))

const senderUinfoType = new Type('SenderUinfo')
  .add(new Field('uid', 1, 'int64'))
  .add(new Field('medal', 3, 'UinfoMedal'))

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
  .add(new Field('senderUinfo', 15, 'SenderUinfo'))

new Root()
  .add(medalType)
  .add(uinfoMedalType)
  .add(senderUinfoType)
  .add(mysteryBoxType)
  .add(giftType)
  .add(sendGiftType)
  .resolveAll()

export function decodeSendGiftV2(pb: string): GiftV2Data {
  const bytes = Uint8Array.from(atob(pb), (char) => char.charCodeAt(0))
  const data = sendGiftType.toObject(sendGiftType.decode(bytes), {
    arrays: true,
    longs: Number,
  }) as DecodedGiftV2

  // field 15 (senderUinfo.medal) 才是本房勋章；field 8 为送礼人当前佩戴的任意主播勋章
  const roomMedal = data.senderUinfo?.uid
    ? data.senderUinfo.medal && data.senderUinfo.medal.level > 0
      ? {
          level: data.senderUinfo.medal.level,
          name: data.senderUinfo.medal.name,
          isLight: data.senderUinfo.medal.isLight === 1,
        }
      : undefined
    : data.medal
      ? {
          level: data.medal.level,
          name: data.medal.medalName,
          isLight: data.medal.medalName !== '',
        }
      : undefined

  return {
    uid: data.uid,
    uname: data.uname,
    face: data.face,
    guardLevel: data.guardLevel,
    medal: roomMedal,
    mysteryBox: data.mysteryBox
      ? {
          name: data.mysteryBox.boxName,
          price: data.mysteryBox.boxPrice,
        }
      : undefined,
    gifts: data.giftInfo.map((gift) => ({
      id: gift.giftId,
      name: gift.giftName,
      num: gift.num,
      price: gift.price,
      timestamp: gift.timestamp,
    })),
  }
}
