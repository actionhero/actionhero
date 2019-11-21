import * as os from "os";

/**
 * Returns this server's external/public IP address
 */
export function getExternalIPAddress(): string {
  const ifaces = os.networkInterfaces();
  let ip = null;
  for (const dev in ifaces) {
    ifaces[dev].forEach(details => {
      if (details.family === "IPv4" && details.address !== "127.0.0.1") {
        ip = details.address;
      }
    });
  }
  return ip;
}
