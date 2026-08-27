import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import type { ModelSelection } from '@/app/shell/model-menu-panel'
import { modelOptionsQueryKey, reconcileSelectionAfterCatalogRefresh, requestModelOptions } from '@/lib/model-options'
import { $activeGatewayProfile } from '@/store/profile'
import { $activeSessionId, $currentModel, $currentProvider, $gatewayState } from '@/store/session'

/**
 * Azure Foundry can list a leftover Claude/OpenCode id as the only row.
 * That 404s (`/openai/deployments/claude-opus-4.6`). When the scoped catalog
 * no longer contains the session pick, switch to the first real Azure/fabric
 * model so Retry talks to GPT-5.6 Luna.
 */
export function useHoudryCatalogReconcile({
  selectModel
}: {
  selectModel: (selection: ModelSelection) => Promise<boolean> | void
}) {
  const gatewayState = useStore($gatewayState)
  const profile = useStore($activeGatewayProfile)
  const sessionId = useStore($activeSessionId)
  const currentModel = useStore($currentModel)
  const currentProvider = useStore($currentProvider)
  const attemptedKey = useRef('')

  const catalog = useQuery({
    queryKey: modelOptionsQueryKey(profile, sessionId),
    queryFn: () => requestModelOptions({ sessionId }),
    enabled: gatewayState === 'open'
  })

  useEffect(() => {
    const switchTo = reconcileSelectionAfterCatalogRefresh(currentModel, catalog.data?.providers)

    if (!switchTo || (switchTo.model === currentModel && switchTo.provider === currentProvider)) {
      attemptedKey.current = ''

      return
    }

    const key = `${sessionId || 'draft'}::${switchTo.provider}::${switchTo.model}`

    if (attemptedKey.current === key) {
      return
    }

    attemptedKey.current = key
    void selectModel({ ...switchTo, sessionId: sessionId || null })
  }, [catalog.data, currentModel, currentProvider, selectModel, sessionId])
}
