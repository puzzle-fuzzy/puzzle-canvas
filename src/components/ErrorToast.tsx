import { useUIStore } from '../stores/uiStore'

function ErrorToast() {
  const error = useUIStore((s) => s.error)

  if (!error) return null

  return <div className="error-toast">{error}</div>
}

export default ErrorToast
