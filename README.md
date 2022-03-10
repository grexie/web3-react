# Grexie Web3 React

Hooks to simplify calling web3 contracts, with built in support for batching requests and automated refetching.

## Installing

```bash
yarn add @grexie/web3-react
```

## Usage

Grexie Web3 React provides two composable context providers used for configuration: `withWeb3Provider` / `Web3Provider` and `withContractProvider` / `ContractProvider`.

```typescript
import { compose } from '@grexie/compose';
import { withContractProvider, withWeb3Provider } from '@grexie/web3-react';
import { withRefetchProvider } from '@grexie/refetch';

const ComposedApp = compose(
  // optional: must come before web3 provider
  withRefetchProvider({ interval: 15_000 }),
  // must come before contract provider
  withWeb3Provider({ defaultChain: 1, urls: ... }),
  withContractProvider({ contracts: ... }),
  App
);
```

And without compose:

```typescript
import { ContractProvider, Web3Provider } from '@grexie/web3-react';
import { RefetchProvider } from '@grexie/refetch';

const WrappedApp = (
  <RefetchProvider interval={15_000}>
    <Web3Provider defaultChain={1} urls={...}>
      <ContractProvider contracts={...}>
        <App />
      </ContractProvider>
    </Web3Provider>
  </RefetchProvider>
);
```

`urls` is the Web3 RPC URL configuration to use when the user is not connected to a Web3 wallet:

```typescript
const urls = {
  // ethereum-mainnet
  1: '...',
  // ethereum-rinkeby
  4: '...',
  // polygon-mainnet
  137: '...',
  ... etc ...
};
```

`contracts` is the ABI registry for all contracts you want to instantiate on-demand using the `useContract` hook:

```typescript
import { ABI } from '@grexie/web3-react';
import MyERC20Token from './contracts/abis/MyERC20Token.json';

const contracts = {
  MyERC20Token: MyERC20Token as ABI,
};
```

Contract methods are available to call using `useWeb3Query` and calls will be assimilated into a BatchRequest for all simultaneous queries across all components within the JavaScript event loop:

```typescript
import { useWeb3Query } from '@grexie/web3-react';

type BalanceOfResult = BigInt;
type BalanceOfArguments = [string];

const { data, loading, firstLoad, error, refetch } = useWeb3Query<
  BalanceOfResult,
  BalanceOfArguments
>('MyERC20Token', 'balanceOf', {
  arguments: [address],
});
```

You can also pass in a contract instance which allows you optionally to specify an address as a string or specify an object containing multi-chain contract addresses. The address used depends on the currently active Web3 chainId:

```typescript
import { useContract, useWeb3Query } from '@grexie/web3-react';

const MyERC20Token = useContract('MyERC20Token', {
  1: '... ethereum-mainnet address ...',
  4: '... ethereum-rinkeby address ...',
  137: '... ethereum-polygon address ...',
});

const { data } = useWeb3Query(MyERC20Token, 'totalSupply');
```

There is also a helper hook which allows you to spread multiple queries and assign the data to different variables more easily, combining `error`, `loading` and `firstLoad` into one variable.

```typescript
import { useWeb3MultiQuery, useWeb3Query } from '@grexie/web3-react';

const {
  data: [name, symbol, decimals, totalSupply],
  loading,
  firstLoad,
  error,
  refetch,
} = useWeb3MultiQuery(
  useWeb3Query('MyERC20Token', 'name'),
  useWeb3Query('MyERC20Token', 'symbol'),
  useWeb3Query('MyERC20Token', 'decimals'),
  useWeb3Query('MyERC20Token', 'totalSupply')
);
```

You can specify call options such as `from` address, and gas etc using the options argument. You can skip queries by specifying true to the skip option.

```typescript
const { account } = useWeb3();
const { data } = useWeb3Query('MyERC20Token', '...', {
  options: {
    from: account,
  },
  skip: !account,
});
```

The `useWeb3` hook returns the current state and some helpful functions:

```typescript
import { useWeb3 } from '@grexie/web3-react';

const {
  // the Web3 instance currently being used
  web3,

  // the current chainId
  chainId,

  // whether the web3 instance is connected to a wallet
  connected,

  // the account address of the connected wallet
  account,

  // a function you can call to invoke web3 modal / web3 wallet
  // connection
  connect,

  // a function you can call to disconnect the wallet and reset state
  disconnect,

  // pass in a Web3Method (such as those returned by Contract.methods
  // [name].call.request) to enqueue the request with the BatchRequest
  // manager
  request,
} = useWeb3();
```
