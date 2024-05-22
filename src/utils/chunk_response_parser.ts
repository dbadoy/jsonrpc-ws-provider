import { EventEmitter } from 'events';
import { JsonRpcResponse } from '../types';

export type Timeout = ReturnType<typeof setTimeout>;

export class ChunkResponseParser {
    private lastChunk: string | undefined;
    private lastChunkTimeout: Timeout | undefined;
    private _clearQueues: (() => void) | undefined;
    private readonly eventEmitter: EventEmitter;
    private readonly autoReconnect: boolean;
    private chunkTimout: number;

    public constructor(eventEmitter: EventEmitter, autoReconnect: boolean) {
        this.eventEmitter = eventEmitter;
        this.autoReconnect = autoReconnect;
        this.chunkTimout = 1000 * 15;
    }
    private clearQueues(): void {
        if (typeof this._clearQueues === 'function') {
            this._clearQueues();
        }
    }

    public onError(clearQueues?: () => void) {
        this._clearQueues = clearQueues;
    }

    // Method for test.
    private setChunkTimeout(ms: number) {
        this.chunkTimout = ms;
    }

    public parseResponse(data: string): JsonRpcResponse[] {
        const returnValues: JsonRpcResponse[] = [];

        // DE-CHUNKER
        const dechunkedData = data
            .replace(/\}[\n\r]?\{/g, '}|--|{') // }{
            .replace(/\}\][\n\r]?\[\{/g, '}]|--|[{') // }][{
            .replace(/\}[\n\r]?\[\{/g, '}|--|[{') // }[{
            .replace(/\}\][\n\r]?\{/g, '}]|--|{') // }]{
            .split('|--|');

        dechunkedData.forEach((_chunkData) => {
            // prepend the last chunk
            let chunkData = _chunkData;
            if (this.lastChunk) {
                chunkData = this.lastChunk + chunkData;
            }

            let result;

            try {
                result = JSON.parse(chunkData) as unknown as JsonRpcResponse;
            } catch (e) {
                this.lastChunk = chunkData;

                // start timeout to cancel all requests
                if (this.lastChunkTimeout) {
                    clearTimeout(this.lastChunkTimeout);
                }

                this.lastChunkTimeout = setTimeout(() => {
                    if (this.autoReconnect) return;
                    this.clearQueues();
                    this.eventEmitter.emit(
                        'error',
                        new Error(
                            JSON.stringify({
                                id: 1,
                                jsonrpc: '2.0',
                                error: { code: 2, message: 'Chunk timeout' },
                            }),
                        ),
                    );
                }, this.chunkTimout);
                return;
            }

            // cancel timeout and set chunk to null
            clearTimeout(this.lastChunkTimeout);
            this.lastChunk = undefined;

            if (result) returnValues.push(result);
        });

        return returnValues;
    }
}
