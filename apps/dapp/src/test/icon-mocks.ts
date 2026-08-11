/**
 * Stands in for the whole `@zivoe/ui/icons` barrel in vitest suites (raw UI
 * TSX does not transform in this environment, so every suite whose graph
 * reaches the barrel must mock it). Total on purpose: ANY icon name resolves
 * to a null component, so neither a new Zivoe Vault logo nor a newly imported
 * icon can break an unrelated suite with React's opaque "Element type is
 * invalid" — the failure mode the earlier hand-maintained whitelists had.
 *
 * Usage: vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
 */
const NullIcon = () => null;

// `then` would make the namespace thenable and hang dynamic-import interop;
// `__esModule` must stay unset so the object is used as the namespace itself;
// symbols are metadata probes, not icons.
const isIconName = (prop: string | symbol): prop is string =>
  typeof prop === 'string' && prop !== 'then' && prop !== '__esModule' && prop !== 'default';

export const ICON_BARREL_MOCK = new Proxy<Record<string, typeof NullIcon>>(
  {},
  {
    get: (_target, prop) => (isIconName(prop) ? NullIcon : undefined),
    // Vitest verifies a named export exists on the mock before binding it.
    has: (_target, prop) => isIconName(prop),
    getOwnPropertyDescriptor: (_target, prop) =>
      isIconName(prop) ? { configurable: true, enumerable: true, value: NullIcon, writable: true } : undefined
  }
);
