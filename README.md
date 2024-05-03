# jsonrpc-ws-provider
JSON-RPC WebSocket Provider to get results synchronously.

Most of the code is taken from [web3.js](https://github.com/web3/web3.js/tree/4.x/packages/web3-providers-ws), and I modified the Ethereum-specific implementation to make it universally usable with JSONRPC.

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
