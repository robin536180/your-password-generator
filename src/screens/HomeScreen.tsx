/**
 * screens/HomeScreen.tsx - M2 三栏布局：CategoriesNav + ItemList + Search + AddFab
 *
 * 左栏：24 分类 + 4 特殊分类
 * 中栏：搜索框 + 分类过滤的 Item 列表
 * （中栏右下：浮动 FAB「+」 → 打开 Drawer，Drawer 实现在 Task 3.2 ItemEditorDrawer）
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  Lock, ShieldCheck, Search, Plus, Star, Trash2, Clock, Tag, ChevronRight,
  Globe, CreditCard, UserCircle2, Building2, Car, Plane, Wifi, Ticket, Award,
  Server, Database, KeyRound, Puzzle, FileKey2, ShieldAlert, Stethoscope,
  ShoppingBag, Coins, Mailbox, FileText, FolderInput, BadgeIndianRupee, Sparkles,
  RotateCcw, AlertTriangle, CheckCircle2, XCircle, Info,
} from 'lucide-react';
import { useVaultStore } from '@/store/vaultStore';
import { cn } from '@/lib/utils';
import type { Item, ItemCategory } from '@/types/models';
import { ItemEditorDrawer } from '@/components/ItemEditorDrawer';

/* ---------------- 24 分类配置：emoji + 中文 label ---------------- */
type CategoryMeta = { id: ItemCategory | '__ALL__' | '__FAV__' | '__TRASH__' | '__RECENT__'; label: string; emoji?: string; icon?: any; special?: boolean };

export const CATEGORIES: CategoryMeta[] = [
  /* ---- 4 特殊分类 ---- */
  { id: '__ALL__', label: '全部项目', special: true, icon: Globe },
  { id: '__FAV__', label: '收藏夹', special: true, icon: Star },
  { id: '__TRASH__', label: '回收站', special: true, icon: Trash2 },
  { id: '__RECENT__', label: '最近使用', special: true, icon: Clock },
  /* ---- 24 业务分类（不展示 password-history 内部分类）---- */
  { id: 'login', label: '登录项', icon: Globe },
  { id: 'credit-card', label: '信用卡', icon: CreditCard },
  { id: 'identity', label: '身份信息', icon: UserCircle2 },
  { id: 'bank-account', label: '银行账户', icon: Building2 },
  { id: 'drivers-license', label: '驾驶证', icon: Car },
  { id: 'passport', label: '护照', icon: Plane },
  { id: 'wireless-network', label: 'Wi-Fi 密码', icon: Wifi },
  { id: 'membership', label: '会员卡', icon: Ticket },
  { id: 'reward-card', label: '积分卡', icon: Award },
  { id: 'server', label: '服务器', icon: Server },
  { id: 'database', label: '数据库', icon: Database },
  { id: 'ssh-key', label: 'SSH 密钥', icon: KeyRound },
  { id: 'api-credential', label: 'API 凭证', icon: Puzzle },
  { id: 'software-license', label: '软件许可', icon: FileKey2 },
  { id: 'insurance', label: '保单信息', icon: ShieldAlert },
  { id: 'medical-record', label: '医疗记录', icon: Stethoscope },
  { id: 'outdoor-membership', label: '超市会员', icon: ShoppingBag },
  { id: 'crypto-wallet', label: '加密钱包', icon: Coins },
  { id: 'email-account', label: '邮箱账户', icon: Mailbox },
  { id: 'secure-note', label: '安全备注', icon: FileText },
  { id: 'document', label: '文档', icon: FolderInput },
  { id: 'social-security-number', label: '身份证号', icon: BadgeIndianRupee },
  { id: 'custom', label: '自定义', icon: Sparkles },
];

export const CATEGORY_LABELS: Partial<Record<string, string>> = CATEGORIES.reduce((acc, c) => {
  if (!c.special) acc[c.id as string] = c.label;
  return acc;
}, {} as Partial<Record<string, string>>);

export const CATEGORY_ICON: Record<string, any> = CATEGORIES.reduce((acc, c) => {
  if (c.icon && !c.special) acc[c.id as string] = c.icon;
  return acc;
}, {} as Record<string, any>);

export const CAT_ICON: Record<string, any> = CATEGORIES.reduce((acc, c) => {
  if (c.icon) acc[c.id as string] = c.icon;
  return acc;
}, {} as Record<string, any>);

