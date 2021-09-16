export declare type WebsocketClientState = "disconnected" | "connected" | "connecting" | "reconnecting";
export declare type WebsocketResponse<DataType extends Record<string, any>> = {
    context: string;
    messageId: string | number;
    status: string;
    data: DataType;
};
export declare class ActionheroWebsocketClient {
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
    connection: WebSocket;
    onConnect: (state: WebsocketClientState) => void;
    onDisconnect: (state: WebsocketClientState) => void;
    onMessage: (response: WebsocketResponse<{
        message: string;
    }>) => void;
    onSay: (response: WebsocketResponse<{
        message: string;
    }>) => void;
    onWelcome: (response: WebsocketResponse<{
        welcome: string;
    }>) => void;
    /**
     * Build a new Websocket client to talk to an Actionhero server
     *
     * @param url: The URL to connect to.  `"http://localhost:8080"` would be the localhost default.
     * @param options: Options to pass to the websocket connection.
     */
    constructor(url: string, options?: {
        cookieKey: string;
        protocols: string;
        apiPath: string;
    });
    connect(): Promise<WebsocketResponse<{
        connectedAt: number;
        fingerprint: string;
        id: string;
        remoteIp: string;
        remotePort: string;
        rooms: string[];
        totalActions: number;
    }>>;
    send<DataType>(args: Record<string, any>): Promise<WebsocketResponse<DataType>>;
    say(room: string, message: string | Record<string, any>): Promise<WebsocketResponse<unknown>>;
    file(file: string): Promise<WebsocketResponse<unknown>>;
    detailsView(): Promise<WebsocketResponse<{
        connectedAt: number;
        fingerprint: string;
        id: string;
        remoteIp: string;
        remotePort: string;
        rooms: string[];
        totalActions: number;
    }>>;
    roomView(room: string): Promise<WebsocketResponse<{
        rooms: string[];
    }>>;
    roomAdd(room: string): Promise<WebsocketResponse<{
        connectedAt: number;
        fingerprint: string;
        id: string;
        remoteIp: string;
        remotePort: string;
        rooms: string[];
        totalActions: number;
    }>>;
    roomLeave(room: string): Promise<WebsocketResponse<{
        connectedAt: number;
        fingerprint: string;
        id: string;
        remoteIp: string;
        remotePort: string;
        rooms: string[];
        totalActions: number;
    }>>;
    documentation(): Promise<WebsocketResponse<unknown>>;
    disconnect(): void;
    action(actionName: string, params: Record<string, any>): Promise<Record<string, any>>;
    actionWeb(params: Record<string, any>): Promise<unknown>;
    actionWebSocket(params: Record<string, any>): Promise<WebsocketResponse<unknown>>;
    configure(): Promise<WebsocketResponse<{
        connectedAt: number;
        fingerprint: string;
        id: string;
        remoteIp: string;
        remotePort: string;
        rooms: string[];
        totalActions: number;
    }>>;
    private urlWithSession;
    private getCookie;
    private heartbeat;
}
