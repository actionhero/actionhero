/**
 * Parse an IPv6 address, returning both host and port.
 * see https://github.com/actionhero/actionhero/issues/275
 */
export function parseIPv6URI(
  addr: string
): {
  host: string;
  port: number;
} {
  let host = "::1";
  let port = "80";
  const regexp = new RegExp(/\[([0-9a-f:]+(?:%.+)?)]:([0-9]{1,5})/);
  // if we have brackets parse them and find a port
  if (addr.indexOf("[") > -1 && addr.indexOf("]") > -1) {
    const res = regexp.exec(addr);
    if (res === null) {
      throw new Error("failed to parse address");
    }
    host = res[1];
    port = res[2];
  } else {
    host = addr;
  }
  return { host: host, port: parseInt(port, 10) };
}
