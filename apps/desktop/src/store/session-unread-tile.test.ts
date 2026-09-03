import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { group, split } from '@/components/pane-shell/tree/model'
import { $activeTreeGroup, $layoutTree, noteActiveTreeGroup } from '@/components/pane-shell/tree/store'
import { registry } from '@/contrib/registry'
import { createClientSessionState } from '@/lib/chat-runtime'
import { $lastReadAtBySessionId, $selectedStoredSessionId, $unreadFinishedSessionIds } from '@/store/session'
import { publishSessionState } from '@/store/session-states'

// The completed-unread dot is keyed on the FOCUSED session, not the selected
// one. A tile is never $selectedStoredSessionId, so keying either half on the
// selection left a tiled session's dot green with no way to clear it.
//
// Imports stay static: vi.resetModules() + a cold reimport of the session/tree
// graph was paying the jsdom transform cost inside every test and timing out
// under a parallel UI run.

const TILE_PANE = 'session-tile:tiled'

function finishTurn(storedSessionId: string) {
  const working = { ...createClientSessionState(null), busy: true, storedSessionId }

  publishSessionState(`rt-${storedSessionId}`, working)
  publishSessionState(`rt-${storedSessionId}`, { ...working, busy: false })
}

describe('completed-unread dot follows the focused session', () => {
  const disposers: Array<() => void> = []

  beforeEach(() => {
    for (const id of ['workspace', TILE_PANE]) {
      disposers.push(
        registry.register({
          area: 'panes',
          data: id === 'workspace' ? { placement: 'main', uncloseable: true } : { placement: 'main' },
          id,
          render: () => null,
          title: id
        })
      )
    }

    // Replace the tree outright. declareDefaultTree only adopts missing panes
    // onto whatever another test (or persisted layout) already left behind.
    $layoutTree.set(
      split('row', [
        group(['workspace'], { active: 'workspace', id: 'grp-main' }),
        group([TILE_PANE], { active: TILE_PANE, id: 'grp-tile' })
      ])
    )
    $activeTreeGroup.set(null)
    $unreadFinishedSessionIds.set([])
    $lastReadAtBySessionId.set({})
    $selectedStoredSessionId.set('primary')
  })

  afterEach(() => {
    while (disposers.length) {
      disposers.pop()?.()
    }

    $activeTreeGroup.set(null)
    $unreadFinishedSessionIds.set([])
    $lastReadAtBySessionId.set({})
  })

  it('clears the dot when an already-open tile is fronted', () => {
    noteActiveTreeGroup('grp-main')
    finishTurn('tiled')
    expect($unreadFinishedSessionIds.get()).toEqual(['tiled'])

    // Fronting the tile is what a tab click does. Before the fix nothing on
    // this path cleared the marker, so the dot stayed green.
    noteActiveTreeGroup('grp-tile')
    expect($unreadFinishedSessionIds.get()).toEqual([])
  })

  it('never marks a tile that finishes while it is the focused one', () => {
    noteActiveTreeGroup('grp-tile')
    finishTurn('tiled')

    expect($unreadFinishedSessionIds.get()).toEqual([])
  })

  it('marks the primary session when a tile has focus', () => {
    noteActiveTreeGroup('grp-tile')
    finishTurn('primary')

    expect($unreadFinishedSessionIds.get()).toEqual(['primary'])
  })
})
