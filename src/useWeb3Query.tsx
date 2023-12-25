import { useState, useEffect, useCallback, useMemo } from 'react';
import Web3 from 'web3';
import { Contract, CallOptions } from 'web3-eth-contract';
import { Method as Web3Method } from 'web3-core-method';
import { useRefetch } from '@grexie/refetch';
import { useWeb3 } from './useWeb3';
import { ZERO_ADDRESS } from './utils/address';

interface Canceller {
  cancel: boolean;
}

interface Web3QueryResponse<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  firstLoad: boolean;
  refetch: () => Promise<void>;
}

type Web3QueryArguments<T extends unknown[]> = [...T];

type Refetch = (options?: {
  canceller?: Canceller;
  retries?: number;
}) => Promise<void>;

const useWeb3Query = <
  T extends unknown = any,
  V extends Web3QueryArguments<any[]> = any[]
>(
  contract: Contract | Web3 | string,
  method: string,
  {
    arguments: args = [] as unknown as V,
    options = {},
    skip = false,
  }: { arguments?: V; options?: CallOptions; skip?: boolean } = {}
): Web3QueryResponse<T> => {
  const context = useWeb3();

  if (!context) {
    throw new Error(
      `couldn't find context, have you wrapped your App with Web3Provider?`
    );
  }

  const { web3, request } = context;
  const [value, setValue] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [error, setError] = useState<Error>();
  const refetchController = useRefetch();

  const refetch: Refetch = useCallback(
    async ({ canceller, retries = 5 } = {}) => {
      if (skip) {
        return;
      }

      if (!web3 || !contract) {
        return;
      }

      setLoading(true);

      try {
        const value = await new Promise<T>((resolve, reject) => {
          const params = { from: ZERO_ADDRESS, ...options };
          let call: Web3Method;
          if (contract === web3 || contract === 'web3') {
            call = (web3.eth as any)[method].request(
              ...args,
              (err: Error | null, value: any) => {
                if (err) {
                  reject(err);
                  return;
                }

                resolve(value);
              }
            );
          } else {
            call = (contract as Contract).methods[method](...args).call.request(
              params,
              (err: Error | null, value: any) => {
                if (err) {
                  reject(err);
                  return;
                }

                resolve(value);
              }
            );
          }
          request(call);
        });

        if (canceller?.cancel) {
          return;
        }

        setError(undefined);
        setValue(value);
        setLoading(false);
        setFirstLoad(false);
      } catch (err) {
        if (canceller?.cancel) {
          return;
        }

        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return refetch({ canceller, retries: retries - 1 });
        }

        setError(err);
        setValue(undefined);
        setLoading(false);
        setFirstLoad(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      JSON.stringify(args),
      JSON.stringify(options),
      contract,
      method,
      request,
      web3,
      skip,
    ]
  );

  useEffect(() => {
    if (!contract) {
      return;
    }

    if (skip) {
      setLoading(false);
      setFirstLoad(false);
      return;
    }

    const canceller = { cancel: false };
    refetch({ canceller });
    return () => {
      canceller.cancel = true;
    };
  }, [refetch, contract, skip]);

  useEffect(() => {
    if (!refetchController || !contract || skip) {
      return;
    }

    const canceller = { cancel: false };
    const handler = () => refetch({ canceller });
    refetchController.on('refetch', handler);
    return () => {
      refetchController.removeListener('refetch', handler);
      canceller.cancel = true;
    };
  }, [contract, refetchController, refetch, skip]);

  const result = useMemo(
    () => ({ data: value, loading, firstLoad, error, refetch }),
    [value, loading, firstLoad, error, refetch]
  );

  return result;
};

export { useWeb3Query, Web3QueryResponse };
