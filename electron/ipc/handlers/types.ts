export type IpcHandler = (payload?: unknown) => Promise<unknown> | unknown;
export type IpcHandlerMap = Record<string, IpcHandler>;

export type LegacyRequest = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
};
