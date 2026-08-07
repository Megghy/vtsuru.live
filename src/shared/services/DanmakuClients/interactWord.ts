import { Field, Root, Type } from 'protobufjs'

export interface InteractionData {
  uid: number
  uname: string
  msgType: number
  timestamp: number
  privilegeType: number
  fansMedal?: {
    medalLevel: number
    medalName: string
    isLighted: number
  }
  avatar?: string
}

const fansMedalType = new Type('FansMedal')
  .add(new Field('medalLevel', 2, 'int64'))
  .add(new Field('medalName', 3, 'string'))
  .add(new Field('isLighted', 8, 'int64'))

const userBaseType = new Type('UserBase').add(new Field('face', 2, 'string'))
const userInfoType = new Type('UserInfo').add(new Field('base', 2, 'UserBase'))
const interactWordType = new Type('InteractWord')
  .add(new Field('uid', 1, 'int64'))
  .add(new Field('uname', 2, 'string'))
  .add(new Field('msgType', 5, 'int64'))
  .add(new Field('timestamp', 7, 'int64'))
  .add(new Field('fansMedal', 9, 'FansMedal'))
  .add(new Field('privilegeType', 16, 'int64'))
  .add(new Field('uinfo', 22, 'UserInfo'))

new Root().add(fansMedalType).add(userBaseType).add(userInfoType).add(interactWordType).resolveAll()

export function decodeInteractWord(pb: string): InteractionData {
  const bytes = Uint8Array.from(atob(pb), (char) => char.charCodeAt(0))
  const data = interactWordType.toObject(interactWordType.decode(bytes), { longs: Number, defaults: true })

  return {
    uid: data.uid,
    uname: data.uname,
    msgType: data.msgType,
    timestamp: data.timestamp,
    privilegeType: data.privilegeType,
    fansMedal: data.fansMedal,
    avatar: data.uinfo?.base?.face,
  }
}
