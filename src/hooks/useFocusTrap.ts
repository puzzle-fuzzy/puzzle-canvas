import { useEffect, useRef } from 'react'

/**
 * Focus trap hook for modal dialogs.
 *
 * Traps Tab/Shift+Tab within the container, focuses the first focusable element
 * on mount, and restores focus to the previously-focused element on unmount.
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive) return

    // Remember the previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement

    // Focus the first focusable element in the container
    const container = containerRef.current
    if (container) {
      const first = container.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      first?.focus()
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const container = containerRef.current
      if (!container) return

      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handler)

    return () => {
      document.removeEventListener('keydown', handler)
      // Restore focus to the previously focused element
      previousFocusRef.current?.focus()
    }
  }, [isActive])

  return containerRef
}
