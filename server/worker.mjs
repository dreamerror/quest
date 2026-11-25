async function sameSecret(actual, expected) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

export default {
  async fetch(request, env) {
    const headers = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Vary": "Origin"
    });
    if (!env.INVITE_TOKEN || !env.SITE_ORIGIN || !env.CERTIFICATE_KEY) {
      return new Response("Service is not configured", { status: 503, headers });
    }
    const origin = request.headers.get("Origin");
    if (origin && origin !== env.SITE_ORIGIN) return new Response("Forbidden", { status: 403, headers });
    headers.set("Access-Control-Allow-Origin", env.SITE_ORIGIN);
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET") {
      headers.set("Allow", "GET, OPTIONS");
      return new Response("Method not allowed", { status: 405, headers });
    }
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ") || authorization.length > 1024 ||
        !await sameSecret(authorization.slice(7), env.INVITE_TOKEN)) {
      return new Response("Unauthorized", { status: 401, headers });
    }
    const path = new URL(request.url).pathname;
    if (path === "/api/access") return new Response(null, { status: 204, headers });
    if (path !== "/api/certificate") return new Response("Not found", { status: 404, headers });
    try {
      const pdf = await env.CERTIFICATES.get(env.CERTIFICATE_KEY, "arrayBuffer");
      if (pdf === null) return new Response("Certificate not uploaded", { status: 404, headers });
      headers.set("Content-Type", "application/pdf");
      headers.set("Content-Disposition", 'attachment; filename="certificate-for-mom.pdf"');
      return new Response(pdf, { headers });
    } catch {
      return new Response("Certificate unavailable", { status: 503, headers });
    }
  }
};
