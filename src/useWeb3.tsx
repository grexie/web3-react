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
import Web3 from 'web3';
import { Method as Web3Method } from 'web3-core-method';
import { createComposableWithProps } from '@grexie/compose';
import { useWeb3Modal, useWeb3ModalProvider } from '@web3modal/ethers5/react';

export interface Web3Metadata {
  name: string;
  description: string;
  url: string;
  icons: string[];
}

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

interface Web3ProviderProps {
  provider?: (chainId: number) => any;
  defaultChain?: number;
  urls: Web3RpcUrls;
  metadata: Web3Metadata;
  projectId: string;
}

const Web3Provider: FC<PropsWithChildren<Web3ProviderProps>> = ({
  provider,
  defaultChain,
  urls,
  projectId,
  metadata,
  children,
}) => {
  defaultChain = defaultChain ? Number(defaultChain) : undefined;
  const web3Modal = useWeb3Modal();
  const { walletProvider } = useWeb3ModalProvider();

  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [networkId, setNetworkId] = useState<number | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  const batchRequestQueue = useMemo(() => new BatchRequestQueue(), []);

  const reset = useCallback(
    async (canceller?: { cancel: boolean }) => {
      setAccount(null);
      if (defaultChain) {
        setChainId(defaultChain);
        setNetworkId(defaultChain);
        const _provider =
          provider?.(defaultChain) ??
          new Web3.providers.HttpProvider(urls[defaultChain]);
        const web3 = new Web3(_provider);
        setWeb3(web3);
        setConnected(false);
        await subscribe(_provider, web3, canceller);
      } else {
        setChainId(null);
        setNetworkId(null);
        setWeb3(null);
        setConnected(false);
      }
    },
    [provider]
  );

  const subscribe = useCallback(
    async (provider, web3, canceller?: { cancel: boolean }) => {
      provider.on?.('close', reset);
      provider.on?.('accountsChanged', (accounts: string[]) => {
        setAccount(web3.utils.toChecksumAddress(accounts[0]));
        if (!accounts[0]) {
          reset();
        }
      });
      provider.on?.('chainChanged', async (chainId: string) => {
        const networkId = await web3.eth.net.getId();
        setChainId(Number(chainId));
        setNetworkId(Number(networkId));
      });
      provider.on?.('networkChanged', async (networkId: string) => {
        const chainId = await web3.eth.getChainId();
        setChainId(Number(chainId));
        setNetworkId(Number(networkId));
      });

      const accounts = await web3.eth.getAccounts();
      const account = web3.utils.toChecksumAddress(accounts[0]);
      const networkId = await web3.eth.net.getId();
      const chainId = await web3.eth.getChainId();

      if (canceller?.cancel) {
        return;
      }

      setAccount(account);
      setNetworkId(Number(networkId));
      setChainId(Number(chainId));
      setConnected(true);
    },
    [reset]
  );

  const connect = useCallback(async () => {
    await web3Modal.open();
    const web3 = new Web3(walletProvider);
    setWeb3(web3);

    await subscribe(provider, web3);
  }, [projectId, metadata, subscribe, connected]);

  useEffect(() => {
    let canceller = { cancel: false };

    reset(canceller).catch(err => console.error(err));

    return () => {
      canceller.cancel = true;
    };
  }, [reset, provider]);

  useEffect(() => {
    if (connected) {
      return;
    }

    const immediate = setImmediate(() => {
      connect();
    });

    return () => {
      clearImmediate(immediate);
    };
  }, [connect, connected]);

  const disconnect = useCallback(async () => {
    reset();
  }, [web3, reset]);

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