const useDebouncedValue = <T,>(value: T, delayMs = 300): T => {
  const [val, setVal] = useState<T>(value);
  const t = useRef<number | null>(null);
  React.useEffect(() => {
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setVal(value), delayMs);
    return () => { if (t.current) window.clearTimeout(t.current); };
  }, [value, delayMs]);
  return val;
};

export const HomeScreen: React.FC<{
  onAddItem?: (category?: ItemCategory) => void;
  onEditItem?: (item: Item) => void;
  onViewOptions?: () => void;
}> = ({ onAddItem, onEditItem, onViewOptions }) => {
  const meta = useVaultStore((s) => s.meta);
  const snap = useVaultStore((s) => s.vaultSnapshot);
  const lock = useVaultStore((s) => s.lockVault);
  const sessionId = useVaultStore((s) => s.sessionId);
  const toggleFavorite = useVaultStore((s) => s.toggleFavorite);
  const trashItem = useVaultStore((s) => s.trashItem);
  const restoreItem = useVaultStore((s) => s.restoreItem);
  const deleteItemPermanently = useVaultStore((s) => s.deleteItemPermanently);

  const [activeCatId, setActiveCatId] = useState<string>('__ALL__');
  const [search, setSearch] = useState('');
  const searchDebounced = useDebouncedValue(search, 300);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitCat, setDrawerInitCat] = useState<ItemCategory | undefined>(undefined);
  const [drawerInitItem, setDrawerInitItem] = useState<Item | undefined>(undefined);

  const openCreate = (cat?: ItemCategory) => {
    if (onAddItem) { onAddItem(cat); return; }
    setDrawerInitCat(cat);
    setDrawerInitItem(undefined);
    setDrawerMode('create');
    setDrawerOpen(true);
  };
  const openEdit = (item: Item) => {
    if (onEditItem) { onEditItem(item); return; }
    setDrawerInitCat(undefined);
    setDrawerInitItem(item);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  type ToastKind = 'success' | 'error' | 'warn' | 'info';
  type Toast = { id: number; kind: ToastKind; title: string; detail?: string };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(1);
  const pushToast = (kind: ToastKind, title: string, detail?: string) => {
    const id = toastSeq.current++;
    setToasts((list) => [...list, { id, kind, title, detail }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3500);
  };

  // ⭐ Fix: 之前 snap 或 meta 短暂 null 时会显示吓人的「状态异常…」，现在显示友好的加载中
  if (!snap || !meta) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6 text-slate-400">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-brand-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium animate-pulse">正在加载保管库…</p>
          <p className="text-[11px] text-slate-300">首次打开需要同步明文快照，约 0.2~1 秒</p>
        </div>
      </div>
    );
  }

  const items = snap.items;

  /* -------- 计数（给左侧分类展示数量）-------- */
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) {
      if (it.trashed) continue;
      m[it.category] = (m[it.category] ?? 0) + 1;
    }
    m.__ALL__ = items.filter((i) => !i.trashed).length;
    m.__FAV__ = items.filter((i) => !i.trashed && i.favorite).length;
    m.__TRASH__ = items.filter((i) => i.trashed).length;
    m.__RECENT__ = Math.min(8, m.__ALL__);
    return m;
  }, [items]);

  /* -------- 中栏列表过滤 -------- */
  const list = useMemo(() => {
    let arr = items.slice();
    const isTrash = activeCatId === '__TRASH__';
    if (isTrash) {
      arr = arr.filter((i) => i.trashed);
    } else {
      arr = arr.filter((i) => !i.trashed);
      if (activeCatId === '__FAV__') arr = arr.filter((i) => i.favorite);
      else if (activeCatId === '__RECENT__') arr = arr.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
      else if (activeCatId !== '__ALL__') arr = arr.filter((i) => i.category === (activeCatId as ItemCategory));
    }
    if (searchDebounced.trim()) {
      const kw = searchDebounced.trim().toLowerCase();
      arr = arr.filter((i) =>
        i.title.toLowerCase().includes(kw) ||
        i.fields.some((f) => f.label.toLowerCase().includes(kw) || String(f.value || '').toLowerCase().includes(kw)),
      );
    }
    return arr.sort((a, b) => {
      if (isTrash) return (b.trashedAt ?? 0) - (a.trashedAt ?? 0);
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [items, activeCatId, searchDebounced]);

  const primarySubtitle = (it: Item): string => {
    const firstUsernameField = it.fields.find((f) => /用户名|username|账号|email|邮箱/i.test(f.label) || f.type === 'email');
    if (firstUsernameField && firstUsernameField.value) return String(firstUsernameField.value);
    const firstText = it.fields.find((f) => f.type !== 'password' && f.type !== 'concealed' && f.value);
    if (firstText) return String(firstText.value).slice(0, 40);
    if (it.urls[0]) return it.urls[0];
    return '—';
  };

  const activeCatMeta = CATEGORIES.find((c) => c.id === (activeCatId as any));
  const listHeaderTitle = activeCatMeta?.label ?? '全部项目';
  const isTrash = activeCatId === '__TRASH__';

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900">
      {/* ===== 顶部栏 ===== */}
      <div className="px-3 pt-3 pb-2 bg-gradient-to-br from-brand-500 to-brand-700 text-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/20"><ShieldCheck size={16} /></div>
            <div>
              <p className="text-[10px] opacity-80 leading-tight">已安全解锁</p>
              <p className="text-sm font-semibold leading-tight truncate max-w-[180px]">{meta.accountEmail || '本地保管库'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onViewOptions?.()}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition text-[11px] font-medium hidden"
              title="打开选项页（5 Tab：Home / Items / Tags / Watchtower / Settings）"
            >选项</button>
            <button
              onClick={() => lock()}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition flex items-center gap-1 text-xs font-medium"
              title="锁定保管库（清空内存中的主密钥 DK）"
            ><Lock size={14} /> <span>锁定</span></button>
          </div>
        </div>
      </div>

      {/* ===== 三栏主区 ===== */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ---- 左栏：分类导航 ---- */}
        <aside className="w-[168px] shrink-0 bg-white border-r border-slate-200 flex flex-col min-h-0">
          <div className="px-2.5 pt-2.5 pb-1.5 text-[10px] font-semibold text-slate-500 tracking-wider uppercase">集合</div>
          <nav className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
            {CATEGORIES.map((c) => {
              const active = activeCatId === c.id;
              const count = catCounts[c.id as string] ?? 0;
              const Icon = CAT_ICON[c.id as string];
              const isSpecial = c.special;
              if (!isSpecial && c.id === 'password-history') return null;
              return (
                <button
                  key={c.id as string}
                  onClick={() => setActiveCatId(c.id as string)}
                  className={cn(
                    'w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-[12.5px] transition',
                    active ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-100',
                  )}
                >
                  {Icon ? <Icon size={14} className={cn('shrink-0', active ? 'text-brand-600' : 'text-slate-500')} /> : <Tag size={14} className="text-slate-500 shrink-0" />}
                  <span className="flex-1 truncate">{c.label}</span>
                  {count > 0 && (
                    <span className={cn(
                      'text-[10px] font-medium rounded px-1.5 min-w-[18px] text-center',
                      active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500',
                    )}>{count}</span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="p-2 border-t border-slate-200 text-[10px] text-slate-500 leading-snug">
            会话ID: {sessionId.slice(-8)}
          </div>
        </aside>

        {/* ---- 中栏：搜索 + 列表 ---- */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* 搜索 + 标题 */}
          <div className="px-3.5 pt-3 pb-2 border-b border-slate-200 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-[15px] font-bold text-slate-800 truncate flex-1">{listHeaderTitle}</h2>
              {!isTrash && (
                <span className="text-[11px] text-slate-500 shrink-0">{list.length} 项</span>
              )}
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isTrash ? '搜索回收站中的项目…' : '搜索标题 / 字段 / 网址…'}
                className={cn(
                  'w-full h-8 pl-8 pr-8 text-[12.5px] rounded-md border border-slate-300 bg-slate-50',
                  'focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 text-slate-900 placeholder:text-slate-400',
                )}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium">清空</button>
              )}
            </div>
          </div>

          {/* 列表 */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-white">
            {list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center text-slate-500">
                <Search size={28} className="mb-2 text-slate-300" />
                <p className="text-[12px]">
                  {isTrash ? '回收站是空的' : (searchDebounced ? `没有匹配「${searchDebounced}」的结果` : '这里还没有项目')}
                </p>
                {!isTrash && !searchDebounced && !list.length && (
                  <button
                    onClick={() => openCreate(undefined)}
                    className="mt-3 px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium"
                  >➕ 新建第一条</button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.map((it) => {
                  const I: any = CAT_ICON[it.category] ?? Globe;
                  const doTrash = async (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (!window.confirm(`确定要将「${it.title}」移入回收站吗？30天后会自动永久删除。`)) return;
                    const r = await trashItem(it.id);
                    if (r.ok) pushToast('success', '已移入回收站', it.title);
                    else pushToast('error', '移入回收站失败', r.error ?? r.code);
                  };
                  const doRestore = async (e: React.MouseEvent) => {
                    e.stopPropagation();
                    const r = await restoreItem(it.id);
                    if (r.ok) pushToast('success', '已从回收站恢复', it.title);
                    else pushToast('error', '恢复失败', r.error ?? r.code);
                  };
                  const doDeletePerm = async (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (!window.confirm(`⚠️  永久删除「${it.title}」？\n\n此操作不可逆，删除后无法通过恢复找回。`)) return;
                    const r = await deleteItemPermanently(it.id);
                    if (r.ok) pushToast('success', '已永久删除', it.title);
                    else if (r.code === 'NOT_TRASHED') pushToast('warn', '删除被拒绝', '永久删除前必须先移入回收站（防误删 3 步流程）');
                    else pushToast('error', '永久删除失败', r.error ?? r.code);
                  };
                  return (
                    <li key={it.id}>
                      <button
                        onClick={() => openEdit(it)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-50 transition group"
                      >
                        <div className={cn(
                          'w-8 h-8 shrink-0 rounded-md flex items-center justify-center text-[13px]',
                          it.trashed ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-600',
                        )}>
                          <I size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className={cn('text-[13px] font-semibold truncate', it.trashed ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-800')}>{it.title}</p>
                            {it.favorite && !isTrash && <span className="text-amber-500"><Star size={12} fill="currentColor" /></span>}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{primarySubtitle(it)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!isTrash ? (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleFavorite(it.id); }}
                                className={cn(
                                  'p-1.5 rounded opacity-0 group-hover:opacity-100 transition',
                                  it.favorite ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:bg-slate-100',
                                )}
                                title={it.favorite ? '取消收藏' : '收藏'}
                              >
                                <Star size={14} fill={it.favorite ? 'currentColor' : 'none'} />
                              </button>
                              <button
                                onClick={doTrash}
                                className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                title="移入回收站（30天内可恢复）"
                              >
                                <Trash2 size={14} />
                              </button>
                              <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition shrink-0" />
                            </>
                          ) : (
                            <>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                                30 天内可恢复
                              </span>
                              <button
                                onClick={doRestore}
                                className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                                title="从回收站恢复"
                              >
                                <RotateCcw size={14} />
                              </button>
                              <button
                                onClick={doDeletePerm}
                                className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition text-rose-500 hover:bg-rose-50"
                                title="永久删除（不可恢复）"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* ===== 浮动 FAB：➕ 新建 ===== */}
      {!isTrash && (
        <button
          onClick={() => openCreate(activeCatId && !activeCatId.startsWith('__') ? (activeCatId as ItemCategory) : undefined)}
          className="absolute right-5 bottom-5 w-12 h-12 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/30 flex items-center justify-center transition hover:scale-105"
          title="新建项目"
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {/* ===== Item Editor Drawer ===== */}
      <ItemEditorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        initialCategory={drawerInitCat}
        initialItem={drawerInitItem}
      />

      {/* ===== Toast 容器 ===== */}
      <div className="pointer-events-none absolute top-2 right-2 z-[60] space-y-1.5 w-[280px]">
        {toasts.map((t) => {
          const bg = t.kind === 'success' ? 'bg-emerald-50 border-emerald-200'
            : t.kind === 'error' ? 'bg-rose-50 border-rose-200'
            : t.kind === 'warn' ? 'bg-amber-50 border-amber-200'
            : 'bg-slate-50 border-slate-200';
          const ic = t.kind === 'success' ? CheckCircle2
            : t.kind === 'error' ? XCircle
            : t.kind === 'warn' ? AlertTriangle
            : Info;
          const tx = t.kind === 'success' ? 'text-emerald-700'
            : t.kind === 'error' ? 'text-rose-700'
            : t.kind === 'warn' ? 'text-amber-700'
            : 'text-slate-700';
          const Icon = ic as any;
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto rounded-lg border shadow-md px-2.5 py-2 flex items-start gap-2 animate-in slide-in-from-right',
                bg,
              )}
            >
              <Icon size={15} className={cn('mt-0.5 shrink-0', tx)} />
              <div className="min-w-0 flex-1">
                <p className={cn('text-[12px] font-semibold leading-tight', tx)}>{t.title}</p>
                {t.detail && <p className="text-[10.5px] text-slate-600 mt-0.5 truncate">{t.detail}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
