import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'

import { prefersReducedMotion } from '@/hooks/use-media-query'
import { translateNow } from '@/i18n'
import { cn } from '@/lib/utils'
import { $desktopBoot } from '@/store/boot'
import { $controlPlane } from '@/store/control-plane'
import { $gatewaySwitching } from '@/store/gateway-switch'
import { $gatewayState } from '@/store/session'

const TEXT_OUT_MS = 360
const POST_TEXT_HOLD_MS = 300
const OVERLAY_OUT_MS = 520
const PREVIEW_CONNECT_MS = 2600
const PREVIEW_REPLAY_MS = 1100

type Phase = 'live' | 'text-out' | 'overlay-out' | 'gone'

function forcedPreview(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false
  }

  try {
    return new URLSearchParams(window.location.search).get('connecting') === '1'
  } catch {
    return false
  }
}

function statusCopy(phase: 'searching' | 'found' | 'connecting'): string {
  if (phase === 'searching') {
    return translateNow('boot.steps.searchingControlPlane')
  }

  if (phase === 'found') {
    return translateNow('boot.steps.foundControlPlane')
  }

  return translateNow('boot.steps.connectingGateway')
}

export function GatewayConnectingOverlay() {
  const gatewayState = useStore($gatewayState)
  const boot = useStore($desktopBoot)
  const gatewaySwitching = useStore($gatewaySwitching)
  const controlPlane = useStore($controlPlane)
  const [previewing] = useState(forcedPreview)
  const reduce = prefersReducedMotion()
  const [phase, setPhase] = useState<Phase>('live')
  const coldBootDoneRef = useRef(false)

  if (!boot.running && boot.progress >= 100 && !boot.error) {
    coldBootDoneRef.current = true
  }

  const initialBootActive = boot.visible || boot.running || boot.progress < 100

  const connecting =
    !coldBootDoneRef.current && !gatewaySwitching && gatewayState !== 'open' && !boot.error && initialBootActive

  const shownRef = useRef(false)

  if (previewing || connecting) {
    shownRef.current = true
  }

  useEffect(() => {
    if (phase !== 'live') {
      return
    }

    if (previewing) {
      const id = window.setTimeout(() => setPhase('text-out'), PREVIEW_CONNECT_MS)

      return () => window.clearTimeout(id)
    }

    if (gatewayState === 'open' && shownRef.current) {
      setPhase(reduce ? 'gone' : 'text-out')
    }
  }, [phase, previewing, gatewayState, reduce])

  useEffect(() => {
    if (phase === 'text-out') {
      const id = window.setTimeout(() => setPhase('overlay-out'), TEXT_OUT_MS + POST_TEXT_HOLD_MS)

      return () => window.clearTimeout(id)
    }

    if (phase === 'overlay-out') {
      const id = window.setTimeout(() => setPhase('gone'), OVERLAY_OUT_MS)

      return () => window.clearTimeout(id)
    }

    if (phase === 'gone' && previewing) {
      const id = window.setTimeout(() => setPhase('live'), PREVIEW_REPLAY_MS)

      return () => window.clearTimeout(id)
    }
  }, [phase, previewing])

  if (boot.error && !previewing) {
    return null
  }

  if (phase === 'gone' && !previewing) {
    return null
  }

  if (!previewing && !connecting && !shownRef.current) {
    return null
  }

  const leaving = phase !== 'live'
  const overlayHidden = phase === 'overlay-out' || phase === 'gone'
  const copy = statusCopy(previewing ? 'searching' : controlPlane.phase)

  return (
    <div
      className={cn(
        'fixed inset-0 z-(--z-connecting) grid place-items-center bg-(--ui-chat-surface-background) transition-opacity duration-500 ease-out',
        overlayHidden ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
      data-glass-opaque=""
      data-slot="control-plane-overlay"
    >
      <p
        aria-live="polite"
        className={cn(
          'max-w-sm px-6 text-center text-sm font-medium tracking-[0.005em] text-(--ui-text-secondary) transition duration-300 ease-out',
          leaving ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
        )}
        role="status"
      >
        {copy}
      </p>
    </div>
  )
}
