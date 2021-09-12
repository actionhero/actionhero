export type WebsocketClientState =
  | "disconnected"
  | "connected"
  | "connecting"
  | "reconnecting";

export type WebsocketResponse<DataType extends Record<string, any>> = {
  context: string;
  messageId: string | number;
  status: string;
  data: DataType;
};

export class ActionheroWebsocketClient {
  url: string;
  options: Record<string, any>;
  id: string;
  fingerprint: string;
  callbacks: Record<string, (value: unknown) => void>;
  events: Record<string, () => {}>;
  rooms: string[];
  state: WebsocketClientState;
  messageId: number;
  pingTimeout: ReturnType<typeof setTimeout>;
  connection: WebSocket; // built-in type

  // optional subscription methods
  onConnect: (state: WebsocketClientState) => void;
  onDisconnect: (state: WebsocketClientState) => void;
  onMessage: (response: WebsocketResponse<{ message: string }>) => void;
  onSay: (response: WebsocketResponse<{ message: string }>) => void;
  onWelcome: (response: WebsocketResponse<{ welcome: string }>) => void;

  /**
   * Build a new Websocket client to talk to an Actionhero server
   *
   * @param url: The URL to connect to.  `"http://localhost:8080"` would be the localhost default.
   * @param options: Options to pass to the websocket connection.
   */
  constructor(
    url: string,
    options = {
      cookieKey: "",
      protocols: "",
      apiPath: "/api",
    }
  ) {
    this.url = url;
    this.options = options;
    this.callbacks = {};
    this.id = null;
    this.fingerprint = null;
    this.events = {};
    this.rooms = [];
    this.state = "disconnected";
    this.messageId = 0;
  }

  //////////////
  // COMMANDS //
  //////////////

  async connect() {
    if (this.state === "connected") return;
    if (this.state === "connecting") return;

    this.state = "connecting";
    delete this.connection;
    delete this.id;
    delete this.fingerprint;

    await new Promise((resolve) => {
      this.connection = new WebSocket(
        this.urlWithSession(),
        this.options.protocols && this.options.protocols.length > 0
          ? this.options.protocols
          : undefined
      );

      this.connection.onopen = () => {
        this.heartbeat();
        if (typeof this.onConnect === "function") this.onConnect(this.state);
        resolve(null);
      };

      this.connection.onclose = () => {
        clearTimeout(this.pingTimeout);
        // if (this.state !== "disconnected") this.reconnect();
        if (typeof this.onDisconnect === "function") {
          this.onDisconnect(this.state);
        }
      };

      this.connection.onerror = (error: any) => {
        console.error(error);
      };

      this.connection.onmessage = (message: MessageEvent) => {
        if (!message.data) return;

        const data: WebsocketResponse<any> = JSON.parse(message.data);

        if (typeof this.onMessage === "function") {
          this.onMessage(data);
        }

        if (data.context === "response") {
          if (data.messageId && this.callbacks[this.messageId]) {
            this.callbacks[this.messageId](data);
            delete this.callbacks[this.messageId];
          }
        } else if (
          data.context === "user" &&
          typeof this.onSay === "function"
        ) {
          this.onSay(data);
        } else if (
          data["welcome"] &&
          data.context === "api" &&
          typeof this.onWelcome === "function"
        ) {
          this.onWelcome(data);
        }
      };
    });

    return this.configure();
  }

  send<DataType>(
    args: Record<string, any>
  ): Promise<WebsocketResponse<DataType>> {
    this.messageId++;
    args.messageId = args.params
      ? args.params.messageId || args.messageId || this.messageId
      : args.messageId || this.messageId;

    this.connection.send(JSON.stringify(args));

    return new Promise((resolve) => {
      this.callbacks[this.messageId] = resolve;
    });
  }

  async say(room: string, message: string | Record<string, any>) {
    return this.send({ event: "say", room: room, message: message });
  }

  async file(file: string) {
    return this.send({ event: "file", file });
  }

  async detailsView() {
    return this.send<{
      connectedAt: number;
      fingerprint: string;
      id: string;
      remoteIp: string;
      remotePort: string;
      rooms: string[];
      totalActions: number;
    }>({ event: "detailsView" });
  }

  async roomView(room: string) {
    return this.send<{ rooms: string[] }>({ event: "roomView", room: room });
  }

  async roomAdd(room: string) {
    await this.send({ event: "roomAdd", room: room });
    return this.configure();
  }

  async roomLeave(room: string) {
    await this.send({ event: "roomLeave", room: room });
    return this.configure();
  }

  async documentation() {
    return this.send({ event: "documentation" });
  }

  disconnect() {
    this.state = "disconnected";
    this.connection.close();
  }

  /////////////
  // ACTIONS //
  /////////////

  async action(actionName: string, params: Record<string, any>) {
    if (!params) params = {};
    params.action = actionName;

    let response: Record<string, any>;
    if (this.state !== "connected") {
      response = await this.actionWeb(params);
    } else {
      response = await this.actionWebSocket(params);
    }

    if (response.error) throw new Error(response.error);

    return response;
  }

  async actionWeb(params: Record<string, any>) {
    return new Promise((resolve, reject) => {
      const req = new XMLHttpRequest();

      req.onreadystatechange = () => {
        var response;
        if (req.readyState === 4) {
          if (req.status === 200) {
            response = JSON.parse(req.responseText);
          } else {
            try {
              response = JSON.parse(req.responseText);
            } catch (e) {
              response = {
                error: {
                  statusText: req.statusText,
                  responseText: req.responseText,
                },
              };
            }
          }
          return resolve(response);
        }
      };

      // TODO: handle rejection cases

      const method = (params.httpMethod || "POST").toUpperCase();
      let url = this.url + this.options.apiPath + "?action=" + params.action;

      if (method === "GET") {
        for (var param in params) {
          if (~["action", "httpMethod"].indexOf(param)) continue;
          url += "&" + param + "=" + params[param];
        }
      }

      req.open(method, url, true);
      req.setRequestHeader("Content-Type", "application/json");
      req.send(JSON.stringify(params));
    });
  }

  async actionWebSocket(params: Record<string, any>) {
    return this.send({ event: "action", params: params });
  }

  /////////////
  // private //
  /////////////

  async configure() {
    for (const room of this.rooms) await this.send({ event: "roomAdd", room });
    const details = await this.detailsView();
    this.id = details.data.id;
    this.fingerprint = details.data.fingerprint;
    this.rooms = details.data.rooms;

    return details;
  }

  private urlWithSession() {
    let url = this.url;
    if (this.options.cookieKey) {
      const cookieValue = this.getCookie(this.options.cookieKey);
      if (cookieValue && cookieValue.length > 0) {
        url += "?" + this.options.cookieKey + "=" + cookieValue;
      }
    }

    return url;
  }

  private getCookie(name) {
    if (typeof document === "undefined" || !document.cookie) {
      return;
    }
    var match = document.cookie.match(new RegExp(name + "=([^;]+)"));
    if (match) return match[1];
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

  // private reconnect() {
  //   clearTimeout(this.pingTimeout);
  //   this.connection.close();
  //   this.state = "reconnecting";
  //   this.pingTimeout = setTimeout(() => this.connect, 1000 * 5);
  // }
}
