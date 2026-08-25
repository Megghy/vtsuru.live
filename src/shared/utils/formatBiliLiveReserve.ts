export function formatBiliLiveReserveInterval(minutes: number) {
  if (minutes >= 60 && minutes % 60 === 0) return `约每 ${minutes / 60} 小时自动更新`
  return `约每 ${minutes} 分钟自动更新`
}

export function formatBiliLiveReserveTime(unix: number) {
  if (!unix) return ''
  const date = new Date(unix * 1000)
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  if (isSameDate(date, today)) return `今天 ${hm}`
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (isSameDate(date, tomorrow)) return `明天 ${hm}`
  return `${date.getMonth() + 1}月${date.getDate()}日 ${hm}`
}

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
