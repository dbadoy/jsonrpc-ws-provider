import Websocket from 'ws';
import { EventEmitter } from 'events';
import { JsonRpcId, JsonRpcRequest, JsonRpcResponse, JsonRpcResponseWithResult, ProviderStatus } from './types';
import { DeferredPromise, DeferredPromiseInterface } from './utils/deferred_promise';
import { ChunkResponseParser } from './utils/chunk_response_parser';
import {
    ConnectionError,
    InvalidClientError,
    MaxAttemptsReachedOnReconnectingError,
    PendingRequestsOnReconnectingError,
} from './execption';
import { sleep } from './utils/time';

const NORMAL_CLOSE_CODE = 1000; // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close

export interface SocketRequestItem<T> {
    payload: any;
    deferredPromise: DeferredPromiseInterface<JsonRpcResponse<T>>;
}

export type ReconnectOptions = {
    autoReconnect: boolean;
    delay: number;
    maxAttempts: number;
    disconnectCheckInterval?: number; // default: 3s
};

const DEFAULT_RECONNECTION_OPTIONS: ReconnectOptions = {
    autoReconnect: true,
    delay: 5000,
    maxAttempts: 5,
    disconnectCheckInterval: 3000,
};

export class JsonRpcWebSocketProvider extends EventEmitter {
    protected isReconnecting: boolean;

    private _socketConnection?: Websocket;
    public get SocketConnection() {
        return this._socketConnection;
    }

    private readonly _socketPath: string;

    protected readonly chunkResponseParser: ChunkResponseParser;

    protected _connectionStatus: ProviderStatus;
    protected readonly _reconnectOptions: ReconnectOptions;

    protected readonly _onMessageHandler: (event: Websocket.MessageEvent) => void;
    protected readonly _onOpenHandler: () => void;
    protected readonly _onCloseHandler: (event: Websocket.CloseEvent) => void;
    protected readonly _onErrorHandler: (event: Websocket.ErrorEvent) => void;

    protected readonly _pendingRequestsQueue: Map<JsonRpcId, SocketRequestItem<any>>;
    protected readonly _sentRequestsQueue: Map<JsonRpcId, SocketRequestItem<any>>;

    protected _reconnectAttempts!: number;

    constructor(socketPath: string, reconnectOptions?: Partial<ReconnectOptions>) {
        super();
        this._socketPath = socketPath;
        this._connectionStatus = 'connecting';

        this._reconnectOptions = {
            ...DEFAULT_RECONNECTION_OPTIONS,
            ...(reconnectOptions ?? {}),
        };

        if (this._reconnectOptions.autoReconnect) {
            this.autoReconnectLoop();
        }

        this._socketConnection = new Websocket(this._socketPath);

        this._onMessageHandler = this._onMessage.bind(this);
        this._onOpenHandler = this._onConnect.bind(this);
        this._onCloseHandler = this._onCloseEvent.bind(this);
        this._onErrorHandler = this._onError.bind(this);

        this._pendingRequestsQueue = new Map();
        this._sentRequestsQueue = new Map();

        this._init();
        this.connect();

        this.chunkResponseParser = new ChunkResponseParser(this, this._reconnectOptions.autoReconnect);
        this.chunkResponseParser.onError(() => {
            this._clearQueues();
        });

        this.isReconnecting = false;
    }

    protected _init() {
        this._reconnectAttempts = 0;
    }

    protected _openSocketConnection() {
        this._socketConnection = new Websocket(this._socketPath, undefined, undefined);
    }

    // eslint-disable-next-line class-methods-use-this
    public getPendingRequestQueueSize() {
        return this._pendingRequestsQueue.size;
    }

    // eslint-disable-next-line class-methods-use-this
    public getSentRequestsQueueSize() {
        return this._sentRequestsQueue.size;
    }

    /**
     * Resets the socket, removing all listeners and pending requests
     */
    public reset(): void {
        this._sentRequestsQueue.clear();
        this._pendingRequestsQueue.clear();

        this._init();
        this._removeSocketListeners();
        this._addSocketListeners();
    }

    protected _reconnect(): void {
        if (this.isReconnecting) {
            return;
        }
        this.isReconnecting = true;

        if (this._sentRequestsQueue.size > 0) {
            this._sentRequestsQueue.forEach((request: SocketRequestItem<any>, key: JsonRpcId) => {
                request.deferredPromise.reject(new PendingRequestsOnReconnectingError());
                this._sentRequestsQueue.delete(key);
            });
        }

        if (this._reconnectAttempts < this._reconnectOptions.maxAttempts) {
            this._reconnectAttempts += 1;
            setTimeout(() => {
                this._removeSocketListeners();
                this.connect();
                this.isReconnecting = false;
            }, this._reconnectOptions.delay);
        } else {
            this.isReconnecting = false;
            this._clearQueues();
            this._removeSocketListeners();
            this.emit('error', new MaxAttemptsReachedOnReconnectingError(this._reconnectOptions.maxAttempts));
        }
    }

    public connect(): void {
        try {
            this._openSocketConnection();
            this._connectionStatus = 'connecting';
            this._addSocketListeners();
        } catch (e) {
            if (!this.isReconnecting) {
                this._connectionStatus = 'disconnected';
                if (e && (e as Error).message) {
                    throw new ConnectionError(
                        `Error while connecting to ${this._socketPath}. Reason: ${(e as Error).message}`,
                    );
                } else {
                    throw new InvalidClientError(this._socketPath);
                }
            } else {
                setImmediate(() => {
                    this._reconnect();
                });
            }
        }
    }

