import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

import { scanPreferredControlPlane } from '@/lib/control-plane-scan'
import { $controlPlane, setControlPlaneConnecting, setControlPlaneFound, setControlPlaneSearching } from '@/store/control-plane'
import { $desktopOnboarding, type OnboardingContext, saveOnboardingLocalEndpoint } from '@/store/onboarding'
import { $gatewayState } from '@/store/session'

const RESCAN_MS = 2_500
const MAX_EMPTY_SCANS = 20

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    const id = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      window.clearTimeout(id)
      resolve()
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Cold boot: search the LAN / loopback for a Houdry control plane, then persist
 * it as the inference gateway once `hermes serve` is up. Does not rewrite an
 * already-configured install.
 */
export function useControlPlaneBoot(ctx: OnboardingContext) {
  const gatewayState = useStore($gatewayState)
  const plane = useStore($controlPlane)
  const configured = useStore($desktopOnboarding).configured
  const ctxRef = useRef(ctx)
  const adoptedRef = useRef(false)

  ctxRef.current = ctx

  useEffect(() => {
    const abort = new AbortController()

    setControlPlaneSearching()

    const run = async () => {
      let misses = 0

      while (!abort.signal.aborted) {
        if ($desktopOnboarding.get().configured === true) {
          setControlPlaneConnecting($controlPlane.get().api)

          return
        }

        const hit = await scanPreferredControlPlane()

        if (abort.signal.aborted) {
          return
        }

        if (hit) {
          setControlPlaneFound(hit.api)

          return
        }

        misses += 1

        if (misses >= MAX_EMPTY_SCANS) {
          setControlPlaneConnecting(null)

          return
        }

        await sleep(RESCAN_MS, abort.signal)
      }
    }

    void run()

    return () => abort.abort()
  }, [])

  useEffect(() => {
    if (gatewayState === 'open' && plane.api) {
      setControlPlaneConnecting(plane.api)
    }
  }, [gatewayState, plane.api])

  useEffect(() => {
    if (gatewayState !== 'open' || !plane.api || adoptedRef.current) {
      return
    }

    if ($desktopOnboarding.get().configured !== false) {
      return
    }

    adoptedRef.current = true

    void saveOnboardingLocalEndpoint(plane.api, '', ctxRef.current).then(result => {
      if (!result.ok) {
        adoptedRef.current = false
      }
    })
  }, [configured, gatewayState, plane.api])
}
