import { useState } from 'react'

import { requestComposerFocus, requestComposerInsert } from '@/app/chat/composer/focus'
import { triggerHaptic } from '@/lib/haptics'
import {
  BarChart3,
  FileText,
  type IconComponent,
  iconSize,
  MessageCode,
  NotebookTabs,
  Search
} from '@/lib/icons'
import { capitalize, normalize } from '@/lib/text'
import { cn } from '@/lib/utils'

import introCopyJsonl from './intro-copy.jsonl?raw'

type IntroCopy = {
  headline: string
  body: string
}

type IntroCopyRecord = IntroCopy & {
  personality: string
}

export type IntroProps = {
  personality?: string
  seed?: number
}

const NEUTRAL_PERSONALITIES = new Set(['', 'default', 'none', 'neutral'])

const FALLBACK_COPY: IntroCopy[] = [
  {
    headline: 'Houdry Agent is ready.',
    body: 'Add SOPs in Knowledge base (left sidebar). Type /document-analysis, /procedure-lookup, /engineering-calculation, /report-generation, or /knowledge-search. Replies use WORKFLOW, provenance, and FACT / CALCULATION labels. EXECUTE stays locked.'
  },
  {
    headline: 'Where should we start?',
    body: 'MRPL facts come from the local Knowledge base — not the web. Add SOPs in the left sidebar, or start with /knowledge-search.'
  },
  {
    headline: 'What needs attention?',
    body: 'Ask in chat or type a slash skill. Every threshold needs a source; I will not invent MRPL acceptance limits.'
  },
  {
    headline: 'Ready when you are.',
    body: 'Engineering review stays in this chat as markdown: FACT, CALCULATION, VERIFICATION, INTERPRETATION, ASSUMPTION, RECOMMENDATION.'
  },
  {
    headline: 'Start anywhere.',
    body: 'Azure GPT-5.6 Luna is the DEV path; Houdry fabric is PROD. Set the Azure key in Settings → Providers if the footer says inference is unavailable.'
  }
]

function normalizeKey(value?: string): string {
  return normalize(value)
}

function titleize(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(capitalize)
    .join(' ')
}

function isIntroCopyRecord(value: unknown): value is IntroCopyRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    typeof record.personality === 'string' &&
    typeof record.headline === 'string' &&
    typeof record.body === 'string' &&
    Boolean(record.personality.trim()) &&
    Boolean(record.headline.trim()) &&
    Boolean(record.body.trim())
  )
}

function parseIntroCopy(raw: string): Record<string, IntroCopy[]> {
  const byPersonality: Record<string, IntroCopy[]> = {}

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed) {
      continue
    }

    try {
      const parsed: unknown = JSON.parse(trimmed)

      if (!isIntroCopyRecord(parsed)) {
        continue
      }

      const key = normalizeKey(parsed.personality)
      byPersonality[key] ??= []
      byPersonality[key].push({
        headline: parsed.headline.trim(),
        body: parsed.body.trim()
      })
    } catch {
      // Bad generated copy should not break the whole desktop app.
    }
  }

  return byPersonality
}

const INTRO_COPY_BY_PERSONALITY = parseIntroCopy(introCopyJsonl)

function neutralCopy(): IntroCopy[] {
  return INTRO_COPY_BY_PERSONALITY.none || INTRO_COPY_BY_PERSONALITY.default || FALLBACK_COPY
}

function fallbackCopyForPersonality(personalityKey: string): IntroCopy[] {
  if (NEUTRAL_PERSONALITIES.has(personalityKey)) {
    return neutralCopy()
  }

  const label = titleize(personalityKey)

  return [
    {
      headline: `${label} mode is on. What should we work on?`,
      body: "Send the task, file, or rough idea. I'll use your configured voice and keep the work grounded in this repo."
    },
    {
      headline: `What does ${label} need to see?`,
      body: "Bring the context or the stuck part. I'll adapt to your configured personality."
    },
    {
      headline: `${label} mode is ready.`,
      body: "Send the problem, file, or idea. I'll follow the personality you've configured."
    },
    {
      headline: `What should ${label} tackle?`,
      body: "Drop the task here. I'll keep the work grounded in the repo."
    },
    {
      headline: 'Where should we begin?',
      body: `Give me the context and I'll answer in ${label} mode.`
    }
  ]
}

function pickCopy(copies: IntroCopy[], seed = 0): IntroCopy {
  return copies[Math.abs(seed) % copies.length] || FALLBACK_COPY[0]
}

function resolveCopy(personality?: string, seed?: number): IntroCopy {
  const personalityKey = normalizeKey(personality)

  const copies = NEUTRAL_PERSONALITIES.has(personalityKey)
    ? INTRO_COPY_BY_PERSONALITY[personalityKey] || neutralCopy()
    : INTRO_COPY_BY_PERSONALITY[personalityKey] || fallbackCopyForPersonality(personalityKey)

  return pickCopy(copies, seed)
}

type IntroTileAccent = 'accent' | 'mix' | 'primary' | 'soft'

const STARTER_TILES: {
  accent: IntroTileAccent
  command: string
  icon: IconComponent
  label: string
}[] = [
  { accent: 'primary', command: 'document-analysis', icon: FileText, label: 'Analyze an inspection document' },
  { accent: 'accent', command: 'procedure-lookup', icon: NotebookTabs, label: 'Look up an inspection procedure' },
  { accent: 'mix', command: 'engineering-calculation', icon: BarChart3, label: 'Run an engineering calculation' },
  { accent: 'soft', command: 'knowledge-search', icon: Search, label: 'Search the knowledge base' }
]

function insertStarter(command: string) {
  triggerHaptic('tap')
  requestComposerInsert(`/${command}`, { mode: 'prefix' })
  requestComposerFocus('active')
}

export function Intro({ personality, seed }: IntroProps) {
  const [mountSeed] = useState(() => Math.floor(Math.random() * 100000))
  const copy = resolveCopy(personality, mountSeed + (seed ?? 0))

  return (
    <div
      className="pointer-events-none flex w-full min-w-0 flex-col items-center justify-center px-0.5 py-6 text-center sm:px-6 lg:px-8"
      data-slot="aui_intro"
    >
      <div className="flex w-full min-w-0 flex-col items-center">
        <MessageCode aria-hidden className="mb-5 size-8 text-(--ui-text-tertiary)" strokeWidth={1.35} />

        <h1 className="mx-auto mb-10 w-[calc(100%-1rem)] max-w-[28rem] sm:max-w-[36rem]" data-slot="aui_intro-title">
          {copy.headline}
        </h1>

        <div className="pointer-events-auto grid w-full max-w-[44rem] grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {STARTER_TILES.map(tile => {
            const Icon = tile.icon

            return (
              <button
                className={cn(
                  'flex min-h-[8.25rem] flex-col items-start justify-between rounded-2xl border border-(--ui-stroke-tertiary)',
                  'px-3.5 py-3.5 text-left',
                  'focus-visible:border-(--ui-stroke-secondary) focus-visible:outline-none focus-visible:ring-2',
                  'focus-visible:ring-(--theme-primary)/35'
                )}
                data-accent={tile.accent}
                data-slot="aui_intro-card"
                key={tile.command}
                onClick={() => insertStarter(tile.command)}
                type="button"
              >
                <Icon className={cn(iconSize.xl, 'shrink-0 text-(--intro-card-icon)')} strokeWidth={1.5} />
                <span className="text-[0.8125rem] font-normal leading-snug tracking-[-0.01em] text-(--ui-text-secondary)">
                  {tile.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
