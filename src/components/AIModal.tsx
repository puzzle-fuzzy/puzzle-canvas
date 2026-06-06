import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'
import { useUIStore } from '../stores/uiStore'
import { useFocusTrap } from '../hooks/useFocusTrap'
import ModelSelect from './ModelSelect'

interface AIModalProps {
  onGenerate: () => void
}

function AIModal({ onGenerate }: AIModalProps) {
  const showAIModal = useUIStore((s) => s.showAIModal)
  const aiPrompt = useUIStore((s) => s.aiPrompt)
  const aiModel = useUIStore((s) => s.aiModel)
  const aiGenerating = useUIStore((s) => s.aiGenerating)
  const darkMode = useUIStore((s) => s.darkMode)
  const setAiPrompt = useUIStore((s) => s.setAiPrompt)
  const setAiModel = useUIStore((s) => s.setAiModel)
  const setShowAIModal = useUIStore((s) => s.setShowAIModal)

  const SparkleIcon = useAppIcon('sparkle')
  const DismissIcon = useAppIcon('dismiss')
  const SpinnerIcon = useAppIcon('spinner')

  const trapRef = useFocusTrap(showAIModal)

  if (!showAIModal) return null

  return (
    <div className="ai-modal-overlay" onClick={() => !aiGenerating && setShowAIModal(false)}>
      <div
        ref={trapRef}
        className={`ai-modal ${darkMode ? 'dark' : 'light'}`}
        role="dialog"
        aria-modal="true"
        aria-label="AI 生图"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ai-modal-header">
          <span className="ai-modal-title">
            <Icon size={16}><SparkleIcon /></Icon>
            AI 生图
          </span>
          <button
            className="ai-modal-close"
            onClick={() => !aiGenerating && setShowAIModal(false)}
            disabled={aiGenerating}
          >
            <Icon size={16}><DismissIcon /></Icon>
          </button>
        </div>

        <textarea
          className="ai-modal-input"
          placeholder="描述你想要的图片..."
          aria-label="图片描述"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          rows={3}
          disabled={aiGenerating}
        />

        <div className="ai-modal-row">
          <ModelSelect
            options={[
              { value: 'dall-e-3', label: 'DALL·E 3' },
              { value: 'flux-1.1-pro', label: 'FLUX 1.1 Pro' },
              { value: 'stable-diffusion-xl', label: 'Stable Diffusion XL' },
            ]}
            value={aiModel}
            onChange={setAiModel}
            disabled={aiGenerating}
            darkMode={darkMode}
          />
          <button
            className="ai-modal-generate"
            onClick={onGenerate}
            disabled={aiGenerating || !aiPrompt.trim()}
          >
            {aiGenerating ? (
              <><span className="spin"><Icon size={14}><SpinnerIcon /></Icon></span> 生成中...</>
            ) : '生成图片'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AIModal
