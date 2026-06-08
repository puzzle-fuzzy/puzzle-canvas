import { useState, useRef, useCallback, useEffect } from 'react'
import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'
import { useCanvasStore } from '../stores/canvasStore'
import { useUIStore, type ToolbarPosition } from '../stores/uiStore'
import { useAuthStore } from '../stores/authStore'
import { useInputStore } from '../stores/inputStore'

function computeSnapEdge(x: number, y: number, vw: number, vh: number): ToolbarPosition {
  const relX = x / vw
  const relY = y / vh
  // 离哪条边最近
  const distTop = relY
  const distBottom = 1 - relY
  const distLeft = relX
  const distRight = 1 - relX
  const min = Math.min(distTop, distBottom, distLeft, distRight)
  if (min === distTop) return 'top'
  if (min === distBottom) return 'bottom'
  if (min === distLeft) return 'left'
  return 'right'
}

function isHorizontal(pos: ToolbarPosition): boolean {
  return pos === 'top' || pos === 'bottom'
}

function ModeToolbar() {
  const interactionMode = useCanvasStore((s) => s.interactionMode)
  const setInteractionMode = useCanvasStore((s) => s.setInteractionMode)
  const darkMode = useUIStore((s) => s.darkMode)
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode)
  const setShowAIModal = useUIStore((s) => s.setShowAIModal)
  const setShowSettingsModal = useUIStore((s) => s.setShowSettingsModal)
  const setShowImportModal = useUIStore((s) => s.setShowImportModal)
  const iconSize = useUIStore((s) => s.toolbarIconSize)
  const toolbarPosition = useUIStore((s) => s.toolbarPosition)
  const setToolbarPosition = useUIStore((s) => s.setToolbarPosition)
  const spaceHeld = useInputStore((s) => s.spaceHeld)

  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)
  const [dragEdge, setDragEdge] = useState<ToolbarPosition | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const HandIcon = useAppIcon('hand')
  const CursorIcon = useAppIcon('cursor')
  const SparkleIcon = useAppIcon('sparkle')
  const SunIcon = useAppIcon('sun')
  const MoonIcon = useAppIcon('moon')
  const SettingsIcon = useAppIcon('settings')
  const ImportIcon = useAppIcon('arrowDownload')

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button.mode-toolbar-btn')) return
    const el = toolbarRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setDragCurrent({ x: e.clientX, y: e.clientY })
    setDragEdge(toolbarPosition)
    setDragging(true)
  }, [toolbarPosition])

  useEffect(() => {
    if (!dragging) return

    const handleMouseMove = (e: MouseEvent) => {
      setDragCurrent({ x: e.clientX, y: e.clientY })
      setDragEdge(computeSnapEdge(e.clientX, e.clientY, window.innerWidth, window.innerHeight))
    }

    const handleMouseUp = (e: MouseEvent) => {
      const snap = computeSnapEdge(e.clientX, e.clientY, window.innerWidth, window.innerHeight)
      setToolbarPosition(snap)
      setDragging(false)
      setDragOffset(null)
      setDragCurrent(null)
      setDragEdge(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, setToolbarPosition])

  const activePos = dragging && dragEdge ? dragEdge : toolbarPosition
  const horizontal = isHorizontal(activePos)

  const style = dragging && dragCurrent && dragOffset
    ? {
      position: 'fixed' as const,
      left: dragCurrent.x - dragOffset.x,
      top: dragCurrent.y - dragOffset.y,
      cursor: 'grabbing',
    }
    : getPositionStyles(toolbarPosition)

  const dividerStyle = horizontal
    ? { height: '32px', width: '1px' }
    : { width: '32px', height: '1px' }

  return (
    <div
      ref={toolbarRef}
      className={`mode-toolbar ${darkMode ? 'dark' : 'light'} ${horizontal ? 'mode-toolbar--horizontal' : ''} ${dragging ? 'mode-toolbar--dragging' : ''}`}
      style={style}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`mode-toolbar-avatar ${isAuthenticated ? '' : 'placeholder'}`}
        title={isAuthenticated ? user?.username ?? '' : ''}
        style={{ cursor: 'grab' }}
      >
        {isAuthenticated
          ? <span style={{ fontSize: '14px', fontWeight: 600 }}>{user?.username?.charAt(0).toUpperCase()}</span>
          : <span style={{ fontSize: '11px', fontWeight: 500 }}>?</span>
        }
      </div>
      <div className="mode-toolbar-divider" style={dividerStyle} />
      <button
        className={`mode-toolbar-btn ${interactionMode === 'pan' && !spaceHeld ? 'active' : ''}`}
        onClick={() => setInteractionMode('pan')}
        aria-label="拖拽模式（Space 切换）"
      >
        <Icon size={iconSize}><HandIcon /></Icon>
      </button>
      <button
        className={`mode-toolbar-btn ${interactionMode === 'select' || spaceHeld ? 'active' : ''}`}
        onClick={() => setInteractionMode('select')}
        aria-label="选择模式（Space 切换）"
      >
        <Icon size={iconSize}><CursorIcon /></Icon>
      </button>
      <div className="mode-toolbar-divider" style={dividerStyle} aria-hidden="true" />
      <button
        className="mode-toolbar-btn"
        onClick={() => setShowAIModal(true)}
        aria-label="AI 生图"
      >
        <Icon size={iconSize}><SparkleIcon /></Icon>
      </button>
      <div className="mode-toolbar-divider" style={dividerStyle} aria-hidden="true" />
      <button
        className="mode-toolbar-btn"
        onClick={() => toggleDarkMode()}
        aria-label={darkMode ? '切换到日间模式' : '切换到夜间模式'}
      >
        {darkMode ? <Icon size={iconSize}><SunIcon /></Icon> : <Icon size={iconSize}><MoonIcon /></Icon>}
      </button>
      <div className="mode-toolbar-divider" style={dividerStyle} aria-hidden="true" />
      <button
        className="mode-toolbar-btn"
        onClick={() => setShowImportModal(true)}
        aria-label="导入节点"
      >
        <Icon size={iconSize}><ImportIcon /></Icon>
      </button>
      <div className="mode-toolbar-divider" style={dividerStyle} aria-hidden="true" />
      <button
        className="mode-toolbar-btn"
        onClick={() => setShowSettingsModal(true)}
        aria-label="设置"
      >
        <Icon size={iconSize}><SettingsIcon /></Icon>
      </button>
    </div>
  )
}

function getPositionStyles(pos: ToolbarPosition): Record<string, string> {
  switch (pos) {
    case 'top':
      return { position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)' }
    case 'bottom':
      return { position: 'fixed', bottom: '10px', left: '50%', transform: 'translateX(-50%)' }
    case 'left':
      return { position: 'fixed', top: '50%', left: '10px', transform: 'translateY(-50%)' }
    default:
      return { position: 'fixed', top: '50%', right: '10px', transform: 'translateY(-50%)' }
  }
}

export default ModeToolbar