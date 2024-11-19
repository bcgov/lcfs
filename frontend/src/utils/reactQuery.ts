import { DefaultError, UseQueryOptions } from '@tanstack/react-query'

export type TQueryOptions<
  TQueryFnReturn = unknown,
  TData = TQueryFnReturn,
  TError = DefaultError
> = Omit<UseQueryOptions<TQueryFnReturn, TError, TData>, 'queryKey' | 'queryFn'>
