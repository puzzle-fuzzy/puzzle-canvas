import { useState, type FormEvent } from 'react'
import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'
import { useUIStore } from '../stores/uiStore'
import { useCanvasStore } from '../stores/canvasStore'
import { register, login } from '../utils/auth'
import { loadNodes } from '../utils/api'

type Tab = 'login' | 'register'

function LoginModal() {
  const showLoginModal = useUIStore((s) => s.showLoginModal)
  const setShowLoginModal = useUIStore((s) => s.setShowLoginModal)
  const darkMode = useUIStore((s) => s.darkMode)

  const UserIcon = useAppIcon('user')
  const DismissIcon = useAppIcon('dismiss')
  const SpinnerIcon = useAppIcon('spinner')

  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!showLoginModal) return null

  const resetForm = () => {
    setEmail('')
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setError('')
    setLoading(false)
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    resetForm()
  }

  const handleClose = () => {
    if (!loading) {
      setShowLoginModal(false)
      resetForm()
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (tab === 'register') {
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致')
        return
      }
      if (password.length < 6) {
        setError('密码长度至少 6 个字符')
        return
      }
    }

    setLoading(true)
    try {
      if (tab === 'login') {
        await login(email, password)
      } else {
        await register(email, username, password)
      }
      // 登录/注册成功 → 关闭弹窗
      setShowLoginModal(false)
      resetForm()

      // 登录后加载节点
      const loaded = await loadNodes()
      useCanvasStore.getState().setNodes(loaded)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-modal-overlay" onClick={handleClose}>
      <div className={`auth-modal ${darkMode ? 'dark' : 'light'}`} onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <span className="auth-modal-title">
            <Icon size={16}><UserIcon /></Icon>
            {tab === 'login' ? '登录' : '注册'}
          </span>
          <button className="auth-modal-close" onClick={handleClose} disabled={loading}>
            <Icon size={16}><DismissIcon /></Icon>
          </button>
        </div>

        <div className="auth-modal-tabs">
          <button
            className={`auth-modal-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
            disabled={loading}
          >
            登录
          </button>
          <button
            className={`auth-modal-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => switchTab('register')}
            disabled={loading}
          >
            注册
          </button>
        </div>

        <form className="auth-modal-form" onSubmit={handleSubmit}>
          <input
            className="auth-modal-input"
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
          {tab === 'register' && (
            <input
              className="auth-modal-input"
              type="text"
              placeholder="用户名（2-20 个字符）"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              minLength={2}
              maxLength={20}
              required
            />
          )}
          <input
            className="auth-modal-input"
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            minLength={6}
            required
          />
          {tab === 'register' && (
            <input
              className="auth-modal-input"
              type="password"
              placeholder="确认密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              minLength={6}
              required
            />
          )}
          <button className="auth-modal-submit" type="submit" disabled={loading}>
            {loading ? (
              <><span className="spin"><Icon size={14}><SpinnerIcon /></Icon></span> 处理中...</>
            ) : tab === 'login' ? '登录' : '注册'}
          </button>
        </form>

        {error && <div className="auth-modal-error">{error}</div>}
      </div>
    </div>
  )
}

export default LoginModal
