import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** Live knowledge mount under HERMES_HOME. Stays on this computer. */
export const KNOWLEDGE_RELATIVE_ROOT = path.join('knowledge', 'mrpl')

export const KNOWLEDGE_CATEGORIES = [
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
] as const

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number]

export const KNOWLEDGE_INDEX_VERSION = 1
export const MAX_RULES_CHARS = 20_000
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024
export const HOME_AGENTS_START = '<!-- houdry-knowledge-start -->'
export const HOME_AGENTS_END = '<!-- houdry-knowledge-end -->'

const SKIP_NAMES = new Set(['rules.json', 'AGENTS.md', 'INDEX.md', 'README.md', '.gitkeep'])

export interface KnowledgeDocument {
  id: string
  relativePath: string
  title: string
  category: KnowledgeCategory
  rules: string
  addedAt: string
}

export interface KnowledgeIndex {
  version: typeof KNOWLEDGE_INDEX_VERSION
  documents: KnowledgeDocument[]
}

export interface KnowledgeSnapshot {
  root: string
  documents: KnowledgeDocument[]
}

export interface KnowledgeHomeFs {
  exists: (target: string) => boolean
  isFile: (target: string) => boolean
  isDir: (target: string) => boolean
  mkdirp: (target: string) => void
  readFile: (target: string) => string
  writeFile: (target: string, contents: string) => void
  copyFile: (from: string, to: string) => void
  removeFile: (target: string) => void
  readDir: (target: string) => string[]
  join: (...parts: string[]) => string
  basename: (target: string) => string
  dirname: (target: string) => string
  extname: (target: string) => string
  isAbsolute: (target: string) => boolean
  resolve: (...parts: string[]) => string
  relative: (from: string, to: string) => string
  fileSize: (target: string) => number
}

export interface KnowledgeIo {
  hermesHome: string
  fs: KnowledgeHomeFs
  now?: () => string
  createId?: () => string
}

export function isKnowledgeCategory(value: string): value is KnowledgeCategory {
  return (KNOWLEDGE_CATEGORIES as readonly string[]).includes(value)
}

export function knowledgeRoot(hermesHome: string, io: Pick<KnowledgeHomeFs, 'join'>): string {
  return io.join(hermesHome, 'knowledge', 'mrpl')
}

export function knowledgeSourceDirs(hermesHome: string, io: Pick<KnowledgeHomeFs, 'join' | 'mkdirp'>): string {
  const root = knowledgeRoot(hermesHome, io)
  io.mkdirp(root)
  for (const category of KNOWLEDGE_CATEGORIES) {
    io.mkdirp(io.join(root, 'sources', category))
  }

  return root
}

export function toPosixRelative(value: string): string {
  return value.replace(/\\/g, '/')
}

export function isInsideRoot(
  root: string,
  target: string,
  io: Pick<KnowledgeHomeFs, 'isAbsolute' | 'relative' | 'resolve'>
): boolean {
  const from = io.resolve(root)
  const to = io.resolve(target)
  const rel = io.relative(from, to)

  return rel !== '' && !rel.startsWith('..') && !io.isAbsolute(rel)
}

export function sanitizeFilename(name: string): string {
  const base = name.replace(/\0/g, '').trim()
  const cleaned = base.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ')
  const clipped = cleaned.slice(0, 180).trim()

  if (!clipped || clipped === '.' || clipped === '..') {
    return 'document'
  }

  return clipped
}

export function slugFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return slug || 'note'
}

function uniqueDest(dir: string, filename: string, io: KnowledgeHomeFs): string {
  const ext = io.extname(filename)
  const stem = filename.slice(0, filename.length - ext.length) || 'document'
  let candidate = io.join(dir, filename)
  let n = 2

  while (io.exists(candidate)) {
    candidate = io.join(dir, `${stem}-${n}${ext}`)
    n += 1
  }

  return candidate
}

function clipRules(rules: string): string {
  if (rules.length <= MAX_RULES_CHARS) {
    return rules
  }

  return rules.slice(0, MAX_RULES_CHARS)
}

