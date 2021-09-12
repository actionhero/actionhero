export declare type WebsocketClientState = "disconnected" | "connected" | "connecting";
export declare class ActionheroWebsocketClient {
    url: string;
    options: Record<string, any>;
    id: string;
    callbacks: Record<string, () => {}>;
    events: Record<string, () => {}>;
    rooms: string[];
    state: WebsocketClientState;
    messageId: number;
    pingTimeout: ReturnType<typeof setTimeout>;
    connection: WebSocket;
    /**
     * Build a new Websocket client to talk to an Actionhero server
     *
     * @param url: The URL to connect to.  `"http://localhost:8080"` would be the localhost default.
     * @param options: Options to pass to the websocket connection.
     */
    constructor(url: string, options?: {
        protocols: string;
    });
    connect(): Promise<void>;
    private heartbeat;
}
