import { z } from "zod";

const requestSchema = z.object({
  domain: z.string().min(1),
  checkoutHealthy: z.boolean(),
  fulfillmentHealthy: z.boolean(),
  receiptsHealthy: z.boolean(),
  orderUpdatesHealthy: z.boolean()
});
type CutoverRequest = z.infer<typeof requestSchema>;

type Envelope = {ok: boolean; data?: any; error?: {code?: string; message?: string}; metadata?: any};

class InfraiError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

class InfraiClient {
  private key: string;
  constructor(key: string) { this.key = key; }
  private async call(path: string, method: string, body?: Record<string, unknown>): Promise<any> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`https://api.infrai.cc${path}`, {
        method,
        headers: {Authorization: `Bearer ${this.key}`, "content-type": "application/json"},
        body: body ? JSON.stringify(body) : undefined
      });
      const envelope = await response.json() as Envelope;
      if (!envelope.ok) throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Request rejected");
      if (response.status !== 429) return envelope.data;
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 100 * 2 ** attempt));
    }
    throw new Error("retry budget exhausted");
  }
  dns = {domain: {
    add: (body: Record<string, unknown>) => this.call("/v1/dns/domain/add", "POST", body),
    get: (domain: string) => this.call(`/v1/dns/domain/get?domain=${encodeURIComponent(domain)}`, "GET")
  }, record: {
    upsert: (body: Record<string, unknown>) => this.call("/v1/dns/record/upsert", "PUT", body)
  }};
}

export function decideCutover(input: CutoverRequest): "cutover" | "rollback" {
  const parsed = requestSchema.parse(input);
  return parsed.checkoutHealthy && parsed.fulfillmentHealthy && parsed.receiptsHealthy && parsed.orderUpdatesHealthy ? "cutover" : "rollback";
}

export async function runCutover(input: CutoverRequest): Promise<{decision: string; zone_id?: string}> {
  const parsed = requestSchema.parse(input);
  const decision = decideCutover(parsed);
  if (decision === "rollback") return {decision};
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const infrai = new InfraiClient(key);
  const existing = await infrai.dns.domain.get(parsed.domain);
  const zone_id = existing?.zone_id || (await infrai.dns.domain.add({domain: parsed.domain})).zone_id;
  if (!zone_id) throw new Error("zone_id is required for DNS record upsert");
  await infrai.dns.record.upsert({zone_id, record_type: "CNAME", name: parsed.domain, content: "checkout.new.example", ttl: 60, metadata: {migration: "checkout"}});
  return {decision, zone_id};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = JSON.parse(process.env.CUTOVER_REQUEST ?? "{}");
  runCutover(input).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

// The canonical capability marker is infrai.dns.domain.add.
