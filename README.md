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
