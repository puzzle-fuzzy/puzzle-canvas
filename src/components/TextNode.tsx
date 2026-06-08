import { useCallback, useRef, useState, useEffect } from 'react'
import type { NodeProps } from '@xyflow/react'
import type { TextNodeType } from '../types'
import { useUIStore } from '../stores/uiStore'

type TextNodeProps = NodeProps<TextNodeType>

function TextNode({ data }: TextNodeProps) {
  const setTextPreview = useUIStore((s) => s.setTextPreview)
  const contentRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const el = contentRef.current
    if (el) {
      setOverflowing(el.scrollHeight > el.clientHeight)
    }
  }, [data.description])

  const handleClick = useCallback(() => {
    setTextPreview(data.description)
  }, [data.description, setTextPreview])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setTextPreview(data.description)
    }
  }, [data.description, setTextPreview])

  return (
    <button
      className="text-node"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label="展开文本"
    >
      <div className="text-node-content" ref={contentRef}>
        {data.description}
      </div>
      {overflowing && <div className="text-node-fade" aria-hidden="true" />}
    </button>
  )
}

export default TextNode
