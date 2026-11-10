import { handleRequest } from "../worker.mjs";
import { database } from "../lib/database.mjs";

export default {
  fetch(request) {
    const headers = new Headers(request.headers);
    headers.set("CF-Connecting-IP", headers.get("x-vercel-forwarded-for")?.split(",")[0] || "shared");
    request = new Request(request, { headers });
    return handleRequest(request, { DB: database }, {});
  },
};
