export interface EventFetcherStateModel {
  online: boolean
  status: { [errorCode: string]: string }
  version?: string
  todayReceive: number
  useCookie: boolean
  type: EventFetcherType
}

export enum EventFetcherType {
  Application,
  OBS,
  Server,
  Tauri,
}

export interface BiliRoomInfo {
  uid: number
  room_id: number
  short_id: number
  attention: number
  online: number
  is_portrait: boolean
  description: string
  live_status: number
  area_id: number
  parent_area_id: number
  parent_area_name: string
  old_area_id: number
  background: string
  title: string
  user_cover: string
  keyframe: string
  is_strict_room: boolean
  live_time: string
  tags: string
  is_anchor: number
  room_silent_type: string
  room_silent_level: number
  room_silent_second: number
  area_name: string
  pendants: string
  area_pendants: string
  hot_words: string[]
  hot_words_status: number
  verify: string
  new_pendants: {
    frame: {
      name: string
      value: string
      position: number
      desc: string
      area: number
      area_old: number
      bg_color: string
      bg_pic: string
      use_old_area: boolean
    }
    badge: unknown // null in the example, adjust to proper type if known
    mobile_frame: {
      name: string
      value: string
      position: number
      desc: string
      area: number
      area_old: number
      bg_color: string
      bg_pic: string
      use_old_area: boolean
    }
    mobile_badge: unknown // null in the example, adjust to proper type if known
  }
  up_session: string
  pk_status: number
  pk_id: number
  battle_id: number
  allow_change_area_time: number
  allow_upload_cover_time: number
  studio_info: {
    status: number
    master_list: any[] // empty array in the example, adjust to proper type if known
  }
}

export interface FetcherStatisticData {
  date: string
  count: number
  eventTypeCounts: { [eventType: string]: number }
}
export interface BiliStreamingInfo {
  status: 'prepare' | 'streaming' | 'cycle'
  streamAt: Date
  roomId: number
  title: string
  coverUrl: string
  frameUrl: string
  areaName: string
  parentAreaName: string
  online: number
  attention: number
}

// Nested type for Vip Label
interface VipLabel {
  path: string
  text: string
  label_theme: string
  text_color: string
  bg_style: number
  bg_color: string
  border_color: string
  use_img_label: boolean
  img_label_uri_hans: string
  img_label_uri_hant: string
  img_label_uri_hans_static: string
  img_label_uri_hant_static: string
}

// Nested type for Avatar Icon
interface AvatarIcon {
  icon_type: number
  // Assuming icon_resource could contain arbitrary data or be empty
  icon_resource: Record<string, unknown> | {}
}

// Nested type for Vip Info
interface VipInfo {
  type: number
  status: number
  due_date: number // Likely a Unix timestamp in milliseconds
  vip_pay_type: number
  theme_type: number
  label: VipLabel
  avatar_subscript: number
  nickname_color: string
  role: number
  avatar_subscript_url: string
  tv_vip_status: number
  tv_vip_pay_type: number
  tv_due_date: number // Likely a Unix timestamp in milliseconds or 0
  avatar_icon: AvatarIcon
}

// Nested type for Pendant Info
interface PendantInfo {
  pid: number
  name: string
  image: string // URL
  expire: number // Likely a timestamp or duration
  image_enhance: string // URL
  image_enhance_frame: string // URL or empty string
  n_pid: number
}

// Nested type for Nameplate Info
interface NameplateInfo {
  nid: number
  name: string
  image: string // URL
  image_small: string // URL
  level: string
  condition: string
}

// Nested type for Official Info
interface OfficialInfo {
  role: number
  title: string
  desc: string
  type: number
}

// Nested type for Profession Info
interface ProfessionInfo {
  id: number
  name: string
  show_name: string
  is_show: number // Likely 0 or 1
  category_one: string
  realname: string
  title: string
  department: string
  certificate_no: string
  certificate_show: boolean
}

// Nested type for Honours Colour
interface HonoursColour {
  dark: string // Hex color code
  normal: string // Hex color code
}

// Nested type for Honours Info
interface HonoursInfo {
  mid: number
  colour: HonoursColour
  // Assuming tags could be an array of strings if not null
  tags: string[] | null
  is_latest_100honour: number // Likely 0 or 1
}

// Nested type for Attestation Common Info
interface CommonAttestationInfo {
  title: string
  prefix: string
  prefix_title: string
}

// Nested type for Attestation Splice Info
interface SpliceAttestationInfo {
  title: string
}

// Nested type for Attestation Info
interface AttestationInfo {
  type: number
  common_info: CommonAttestationInfo
  splice_info: SpliceAttestationInfo
  icon: string
  desc: string
}

// Nested type for Expert Info
interface ExpertInfo {
  title: string
  state: number
  type: number
  desc: string
}

// Nested type for Level Exp Info
interface LevelExpInfo {
  current_level: number
  current_min: number
  current_exp: number
  next_exp: number // -1 might indicate max level or data not applicable
  level_up: number // Likely a Unix timestamp
}

// Main User Profile Type
export interface BiliUserProfile {
  mid: number
  name: string
  sex: string // Could be more specific like '男' | '女' | '保密' if desired
  face: string // URL
  sign: string
  rank: number
  level: number
  jointime: number // Likely a Unix timestamp or 0
  moral: number
  silence: number // Likely 0 or 1
  email_status: number // Likely 0 or 1
  tel_status: number // Likely 0 or 1
  identification: number // Likely 0 or 1
  vip: VipInfo
  pendant: PendantInfo
  nameplate: NameplateInfo
  official: OfficialInfo
  birthday: number // Likely a Unix timestamp
  is_tourist: number // Likely 0 or 1
  is_fake_account: number // Likely 0 or 1
  pin_prompting: number // Likely 0 or 1
  is_deleted: number // Likely 0 or 1
  in_reg_audit: number // Likely 0 or 1
  is_rip_user: boolean
  profession: ProfessionInfo
  face_nft: number
  face_nft_new: number
  is_senior_member: number // Likely 0 or 1
  honours: HonoursInfo
  digital_id: string
  digital_type: number
  attestation: AttestationInfo
  expert_info: ExpertInfo
  // Assuming name_render could be various types or null
  name_render: any | null
  country_code: string
  level_exp: LevelExpInfo
  coins: number // Can be float
  following: number
  follower: number
}
