import { Web3QueryResponse } from './useWeb3Query';

type Web3MultiQueryData<Q extends Web3QueryResponse<any>[]> = {
  [K in keyof Q]: Q[K] extends Web3QueryResponse<infer T>
    ? T | undefined
    : never;
};

const useWeb3MultiQuery = <Q extends Web3QueryResponse<any>[]>(
  ...queries: Q
): Web3QueryResponse<Web3MultiQueryData<Q>> => {
  const data = queries.map(({ data }) => data) as Web3MultiQueryData<Q>;
  const error = queries.reduce((a, b) => a || b.error, undefined);
  const loading = queries.reduce((a, b) => a || b.loading, false);
  const firstLoad = queries.reduce((a, b) => a || b.firstLoad, false);
  const refetch = async () => {
    await Promise.all(queries.map(query => query.refetch()));
  };
  return { data, error, loading, firstLoad, refetch };
};

export { useWeb3MultiQuery };
