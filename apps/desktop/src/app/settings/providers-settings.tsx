import { useState } from 'react'

import { RowButton } from '@/components/ui/row-button'
import { SearchField } from '@/components/ui/search-field'
import { useI18n } from '@/i18n'
import {
  isHoudryDesktopInferenceEnvKey,
  isHoudryDesktopInferenceGroupName
} from '@/lib/houdry-inference-providers'
import { ChevronRight } from '@/lib/icons'
import { normalize } from '@/lib/text'
import { startManualLocalEndpoint } from '@/store/onboarding'
import type { EnvVarInfo } from '@/types/hermes'

import { isKeyVar, ProviderKeyRows } from './credential-key-ui'
import { CustomEndpointsSettings } from './custom-endpoints-settings'
import { useEnvCredentials } from './env-credentials'
import { providerGroup, providerMeta, providerPriority } from './helpers'
import { SettingsContent, SettingsSkeleton } from './primitives'

// Sub-views: Azure API keys vs Houdry fabric endpoints. `accounts` remains in
// the enum so old `?pview=accounts` deep links still parse, then Settings
// redirects them to keys.
export const PROVIDER_VIEWS = ['accounts', 'keys', 'custom-endpoints'] as const

export type ProviderView = (typeof PROVIDER_VIEWS)[number]

function isHoudryDesktopInferenceKeyGroup(name: string, envKey: string): boolean {
  return isHoudryDesktopInferenceEnvKey(envKey) || isHoudryDesktopInferenceGroupName(name)
}

// Group the env catalog by provider — one ListRow per vendor plus optional
// advanced overrides (base URL, region, etc.). Groups without a key field are
// skipped.
//
// Desktop only lists Azure OpenAI. Houdry GPU fabric is the LocalEndpointRow
// + custom-endpoints tab, not a third-party env-key card.
function buildProviderKeyGroups(vars: Record<string, EnvVarInfo>): ProviderKeyGroup[] {
  const buckets = new Map<string, [string, EnvVarInfo][]>()

  for (const [key, info] of Object.entries(vars)) {
    if (info.category !== 'provider') {
      continue
    }

    const name = info.provider_label?.trim() || info.provider?.trim() || providerGroup(key)

    if (name === 'Other' || !isHoudryDesktopInferenceKeyGroup(name, key)) {
      continue
    }

    buckets.set(name, [...(buckets.get(name) ?? []), [key, info]])
  }

  const groups: ProviderKeyGroup[] = []

  for (const [name, entries] of buckets) {
    const primary = entries.find(([k, i]) => !i.advanced && isKeyVar(k, i)) ?? entries.find(([k, i]) => isKeyVar(k, i))

    if (!primary) {
      continue
    }

    const meta = providerMeta(name)

    groups.push({
      advanced: entries
        .filter(([k, i]) => k !== primary[0] && (!isKeyVar(k, i) || i.is_set))
        .sort(([a], [b]) => a.localeCompare(b)),
      description: meta?.description ?? primary[1].description,
      docsUrl: meta?.docsUrl ?? primary[1].url ?? undefined,
      hasAnySet: entries.some(([, i]) => i.is_set),
      name,
      primary,
      priority: providerPriority(name)
    })
  }

  return groups.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
}

function NoProviderKeys() {
  const { t } = useI18n()

  return (
    <div className="grid min-h-32 place-items-center px-4 py-8 text-center text-[length:var(--conversation-caption-font-size)] text-muted-foreground">
      {t.settings.providers.noProviderKeys}
    </div>
  )
}

// Houdry GPU fabric entry point. The env-var key catalog never lists a custom
// OpenAI-compatible URL, so this row is the GUI path to the fabric /v1 endpoint.
// Pass reason: null — the onboarding overlay renders an unmapped reason string
// verbatim as a banner (see ReasonNotice in onboarding/index.tsx).
function LocalEndpointRow({ onOpen }: { onOpen: (reason: null | string) => void }) {
  const { t } = useI18n()
  const copy = t.settings.providers.localEndpoint

  return (
    <RowButton
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-[6px] px-3 py-2.5 text-left transition-colors hover:bg-(--ui-control-hover-background)"
      onClick={() => onOpen(null)}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[length:var(--conversation-text-font-size)] font-semibold">{copy.title}</span>
        <span className="truncate text-[length:var(--conversation-caption-font-size)] leading-5 text-muted-foreground">
          {copy.description}
        </span>
      </div>
      <ChevronRight className="size-4 text-muted-foreground transition group-hover:text-foreground" />
    </RowButton>
  )
}

export function ProvidersSettings({
  onConfigSaved,
  onMainModelChanged,
  view
}: ProvidersSettingsProps) {
  const { t } = useI18n()
  const { rowProps, vars } = useEnvCredentials()
  const [openProvider, setOpenProvider] = useState<null | string>(null)
  const [keyQuery, setKeyQuery] = useState('')

  if (!vars) {
    return <SettingsSkeleton search sections={[{ rows: 6 }]} />
  }

  if (view === 'custom-endpoints') {
    return <CustomEndpointsSettings onConfigSaved={onConfigSaved} onMainModelChanged={onMainModelChanged} />
  }

  const keyGroups = buildProviderKeyGroups(vars)
  const q = normalize(keyQuery)
  const showSearch = keyGroups.length > 1

  const visibleGroups = q
    ? keyGroups.filter(group => {
        const haystack = [group.name, group.description ?? '', group.primary[0], ...group.advanced.map(([k]) => k)]

        return haystack.some(s => s.toLowerCase().includes(q))
      })
    : keyGroups

  return (
    <SettingsContent>
      <LocalEndpointRow onOpen={startManualLocalEndpoint} />
      {keyGroups.length > 0 ? (
        <div className="grid gap-3">
          {showSearch ? (
            <SearchField
              aria-label={t.settings.providers.searchKeys}
              containerClassName="w-full"
              onChange={setKeyQuery}
              placeholder={t.settings.providers.searchKeys}
              value={keyQuery}
            />
          ) : null}
          {visibleGroups.length > 0 ? (
            <div className="grid gap-2">
              {visibleGroups.map(group => (
                <ProviderKeyRows
                  expanded={openProvider === group.name}
                  group={group}
                  key={group.name}
                  onExpand={() => setOpenProvider(group.name)}
                  onToggle={() => setOpenProvider(prev => (prev === group.name ? null : group.name))}
                  rowProps={rowProps}
                />
              ))}
            </div>
          ) : (
            <div className="grid min-h-24 place-items-center px-4 py-6 text-center text-[length:var(--conversation-caption-font-size)] text-muted-foreground">
              {t.settings.providers.noKeysMatch}
            </div>
          )}
        </div>
      ) : (
        <NoProviderKeys />
      )}
    </SettingsContent>
  )
}

interface ProviderKeyGroup {
  advanced: [string, EnvVarInfo][]
  description?: string
  docsUrl?: string
  hasAnySet: boolean
  name: string
  primary: [string, EnvVarInfo]
  priority: number
}

interface ProvidersSettingsProps {
  onClose: () => void
  onConfigSaved?: () => void
  onMainModelChanged?: (provider: string, model: string) => void
  onViewChange: (view: ProviderView) => void
  view: ProviderView
}
