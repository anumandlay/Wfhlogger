const normalizeMinus = (s) => String(s || '').replace(/[−–—]/g, '-').trim()

export function parseTimezone(input) {
  const raw = normalizeMinus(input)
  if (!raw) return { kind: 'offset', offsetMinutes: 0, label: 'UTC' }

  const tz = raw.replace(/\s+/g, '')
  if (/^(utc|gmt)$/i.test(tz)) return { kind: 'offset', offsetMinutes: 0, label: 'UTC' }

  const offsetLike = tz.match(/^(utc|gmt)?([+-])(\d{1,2})(?::?(\d{2}))?$/i)
  if (offsetLike) {
    const sign = offsetLike[2] === '-' ? -1 : 1
    const h = Number(offsetLike[3])
    const m = Number(offsetLike[4] || 0)
    const mins = sign * (h * 60 + m)
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    const label = `UTC${sign === 1 ? '+' : '-'}${hh}:${mm}`
    return { kind: 'offset', offsetMinutes: mins, label }
  }

  const plainOffset = tz.match(/^([+-])(\d{2}):?(\d{2})$/)
  if (plainOffset) {
    const sign = plainOffset[1] === '-' ? -1 : 1
    const h = Number(plainOffset[2])
    const m = Number(plainOffset[3])
    const mins = sign * (h * 60 + m)
    const label = `UTC${sign === 1 ? '+' : '-'}${plainOffset[2]}:${plainOffset[3]}`
    return { kind: 'offset', offsetMinutes: mins, label }
  }

  return { kind: 'iana', timeZone: raw }
}

const pad2 = (n) => String(n).padStart(2, '0')

export function toLocalParts(utcMs, tz) {
  const parsed = parseTimezone(tz)
  if (parsed.kind === 'offset') {
    const d = new Date(Number(utcMs) + parsed.offsetMinutes * 60_000)
    return {
      year: d.getUTCFullYear(),
      month: pad2(d.getUTCMonth() + 1),
      day: pad2(d.getUTCDate()),
      hour: pad2(d.getUTCHours()),
      minute: pad2(d.getUTCMinutes()),
      second: pad2(d.getUTCSeconds()),
      timeZone: parsed.label,
    }
  }

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: parsed.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date(Number(utcMs)))
  const get = (type) => parts.find(p => p.type === type)?.value
  return {
    year: Number(get('year')),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
    timeZone: parsed.timeZone,
  }
}

export function localDateKey(utcMs, tz) {
  const p = toLocalParts(utcMs, tz)
  return `${p.year}-${p.month}-${p.day}`
}

export function formatLocalDateTime(utcMs, tz, { withSeconds = false } = {}) {
  const p = toLocalParts(utcMs, tz)
  const time = withSeconds ? `${p.hour}:${p.minute}:${p.second}` : `${p.hour}:${p.minute}`
  return `${p.year}-${p.month}-${p.day} ${time}`
}

export function parseLocalDateTimeToUtcMs(dateStr, timeStr, tz) {
  const date = String(dateStr || '').trim()
  const time = String(timeStr || '').trim()
  const mDate = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const mTime = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!mDate || !mTime) return null

  const y = Number(mDate[1])
  const mo = Number(mDate[2])
  const d = Number(mDate[3])
  const hh = Number(mTime[1])
  const mm = Number(mTime[2])
  const ss = Number(mTime[3] || 0)

  const desiredUtcLike = Date.UTC(y, mo - 1, d, hh, mm, ss)
  const parsed = parseTimezone(tz)
  if (parsed.kind === 'offset') {
    return desiredUtcLike - parsed.offsetMinutes * 60_000
  }

  let guess = desiredUtcLike
  for (let i = 0; i < 3; i += 1) {
    const actual = toLocalParts(guess, parsed.timeZone)
    const actualUtcLike = Date.UTC(Number(actual.year), Number(actual.month) - 1, Number(actual.day), Number(actual.hour), Number(actual.minute), Number(actual.second))
    const diff = desiredUtcLike - actualUtcLike
    if (Math.abs(diff) < 1000) break
    guess = guess + diff
  }
  return guess
}

export function toIsoZ(ms) {
  return new Date(Number(ms)).toISOString()
}

