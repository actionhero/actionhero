export type WebsocketClientState = "disconnected" | "connected" | "connecting";

export class ActionheroWebsocketClient {
  url: string;
  options: Record<string, any>;
  id: string;
  callbacks: Record<string, () => {}>;
  events: Record<string, () => {}>;
  rooms: string[];
  state: WebsocketClientState;
  messageId: number;
  pingTimeout: NodeJS.Timeout;
  connection: WebSocket; // built-in type

  /**
   * Build a new Websocket client to talk to an Actionhero server
   *
   * @param url: The URL to connect to.  `"http://localhost:8080"` would be the localhost default.
   * @param options: Options to pass to the websocket connection.
   */
  constructor(url: string, options?: { protocols: string }) {
    this.url = url;
    this.options = options;
    this.callbacks = {};
    this.id = null;
    this.events = {};
    this.rooms = [];
    this.state = "disconnected";
    this.messageId = 0;
  }

  async connect() {
    if (this.state === "connected") return;
    if (this.state === "connecting") return;

    this.state = "connecting";
    delete this.connection;
    this.connection = new WebSocket(this.url, this.options.protocols);

    this.connection.onopen = () => {
      this.heartbeat();
    };

    this.connection.onclose = () => {
      clearTimeout(this.pingTimeout);
    };

    this.connection.onerror = (error: any) => {
      console.error(error);
    };

    this.connection.onmessage = (message: any) => {
      let data: Record<string, any> = message;
      try {
        data = JSON.parse(message);
      } catch {}

      console.log(data);
      // this.connection.on("ping", this.heartbeat);
    };
  }

  private heartbeat() {
    clearTimeout(this.pingTimeout);
    this.state = "connected";

    // Use `WebSocket#terminate()`, which immediately destroys the connection,
    // instead of `WebSocket#close()`, which waits for the close timer.
    // Delay should be equal to the interval at which your server
    // sends out pings plus a conservative assumption of the latency.
    this.pingTimeout = setTimeout(() => {
      this.connection.close();
    }, 15 * 1000 * 2);
  }
}
