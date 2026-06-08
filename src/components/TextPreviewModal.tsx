import { useEffect, useRef } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useFocusTrap } from '../hooks/useFocusTrap'

export default function TextPreviewModal() {
  const textPreview = useUIStore((s) => s.textPreview)
  const setTextPreview = useUIStore((s) => s.setTextPreview)
  const modalRef = useRef<HTMLDivElement>(null)

  useFocusTrap(textPreview !== null)

  useEffect(() => {
    if (textPreview === null) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTextPreview(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [textPreview, setTextPreview])

  if (textPreview === null) return null

  return (
    <div className="text-preview-overlay" onClick={() => setTextPreview(null)}>
      <div
        className="text-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label="文本预览"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-preview-body">{textPreview}</div>
      </div>
    </div>
  )
}
