import { useEffect, useMemo, useState } from 'react'

export function usePagination(items, pageSize = 10, deps = []) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items])
  const size = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const total = safeItems.length
  const pageCount = Math.max(1, Math.ceil(total / size))
  const clampedPage = Math.min(Math.max(1, page), pageCount)

  useEffect(() => {
    if (page !== clampedPage) setPage(clampedPage)
  }, [page, clampedPage])

  const pageItems = useMemo(() => {
    const start = (clampedPage - 1) * size
    return safeItems.slice(start, start + size)
  }, [safeItems, clampedPage, size])

  return {
    page: clampedPage,
    pageSize: size,
    total,
    pageCount,
    pageItems,
    setPage,
  }
}
