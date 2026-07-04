import React from 'react'
import { X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'

export default function ImageViewerModal({ open, images, index, onClose, onIndexChange, title }) {
  const list = Array.isArray(images) ? images : []
  const count = list.length
  const safeIndex = Math.min(Math.max(0, index || 0), Math.max(0, count - 1))
  const current = list[safeIndex] || null

  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (count > 0) onIndexChange?.((safeIndex - 1 + count) % count)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (count > 0) onIndexChange?.((safeIndex + 1) % count)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, onIndexChange, count, safeIndex])

  if (!open) return null

  const canNav = count > 1
  const goPrev = () => canNav && onIndexChange?.((safeIndex - 1 + count) % count)
  const goNext = () => canNav && onIndexChange?.((safeIndex + 1) % count)

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close"
      />

      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-4xl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {title || 'Screenshot'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {current?.caption || current?.subtitle || ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {current?.src && (
                  <a
                    href={current.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                </button>
              </div>
            </div>

            <div className="relative bg-slate-50 dark:bg-slate-950 flex-1 min-h-0">
              {canNav && (
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/90 hover:bg-white border border-slate-200 shadow-sm dark:bg-slate-900/80 dark:hover:bg-slate-900 dark:border-slate-700"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-800 dark:text-slate-100" />
                </button>
              )}
              {canNav && (
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/90 hover:bg-white border border-slate-200 shadow-sm dark:bg-slate-900/80 dark:hover:bg-slate-900 dark:border-slate-700"
                  aria-label="Next"
                >
                  <ChevronRight className="w-5 h-5 text-slate-800 dark:text-slate-100" />
                </button>
              )}

              <div className="w-full h-full flex items-center justify-center p-3 sm:p-4">
                {current?.src ? (
                  <img
                    src={current.src}
                    alt={current.alt || 'Screenshot'}
                    className="max-h-full w-auto max-w-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No image</div>
                )}
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
              <div>
                {count > 0 ? (
                  <span>
                    {safeIndex + 1} / {count}
                  </span>
                ) : (
                  <span>0 / 0</span>
                )}
              </div>
              <div className="hidden sm:block">Esc to close · ←/→ to navigate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