function emptyIndex(): KnowledgeIndex {
  return { version: KNOWLEDGE_INDEX_VERSION, documents: [] }
}

function parseIndex(raw: string): KnowledgeIndex {
  try {
    const parsed = JSON.parse(raw) as Partial<KnowledgeIndex>
    if (parsed?.version !== KNOWLEDGE_INDEX_VERSION || !Array.isArray(parsed.documents)) {
      return emptyIndex()
    }

    const documents: KnowledgeDocument[] = []
    for (const item of parsed.documents) {
      if (!item || typeof item !== 'object') {
        continue
      }

      if (typeof item.id !== 'string' || typeof item.relativePath !== 'string') {
        continue
      }

      if (!isKnowledgeCategory(String(item.category))) {
        continue
      }

      documents.push({
        addedAt: typeof item.addedAt === 'string' ? item.addedAt : new Date(0).toISOString(),
        category: item.category,
        id: item.id,
        relativePath: toPosixRelative(item.relativePath),
        rules: typeof item.rules === 'string' ? clipRules(item.rules) : '',
        title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : item.relativePath
      })
    }

    return { version: KNOWLEDGE_INDEX_VERSION, documents }
  } catch {
    return emptyIndex()
  }
}

export function generateMountAgentsMarkdown(documents: readonly KnowledgeDocument[]): string {
  const withRules = documents.filter(doc => doc.rules.trim())
  const rulesBlock =
    withRules.length === 0
      ? '_No standing rules yet. Add them next to each SOP in Knowledge base._'
      : withRules
          .map(
            doc =>
              `### ${doc.title}\n\n- Path: \`${doc.relativePath}\`\n- Category: ${doc.category}\n\n${doc.rules.trim()}`
          )
          .join('\n\n')

  const catalog =
    documents.length === 0
      ? '_Empty. Add files from the Knowledge base sidebar._'
      : documents.map(doc => `- \`${doc.relativePath}\` — ${doc.title} (${doc.category})`).join('\n')

  return `# Local knowledge workspace

This tree is the **only** source for plant SOPs, manuals, and correspondence.
Do not invent procedures. Do not use the public web for plant facts.

## How to work

- Plan multi-step work. Use local tools: \`read_file\`, \`search_files\`, \`execute_code\`, spreadsheet/document skills, OCR/vision for scans, handwriting, drawings, and photos.
- Deliver real artifacts: approval notes, Word/PPT/Excel, working code, calculations with steps shown — not chat-only answers.
- Cite file paths and section headings. If a document is missing, say so.

## Governance

- READ / ANALYZE: allowed with citations.
- DRAFT: label outputs as drafts for human review.
- EXECUTE (mutating systems, ERP/QMS writes, destructive shell): require explicit user approval.
- Nothing plant-specific leaves this computer or LAN.

## Standing rules

${rulesBlock}

## Documents

${catalog}
`
}

export function generateHomeAgentsSection(documents: readonly KnowledgeDocument[]): string {
  const withRules = documents.filter(doc => doc.rules.trim())
  const rules =
    withRules.length === 0
      ? 'No standing SOP rules yet. When the user adds them in Knowledge base, follow them exactly.'
      : withRules.map(doc => `- **${doc.title}** (\`${doc.relativePath}\`):\n  ${doc.rules.trim().replace(/\n/g, '\n  ')}`).join('\n')

  const body = `## Local knowledge base (this computer only)

SOPs and site documents live in \`knowledge/mrpl/\`. Search that tree with \`search_files\` / \`read_file\` before answering procedure questions. For scanned PDFs, handwriting, drawings, or photos, use on-device OCR/vision after a filename match. Do **not** use the public web for plant facts.

Act as an agent: plan multi-step work, iterate with local tools (files, sandbox code, spreadsheets, document search), and produce real deliverables (approval notes, PPT/Word/Excel, working code, stepped calculations).

### Standing rules from Knowledge base

${rules}
`

  if (body.length <= 24_000) {
    return body.trimEnd() + '\n'
  }

  return `${body.slice(0, 23_500)}\n\n_Truncated — see knowledge/mrpl/AGENTS.md for the rest._\n`
}

