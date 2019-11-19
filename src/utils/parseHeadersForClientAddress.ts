import { parseIPv6URI } from "./parseIPv6URI";

/**
 * Return ip and port information if defined in the header
 */
export function parseHeadersForClientAddress(
  headers: object
): {
  ip: string;
  port: number;
} {
  let ip = null;
  let port = null;

  if (headers["x-forwarded-for"]) {
    let parts;
    let forwardedIp = headers["x-forwarded-for"].split(",")[0];
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
    port = headers["x-forwarded-port"];
  }
  if (headers["x-real-ip"]) {
    // https://distinctplace.com/2014/04/23/story-behind-x-forwarded-for-and-x-real-ip-headers/
    ip = headers["x-real-ip"];
  }
  return { ip, port };
}
