/**
 * test/vitest/12-item-tags.test.tsx - 项目标签读写链路回归测试
 *
 * 覆盖：
 *   T12-1 编辑项目时能读到已有标签（读链路）
 *   T12-2 Enter 新增标签后保存 → 持久化 tags（写链路）
 *   T12-3 新建项目带标签 → 保存 → 再次打开仍显示
 *   T12-4 输入标签但未按 Enter，直接点保存（失焦提交）→ 不丢失
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Item } from '@/types/models';

const h = vi.hoisted(() => ({
  vault: { version: 1, vaults: [], tags: [], deleted: [], settings: {}, items: [] as any[] },
}));

vi.mock('@/store/vaultStore', async () => {
  const { create } = await import('zustand');
  const core = await import('@/core/vault-store');
  const ipcCall = async (action: string, rawPayload: any) => {
    // 模拟 chrome.runtime.sendMessage 的 JSON 序列化（undefined 字段会被丢弃）
    const payload = rawPayload === undefined ? undefined : JSON.parse(JSON.stringify(rawPayload));
    if (action === 'ITEM_CREATE') {
      const it = core.addItem(h.vault as any, payload as any);
      return { ok: true, data: JSON.parse(JSON.stringify(it)) };
    }
    if (action === 'ITEM_UPDATE') {
      const p: any = { ...payload };
      delete p.id;
      const it = core.updateItem(h.vault as any, payload.id, p);
      return { ok: true, data: JSON.parse(JSON.stringify(it)) };
    }
    return { ok: true, data: {} };
  };
  const useVaultStore: any = create(() => ({
    status: 'UNLOCKED',
    meta: {},
    vaultSnapshot: { ...h.vault },
    sessionId: 's1',
    createItem: async (partial: Partial<Item>) => {
      const r = await ipcCall('ITEM_CREATE', partial);
      const cur = useVaultStore.getState().vaultSnapshot;
      useVaultStore.setState({ vaultSnapshot: { ...cur, items: [r.data, ...cur.items] } });
      return r.data as Item;
    },
    updateItem: async (patch: Partial<Item> & { id: string }) => {
      const r = await ipcCall('ITEM_UPDATE', patch);
      const cur = useVaultStore.getState().vaultSnapshot;
      useVaultStore.setState({ vaultSnapshot: { ...cur, items: cur.items.map((i: Item) => (i.id === r.data.id ? r.data : i)) } });
      return r.data as Item;
    },
    toggleFavorite: async () => ({ ok: true }),
    trashItem: async () => ({ ok: true }),
    restoreItem: async () => ({ ok: true }),
    deleteItemPermanently: async () => ({ ok: true }),
    lockVault: async () => {},
    refreshStatus: async () => {},
  }));
  return { useVaultStore, ipcCall, default: useVaultStore };
});

import { HomeScreen } from '@/screens/HomeScreen';
import { useVaultStore } from '@/store/vaultStore';

const baseItem = (tags: string[]): Item => ({
  id: 'i1',
  vaultId: 'vault-personal',
  category: 'login',
  title: '测试项目',
  tags,
  fields: [
    { id: 'f1', label: '用户名', type: 'text', value: 'user1' },
    { id: 'f2', label: '密码', type: 'password', value: 'Passw0rd!' },
  ],
  urls: [],
  createdAt: 1,
  updatedAt: 1,
  version: 1,
  trashed: false,
});

describe('项目标签读写链路', () => {
  beforeEach(() => {
    h.vault.items = [baseItem(['工作'])];
    (useVaultStore as any).setState({ vaultSnapshot: { ...h.vault, items: [baseItem(['工作'])] } });
  });

  it('T12-1 列表行直接展示标签，打开编辑也能读到已有标签', async () => {
    render(<HomeScreen />);
    // 列表行内已渲染标签（无需打开抽屉）
    expect(await screen.findAllByText('工作')).toBeTruthy();
    fireEvent.click(screen.getByText('测试项目'));
    expect(await screen.findByPlaceholderText('输入标签，按 Enter 新增')).toBeTruthy();
    expect(screen.getAllByText('工作').length).toBeGreaterThan(0);
  });

  it('T12-2 Enter 新增标签后保存，持久化含 tags', async () => {
    render(<HomeScreen />);
    fireEvent.click(await screen.findByText('测试项目'));
    const input = await screen.findByPlaceholderText('输入标签，按 Enter 新增');
    fireEvent.change(input, { target: { value: '重要' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => {
      expect(h.vault.items[0].tags).toEqual(['工作', '重要']);
    });
  });

  it('T12-3 新建项目带标签 → 保存 → 再次打开仍显示', async () => {
    render(<HomeScreen />);
    fireEvent.click(screen.getByTitle('新建项目'));
    fireEvent.change(await screen.findByPlaceholderText('项目标题'), { target: { value: '新项目X' } });
    const tagInput = screen.getByPlaceholderText('输入标签，按 Enter 新增');
    fireEvent.change(tagInput, { target: { value: '工作' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    fireEvent.click(screen.getByText('创建'));
    await waitFor(() => {
      expect(h.vault.items.find((i) => i.title === '新项目X')?.tags).toEqual(['工作']);
    });
    fireEvent.click(await screen.findByText('新项目X'));
    expect(await screen.findByPlaceholderText('输入标签，按 Enter 新增')).toBeTruthy();
    expect(screen.getAllByText('工作').length).toBeGreaterThan(1);
  });

  it('T12-4 输入标签未按 Enter，直接点保存（失焦提交）不丢失', async () => {
    render(<HomeScreen />);
    fireEvent.click(await screen.findByText('测试项目'));
    const input = await screen.findByPlaceholderText('输入标签，按 Enter 新增');
    input.focus();
    fireEvent.change(input, { target: { value: '未回车' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByText('保存'));
    await waitFor(() => {
      expect(h.vault.items[0].tags).toEqual(['工作', '未回车']);
    });
  });
});
