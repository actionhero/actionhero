import { Process, api } from "../../../src/index";
import * as net from "net";

const port = 18080 + parseInt(process.env.JEST_WORKER_ID || "0");

const createWebConfig = (customPort?: string | number) => ({
  __esModule: true,
  test: {
    web: () => ({
      enabled: true,
      secure: false,
      urlPathForActions: "api",
      urlPathForFiles: "public",
      rootEndpointType: "file",
      port: customPort || port,
      matchExtensionMime: true,
      metadataOptions: {
        serverInformation: true,
        requesterInformation: false,
      },
      fingerprintOptions: {
        cookieKey: "sessionID",
      },
    }),
  },
});

describe("Server: Web Port Check", () => {
  let testActionhero: Process;
  let server: net.Server;
  let serverIPv4: net.Server;
  let serverIPv6: net.Server;

  beforeEach(() => {
    jest.resetModules();
    jest.mock("./../../../src/config/web.ts", () =>
      createWebConfig(process.env.TEST_PORT),
    );
    jest.mock("./../../../src/config/websocket.ts", () => ({
      __esModule: true,
      test: {
        websocket: () => ({
          enabled: false,
        }),
      },
    }));
  });

  afterEach(async () => {
    const closeServer = async (server?: net.Server) => {
      try {
        if (server?.listening) {
          await new Promise<void>((resolve, reject) => {
            server.close((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      } catch (error) {
        console.warn("Error closing server:", error);
      }
    };

    await Promise.all([
      closeServer(server),
      closeServer(serverIPv4),
      closeServer(serverIPv6),
    ]);

    if (testActionhero?.initialized) {
      try {
        await testActionhero.stop();
      } catch (error) {
        console.warn("Error stopping actionhero:", error);
      }
    }

    delete process.env.TEST_PORT;

    jest.resetModules();
  });

  test("should start normally when ports are available", async () => {
    process.env.TEST_PORT = port.toString();
    testActionhero = new Process();

    await testActionhero.start();

    expect(api.servers.servers.web.server.listening).toBe(true);

    await testActionhero.stop();
  });

  test("should detect IPv4 port in use", async () => {
    const testPort = port + 1;
    process.env.TEST_PORT = testPort.toString();

    jest.resetModules();
    jest.mock("./../../../src/config/web.ts", () => createWebConfig(testPort));

    serverIPv4 = net.createServer();

    await new Promise<void>((resolve) => {
      serverIPv4.listen(testPort, "0.0.0.0", () => resolve());
    });

    testActionhero = new Process();

    await expect(testActionhero.start()).rejects.toThrow(
      `IPv4 port ${testPort} is already in use`,
    );
  });

  test("should detect IPv6 port in use", async () => {
    const testPort = port + 2;
    process.env.TEST_PORT = testPort.toString();

    jest.resetModules();
    jest.mock("./../../../src/config/web.ts", () => createWebConfig(testPort));

    serverIPv6 = net.createServer();
    await new Promise<void>((resolve) => {
      serverIPv6.listen(testPort, "::", () => resolve());
    });

    testActionhero = new Process();

    await expect(testActionhero.start()).rejects.toThrow(
      `IPv6 port ${testPort} is already in use`,
    );
  });

  test("should handle both IPv4 and IPv6 ports being used simultaneously", async () => {
    const testPort = port + 3;
    process.env.TEST_PORT = testPort.toString();

    jest.resetModules();
    jest.mock("./../../../src/config/web.ts", () => createWebConfig(testPort));

    serverIPv4 = net.createServer();
    serverIPv6 = net.createServer();

    await Promise.all([
      new Promise<void>((resolve) => {
        serverIPv4.listen(testPort, "0.0.0.0", () => resolve());
      }),
      new Promise<void>((resolve) => {
        serverIPv6.listen(testPort, "::", () => resolve());
      }),
    ]);

    testActionhero = new Process();

    await expect(testActionhero.start()).rejects.toThrow(
      `IPv6 port ${testPort} is already in use`,
    );
  });

  test("should handle port check with invalid port number", async () => {
    process.env.TEST_PORT = "invalid_port";

    jest.resetModules();
    jest.mock("./../../../src/config/web.ts", () =>
      createWebConfig(process.env.TEST_PORT),
    );

    testActionhero = new Process();
    await expect(testActionhero.start()).rejects.toThrow(
      `Invalid port number: NaN`,
    );
  });
});
