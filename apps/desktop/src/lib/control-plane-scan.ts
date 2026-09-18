import type { DesktopHoudryFabricEndpoint } from '@/global'
import { fabricApiOrigin } from '@/lib/control-plane-reconnect'
import { type FabricLanEndpoint, fromWifiAdvertise, pickPreferredFabricLan, uniqueFabricLan } from '@/lib/houdry-fabric-lan'

async function discoverWifi(): Promise<DesktopHoudryFabricEndpoint[]> {
  try {
    return (await window.hermesDesktop?.houdryFabric?.discover?.()) ?? []
  } catch {
    return []
  }
}

/** True when `/.well-known/houdry.json` answers at this API or origin. */
export async function probeControlPlane(api: string): Promise<boolean> {
  const origin = fabricApiOrigin(api)
  const isControlPlane = window.hermesDesktop?.houdryFabric?.isControlPlane

  if (!origin || !isControlPlane) {
    return false
  }

  try {
    return await isControlPlane(origin)
  } catch {
    return false
  }
}

/**
 * WiFi-only. This feeds the always-on background reconnect
 * (`useControlPlaneBoot`) and the "Refresh Models" rescan, so it must never
 * surface a loopback (127.0.0.1) hit here — a control plane running on this
 * same machine is still reachable through its real LAN address via the mDNS/
 * UDP WiFi advertisement (houdry serve binds 0.0.0.0 and announces its actual
 * interface IP), so there is no case where loopback is the only way to reach
 * it. Silently preferring 127.0.0.1 is exactly the "shows localhost instead
 * of the WiFi IP" bug this guards against; see `houdry-fabric-lan.ts` for the
 * separate, user-driven "This Computer" picker used during manual onboarding.
 */
export async function scanControlPlane(): Promise<FabricLanEndpoint[]> {
  const wifi = await discoverWifi()

  return uniqueFabricLan(wifi.map(fromWifiAdvertise))
}

export async function scanPreferredControlPlane(): Promise<FabricLanEndpoint | null> {
  return pickPreferredFabricLan(await scanControlPlane())
}
