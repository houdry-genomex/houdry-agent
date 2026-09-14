import type { DesktopHoudryFabricEndpoint } from '@/global'
import {
  type FabricLanEndpoint,
  fromWifiAdvertise,
  mergeFabricLanScan,
  pickPreferredFabricLan
} from '@/lib/houdry-fabric-lan'
import { FABRIC_LOOPBACK_PORTS } from '@/lib/local-inference-scan'

async function discoverWifi(): Promise<DesktopHoudryFabricEndpoint[]> {
  try {
    return (await window.hermesDesktop?.houdryFabric?.discover?.()) ?? []
  } catch {
    return []
  }
}

async function scanLoopbackControlPlane(): Promise<string | null> {
  const isControlPlane = window.hermesDesktop?.houdryFabric?.isControlPlane

  if (!isControlPlane) {
    return null
  }

  for (const port of FABRIC_LOOPBACK_PORTS) {
    const origin = `http://127.0.0.1:${port}`

    try {
      if (await isControlPlane(origin)) {
        return `${origin}/v1`
      }
    } catch {
      // Next port.
    }
  }

  return null
}

/** UDP WiFi ads + loopback `/.well-known/houdry.json`. Loopback wins when both answer. */
export async function scanControlPlane(): Promise<FabricLanEndpoint[]> {
  const [wifi, loopback] = await Promise.all([discoverWifi(), scanLoopbackControlPlane()])

  return mergeFabricLanScan(wifi.map(fromWifiAdvertise), loopback)
}

export async function scanPreferredControlPlane(): Promise<FabricLanEndpoint | null> {
  return pickPreferredFabricLan(await scanControlPlane())
}