    public disconnect(code?: number, data?: string): void {
        const disconnectCode = code ?? NORMAL_CLOSE_CODE;
        this._removeSocketListeners();
        if (this.getStatus() !== 'disconnected') {
            this._closeSocketConnection(disconnectCode, data);
        }
        this._onDisconnect(disconnectCode, data);
    }

    async request<T>(request: JsonRpcRequest): Promise<JsonRpcResponse<T>> {
        if (!this._socketConnection) {
            throw new Error('Connection is undefined');
        }

        if (!this._reconnectOptions.autoReconnect && this.getStatus() === 'disconnected') {
            this.connect();
        }

        const requestId = request.id;

        if (!requestId) {
            throw new Error('Request id is undefined');
        }

        if (this._sentRequestsQueue.has(requestId)) {
            throw new Error('Already sent request with the same id');
        }

        const deferredPromise = new DeferredPromise<JsonRpcResponse<T>>();
        deferredPromise.catch((error) => {
            this.emit('error', error);
        });
        const reqItem: SocketRequestItem<T> = {
            payload: request,
            deferredPromise,
        };

        if (this.getStatus() === 'connecting') {
            this._pendingRequestsQueue.set(requestId, reqItem);
            return reqItem.deferredPromise;
        }

        this._sentRequestsQueue.set(requestId, reqItem);

        try {
            this._socketConnection.send(JSON.stringify(request));
        } catch (error) {
            this._sentRequestsQueue.delete(requestId);
            this.emit('error', error);
        }

        return reqItem.deferredPromise;
    }

    getStatus(): ProviderStatus {
        if (this._socketConnection) {
            switch (this._socketConnection.readyState) {
                case Websocket.CONNECTING:
                    return 'connecting';
                case Websocket.OPEN:
                    return 'connected';
                default:
                    return 'disconnected';
            }
        }
        return 'disconnected';
    }

    // If Status is 'disconnected', this is a loop that will
    // automatically attempt to connect even if you don't call
    // 'request'.
    private async autoReconnectLoop(): Promise<void> {
        while (1) {
            // Ignore the _reconnect method if it is being performed.
            if (!this.isReconnecting && this.getStatus() === 'disconnected') {
                this.connect();
            }
            await sleep(this._reconnectOptions.disconnectCheckInterval ?? 3000);
        }
    }

    private _addSocketListeners(): void {
        this._socketConnection?.addEventListener('open', this._onOpenHandler);
        this._socketConnection?.addEventListener('message', (rawData) => this._onMessageHandler(rawData));
        this._socketConnection?.addEventListener('close', (e) => this._onCloseHandler(e));
        this._socketConnection?.addEventListener('error', (e) => this._onErrorHandler(e));
    }

    private _removeSocketListeners(): void {
        this._socketConnection?.removeEventListener('message', this._onMessageHandler);
        this._socketConnection?.removeEventListener('open', this._onOpenHandler);
        this._socketConnection?.removeEventListener('close', this._onCloseHandler);
    }

    private _onConnect() {
        this._connectionStatus = 'connected';
        this.emit('connect');
        this._sendPendingRequests();
    }

    protected _onMessage(event: Websocket.MessageEvent): void {
        const responses = this.chunkResponseParser.parseResponse(event.data as string);
        for (const response of responses) {
            const requestId = (response as unknown as JsonRpcResponseWithResult).id;
            const requestItem = this._sentRequestsQueue.get(requestId);

            if (requestItem) {
                requestItem.deferredPromise.resolve(response);
                this._sentRequestsQueue.delete(requestId);
            }

            this.emit('message', response);
        }
    }

    protected _onCloseEvent(event: Websocket.CloseEvent): void {
        this._clearQueues(event);
        this._removeSocketListeners();
        this._onDisconnect(event.code, event.reason);
        // disconnect was successful and can safely remove error listener
        this._socketConnection?.removeEventListener('error', this._onErrorHandler);
    }

    protected _onDisconnect(code: number, data?: string) {
        this._connectionStatus = 'disconnected';
        this.emit('disconnect', new Error(`${code} ${data}`));
    }

    protected _onError(event: Websocket.ErrorEvent): void {
        // do not emit error while trying to reconnect
        this.emit('error', event);
    }

    protected _closeSocketConnection(code?: number, data?: string) {
        this._socketConnection?.close(code, data);
    }

    private _sendPendingRequests() {
        for (const [id, value] of this._pendingRequestsQueue.entries()) {
            this._socketConnection?.send(JSON.stringify(value.payload));
            this._pendingRequestsQueue.delete(id);
            this._sentRequestsQueue.set(id, value);
        }
    }

    protected _clearQueues(event?: any) {
        if (this._pendingRequestsQueue.size > 0) {
            this._pendingRequestsQueue.forEach((request: SocketRequestItem<any>, key: JsonRpcId) => {
                request.deferredPromise.reject(new Error(event));
                this._pendingRequestsQueue.delete(key);
            });
        }

        if (this._sentRequestsQueue.size > 0) {
            this._sentRequestsQueue.forEach((request: SocketRequestItem<any>, key: JsonRpcId) => {
                request.deferredPromise.reject(new Error(event));
                this._sentRequestsQueue.delete(key);
            });
        }

        this._removeSocketListeners();
    }
}
