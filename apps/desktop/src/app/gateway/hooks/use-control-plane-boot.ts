import { useStore } from '@nanostores/react'
import { useEffect, useRef } from 'react'

import { getHermesConfigRecord } from '@/hermes'
import {
  decideFabricReconnect,
  isLoopbackApi,
  sameFabricApi,
  savedInferenceFromConfig,
  type SavedInference
} from '@/lib/control-plane-reconnect'
import { probeControlPlane, scanPreferredControlPlane } from '@/lib/control-plane-scan'
import { $controlPlane, setControlPlaneConnecting, setControlPlaneFound, setControlPlaneSearching } from '@/store/control-plane'
import { $desktopOnboarding, type OnboardingContext, saveOnboardingLocalEndpoint } from '@/store/onboarding'
import { $gatewayState } from '@/store/session'

const RESCAN_MS = 2_500
const MAX_EMPTY_SCANS = 20
// Once connected, re-verify at a relaxed cadence instead of hammering the
// network on every render — a WiFi/venue change (new SSID, new IP) is still
// caught, just not within milliseconds of it happening.
const CONNECTED_RECHECK_MS = 15_000

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
 * Cold boot: find a Houdry control plane on this WiFi. First run persists it.
 * A venue change (new SSID / IP) rewrites the saved fabric URL to whatever
 * UDP advertised this scan — even if the previous IP still answers on a
 * stale route. Azure is left alone.
 *
 * Runs for as long as the component is mounted: after connecting, it keeps
 * UDP-scanning this WiFi every `CONNECTED_RECHECK_MS` and adopts a newly
 * advertised host even if the previous IP still answers. Azure is left alone.
 */
export function useControlPlaneBoot(ctx: OnboardingContext) {
  const gatewayState = useStore($gatewayState)
  const plane = useStore($controlPlane)
  const configured = useStore($desktopOnboarding).configured
  const ctxRef = useRef(ctx)
  const rewriteRef = useRef(false)
  // Guards the write-back effect against re-persisting the same address on
  // every render — reset (implicitly, by comparison) whenever a new address
  // is adopted, so each distinct venue change still gets its one write.
  const lastWrittenApiRef = useRef<string | null>(null)

  ctxRef.current = ctx

  useEffect(() => {
    const abort = new AbortController()

    setControlPlaneSearching()

    const run = async () => {
      let misses = 0
      let saved: SavedInference | null = null
      let savedLoaded = false
      // Last endpoint we successfully connected to. Once set, the loop
      // switches from "find one" cadence to "keep watching this one" cadence.
      let activeApi: string | null = null

      while (!abort.signal.aborted) {
        const onboarded = $desktopOnboarding.get().configured === true

        if (onboarded && !activeApi && $gatewayState.get() !== 'open') {
          await sleep(RESCAN_MS, abort.signal)
          continue
        }

        if (onboarded) {
          saved = await readSavedInference()
          savedLoaded = true
        }

        if (activeApi) {
          await sleep(CONNECTED_RECHECK_MS, abort.signal)

          if (abort.signal.aborted) {
            return
          }
        }

        const discovered = await scanPreferredControlPlane()

        // A still-reachable IP from another SSID must not skip the WiFi scan.
        // If UDP advertised a different host, fall through and adopt it.
        if (
          activeApi &&
          (!discovered?.api || sameFabricApi(discovered.api, activeApi)) &&
          (await probeControlPlane(activeApi))
        ) {
          continue
        }

        if (activeApi) {
          saved = { baseUrl: activeApi, provider: saved?.provider ?? 'custom' }
        }

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
          activeApi = decision.api
          misses = 0
          setControlPlaneConnecting(decision.api)
          continue
        }

        if (decision.action === 'adopt') {
          activeApi = decision.api
          misses = 0
          rewriteRef.current = rewriteRef.current || onboarded
          setControlPlaneFound(decision.api)
          continue
        }

        misses += 1
        activeApi = null

        if (misses >= MAX_EMPTY_SCANS) {
          // Never surface a loopback address here: the whole point of this
          // status is "still trying" — showing 127.0.0.1 would look like a
          // control plane that exists, when this WiFi genuinely has none.
          const savedBase = saved?.baseUrl?.trim() || null

          setControlPlaneConnecting(savedBase && !isLoopbackApi(savedBase) ? savedBase : null)
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
    if (gatewayState !== 'open' || !plane.api || lastWrittenApiRef.current === plane.api) {
      return
    }

    const onboarded = $desktopOnboarding.get().configured !== false

    if (onboarded && !rewriteRef.current) {
      return
    }

    const api = plane.api

    lastWrittenApiRef.current = api

    void saveOnboardingLocalEndpoint(api, '', ctxRef.current).then(result => {
      if (!result.ok && lastWrittenApiRef.current === api) {
        lastWrittenApiRef.current = null
        rewriteRef.current = false
      }
    })
  }, [configured, gatewayState, plane.api])
}
