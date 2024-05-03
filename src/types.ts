export type ProviderStatus = 'connecting' | 'connected' | 'disconnected';

export type JsonRpcId = string | number | undefined;
export type JsonRpcResult = string | number | boolean | Record<string, unknown>;
export type JsonRpcIdentifier = string & ('2.0' | '1.0');

export interface JsonRpcError<T = JsonRpcResult> {
    readonly code: number;
    readonly message: string;
    readonly data?: T;
}

export interface JsonRpcRequest<T = unknown[]> {
    readonly id: JsonRpcId;
    readonly jsonrpc: JsonRpcIdentifier;
    readonly method: string;
    readonly params?: T;
}

export interface JsonRpcResponseWithResult<T = JsonRpcResult> {
    readonly id: JsonRpcId;
    readonly jsonrpc: JsonRpcIdentifier;
    readonly error?: never;
    readonly result: T;
}

export interface JsonRpcResponseWithError<Error = JsonRpcResult> {
    readonly id: JsonRpcId;
    readonly jsonrpc: JsonRpcIdentifier;
    readonly error: JsonRpcError<Error>;
    readonly result?: never;
}

export type JsonRpcResponse<Result = JsonRpcResult, Error = JsonRpcResult> =
    | JsonRpcResponseWithError<Error>
    | JsonRpcResponseWithResult<Result>;