export function upsertHomeAgentsSection(existing: string, section: string): string {
  const block = `${HOME_AGENTS_START}\n${section.trimEnd()}\n${HOME_AGENTS_END}\n`
  const start = existing.indexOf(HOME_AGENTS_START)
  const end = existing.indexOf(HOME_AGENTS_END)

  if (start !== -1 && end !== -1 && end > start) {
    const after = existing.slice(end + HOME_AGENTS_END.length).replace(/^\r?\n/, '')

    return `${existing.slice(0, start)}${block}${after}`
  }

  if (!existing.trim()) {
    return `# Agent instructions\n\n${block}`
  }

  const prefix = existing.endsWith('\n') ? existing : `${existing}\n`

  return `${prefix}\n${block}`
}

function generateIndexMarkdown(documents: readonly KnowledgeDocument[]): string {
  const rows =
    documents.length === 0
      ? '| — | — | — | — |'
      : documents
          .map(
            doc =>
              `| ${doc.title.replace(/\|/g, '/')} | ${doc.category} | \`${doc.relativePath}\` | ${doc.rules.trim() ? 'yes' : ''} |`
          )
          .join('\n')

  return `# Knowledge catalog

Generated by Houdry Agent Desktop. Do not invent documents that are not listed.

| Title | Category | Path | Rules |
|-------|----------|------|-------|
${rows}
`
}

function indexPath(root: string, io: KnowledgeHomeFs): string {
  return io.join(root, 'rules.json')
}

function loadIndex(root: string, io: KnowledgeHomeFs): KnowledgeIndex {
  const file = indexPath(root, io)
  if (!io.exists(file) || !io.isFile(file)) {
    return emptyIndex()
  }

  return parseIndex(io.readFile(file))
}

function saveIndex(root: string, index: KnowledgeIndex, io: KnowledgeHomeFs): void {
  io.writeFile(indexPath(root, io), `${JSON.stringify(index, null, 2)}\n`)
}

function walkFiles(dir: string, root: string, io: KnowledgeHomeFs, acc: string[], depth: number): void {
  if (depth > 6 || !io.exists(dir) || !io.isDir(dir)) {
    return
  }

  for (const name of io.readDir(dir)) {
    if (!name || name === '.' || name === '..' || SKIP_NAMES.has(name) || name.startsWith('.')) {
      continue
    }

    const full = io.join(dir, name)
    if (io.isDir(full)) {
      walkFiles(full, root, io, acc, depth + 1)
    } else if (io.isFile(full)) {
      acc.push(full)
    }
  }
}

function categoryFromRelative(relativePath: string): KnowledgeCategory | null {
  const parts = toPosixRelative(relativePath).split('/')
  if (parts[0] !== 'sources' || !parts[1] || !isKnowledgeCategory(parts[1])) {
    return null
  }

  return parts[1]
}

function reconcileDocuments(
  root: string,
  index: KnowledgeIndex,
  io: KnowledgeHomeFs,
  now: string,
  createId: () => string
): { changed: boolean; documents: KnowledgeDocument[] } {
  const sources = io.join(root, 'sources')
  const found: string[] = []
  walkFiles(sources, root, io, found, 0)

  const byRel = new Map(index.documents.map(doc => [toPosixRelative(doc.relativePath), doc]))
  const kept: KnowledgeDocument[] = []
  let changed = false

  for (const full of found) {
    if (!isInsideRoot(root, full, io)) {
      continue
    }

    const relativePath = toPosixRelative(io.relative(root, full))
    const category = categoryFromRelative(relativePath)
    if (!category) {
      continue
    }

    const existing = byRel.get(relativePath)
    if (existing) {
      kept.push(existing)
      byRel.delete(relativePath)
      continue
    }

    changed = true
    kept.push({
      addedAt: now,
      category,
      id: createId(),
      relativePath,
      rules: '',
      title: io.basename(full)
    })
  }

  if (byRel.size > 0) {
    changed = true
  }

  const seen = new Set<string>()
  const documents: KnowledgeDocument[] = []
  for (const doc of kept) {
    if (seen.has(doc.id)) {
      changed = true
      continue
    }
    seen.add(doc.id)
    documents.push(doc)
  }

  documents.sort((a, b) => a.title.localeCompare(b.title) || a.relativePath.localeCompare(b.relativePath))

  return { changed, documents }
}

