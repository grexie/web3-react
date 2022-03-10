import React, {
  FC,
  useMemo,
  createContext,
  useContext,
  PropsWithChildren,
} from 'react';
import { useWeb3 } from './useWeb3';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import { createComposableWithProps } from '@grexie/compose';

export type ABI = AbiItem[] | AbiItem;

export interface Contracts {
  [name: string]: ABI;
}

interface ContractContext {
  contracts: Contracts;
  cache: {
    [name: string]: {
      [address: string]: Contract;
    };
  };
}

interface ContractProviderProps {
  contracts: Contracts;
}

type ContractAddress =
  | {
      [chainId: string]: string;
    }
  | string;

const ContractContext = createContext<ContractContext>({
  contracts: {},
  cache: {},
});

const ContractProvider: FC<PropsWithChildren<ContractProviderProps>> = ({
  contracts,
  children,
}) => {
  const { web3 } = useWeb3();

  const context = useMemo(
    () => ({ contracts, cache: {} }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [web3]
  );

  return (
    <ContractContext.Provider value={context}>
      {children}
    </ContractContext.Provider>
  );
};

const withContractProvider =
  createComposableWithProps<ContractProviderProps>(ContractProvider);

const useContract = (name: string, address: ContractAddress) => {
  const { web3, chainId } = useWeb3();
  const { contracts, cache } = useContext(ContractContext);

  if (!web3 || !chainId) {
    return null;
  }

  if (typeof address === 'object' && address !== null) {
    address = address[chainId];
  }

  if (!address) {
    return null;
  }

  address = (address as string).toLowerCase();

  if (!contracts[name]) {
    return null;
  }

  if (!cache[name]) {
    cache[name] = {};
  }

  if (!cache[name][address]) {
    cache[name][address] = new web3.eth.Contract(contracts[name], address);
  }

  return cache[name][address];
};

export { ContractProvider, withContractProvider, useContract };
