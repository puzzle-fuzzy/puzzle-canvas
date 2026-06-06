import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'
import { useCanvasStore } from '../stores/canvasStore'
import { useUIStore } from '../stores/uiStore'
import { useInputStore } from '../stores/inputStore'

function ModeToolbar() {
  const interactionMode = useCanvasStore((s) => s.interactionMode)
  const setInteractionMode = useCanvasStore((s) => s.setInteractionMode)
  const darkMode = useUIStore((s) => s.darkMode)
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode)
  const setShowAIModal = useUIStore((s) => s.setShowAIModal)
  const setShowSettingsModal = useUIStore((s) => s.setShowSettingsModal)
  const spaceHeld = useInputStore((s) => s.spaceHeld)

  const HandIcon = useAppIcon('hand')
  const CursorIcon = useAppIcon('cursor')
  const SparkleIcon = useAppIcon('sparkle')
  const SunIcon = useAppIcon('sun')
  const MoonIcon = useAppIcon('moon')
  const SettingsIcon = useAppIcon('settings')

  return (
    <div className={`mode-toolbar ${darkMode ? 'dark' : 'light'}`}>
      <button
        className={`mode-toolbar-btn ${interactionMode === 'pan' && !spaceHeld ? 'active' : ''}`}
        onClick={() => setInteractionMode('pan')}
        title="拖拽模式（Space 切换）"
      >
        <Icon size={20}><HandIcon /></Icon>
      </button>
      <button
        className={`mode-toolbar-btn ${interactionMode === 'select' || spaceHeld ? 'active' : ''}`}
        onClick={() => setInteractionMode('select')}
        title="选择模式（Space 切换）"
      >
        <Icon size={20}><CursorIcon /></Icon>
      </button>
      <div className="mode-toolbar-divider" />
      <button
        className="mode-toolbar-btn"
        onClick={() => setShowAIModal(true)}
        title="AI 生图"
      >
        <Icon size={20}><SparkleIcon /></Icon>
      </button>
      <div className="mode-toolbar-divider" />
      <button
        className="mode-toolbar-btn"
        onClick={() => toggleDarkMode()}
        title={darkMode ? '切换到日间模式' : '切换到夜间模式'}
      >
        {darkMode ? <Icon size={20}><SunIcon /></Icon> : <Icon size={20}><MoonIcon /></Icon>}
      </button>
      <div className="mode-toolbar-divider" />
      <button
        className="mode-toolbar-btn"
        onClick={() => setShowSettingsModal(true)}
        title="设置"
      >
        <Icon size={20}><SettingsIcon /></Icon>
      </button>
    </div>
  )
}

export default ModeToolbar
