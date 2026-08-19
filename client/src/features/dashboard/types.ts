// Shape of GET /api/dashboard/stats.
export interface Stats {
  totalEmployees: number;
  pendingLeaves: number;
  pendingRegularizations: number;
  presentToday: number;
}

// ===== Design system (dashboard) =====
// Note: the page background gradient is applied globally on the app shell (see App.tsx).
