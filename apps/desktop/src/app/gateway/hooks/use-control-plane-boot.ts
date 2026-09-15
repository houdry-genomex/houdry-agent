import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

import { getHermesConfigRecord } from '@/hermes'
import {
  decideFabricReconnect,
  savedInferenceFromConfig,
  type SavedInference
} from '@/lib/control-plane-reconnect'
import { probeControlPlane, scanPreferredControlPlane } from '@/lib/control-plane-scan'
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

async function readSavedInference(): Promise<SavedInference | null> {
  try {
    return savedInferenceFromConfig(await getHermesConfigRecord())
  } catch {
    return null
  }
}

/**
 * Cold boot: find a Houdry control plane on loopback / this WiFi.
 * First run persists it. A later venue change (new SSID / IP) rewrites the
 * saved fabric URL when the old one no longer answers. Azure is left alone.
 */
export function useControlPlaneBoot(ctx: OnboardingContext) {
  const gatewayState = useStore($gatewayState)
  const plane = useStore($controlPlane)
  const configured = useStore($desktopOnboarding).configured
  const ctxRef = useRef(ctx)
  const adoptedRef = useRef(false)
  const rewriteRef = useRef(false)

  ctxRef.current = ctx

  useEffect(() => {
    const abort = new AbortController()

    setControlPlaneSearching()

    const run = async () => {
      let misses = 0
      let saved: SavedInference | null = null
      let savedLoaded = false

      while (!abort.signal.aborted) {
        const onboarded = $desktopOnboarding.get().configured === true

        if (onboarded && $gatewayState.get() !== 'open') {
          await sleep(RESCAN_MS, abort.signal)
          continue
        }

        if (onboarded && !savedLoaded) {
          saved = await readSavedInference()
          savedLoaded = true
        }

        const discovered = await scanPreferredControlPlane()
        const savedReachable = saved?.baseUrl ? await probeControlPlane(saved.baseUrl) : false
        const decision = decideFabricReconnect({
          configured: $desktopOnboarding.get().configured,
          discoveredApi: discovered?.api ?? null,
          saved,
          savedLoaded: !onboarded || savedLoaded,
          savedReachable
        })

        if (abort.signal.aborted) {
          return
        }

        if (decision.action === 'skip') {
          setControlPlaneConnecting(null)

          return
        }

        if (decision.action === 'keep') {
          setControlPlaneConnecting(decision.api)

          return
        }

        if (decision.action === 'adopt') {
          rewriteRef.current = onboarded
          setControlPlaneFound(decision.api)

          return
        }

        misses += 1

        if (misses >= MAX_EMPTY_SCANS) {
          setControlPlaneConnecting(saved?.baseUrl || null)

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

    const onboarded = $desktopOnboarding.get().configured !== false

    if (onboarded && !rewriteRef.current) {
      return
    }

    adoptedRef.current = true

    void saveOnboardingLocalEndpoint(plane.api, '', ctxRef.current).then(result => {
      if (!result.ok) {
        adoptedRef.current = false
        rewriteRef.current = false
      }
    })
  }, [configured, gatewayState, plane.api])
}
