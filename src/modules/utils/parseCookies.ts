/**
 * Transform the cookie headers of a node HTTP `req` Object into a hash.
 */
export function parseCookies(req: {
  headers: { [key: string]: string | string[] };
}): object {
  const cookies: Record<string, string> = {};
  if (req.headers.cookie) {
    (Array.isArray(req.headers.cookie)
      ? req.headers.cookie.join("")
      : req.headers.cookie
    )
      .split(";")
      .forEach((cookie) => {
        const parts = cookie.split("=");
        cookies[parts[0].trim()] = (parts[1] || "").trim();
      });
  }
  return cookies;
}
