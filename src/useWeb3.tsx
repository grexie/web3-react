import React, {
  FC,
  PropsWithChildren,
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
} from 'react';
import Web3Modal from 'web3modal';
import WalletConnectProvider from '@walletconnect/web3-provider';
import Web3 from 'web3';
import { Method as Web3Method } from 'web3-core-method';
import { createComposableWithProps } from '@grexie/compose';

interface Web3Context {
  web3: Web3 | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  account: string | null;
  chainId: number | null;
  connected: boolean;
  request: (method: Web3Method) => void;
}

const PrivateTable = new WeakMap();
const Web3Context = createContext<Web3Context | null>(null);

class BatchRequestQueue {
  constructor() {
    PrivateTable.set(this, { queue: [] });
  }

  get BatchRequest() {
    const { BatchRequest } = PrivateTable.get(this);
    return BatchRequest;
  }

  set BatchRequest(value) {
    PrivateTable.get(this).BatchRequest = value;
    this.process();
  }

  process() {
    const _ = PrivateTable.get(this);
    if (!_.BatchRequest) {
      return;
    }

    clearImmediate(_.immediate);
    _.immediate = setImmediate(() => {
      const methods = _.queue.splice(0, _.queue.length);

      if (!methods.length) {
        return;
      }

      const batch = new _.BatchRequest();
      for (const method of methods) {
        batch.add(method);
      }
      batch.execute();
      console.debug('executing', methods.length, 'requests');
    });
  }

  add(method: Web3Method) {
    const { queue } = PrivateTable.get(this);
    queue.push(method);
    this.process();
  }
}

interface Web3RpcUrls {
  [chain: number]: string;
}

const createWeb3Modal = (urls: Web3RpcUrls) =>
  typeof window !== 'undefined'
    ? new Web3Modal({
        cacheProvider: true,
        providerOptions: {
          walletconnect: {
            package: WalletConnectProvider,
            options: {
              rpc: urls,
            },
          },
        },
        disableInjectedProvider: false,
      })
    : null;

interface Web3ProviderProps {
  defaultChain?: number;
  urls: Web3RpcUrls;
}

const Web3Provider: FC<PropsWithChildren<Web3ProviderProps>> = ({
  defaultChain,
  urls,
  children,
}) => {
  defaultChain = defaultChain ? Number(defaultChain) : undefined;

  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [networkId, setNetworkId] = useState<number | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const web3Modal = useMemo(() => createWeb3Modal(urls), []);

  const batchRequestQueue = useMemo(() => new BatchRequestQueue(), []);

  const reset = useCallback(() => {
    setAccount(null);
    if (defaultChain) {
      setChainId(defaultChain);
      setNetworkId(defaultChain);
      setWeb3(new Web3(new Web3.providers.HttpProvider(urls[defaultChain])));
    } else {
      setChainId(null);
      setNetworkId(null);
      setWeb3(null);
    }
    setConnected(false);
  }, []);

  const subscribe = useCallback(
    (provider, web3) => {
      provider.on('close', reset);
      provider.on('accountsChanged', (accounts: string[]) => {
        setAccount(web3.utils.toChecksumAddress(accounts[0]));
        if (!accounts[0]) {
          reset();
        }
      });
      provider.on('chainChanged', async (chainId: string) => {
        const networkId = await web3.eth.net.getId();
        setChainId(Number(chainId));
        setNetworkId(Number(networkId));
      });
      provider.on('networkChanged', async (networkId: string) => {
        const chainId = await web3.eth.getChainId();
        setChainId(Number(chainId));
        setNetworkId(Number(networkId));
      });
    },
    [reset]
  );

  const connect = useCallback(async () => {
    if (!web3Modal) {
      throw new Error(
        'Web3Modal not instantiated, are you running in a browser?'
      );
    }

    const provider = await web3Modal.connect();
    if (!provider) {
      return;
    }

    const web3 = new Web3(provider);
    setWeb3(web3);

    subscribe(provider, web3);

    const accounts = await web3.eth.getAccounts();
    const account = web3.utils.toChecksumAddress(accounts[0]);
    const networkId = await web3.eth.net.getId();
    const chainId = await web3.eth.getChainId();

    setAccount(account);
    setNetworkId(Number(networkId));
    setChainId(Number(chainId));
    setConnected(true);
  }, [web3Modal, subscribe]);

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (web3Modal && web3Modal.cachedProvider) {
      connect();
    }
  }, [web3Modal, connect]);

  const disconnect = useCallback(async () => {
    web3Modal?.clearCachedProvider?.();
    reset();
  }, [web3Modal, web3, reset]);

  useEffect(() => {
    if (web3) {
      batchRequestQueue.BatchRequest = web3.BatchRequest;
    }
  }, [web3, batchRequestQueue]);

  const context = useMemo(
    () => ({
      web3,
      connect,
      disconnect,
      account,
      chainId,
      connected,
      request: (request: Web3Method) => batchRequestQueue.add(request),
    }),
    [
      web3,
      connect,
      disconnect,
      account,
      networkId,
      chainId,
      connected,
      batchRequestQueue,
    ]
  );

  return (
    <Web3Context.Provider value={context}>{children}</Web3Context.Provider>
  );
};

const withWeb3Provider =
  createComposableWithProps<Web3ProviderProps>(Web3Provider);

const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error(
      'web3 context not initialized, have you wrapped your app with Web3Provider?'
    );
  }
  return context;
};

export { Web3Provider, withWeb3Provider, useWeb3 };
