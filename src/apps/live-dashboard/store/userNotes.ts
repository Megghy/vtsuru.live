import { reactive } from 'vue'

import type { UserNote } from '../core/db'
import { dashboardDB } from '../core/db'

interface NotesFile {
  version: 1
  timestamp: number
  userNotes: UserNote[]
}

/** 用户备注：本地 IndexedDB，按用户身份合并，跨房间通用 */
export function useUserNotes() {
  const map = reactive(new Map<string, UserNote>())

  async function load() {
    for (const note of await dashboardDB.notes.toArray()) map.set(note.userKey, note)
  }

  function get(userKey: string) {
    return map.get(userKey)
  }

  async function set(userKey: string, uname: string, note: string) {
    const text = note.trim()
    if (!text) {
      map.delete(userKey)
      await dashboardDB.notes.delete(userKey)
      return
    }
    const entry: UserNote = { userKey, uname, note: text, updatedAt: Date.now() }
    map.set(userKey, entry)
    await dashboardDB.notes.put(entry)
  }

  function exportFile(): Blob {
    const file: NotesFile = { version: 1, timestamp: Date.now(), userNotes: [...map.values()] }
    return new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  }

  /** 导入按用户合并，已有备注被覆盖 */
  async function importFile(file: File) {
    const data = JSON.parse(await file.text()) as NotesFile
    if (data.version !== 1 || !Array.isArray(data.userNotes)) throw new Error('不是有效的备注文件')
    await dashboardDB.notes.bulkPut(data.userNotes)
    for (const note of data.userNotes) map.set(note.userKey, note)
    return data.userNotes.length
  }

  return { map, load, get, set, exportFile, importFile }
}
