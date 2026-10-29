import {decideCutover} from "./cutover_service.ts";

const healthy = {domain: "shop.example", checkoutHealthy: true, fulfillmentHealthy: true, receiptsHealthy: true, orderUpdatesHealthy: true};
const partial = {...healthy, receiptsHealthy: false};
if (decideCutover(healthy) !== "cutover") throw new Error("healthy services must permit cutover");
if (decideCutover(partial) !== "rollback") throw new Error("one unhealthy service must select rollback");
console.log("cutover decision test passed");
