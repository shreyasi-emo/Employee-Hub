// Zoho Books push worker. Idempotent, queued, retried.
// Finance owns Zoho — fills zohoConfig + flips enabled=true.
import { storage } from "./storage";

const ZOHO_API = "https://www.zohoapis.in/books/v3";
const ZOHO_TOKEN_URL = "https://accounts.zoho.in/oauth/v2/token";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const cfg = await storage.getZohoConfig();
  if (!cfg?.enabled || !cfg.refreshToken || !cfg.clientId || !cfg.clientSecret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const params = new URLSearchParams({
    refresh_token: cfg.refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
  const r = await fetch(`${ZOHO_TOKEN_URL}?${params.toString()}`, { method: "POST" });
  const data: any = await r.json();
  if (!data.access_token) throw new Error("Zoho token refresh failed: " + JSON.stringify(data));
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function zohoPost(path: string, body: any) {
  const token = await getAccessToken();
  if (!token) throw new Error("ZOHO_NOT_ENABLED");
  const cfg = await storage.getZohoConfig();
  const url = `${ZOHO_API}${path}?organization_id=${cfg!.organizationId}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: any = await r.json();
  if (data.code !== 0) throw new Error(`Zoho error ${data.code}: ${data.message}`);
  return data;
}

function mapReimbursementToExpense(reimb: any, cfg: any) {
  return {
    account_id: cfg.defaultExpenseAccountId,
    date: new Date(reimb.createdAt).toISOString().slice(0, 10),
    amount: Number(reimb.totalAmount),
    reference_number: reimb.reference,
    description: `Reimbursement ${reimb.reference} — ${reimb.category}`,
  };
}

export async function processZohoSyncJobs() {
  const cfg = await storage.getZohoConfig();
  if (!cfg?.enabled) return;
  const jobs = await storage.getPendingZohoJobs(20);
  for (const job of jobs) {
    try {
      await storage.updateZohoJob(job.id, { status: "processing", attempts: job.attempts + 1 });
      let result: any;
      if (job.sourceType === "reimbursement") {
        const reimb = await storage.getReimbursement(job.sourceId);
        if (!reimb) throw new Error("Reimbursement not found");
        result = await zohoPost("/expenses", mapReimbursementToExpense(reimb, cfg));
        await storage.updateReimbursement(job.sourceId, { status: "synced", zohoExpenseId: result.expense?.expense_id });
        await storage.updateZohoJob(job.id, {
          status: "succeeded",
          zohoRecordId: result.expense?.expense_id,
          responsePayload: result,
        });
      } else {
        // Other source types follow the same shape — extend as finance maps them.
        await storage.updateZohoJob(job.id, { status: "failed", lastError: `Unsupported sourceType: ${job.sourceType}` });
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg === "ZOHO_NOT_ENABLED") {
        await storage.updateZohoJob(job.id, { status: "pending" });
      } else {
        await storage.updateZohoJob(job.id, {
          status: job.attempts >= 5 ? "failed" : "pending",
          lastError: msg,
        });
      }
    }
  }
}

export async function enqueueZohoPush(sourceType: string, sourceId: string, zohoEntity: string) {
  const key = `${sourceType}:${sourceId}`;
  const existing = await storage.getZohoJobByKey(key);
  if (existing) return existing;
  return storage.createZohoJob({ sourceType, sourceId, zohoEntity, idempotencyKey: key, status: "pending" });
}
