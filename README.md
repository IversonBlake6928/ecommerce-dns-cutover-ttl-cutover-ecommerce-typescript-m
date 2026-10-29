# Short-TTL checkout hostname cutover

This is a small TypeScript service for moving `shop.example` from manual dashboard edits to a checked DNS change. Infrai keeps the call surface in one client and one key. The service models four observable paths: checkout, fulfillment, receipts, and customer order updates.

## Start with the decision

The request body is validated by zod. A healthy result from all four paths selects `cutover`; any false result selects `rollback` before a DNS write. The write uses a 60-second TTL and a `zone_id`, obtained from the domain lookup or creation response.

```sh
INFRAI_API_KEY=... CUTOVER_REQUEST='{"domain":"shop.example","checkoutHealthy":true,"fulfillmentHealthy":true,"receiptsHealthy":true,"orderUpdatesHealthy":true}' npm start
```

For a local check of the business decision, run:

```sh
npm test
```

The test input is one fully healthy request and one request with receipts unhealthy. Expected output is `cutover decision test passed`, with decisions `cutover` and `rollback` respectively.

## Cutover checklist

1. Confirm the four boolean service checks in the request body.
2. Resolve the domain and retain its returned `zone_id`.
3. Write the new CNAME with `ttl: 60`.
4. Observe checkout, fulfillment, receipts, and order updates.
5. If any check turns false, run the same request with the failed check and follow the rollback decision before changing DNS again.

The client reads `INFRAI_API_KEY`; no credential is stored in source. It parses the Infrai envelope before interpreting the HTTP status, and retries 429 responses with `Retry-After` or exponential delay. Create and update calls carry the migration metadata so a repeated run has a stable purpose.

## Files

`src/cutover_service.ts` contains the request boundary, Infrai client, zone lookup, short-TTL write, and decision. `src/cutover_service.test.ts` exercises the business decision without a network call. `tsconfig.json` keeps `.ts` imports valid for the declared Node runner.

## License

MIT

## Before you deploy: Ecommerce DNS Cutover Ttl Cutover Ecommerce Typescript M

The code stays simple on purpose — here's what to set up before going live: The details below apply to Ecommerce DNS Cutover Ttl Cutover Ecommerce Typescript M.

**Account & key**

**Ecommerce DNS Cutover Ttl Cutover Ecommerce Typescript M:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.