export function persistKnowledgeContext(root: string, documents: readonly KnowledgeDocument[], io: KnowledgeHomeFs, hermesHome: string): void {
  io.writeFile(io.join(root, 'AGENTS.md'), generateMountAgentsMarkdown(documents))
  io.writeFile(io.join(root, 'INDEX.md'), generateIndexMarkdown(documents))

  const homeAgents = io.join(hermesHome, 'AGENTS.md')
  const existing = io.exists(homeAgents) && io.isFile(homeAgents) ? io.readFile(homeAgents) : ''
  io.writeFile(homeAgents, upsertHomeAgentsSection(existing, generateHomeAgentsSection(documents)))
}

export function snapshotKnowledge({ hermesHome, fs: io, now, createId }: KnowledgeIo): KnowledgeSnapshot {
  const root = knowledgeSourceDirs(hermesHome, io)
  const stamp = now?.() ?? new Date().toISOString()
  const id = createId ?? (() => crypto.randomUUID())
  const reconciled = reconcileDocuments(root, loadIndex(root, io), io, stamp, id)

  saveIndex(root, { version: KNOWLEDGE_INDEX_VERSION, documents: reconciled.documents }, io)
  persistKnowledgeContext(root, reconciled.documents, io, hermesHome)

  return { root, documents: reconciled.documents }
}

function requireCategory(category: string): KnowledgeCategory {
  if (!isKnowledgeCategory(category)) {
    throw new Error(`Unknown knowledge category: ${category}`)
  }

  return category
}

export function importKnowledgeFiles({
  category,
  createId,
  fs: io,
  hermesHome,
  now,
  sourcePaths
}: KnowledgeIo & { category: string; sourcePaths: readonly string[] }): KnowledgeDocument[] {
  const cat = requireCategory(category)
  const snapshot = snapshotKnowledge({ createId, fs: io, hermesHome, now })
  const stamp = now?.() ?? new Date().toISOString()
  const id = createId ?? (() => crypto.randomUUID())
  const destDir = io.join(snapshot.root, 'sources', cat)
  io.mkdirp(destDir)

  const added: KnowledgeDocument[] = []
  const documents = [...snapshot.documents]

  for (const source of sourcePaths) {
    if (!source || !io.exists(source) || !io.isFile(source)) {
      continue
    }

    if (io.fileSize(source) > MAX_IMPORT_BYTES) {
      throw new Error(`File is too large to import: ${io.basename(source)}`)
    }

    const filename = sanitizeFilename(io.basename(source))
    const dest = uniqueDest(destDir, filename, io)
    if (!isInsideRoot(snapshot.root, dest, io)) {
      throw new Error('Refusing to import outside the knowledge folder')
    }

    io.copyFile(source, dest)
    const relativePath = toPosixRelative(io.relative(snapshot.root, dest))
    const doc: KnowledgeDocument = {
      addedAt: stamp,
      category: cat,
      id: id(),
      relativePath,
      rules: '',
      title: io.basename(dest)
    }
    documents.push(doc)
    added.push(doc)
  }

  documents.sort((a, b) => a.title.localeCompare(b.title) || a.relativePath.localeCompare(b.relativePath))
  saveIndex(snapshot.root, { version: KNOWLEDGE_INDEX_VERSION, documents }, io)
  persistKnowledgeContext(snapshot.root, documents, io, hermesHome)

  return added
}

