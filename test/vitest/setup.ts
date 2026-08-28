/**
 * test/vitest/setup.ts - Vitest jsdom 环境准备
 *   - 配置 chrome.storage.local (内存 mock)
 *   - 配置 chrome.runtime.sendMessage (空 mock，UI 层测试才需要断言)
 */

interface StorageAreaMock {
  _data: Record<string, any>;
  get: (keys: string | string[] | null) => Promise<Record<string, any>>;
  set: (items: Record<string, any>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
}
const makeStorage = (): StorageAreaMock => ({
  _data: {},
  async get(keys) {
    if (keys === null) return { ...this._data };
    const arr = Array.isArray(keys) ? keys : [keys];
    const out: Record<string, any> = {};
    arr.forEach((k) => { if (k in this._data) out[k] = this._data[k]; });
    return out;
  },
  async set(items) { Object.assign(this._data, items); },
  async remove(keys) {
    const arr = Array.isArray(keys) ? keys : [keys];
    arr.forEach((k) => delete this._data[k]);
  },
  async clear() { this._data = {}; },
});

if (typeof (globalThis as any).chrome === 'undefined') (globalThis as any).chrome = {};
if (!(globalThis as any).chrome.storage) (globalThis as any).chrome.storage = {};
if (!(globalThis as any).chrome.storage.local) (globalThis as any).chrome.storage.local = makeStorage();
if (!(globalThis as any).chrome.alarms) {
  (globalThis as any).chrome.alarms = {
    _timers: new Map<string, { period?: number; when?: number }>(),
    create(name: string, opts: any) { this._timers.set(name, opts); },
    onAlarm: { addListener() {} },
  };
}
if (!(globalThis as any).chrome.runtime) {
  (globalThis as any).chrome.runtime = {
    sendMessage: async (_m: any) => ({ ok: false, error: 'NO_BG_IN_TEST' }),
  };
}

export {};
