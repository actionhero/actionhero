import { parseIPv6URI } from "./parseIPv6URI";

/**
 * Return ip and port information if defined in the header
 */
export function parseHeadersForClientAddress(
  headers: Record<string, string | string[]>
) {
  let ip: string;
  let port: number | string;

  if (headers["x-forwarded-for"]) {
    let parts;
    let forwardedIp = Array.isArray(headers["x-forwarded-for"])
      ? headers["x-forwarded-for"][0].split(",")[0]
      : headers["x-forwarded-for"].split(",")[0];
    if (
      forwardedIp.indexOf(".") >= 0 ||
      (forwardedIp.indexOf(".") < 0 && forwardedIp.indexOf(":") < 0)
    ) {
      // IPv4
      forwardedIp = forwardedIp.replace("::ffff:", ""); // remove any IPv6 information, ie: '::ffff:127.0.0.1'
      parts = forwardedIp.split(":");
      if (parts[0]) {
        ip = parts[0];
      }
      if (parts[1]) {
        port = parts[1];
      }
    } else {
      // IPv6
      parts = parseIPv6URI(forwardedIp);
      if (parts.host) {
        ip = parts.host;
      }
      if (parts.port) {
        port = parts.port;
      }
    }
  }
  if (headers["x-forwarded-port"]) {
    port = Array.isArray(headers["x-forwarded-port"])
      ? headers["x-forwarded-port"][0]
      : headers["x-forwarded-port"];
  }
  if (headers["x-real-ip"]) {
    // https://distinctplace.com/2014/04/23/story-behind-x-forwarded-for-and-x-real-ip-headers/
    ip = Array.isArray(headers["x-real-ip"])
      ? headers["x-real-ip"][0]
      : headers["x-real-ip"];
  }
  return { ip, port };
}
