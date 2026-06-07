import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** 隔离粒度：'app' 整个应用级别，'node' 单节点级别 */
  level?: 'app' | 'node'
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * 错误边界组件
 *
 * 防止单个节点渲染崩溃导致整个画布白屏。
 * - app 级别：包裹整个 Canvas，提供全局兜底
 * - node 级别：包裹单个节点类型，提供降级 UI
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.level ?? 'app'}]`, error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.level === 'node') {
      return (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 8,
          color: '#ef4444',
          fontSize: 13,
          maxWidth: 300,
        }}>
          节点渲染出错
        </div>
      )
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 16,
        color: '#64748b',
      }}>
        <p style={{ fontSize: 16 }}>页面渲染出错，请刷新重试</p>
        <button
          onClick={() => {
            this.setState({ hasError: false, error: null })
          }}
          style={{
            padding: '8px 24px',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          重试
        </button>
      </div>
    )
  }
}
