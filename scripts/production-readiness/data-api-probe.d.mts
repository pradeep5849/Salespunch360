export function probeDataApi(input: {
  url: string;
  key?: string;
  fetcher?: typeof fetch | ((...args: unknown[]) => Promise<unknown>);
}): Promise<{
  http_status: number;
  database_error_code?: string;
  classification: string;
  records_requested: number;
  production_writes: boolean;
}>;
