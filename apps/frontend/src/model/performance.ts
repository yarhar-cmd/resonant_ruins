export const performance = {
  now(): number {
    return globalThis.performance?.now() ?? Date.now();
  },
};
