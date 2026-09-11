// Pluggable shipment-tracking provider. Today only a deterministic MOCK exists; a real courier
// integration (Delhivery / BlueDart / etc.) can implement TrackingProvider and register in PROVIDERS
// without touching the routes — the logistics flow only ever talks to getTrackingProvider().

export type TrackingEvent = { at: string; status: string; note: string; location?: string };

export interface TrackingProvider {
  key: string;
  // Returns the FULL event list known so far (idempotent) — callers replace, not append.
  fetchEvents(input: {
    trackingId?: string | null; carrier?: string | null; dispatchedAt?: Date | string | null;
    from?: string | null; to?: string | null;
  }): Promise<TrackingEvent[]>;
}

const HOURS = (n: number) => n * 60 * 60 * 1000;

// Deterministic checkpoints keyed off dispatch time — each is "reached" once that many hours pass,
// so polling every 6h naturally reveals new events. Nothing random, so a refresh is stable/repeatable.
const MOCK_CHECKPOINTS: { afterH: number; status: string; note: string; where: (i: { from?: string | null; to?: string | null }) => string }[] = [
  { afterH: 0,  status: "dispatched", note: "Shipment picked up and dispatched", where: (i) => i.from || "Origin" },
  { afterH: 6,  status: "in_transit", note: "Departed origin hub",                where: (i) => i.from || "Origin hub" },
  { afterH: 12, status: "in_transit", note: "In transit",                          where: () => "In transit" },
  { afterH: 18, status: "in_transit", note: "Arrived at destination hub",          where: (i) => i.to || "Destination hub" },
  { afterH: 24, status: "out_for_delivery", note: "Out for delivery",              where: (i) => i.to || "Destination" },
];

class MockTrackingProvider implements TrackingProvider {
  key = "mock";
  async fetchEvents(input: { dispatchedAt?: Date | string | null; from?: string | null; to?: string | null }) {
    const base = input.dispatchedAt ? new Date(input.dispatchedAt).getTime() : Date.now();
    if (isNaN(base)) return [];
    const now = Date.now();
    return MOCK_CHECKPOINTS
      .filter((c) => now >= base + HOURS(c.afterH))
      .map((c) => ({ at: new Date(base + HOURS(c.afterH)).toISOString(), status: c.status, note: c.note, location: c.where(input) }));
  }
}

const PROVIDERS: Record<string, TrackingProvider> = { mock: new MockTrackingProvider() };
export const DEFAULT_TRACKING_PROVIDER = "mock";

export function getTrackingProvider(key?: string | null): TrackingProvider {
  return PROVIDERS[key || DEFAULT_TRACKING_PROVIDER] || PROVIDERS.mock;
}
