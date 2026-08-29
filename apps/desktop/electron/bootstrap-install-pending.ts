/** True while first-run install.ps1 may still be running or is needed. */
export function isBootstrapInstallPending(options: {
  bootstrapActive: boolean
  runtimeUsable: boolean
}): boolean {
  if (options.bootstrapActive) {
    return true
  }

  return !options.runtimeUsable
}
