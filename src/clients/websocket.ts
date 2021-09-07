export type WebsocketClientState = "disconnected" | "connected" | "connecting";

export class WebsocketClient {
  url: string;
  options: Record<string, any>;
  id: string;
  callbacks: Record<string, () => {}>;
  events: Record<string, () => {}>;
  rooms: string[];
  state: WebsocketClientState;
  messageId: number;
  connection: WebSocket; // built-in type

  /**
   * Build a new Websocket client to talk to an Actionhero server
   *
   * @param url: The URL to connect to + path.  `"http://localhost:8080/ws"` would be the localhost default.
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
  }
}
