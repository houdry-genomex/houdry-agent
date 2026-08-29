/**
 * Houdry Agent Desktop chrome. Plant users do not run Telegram / Discord /
 * Slack gateways; keep those pages in the tree for tests and older hashes,
 * but never surface them in nav, the command palette, or persisted page tiles.
 */

const HIDDEN_WORKSPACE_PATHS = new Set(['/messaging'])

export function isHoudryHiddenWorkspacePath(path: string): boolean {
  const bare = path.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || '/'

  return HIDDEN_WORKSPACE_PATHS.has(bare)
}

export function isHoudryDesktopSidebarNavId(id: string): boolean {
  return id !== 'messaging'
}
