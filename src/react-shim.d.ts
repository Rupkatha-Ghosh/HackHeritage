declare module 'react' {
  namespace React {
    type ReactNode = unknown;
    type ElementType = any;
    type Ref<T> = any;
    type FC<P = {}> = (props: P) => any;
    type FunctionComponent<P = {}> = FC<P>;
    type ChangeEvent<T = any> = { target: T };
    type FormEvent<T = any> = { preventDefault(): void; currentTarget: T; target: T };
    type MouseEvent<T = any> = { currentTarget: T; target: T; preventDefault(): void; stopPropagation(): void };
    type KeyboardEvent<T = any> = { currentTarget: T; target: T; key: string; preventDefault(): void };
  }
  const React: typeof React;
  export default React;
  export type ReactNode = React.ReactNode;
  export type ElementType = React.ElementType;
  export type Ref<T> = React.Ref<T>;
  export type FC<P = {}> = React.FC<P>;
  export type FunctionComponent<P = {}> = React.FunctionComponent<P>;
  export type ChangeEvent<T = any> = React.ChangeEvent<T>;
  export type FormEvent<T = any> = React.FormEvent<T>;
  export type MouseEvent<T = any> = React.MouseEvent<T>;
  export type KeyboardEvent<T = any> = React.KeyboardEvent<T>;
  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prev: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function useContext<T>(context: any): T;
  export function createContext<T>(defaultValue: T): any;
  export function forwardRef<T = any, P = any>(render: any): any;
  export const Fragment: any;
}

declare module 'react/jsx-runtime' {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
}

declare module '*.css' {
  const value: string;
  export default value;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
