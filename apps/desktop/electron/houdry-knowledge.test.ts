import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  createKnowledgeNote,
  createNodeKnowledgeHomeFs,
  generateHomeAgentsSection,
  HOME_AGENTS_END,
  HOME_AGENTS_START,
  importKnowledgeFiles,
  removeKnowledgeDocument,
  sanitizeFilename,
  snapshotKnowledge,
  updateKnowledgeDocument,
  upsertHomeAgentsSection
} from './houdry-knowledge'

const tmpDirs: string[] = []

function tmpHome(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'houdry-kb-'))
  tmpDirs.push(dir)

  return dir
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true })
  }
})

describe('sanitizeFilename', () => {
  it('strips reserved characters and rejects traversal names', () => {
    expect(sanitizeFilename('pump<>:"/\\|?*.pdf')).toBe('pump_________.pdf')
    expect(sanitizeFilename('..')).toBe('document')
    expect(sanitizeFilename('')).toBe('document')
  })
})

describe('upsertHomeAgentsSection', () => {
  it('wraps empty files and replaces an existing marked block', () => {
    const created = upsertHomeAgentsSection('# Mine\n', '## Local knowledge base\n\n- follow SOP-1\n')

    expect(created).toContain('# Mine')
    expect(created).toContain(HOME_AGENTS_START)
    expect(created).toContain('follow SOP-1')
    expect(created).toContain(HOME_AGENTS_END)

    const next = upsertHomeAgentsSection(created, '## Local knowledge base\n\n- follow SOP-2\n')

    expect(next).toContain('# Mine')
    expect(next).toContain('follow SOP-2')
    expect(next).not.toContain('follow SOP-1')
  })

  it('appends a marked block after existing user instructions', () => {
    const out = upsertHomeAgentsSection('# Mine\n\nBe terse.\n', '## Local knowledge base\n\n- cite SOPs\n')

    expect(out.startsWith('# Mine')).toBe(true)
    expect(out).toContain('Be terse.')
    expect(out).toContain('cite SOPs')
  })
})

describe('knowledge home', () => {
  it('creates the mount, imports a file, stores rules, and writes AGENTS.md', () => {
    const home = tmpHome()
    const io = createNodeKnowledgeHomeFs()
    const source = path.join(home, 'incoming-sop.txt')
    fs.writeFileSync(source, 'Section 4.2 isolate the pump.\n')

    const added = importKnowledgeFiles({
      category: 'sops',
      createId: () => 'doc-1',
      fs: io,
      hermesHome: home,
      now: () => '2026-09-02T00:00:00.000Z',
      sourcePaths: [source]
    })

    expect(added).toHaveLength(1)
    expect(added[0]?.relativePath).toBe('sources/sops/incoming-sop.txt')

    updateKnowledgeDocument({
      fs: io,
      hermesHome: home,
      id: 'doc-1',
      rules: 'Always cite section 4.2 before recommending isolation.'
    })

    const snap = snapshotKnowledge({ fs: io, hermesHome: home })
    expect(snap.documents).toHaveLength(1)
    expect(snap.documents[0]?.rules).toContain('section 4.2')

    const mountAgents = fs.readFileSync(path.join(home, 'knowledge', 'mrpl', 'AGENTS.md'), 'utf8')
    expect(mountAgents).toContain('Always cite section 4.2')
    expect(mountAgents).toContain('sources/sops/incoming-sop.txt')

    const homeAgents = fs.readFileSync(path.join(home, 'AGENTS.md'), 'utf8')
    expect(homeAgents).toContain(HOME_AGENTS_START)
    expect(homeAgents).toContain('Always cite section 4.2')
    expect(homeAgents).toContain('knowledge/mrpl')
  })

  it('picks up a file dropped into sources and removes it on delete', () => {
    const home = tmpHome()
    const io = createNodeKnowledgeHomeFs()
    snapshotKnowledge({ createId: () => 'seed', fs: io, hermesHome: home })

    const dropped = path.join(home, 'knowledge', 'mrpl', 'sources', 'manuals', 'heater.md')
    fs.writeFileSync(dropped, '# Heater manual\n')

    const snap = snapshotKnowledge({ createId: () => 'dropped-1', fs: io, hermesHome: home })
    expect(snap.documents.some(doc => doc.relativePath === 'sources/manuals/heater.md')).toBe(true)

    const id = snap.documents.find(doc => doc.relativePath === 'sources/manuals/heater.md')?.id
    expect(id).toBeTruthy()
    removeKnowledgeDocument({ fs: io, hermesHome: home, id: id! })
    expect(fs.existsSync(dropped)).toBe(false)
    expect(snapshotKnowledge({ fs: io, hermesHome: home }).documents).toHaveLength(0)
  })

  it('creates a markdown note and rejects an unknown category', () => {
    const home = tmpHome()
    const io = createNodeKnowledgeHomeFs()
    const note = createKnowledgeNote({
      category: 'safety',
      createId: () => 'note-1',
      fs: io,
      hermesHome: home,
      rules: 'Permit required before confined-space entry.',
      title: 'Confined space'
    })

    expect(note.relativePath.endsWith('.md')).toBe(true)
    expect(fs.readFileSync(path.join(home, 'knowledge', 'mrpl', note.relativePath), 'utf8')).toContain('Permit required')

    expect(() =>
      importKnowledgeFiles({
        category: 'not-a-category',
        fs: io,
        hermesHome: home,
        sourcePaths: []
      })
    ).toThrow(/Unknown knowledge category/)
  })

  it('imports a file under the chosen category', () => {
    const home = tmpHome()
    const io = createNodeKnowledgeHomeFs()
    const source = path.join(home, 'ok.txt')
    fs.writeFileSync(source, 'ok')

    expect(
      importKnowledgeFiles({
        category: 'sops',
        fs: io,
        hermesHome: home,
        sourcePaths: [source]
      })
    ).toHaveLength(1)
  })
})

describe('generateHomeAgentsSection', () => {
  it('tells the agent to stay local and follow standing rules', () => {
    const text = generateHomeAgentsSection([
      {
        addedAt: '2026-09-02T00:00:00.000Z',
        category: 'sops',
        id: '1',
        relativePath: 'sources/sops/iso.md',
        rules: 'Lockout before opening the strainer.',
        title: 'Isolation'
      }
    ])

    expect(text).toContain('Do **not** use the public web')
    expect(text).toContain('Lockout before opening the strainer.')
    expect(text).toContain('Act as an agent')
  })
})
