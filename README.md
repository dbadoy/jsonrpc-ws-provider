# jsonrpc-ws-provider
JSON-RPC WebSocket Provider to get results synchronously.

Most of the code is taken from [web3.js](https://github.com/web3/web3.js/tree/4.x/packages/web3-providers-ws), and I modified the Ethereum-specific implementation to make it universally usable with JSON-RPC.

### Installation
https://www.npmjs.com/package/jsonrpc-ws-provider

```
$ npm i jsonrpc-ws-provider
```

### Examples
```typescript
const evmWsProvider = new JsonRpcWebSocketProvider('wss://{evm}');
const res1 = await evmWsProvider.request({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_chainId',
    params: [],
});

const cosmosWsProvider = new JsonRpcWebSocketProvider('wss://{cosmos-sdk}/websocket');
const res2 = await cosmosWsProvider.request({
    jsonrpc: '2.0',
    id: 1,
    method: 'net_info',
    params: [],
});
```

Subscribe example
```typescript
const NewBlockHeaderSubId = 'new_block_header_id';

const cosmosWsProvider = new JsonRpcWebSocketProvider('wss://{cosmos-sdk}/websocket');
cosmosWsProvider.request({
    method: 'subscribe',
    params: ["tm.event = 'NewBlockHeader'"],
    jsonrpc: '2.0',
    id: NewBlockHeaderSubId,
});

cosmosWsProvider.on(
    'message',
    async (jsonrpcRes: JsonRpcResponseWithResult<any>) => {
        if (Object.keys(jsonrpcRes?.result).length !== 0) {
            if (jsonrpcRes?.id === NewBlockHeaderSubId) {
                const newBlockHeader = jsonrpcRes?.result?.data;
                if (newBlockHeader?.type !== 'tendermint/event/NewBlockHeader') {
                    throw new Error('Invalid event type');
                }
                const height = newBlockHeader?.value?.header?.height;

                console.log(`new block detected ${height}`);
            }
        }
    }
);
```

### disconnectionCheckInterval
The default logic is to try to connect when the `request` method is called if the connection is lost. <br>
This can cause unintended behavior if you have set up logic for when you receive a reconnection event. For example, let's say you're making a subscribe request to an endpoint and periodically polling it for values. For reliability, you implemented the `onReconnect` method to make a subscribe request when the connection is disconnected and reconnected. <br>
With the existing logic, this means that the `onReconnect` method will not be executed until you call `request`, and you could lose data in the meantime! <br>
In this case, setting the `disconnectionCheckInterval` value will cause the `onReconnect` method to be executed after the set interval instead of waiting for the `request` to be called.

(onReconnect example)
```typescript
async function onReconnect(provider: JsonRpcWebSocketProvider): Promise<void> {
    // Recover logic
    // ...

    subscribeNewBlockHeader(provider);
}

async function subscribeNewBlockHeader(provider: JsonRpcWebSocketProvider): Promise<void> {
    provider.request({
        method: 'subscribe',
        params: ["tm.event = 'NewBlockHeader'"],
        jsonrpc: '2.0',
        id: NewBlockHeaderSubId,
    });

    provider.once('connect', onReconnect);
}

async function detectNewBlockHeader(provider: JsonRpcWebSocketProvider): Promise<void> {
    subscribeNewBlockHeader(provider);

    provider.on(
        'message',
        async (response: any) => {
            // Handle response
            // ...
        },
    );
}
```
