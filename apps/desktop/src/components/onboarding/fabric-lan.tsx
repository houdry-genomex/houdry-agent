import { useCallback, useEffect, useRef, useState } from 'react'

import { validateProviderCredential } from '@/api/config'
import { Button } from '@/components/ui/button'
import type { DesktopHoudryFabricEndpoint } from '@/global'
import { useI18n } from '@/i18n'
import {
  displayNameFor,
  type FabricLanEndpoint,
  fabricLanKind,
  fromWifiAdvertise,
  mergeFabricLanScan
} from '@/lib/houdry-fabric-lan'
import { Check, Loader2, Monitor, RefreshCw, Wifi } from '@/lib/icons'
import { type FabricIdentityProbe, scanLocalFabric } from '@/lib/local-inference-scan'
import { cn } from '@/lib/utils'

export type FabricLanAdoptMode = 'auto' | 'pick' | 'rescan'

export type FabricLanDiscover = () => Promise<DesktopHoudryFabricEndpoint[]>
export type FabricLanLoopback = () => Promise<string | null>

async function defaultDiscover(): Promise<DesktopHoudryFabricEndpoint[]> {
  try {
    return (await window.hermesDesktop?.houdryFabric?.discover?.()) ?? []
  } catch {
    return []
  }
}

async function defaultLoopback(): Promise<string | null> {
  try {
    const isFabric: FabricIdentityProbe = async baseUrl => {
      try {
        return (await window.hermesDesktop?.houdryFabric?.isControlPlane?.(baseUrl)) ?? false
      } catch {
        return false
      }
    }

    const hit = await scanLocalFabric(
      baseUrl => validateProviderCredential('OPENAI_BASE_URL', baseUrl),
      isFabric
    )

    return hit?.baseUrl ?? null
  } catch {
    return null
  }
}

export function FabricLanPanel({
  discover = defaultDiscover,
  onAdopt,
  scanThisComputer = defaultLoopback,
  selectedApi
}: {
  discover?: FabricLanDiscover
  onAdopt: (api: string, mode: FabricLanAdoptMode) => void
  scanThisComputer?: FabricLanLoopback
  selectedApi: string
}) {
  const { t } = useI18n()
  const [scanning, setScanning] = useState(true)
  const [endpoints, setEndpoints] = useState<FabricLanEndpoint[]>([])
  const gen = useRef(0)

  const runScan = useCallback(
    async (mode: 'auto' | 'rescan') => {
      const id = ++gen.current

      setScanning(true)

      let wifi: DesktopHoudryFabricEndpoint[] = []
      let loopback: string | null = null

      try {
        wifi = await discover()
      } catch {
        wifi = []
      }

      try {
        loopback = await scanThisComputer()
      } catch {
        loopback = null
      }

      if (id !== gen.current) {
        return
      }

      const found = mergeFabricLanScan(wifi.map(fromWifiAdvertise), loopback)

      setEndpoints(found)
      setScanning(false)

      if (found.length === 1) {
        onAdopt(found[0].api, mode)
      }
    },
    [discover, onAdopt, scanThisComputer]
  )

  useEffect(() => {
    void runScan('auto')
  }, [runScan])

  const kind = fabricLanKind(endpoints.length)
  const thisComputer = t.onboarding.fabricThisComputer

  return (
    <div className="grid gap-2">
      <div className="flex min-h-5 items-start justify-between gap-3">
        {scanning || kind === 'one' || kind === 'many' ? (
          <p className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-muted-foreground">
            {scanning ? (
              <>
                <Loader2 className="size-3 shrink-0 animate-spin" />
                <span>{t.onboarding.fabricScanning}</span>
              </>
            ) : kind === 'one' ? (
              <>
                <Check className="size-3 shrink-0 text-(--theme-primary)" />
                <span className="truncate">
                  {endpoints[0]?.source === 'this-computer'
                    ? t.onboarding.fabricThisComputerHint
                    : t.onboarding.fabricFoundOne}
                </span>
              </>
            ) : (
              <span>{t.onboarding.fabricFoundMany}</span>
            )}
          </p>
        ) : (
          <span />
        )}
        <Button
          className="shrink-0"
          disabled={scanning}
          onClick={() => void runScan('rescan')}
          size="xs"
          type="button"
          variant="text"
        >
          <RefreshCw className="size-3" />
          {t.onboarding.fabricRescan}
        </Button>
      </div>

      {!scanning && kind === 'none' ? (
        <div className="flex gap-3 rounded-2xl border border-transparent bg-background/60 p-3">
          <Wifi className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-5 text-muted-foreground">{t.onboarding.fabricNone}</p>
        </div>
      ) : null}

      {!scanning && (kind === 'one' || kind === 'many') ? (
        <div className={cn('grid gap-2', kind === 'many' && 'max-h-44 overflow-y-auto p-0.5')}>
          {endpoints.map(ep => {
            const selected = selectedApi.trim() === ep.api
            const Icon = ep.source === 'this-computer' ? Monitor : Wifi

            return (
              <button
                aria-pressed={selected}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border bg-background/60 p-3 text-left transition hover:bg-accent/50',
                  selected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'
                )}
                key={ep.api}
                onClick={() => onAdopt(ep.api, 'pick')}
                type="button"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{displayNameFor(ep, thisComputer)}</span>
                    {selected ? <Check className="size-3.5 shrink-0 text-(--theme-primary)" /> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {ep.host}
                    {ep.auth ? ` · ${t.onboarding.fabricToken}` : ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
