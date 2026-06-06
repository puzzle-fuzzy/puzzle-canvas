import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'
import { useUIStore } from '../stores/uiStore'

/** 预设主题色 */
const PRESET_COLORS = [
  { id: 'indigo',  hex: '#6366f1', label: '靛蓝' },
  { id: 'blue',    hex: '#3b82f6', label: '蓝色' },
  { id: 'violet',  hex: '#8b5cf6', label: '紫罗兰' },
  { id: 'pink',    hex: '#ec4899', label: '粉色' },
  { id: 'red',     hex: '#ef4444', label: '红色' },
  { id: 'orange',  hex: '#f97316', label: '橙色' },
  { id: 'green',   hex: '#22c55e', label: '绿色' },
  { id: 'teal',    hex: '#14b8a6', label: '青色' },
]

interface AppearancePanelProps {
  darkMode: boolean
}

function AppearancePanel({ darkMode }: AppearancePanelProps) {
  const themeColor = useUIStore((s) => s.themeColor)
  const setThemeColor = useUIStore((s) => s.setThemeColor)
  const toolbarIconSize = useUIStore((s) => s.toolbarIconSize)
  const setToolbarIconSize = useUIStore((s) => s.setToolbarIconSize)

  const CheckIcon = useAppIcon('sparkle')

  return (
    <div className={`appearance-panel ${darkMode ? 'dark' : 'light'}`}>
      {/* 主题色 */}
      <div className="appearance-section">
        <div className="appearance-section-title">主题色</div>
        <div className="appearance-color-grid">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.id}
              className={`appearance-color-swatch ${themeColor === c.hex ? 'active' : ''}`}
              style={{ background: c.hex }}
              onClick={() => setThemeColor(c.hex)}
              title={c.label}
              type="button"
            >
              {themeColor === c.hex && (
                <Icon size={14}><CheckIcon /></Icon>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Icon 大小 */}
      <div className="appearance-section">
        <div className="appearance-section-title">
          工具栏图标大小
          <span className="appearance-size-value">{toolbarIconSize}px</span>
        </div>
        <input
          type="range"
          className="appearance-slider"
          min={14}
          max={28}
          step={1}
          value={toolbarIconSize}
          onChange={(e) => setToolbarIconSize(Number(e.target.value))}
        />
        <div className="appearance-slider-labels">
          <span>小</span>
          <span>大</span>
        </div>
      </div>
    </div>
  )
}

export default AppearancePanel
