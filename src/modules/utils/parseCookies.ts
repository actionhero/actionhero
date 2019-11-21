/**
 * Transform the cookie headers of a node HTTP `req` Object into a hash.
 */
export function parseCookies(req: { headers: { [key: string]: any } }): object {
  const cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(";").forEach(cookie => {
      const parts = cookie.split("=");
      cookies[parts[0].trim()] = (parts[1] || "").trim();
    });
  }
  return cookies;
}
