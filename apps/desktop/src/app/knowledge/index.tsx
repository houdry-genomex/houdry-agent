import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RowButton } from '@/components/ui/row-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'

import { DetailColumn, ListColumn, ListStrip, MasterDetail } from '../master-detail'
import { PanelEmpty } from '../overlays/panel'
import { PageSearchShell } from '../page-search-shell'
import type { SetStatusbarItemGroup } from '../shell/statusbar-controls'

type KnowledgeCategory =
  | 'sops'
  | 'manuals'
  | 'engineering'
  | 'safety'
  | 'standards'
  | 'policies'
  | 'reports'
  | 'equipment'
  | 'forms'
  | 'correspondence'

interface KnowledgeDocument {
  id: string
  relativePath: string
  title: string
  category: KnowledgeCategory
  rules: string
  addedAt: string
}

const CATEGORIES: KnowledgeCategory[] = [
  'sops',
  'manuals',
  'engineering',
  'safety',
  'standards',
  'policies',
  'reports',
  'equipment',
  'forms',
  'correspondence'
]

const IMPORT_FILTERS = [
  {
    name: 'Documents',
    extensions: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'md', 'txt', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'webp']
  }
]

function knowledgeApi() {
  return window.hermesDesktop?.houdryKnowledge
}

export function KnowledgeView(_props: { setStatusbarItemGroup?: SetStatusbarItemGroup }) {
  const { t } = useI18n()
  const k = t.knowledge
  const [documents, setDocuments] = useState<KnowledgeDocument[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<KnowledgeCategory>('sops')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [rulesDraft, setRulesDraft] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const selected = documents?.find(doc => doc.id === selectedId) ?? null

  const reload = useCallback(async () => {
    const api = knowledgeApi()

    if (!api) {
      setLoadError(k.loadFailed)
      setDocuments([])

      return
    }

    try {
      const snap = await api.list()
      setDocuments(snap.documents)
      setLoadError(null)
      setSelectedId(current => {
        if (current && snap.documents.some(doc => doc.id === current)) {
          return current
        }

        return snap.documents[0]?.id ?? null
      })
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : k.loadFailed)
      setDocuments([])
    }
  }, [k.loadFailed])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!selected) {
      setTitleDraft('')
      setRulesDraft('')

      return
    }

    setTitleDraft(selected.title)
    setRulesDraft(selected.rules)
    setNoteOpen(false)
  }, [selected])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = documents ?? []

    if (!q) {
      return list
    }

    return list.filter(
      doc =>
        doc.title.toLowerCase().includes(q) ||
        doc.relativePath.toLowerCase().includes(q) ||
        doc.rules.toLowerCase().includes(q) ||
        doc.category.toLowerCase().includes(q)
    )
  }, [documents, query])

  const importFiles = async () => {
    const api = knowledgeApi()

    if (!api || busy) {
      return
    }

    const paths = await window.hermesDesktop?.selectPaths?.({
      filters: IMPORT_FILTERS,
      multiple: true,
      title: k.add
    })

    if (!paths?.length) {
      return
    }

    setBusy(true)

    try {
      const added = await api.importFiles(paths, category)
      notify({ message: k.imported(added.length) })
      await reload()

      if (added[0]?.id) {
        setSelectedId(added[0].id)
      }
    } catch (error) {
      notifyError(error, k.importFailed)
    } finally {
      setBusy(false)
    }
  }

  const createNote = async () => {
    const api = knowledgeApi()

    if (!api || busy) {
      return
    }

    setBusy(true)

    try {
      const doc = await api.createNote({
        category,
        rules: rulesDraft,
        title: titleDraft
      })

      notify({ message: k.imported(1) })
      await reload()
      setSelectedId(doc.id)
      setNoteOpen(false)
    } catch (error) {
      notifyError(error, k.importFailed)
    } finally {
      setBusy(false)
    }
  }

  const saveRules = async () => {
    const api = knowledgeApi()

    if (!api || !selected || busy) {
      return
    }

    setBusy(true)

    try {
      await api.update(selected.id, { rules: rulesDraft, title: titleDraft })
      notify({ message: k.saved })
      await reload()
    } catch (error) {
      notifyError(error, k.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const removeSelected = async () => {
    const api = knowledgeApi()

    if (!api || !selected || busy) {
      return
    }

    if (!window.confirm(k.removeConfirm(selected.title))) {
      return
    }

    setBusy(true)

    try {
      await api.remove(selected.id)
      notify({ message: k.removed })
      setSelectedId(null)
      await reload()
    } catch (error) {
      notifyError(error, k.removeFailed)
    } finally {
      setBusy(false)
    }
  }

  const openFolder = async () => {
    const api = knowledgeApi()

    if (!api) {
      return
    }

    const result = await api.openFolder()

    if (!result.ok) {
      notifyError(result.error ?? k.openFailed, k.openFailed)
    }
  }

  const categoryLabel = (id: KnowledgeCategory) => k.categories[id]

  const trailing = (
    <div className="flex items-center gap-1.5">
      <Select onValueChange={value => setCategory(value as KnowledgeCategory)} value={category}>
        <SelectTrigger aria-label={k.category} className="h-7 w-[9.5rem] text-xs" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map(id => (
            <SelectItem key={id} value={id}>
              {categoryLabel(id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button disabled={busy} onClick={() => void importFiles()} size="sm" variant="secondary">
        {k.add}
      </Button>
      <Button
        disabled={busy}
        onClick={() => {
          setNoteOpen(true)
          setSelectedId(null)
          setTitleDraft('')
          setRulesDraft('')
        }}
        size="sm"
        variant="ghost"
      >
        {k.addNote}
      </Button>
      <Button onClick={() => void openFolder()} size="sm" variant="ghost">
        {k.openFolder}
      </Button>
    </div>
  )

  return (
    <PageSearchShell
      onSearchChange={setQuery}
      searchPlaceholder={k.search}
      searchTrailingAction={trailing}
      searchValue={query}
    >
      {documents === null ? (
        <PanelEmpty icon="loading~spin" title={k.loading} />
      ) : loadError && documents.length === 0 ? (
        <PanelEmpty
          action={
            <Button onClick={() => void reload()} size="sm">
              {k.add}
            </Button>
          }
          description={loadError}
          icon="error"
          title={k.loadFailed}
        />
      ) : filtered.length === 0 && !noteOpen ? (
        <PanelEmpty
          action={
            <Button disabled={busy} onClick={() => void importFiles()} size="sm">
              {k.add}
            </Button>
          }
          description={k.emptyDesc}
          icon="book"
          title={k.emptyTitle}
        />
      ) : (
        <MasterDetail split="wide">
          <ListColumn
            header={
              <ListStrip
                left={<span className="text-[0.68rem] text-muted-foreground/70">{k.localOnly}</span>}
              />
            }
          >
            {filtered.map(doc => (
              <RowButton
                className={cn(
                  'flex h-11 w-full cursor-pointer flex-col justify-center rounded-md px-2 text-left',
                  doc.id === selectedId
                    ? 'bg-(--ui-row-active-background) text-foreground'
                    : 'text-(--ui-text-secondary) hover:bg-(--ui-control-hover-background)'
                )}
                key={doc.id}
                onClick={() => {
                  setNoteOpen(false)
                  setSelectedId(doc.id)
                }}
              >
                <span className="truncate text-[0.78rem] font-medium">{doc.title}</span>
                <span className="truncate text-[0.62rem] text-muted-foreground/50">
                  {categoryLabel(doc.category)}
                  {doc.rules.trim() ? ' · rules' : ''}
                </span>
              </RowButton>
            ))}
          </ListColumn>
          <DetailColumn
            actionBar={
              noteOpen || selected ? (
                <div className="flex justify-end gap-2">
                  {selected && !noteOpen ? (
                    <Button disabled={busy} onClick={() => void removeSelected()} size="sm" variant="ghost">
                      {k.remove}
                    </Button>
                  ) : null}
                  <Button
                    disabled={busy}
                    onClick={() => void (noteOpen ? createNote() : saveRules())}
                    size="sm"
                  >
                    {noteOpen ? k.createNote : k.save}
                  </Button>
                </div>
              ) : null
            }
          >
            {noteOpen || selected ? (
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-foreground/80">{k.title}</span>
                  <Input
                    onChange={event => setTitleDraft(event.target.value)}
                    placeholder={k.noteTitlePlaceholder}
                    value={titleDraft}
                  />
                </label>
                {selected && !noteOpen ? (
                  <p className="text-[0.7rem] text-muted-foreground/70">
                    {k.path}: {selected.relativePath}
                  </p>
                ) : null}
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-foreground/80">{k.rules}</span>
                  <p className="text-[0.7rem] leading-relaxed text-muted-foreground/70">{k.rulesHint}</p>
                  <Textarea
                    className="min-h-48"
                    onChange={event => setRulesDraft(event.target.value)}
                    placeholder={k.noteBodyPlaceholder}
                    value={rulesDraft}
                  />
                </label>
              </div>
            ) : (
              <PanelEmpty description={k.emptyDesc} icon="book" title={k.noSelection} />
            )}
          </DetailColumn>
        </MasterDetail>
      )}
    </PageSearchShell>
  )
}