export function createKnowledgeNote({
  category,
  createId,
  fs: io,
  hermesHome,
  now,
  rules,
  title
}: KnowledgeIo & { category: string; rules: string; title: string }): KnowledgeDocument {
  const cat = requireCategory(category)
  const snapshot = snapshotKnowledge({ createId, fs: io, hermesHome, now })
  const stamp = now?.() ?? new Date().toISOString()
  const trimmedTitle = title.trim() || 'Untitled note'
  const destDir = io.join(snapshot.root, 'sources', cat)
  io.mkdirp(destDir)
  const dest = uniqueDest(destDir, `${sanitizeFilename(slugFromTitle(trimmedTitle))}.md`, io)
  const body = `# ${trimmedTitle}\n\n${clipRules(rules).trim()}\n`
  io.writeFile(dest, body)

  const doc: KnowledgeDocument = {
    addedAt: stamp,
    category: cat,
    id: (createId ?? (() => crypto.randomUUID()))(),
    relativePath: toPosixRelative(io.relative(snapshot.root, dest)),
    rules: clipRules(rules).trim(),
    title: trimmedTitle
  }
  const documents = [...snapshot.documents, doc].sort(
    (a, b) => a.title.localeCompare(b.title) || a.relativePath.localeCompare(b.relativePath)
  )
  saveIndex(snapshot.root, { version: KNOWLEDGE_INDEX_VERSION, documents }, io)
  persistKnowledgeContext(snapshot.root, documents, io, hermesHome)

  return doc
}

export function updateKnowledgeDocument({
  createId,
  fs: io,
  hermesHome,
  id,
  now,
  rules,
  title
}: KnowledgeIo & { id: string; rules?: string; title?: string }): KnowledgeDocument {
  const snapshot = snapshotKnowledge({ createId, fs: io, hermesHome, now })
  const index = snapshot.documents.findIndex(doc => doc.id === id)
  if (index < 0) {
    throw new Error('Document not found')
  }

  const current = snapshot.documents[index]
  const next: KnowledgeDocument = {
    ...current,
    rules: rules === undefined ? current.rules : clipRules(rules),
    title: title === undefined ? current.title : title.trim() || current.title
  }
  const documents = snapshot.documents.slice()
  documents[index] = next
  saveIndex(snapshot.root, { version: KNOWLEDGE_INDEX_VERSION, documents }, io)
  persistKnowledgeContext(snapshot.root, documents, io, hermesHome)

  return next
}

export function removeKnowledgeDocument({
  createId,
  fs: io,
  hermesHome,
  id,
  now
}: KnowledgeIo & { id: string }): void {
  const snapshot = snapshotKnowledge({ createId, fs: io, hermesHome, now })
  const doc = snapshot.documents.find(item => item.id === id)
  if (!doc) {
    throw new Error('Document not found')
  }

  const full = io.join(snapshot.root, ...doc.relativePath.split('/'))
  if (io.exists(full) && isInsideRoot(snapshot.root, full, io)) {
    io.removeFile(full)
  }

  const documents = snapshot.documents.filter(item => item.id !== id)
  saveIndex(snapshot.root, { version: KNOWLEDGE_INDEX_VERSION, documents }, io)
  persistKnowledgeContext(snapshot.root, documents, io, hermesHome)
}

export function createNodeKnowledgeHomeFs(): KnowledgeHomeFs {
  return {
    basename: target => path.basename(target),
    copyFile: (from, to) => {
      fs.mkdirSync(path.dirname(to), { recursive: true })
      fs.copyFileSync(from, to)
    },
    dirname: target => path.dirname(target),
    exists: target => fs.existsSync(target),
    extname: target => path.extname(target),
    fileSize: target => fs.statSync(target).size,
    isAbsolute: target => path.isAbsolute(target),
    isDir: target => {
      try {
        return fs.statSync(target).isDirectory()
      } catch {
        return false
      }
    },
    isFile: target => {
      try {
        return fs.statSync(target).isFile()
      } catch {
        return false
      }
    },
    join: (...parts) => path.join(...parts),
    mkdirp: target => {
      fs.mkdirSync(target, { recursive: true })
    },
    readDir: target => fs.readdirSync(target),
    readFile: target => fs.readFileSync(target, 'utf8'),
    relative: (from, to) => path.relative(from, to),
    removeFile: target => {
      if (fs.existsSync(target)) {
        fs.unlinkSync(target)
      }
    },
    resolve: (...parts) => path.resolve(...parts),
    writeFile: (target, contents) => {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, contents, 'utf8')
    }
  }
}
