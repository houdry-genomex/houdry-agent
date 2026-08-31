/** First-run install.ps1 can take 10+ minutes (clone, uv, node-deps). */
export const BOOTSTRAP_BOOT_WAIT_TIMEOUT_MS = 45 * 60 * 1000

export function isBootstrapBootError(message: string): boolean {
  return (
    /Houdry bootstrap failed/i.test(message) ||
    /Houdry install was cancelled/i.test(message) ||
    /Houdry recovery was handed off/i.test(message)
  )
}
