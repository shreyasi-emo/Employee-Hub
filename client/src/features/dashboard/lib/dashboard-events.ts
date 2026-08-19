// Client-side dashboard events. There is no events API yet, so these live in localStorage.
// Client-side events (no backend events API yet) persisted to localStorage
export const EVENTS_KEY = "emo_dashboard_events";

export interface DashEvent {
  id: number;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string;
  attendees?: string[]; // employee names
}

export function loadEvents(): DashEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    return raw ? (JSON.parse(raw) as DashEvent[]) : [];
  } catch {
    return [];
  }
}
