/**
 * options/App.tsx - Options 管理页（5 Tab：首页/项目/标签/瞭望塔/设置）
 *
 * OQ2 默认：5 Tab 独立 Watchtower Tab ✅
 * OQ3 默认：全中文 Label + emoji ✅
 */
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Shield, Layers, Tag, Eye, Settings2, Database,
  KeyRound, ShieldCheck, ShieldAlert, Unlink, Globe2, CalendarClock,
  ChevronRight, Search, FolderOpen, Download, Upload, FileKey2, AlertTriangle,
  Edit3,
} from 'lucide-react';
import { ItemEditorDrawer } from '@/components/ItemEditorDrawer';
import { useVaultStore } from '@/store/vaultStore';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { UnlockScreen } from '@/screens/UnlockScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { Log, type LogEntry } from '@/core/logger';
import { scanWatchtower } from '@/core/watchtower';
import type { WatchtowerIssueKey, WatchtowerReport } from '@/core/watchtower';
import { cn } from '@/lib/utils';
import { CATEGORY_LABELS, CAT_ICON } from '@/screens/HomeScreen';
import type { Item } from '@/types/models';

export type OptionsTab = 'home' | 'items' | 'tags' | 'watchtower' | 'settings';

export const OptionsApp: React.FC = () => {
  const status = useVaultStore((s) => s.status);
  const refresh = useVaultStore((s) => s.refreshStatus);
  const snap = useVaultStore((s) => s.vaultSnapshot);
  const [tab, setTab] = useState<OptionsTab>('home');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    setLogs(Log.getBuffer().slice().reverse());
    const i = setInterval(() => setLogs(Log.getBuffer().slice().reverse()), 1000);
    return () => clearInterval(i);
  }, []);

  const watchtowerReport: WatchtowerReport = useMemo(
    () => scanWatchtower(snap?.items ?? []),
    [snap?.items],
  );

  const totalItems = snap?.items?.filter((i) => !i.trashed).length ?? 0;
  const trashedCount = snap?.items?.filter((i) => i.trashed).length ?? 0;
  const favCount = snap?.items?.filter((i) => !i.trashed && i.favorite).length ?? 0;
  const totalFields = snap?.items?.reduce((acc, it) => acc + (it.fields?.length ?? 0), 0) ?? 0;

  const Tabs: { key: OptionsTab; label: string; Icon: any; badge?: string }[] = [
    { key: 'home', label: '首页', Icon: Shield },
    { key: 'items', label: '项目', Icon: Layers, badge: totalItems > 0 ? `${totalItems}` : undefined },
    { key: 'tags', label: '标签', Icon: Tag },
    {
      key: 'watchtower',
      label: '瞭望塔',
      Icon: Eye,
      badge: (() => {
        const n = (watchtowerReport.weak.length + watchtowerReport.reused.length + watchtowerReport.notHttps.length + watchtowerReport.outdated.length);
        return n > 0 ? `${n}` : undefined;
      })(),
    },
    { key: 'settings', label: '设置', Icon: Settings2 },
  ];

  if (status === 'UNINITIALIZED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <div className="w-full max-w-md shadow-2xl rounded-3xl overflow-hidden bg-white border border-slate-200">
          <RegisterScreen onDone={() => refresh()} />
        </div>
      </div>
    );
  }
  if (status === 'LOCKED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8">
        <div className="w-full max-w-md shadow-2xl rounded-3xl overflow-hidden bg-white border border-slate-200">
          <UnlockScreen onGoRegister={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-10 bg-gradient-to-r from-brand-700 to-brand-500 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-white/20"><KeyRound size={24} /></div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">1Pass Clone · 管理中心</h1>
            <p className="text-xs opacity-90">M2 完整 CRUD 版本 · AES-256-GCM · 零知识本地加密 · PBKDF2 65 万次</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-emerald-500/90 text-xs font-semibold flex items-center gap-1">
              <ShieldCheck size={12}/> 已解锁
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {Tabs.map(({ key, label, Icon, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'px-4 py-2.5 text-sm font-semibold rounded-t-xl transition flex items-center gap-2 mb-0 relative',
                tab === key ? 'bg-slate-50 text-brand-700' : 'text-white/90 hover:bg-white/10',
              )}
            >
              <Icon size={16} /> {label}
              {badge && (
                <span className={cn(
                  'min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
                  tab === key ? 'bg-brand-500 text-white' : 'bg-white/90 text-brand-700',
                )}>{badge}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {tab === 'home' && (
          <div className="space-y-6">
            {/* 4 张概览卡 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard Icon={Layers} label="总项目数" value={`${totalItems}`} sub={`${favCount} 收藏`} color="brand" />
              <StatCard Icon={FolderOpen} label="字段数" value={`${totalFields}`} sub={`平均 ${totalItems ? Math.round(totalFields / totalItems) : 0}/项`} color="violet" />
              <StatCard Icon={ShieldAlert} label="风险项" value={`${Math.min(999, watchtowerReport.weak.length + watchtowerReport.reused.length + watchtowerReport.notHttps.length + watchtowerReport.outdated.length)}`} sub="点瞭望塔查看详情" color="rose" />
              <StatCard Icon={Database} label="回收站" value={`${trashedCount}`} sub="30 天后自动永久删除" color="amber" />
            </div>

            <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
              <div className="space-y-6">
                {/* 瞭望塔快速预览 */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><Eye size={16}/> 瞭望塔 · 快速概览</h3>
                    <button onClick={() => setTab('watchtower')} className="text-[12px] text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-0.5">前往详情 <ChevronRight size={13}/></button>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <RiskMiniCard keyName="weak" label="弱密码" count={watchtowerReport.weak.length} color="rose" Icon={ShieldAlert} />
                    <RiskMiniCard keyName="reused" label="复用密码" count={watchtowerReport.reused.length} color="amber" Icon={Unlink} />
                    <RiskMiniCard keyName="notHttps" label="未加密 HTTP" count={watchtowerReport.notHttps.length} color="orange" Icon={Globe2} />
                    <RiskMiniCard keyName="outdated" label="陈旧密码" count={watchtowerReport.outdated.length} color="violet" Icon={CalendarClock} />
                  </div>
                </section>

                {/* 导入导出 */}
                <section id="import-export-section" className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                    <FileKey2 size={16} className="text-brand-600"/>
                    <h3 className="font-bold text-slate-700">加密备份 · 导入 / 导出（AES-256-GCM）</h3>
                  </div>
                  <div className="p-5">
                    <ImportExportPanel />
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2"><Database size={16} /> storage 零知识检查</h3>
                  <p className="text-xs text-slate-500 mt-1">验证 chrome.storage.local 仅含 <code>__1p_meta__</code>（明文元）+ <code>__1p_vault_cipher__</code>（AES-GCM Base64 密文）两个 key，绝不保留主密码/衍生密钥。</p>
                  <button
                    className="mt-3 px-4 py-2 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition text-sm flex items-center gap-2"
                    onClick={async () => {
                      const data = await chrome.storage.local.get(null);
                      alert(
                        'storage.local 中的所有 key：\n\n' +
                        Object.keys(data).map((k) => `  · ${k} = ${typeof data[k] === 'string' ? `字符串(len=${data[k].length})` : typeof data[k]}`).join('\n') +
                        '\n\n零知识检查：storage 中绝对没有主密码明文 / DK / Secret Key 明文。'
                      );
                    }}
                  >
                    <Shield size={16}/> 检查 storage.local 内容
                  </button>
                </section>

                <section className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2"><Database size={16} /> 安全参数（不可变）</h3>
                  <div className="mt-2 text-xs space-y-1.5 text-slate-600">
                    <p>🔒 PBKDF2 迭代次数：<b className="font-mono">650,000</b> 次（不可修改）</p>
                    <p>🔒 AES-256-GCM：<b>每次加密换 12B 随机 IV</b>（不可配置）</p>
                    <p>🔒 DK 永远只活在 Background SW 闭包：<code>let __dk__</code></p>
                    <p>🔒 storage 仅 2 个 key：<code>__1p_meta__</code> + <code>__1p_vault_cipher__</code></p>
                    <p>🔒 <code>v1.1 popup.js / popup.css / popup.html</code> 根目录三件套 0 行修改 ✅</p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {tab === 'items' && (
          <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-sm bg-white h-[calc(100vh-210px)] min-h-[640px]">
            <HomeScreen onViewOptions={() => setTab('watchtower')} />
          </div>
        )}

        {tab === 'tags' && (
          <TagsPanel reportRef={watchtowerReport} />
        )}

        {tab === 'watchtower' && (
          <WatchtowerPanel report={watchtowerReport} />
        )}

        {tab === 'settings' && (
          <SettingsPanel logs={logs} onRefreshLogs={() => setLogs(Log.getBuffer().slice().reverse())} onClearLogs={() => { Log.clearBuffer(); setLogs([]); }} />
        )}
      </main>
    </div>
  );
};

/* ============== StatCard ============== */
const StatCard: React.FC<{
  label: string; value: string; sub?: string;
  color: 'brand' | 'rose' | 'amber' | 'violet';
  Icon: any;
}> = ({ label, value, sub, color, Icon }) => {
  const cmap = {
    brand:    'from-brand-50 to-brand-100/60 text-brand-700 border-brand-100',
    rose:     'from-rose-50 to-rose-100/60 text-rose-700 border-rose-100',
    amber:    'from-amber-50 to-amber-100/60 text-amber-700 border-amber-100',
    violet:   'from-violet-50 to-violet-100/60 text-violet-700 border-violet-100',
  } as const;
  return (
    <div className={cn('rounded-2xl border p-4 flex items-start gap-3 bg-gradient-to-br', cmap[color])}>
      <div className="p-2 rounded-xl bg-white/60 shadow-sm"><Icon size={18}/></div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold opacity-80 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold mt-0.5 leading-tight truncate">{value}</p>
        {sub && <p className="text-[10.5px] opacity-75 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
};

/* ============== RiskMiniCard ============== */
const RiskMiniCard: React.FC<{ keyName: WatchtowerIssueKey; label: string; count: number; color: 'rose'|'amber'|'orange'|'violet'; Icon: any }> = ({ keyName: _keyName, label, count, color, Icon }) => {
  const ring = { rose:'bg-rose-500', amber:'bg-amber-500', orange:'bg-orange-500', violet:'bg-violet-500'}[color];
  const textC = { rose:'text-rose-600', amber:'text-amber-600', orange:'text-orange-600', violet:'text-violet-600'}[color];
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-center gap-2.5">
      <div className={cn('p-2 rounded-lg text-white shadow-sm', ring)}><Icon size={15} /></div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[11px] font-semibold', textC)}>{label}</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight">{count}</p>
      </div>
    </div>
  );
};

/* ============== TagsPanel ============== */
const TagsPanel: React.FC<{ reportRef: WatchtowerReport }> = () => {
  const snap = useVaultStore((s) => s.vaultSnapshot);
  const [q, setQ] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const items = snap?.items ?? [];
  const notTrashed = items.filter((i) => !i.trashed);
  const tagToCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of notTrashed) for (const t of it.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [notTrashed]);
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const withTag = activeTag ? notTrashed.filter((i) => (i.tags ?? []).includes(activeTag)) : notTrashed;
    return ql ? withTag.filter((it) => it.title.toLowerCase().includes(ql) || (it.tags ?? []).join(',').toLowerCase().includes(ql)) : withTag;
  }, [q, activeTag, notTrashed]);
  return (
    <div className="grid lg:grid-cols-[260px,1fr] gap-5">
      <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3 h-fit">
        <div className="px-2 pb-2 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">所有标签</h3>
          <span className="text-[10.5px] text-slate-400">{tagToCount.length} 个</span>
        </div>
        <div className="p-2 flex flex-wrap gap-1.5">
          <button onClick={() => setActiveTag(null)} className={cn(
            'px-2.5 py-1 rounded-full text-[11px] font-medium transition',
            activeTag === null ? 'bg-brand-500 text-white shadow shadow-brand-500/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
          )}>
            全部 · {notTrashed.length}
          </button>
          {tagToCount.length === 0 && (
            <p className="text-[11.5px] text-slate-400 px-1">还没有任何标签，编辑项目时按 Enter 新增 Tag。</p>
          )}
          {tagToCount.map(([tag, n]) => (
            <button key={tag} onClick={() => setActiveTag((prev) => (prev === tag ? null : tag))} className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-medium transition flex items-center gap-1',
              activeTag === tag ? 'bg-brand-500 text-white shadow shadow-brand-500/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )}>
              <Tag size={11}/> {tag} <span className={cn('ml-0.5 opacity-75', activeTag === tag ? 'text-white' : 'text-slate-500')}>{n}</span>
            </button>
          ))}
        </div>
      </aside>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
          <Search size={14} className="text-slate-400"/>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={activeTag ? `在标签「${activeTag}」中搜索…` : '搜索项目标题或标签…'}
            className="flex-1 outline-none bg-transparent text-[12.5px] placeholder:text-slate-400 py-1"/>
          <span className="text-[11px] text-slate-400">{filtered.length} 项</span>
        </div>
        <div className="divide-y divide-slate-100 max-h-[calc(100vh-280px)] overflow-auto">
          {filtered.length === 0 && (
            <div className="py-10 text-center text-slate-400 text-[12px]">暂无匹配项</div>
          )}
          {filtered.map((it) => {
            const I: any = CAT_ICON[it.category] ?? FolderOpen;
            const sub = it.fields.find((f) => ['用户名', '邮箱地址', '电子邮箱'].includes(f.label) || f.type === 'email')?.value ??
              it.urls[0] ?? '';
            return (
              <div key={it.id} className="px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><I size={15}/></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-800 truncate flex items-center gap-1.5">
                    {it.title}
                    {it.favorite && <span className="text-amber-500"><Eye size={11} strokeWidth={3}/></span>}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{sub}</p>
                </div>
                <span className="text-[10.5px] text-slate-400 shrink-0">{CATEGORY_LABELS[it.category]}</span>
                <ChevronRight size={14} className="text-slate-300 shrink-0"/>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

/* ============== WatchtowerPanel ============== */
const WatchtowerPanel: React.FC<{ report: WatchtowerReport }> = ({ report }) => {
  const snap = useVaultStore((s) => s.vaultSnapshot);
  const [filter, setFilter] = useState<WatchtowerIssueKey | 'all'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerInitItem, setDrawerInitItem] = useState<Item | undefined>(undefined);
  const items: Item[] = snap?.items ?? [];
  const itemMap = new Map(items.map((i) => [i.id, i] as const));
  const tabs: { key: WatchtowerIssueKey | 'all'; label: string; Icon: any; count: number; color: 'rose'|'amber'|'orange'|'violet'|'slate' }[] = [
    { key: 'all',      label: '全部风险', Icon: AlertTriangle, count: report.weak.length + report.reused.length + report.notHttps.length + report.outdated.length, color: 'slate' },
    { key: 'weak',     label: '弱密码',   Icon: ShieldAlert, count: report.weak.length,     color: 'rose' },
    { key: 'reused',   label: '复用密码', Icon: Unlink,      count: report.reused.length,   color: 'amber' },
    { key: 'notHttps', label: '未加密 HTTP', Icon: Globe2,    count: report.notHttps.length, color: 'orange' },
    { key: 'outdated', label: '陈旧密码', Icon: CalendarClock, count: report.outdated.length, color: 'violet' },
  ];
  const mergedList = useMemo(() => {
    const build = (k: WatchtowerIssueKey) => report[k].map((i) => ({ ...i, kind: k }));
    const all = [
      ...build('weak'), ...build('reused'), ...build('notHttps'), ...build('outdated'),
    ] as any[];
    return filter === 'all' ? all : all.filter((x) => x.kind === filter);
  }, [report, filter]);
  const kindMeta = (k: WatchtowerIssueKey) => {
    if (k === 'weak')     return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: '弱密码', dot: 'bg-rose-500' };
    if (k === 'reused')   return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: '复用密码', dot: 'bg-amber-500' };
    if (k === 'notHttps') return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: '未加密 HTTP', dot: 'bg-orange-500' };
    return { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', label: '陈旧密码', dot: 'bg-violet-500' };
  };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tabs.map((t) => {
          const color = t.color === 'slate' ? undefined : t.color;
          return (
            <button key={t.key} onClick={() => setFilter(t.key)} className={cn(
              'text-left rounded-2xl border p-3 transition shadow-sm',
              filter === t.key ? 'ring-2 ring-brand-400 border-brand-200 bg-white' : 'bg-white border-slate-200 hover:border-slate-300',
            )}>
              <div className="flex items-center justify-between">
                <div className={cn('p-1.5 rounded-lg',
                  color === 'rose' ? 'bg-rose-100 text-rose-700' :
                  color === 'amber' ? 'bg-amber-100 text-amber-700' :
                  color === 'orange' ? 'bg-orange-100 text-orange-700' :
                  color === 'violet' ? 'bg-violet-100 text-violet-700' :
                  'bg-slate-100 text-slate-700')}>
                  <t.Icon size={14}/>
                </div>
                <span className="text-2xl font-bold text-slate-800">{t.count}</span>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-1.5">{t.label}</p>
            </button>
          );
        })}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-700">
            {filter === 'all' ? '所有风险项' : `${kindMeta(filter as WatchtowerIssueKey).label} · ${mergedList.length}`}
          </h3>
          <p className="text-[11px] text-slate-400">扫描 {report.totalItemsScanned} 项 / {report.totalPasswordsScanned} 密码 · 耗时 {report.scanMs}ms</p>
        </div>
        <div className="max-h-[calc(100vh-360px)] overflow-auto divide-y divide-slate-100">
          {mergedList.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-[12px]">
              <ShieldCheck size={36} className="mx-auto mb-2 text-emerald-500 opacity-70"/>
              <p className="font-semibold text-slate-500">✅ 当前筛选下没有风险</p>
              <p className="mt-1 text-slate-400">密码强度良好，没有复用、未加密 HTTP 或陈旧密码。</p>
            </div>
          )}
          {mergedList.map((row, i) => {
            const it = itemMap.get(row.itemId);
            if (!it) return null;
            const I: any = CAT_ICON[it.category] ?? FolderOpen;
            const km = kindMeta(row.kind as WatchtowerIssueKey);
            const openEdit = (e: React.MouseEvent) => { e.stopPropagation(); setDrawerInitItem(it); setDrawerOpen(true); };
            return (
              <div key={`${row.itemId}-${i}`} onClick={openEdit} className="px-5 py-3 hover:bg-slate-50 flex items-center gap-3 cursor-pointer group">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', km.bg, km.text, 'border', km.border)}>
                  <I size={15}/>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{it.title}</p>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1', km.bg, km.text)}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', km.dot)}></span> {km.label}
                    </span>
                    {it.favorite && <span className="text-amber-500"><AlertTriangle size={10}/></span>}
                  </div>
                  <p className="text-[11.5px] text-slate-600 mt-0.5 truncate">{row.reason}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <span className="text-[10.5px] text-slate-400">{CATEGORY_LABELS[it.category]}</span>
                  <button onClick={openEdit} className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-md hover:bg-white hover:shadow-sm flex items-center justify-center text-slate-500 hover:text-brand-600 transition" title="编辑项目">
                    <Edit3 size={13}/>
                  </button>
                  <ChevronRight size={14} className="text-slate-300"/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ItemEditorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode="edit"
        initialItem={drawerInitItem}
      />
    </div>
  );
};

/* ============== ImportExportPanel ============== */
const ImportExportPanel: React.FC = () => {
  const exportVault = useVaultStore((s) => s.exportVault);
  const importVault = useVaultStore((s) => s.importVault);
  const snap = useVaultStore((s) => s.vaultSnapshot);
  const meta = useVaultStore((s) => s.meta);

  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [mp, setMp] = useState('');
  const [strategy, setStrategy] = useState<'keep-new' | 'keep-old' | 'duplicate-both'>('keep-new');
  const [working, setWorking] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ kind: 'success' | 'error' | 'warn' | 'info'; msg: string; detail?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const exportNow = async () => {
    if (!mp) { setStatusMsg({ kind: 'warn', msg: '请输入主密码（用于导出 AES-GCM 加密）' }); return; }
    setWorking(true); setStatusMsg(null);
    try {
      const r = await exportVault();
      if (!r.ok || !r.data) { setStatusMsg({ kind: 'error', msg: '导出失败', detail: r.error ?? r.code }); return; }
      const bytes = Uint8Array.from(atob(r.data.blobB64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/json' });
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url; a.download = r.data.fileName;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      setStatusMsg({ kind: 'success', msg: `✅ 导出成功：${r.data.fileName}`, detail: `大小 ${(r.data.sizeBytes / 1024).toFixed(2)} KB（AES-256-GCM 加密）` });
    } catch (e) {
      setStatusMsg({ kind: 'error', msg: '导出异常', detail: String(e) });
    } finally { setWorking(false); }
  };

  const readFileAndImport = async (f: File) => {
    if (!mp) { setStatusMsg({ kind: 'warn', msg: '请输入主密码（验证备份并解密）' }); return; }
    setWorking(true); setStatusMsg({ kind: 'info', msg: `读取备份文件：${f.name}…` });
    try {
      const arrbuf = await f.arrayBuffer();
      const bs = new Uint8Array(arrbuf);
      const bs64 = btoa(String.fromCharCode(...bs));
      const r = await importVault(bs64, mp, strategy);
      if (r.ok && r.data) {
        setStatusMsg({
          kind: 'success',
          msg: `✅ 导入完成（策略：${strategy}）`,
          detail: `共 ${r.data.totalInBackup} 条 → 新增 ${r.data.added} · 跳过 ${r.data.skipped} · 冲突 ${r.data.conflicted}`,
        });
      } else {
        const c = r.code;
        if (c === 'BAD_MASTER_PASSWORD') setStatusMsg({ kind: 'error', msg: '❌ 主密码错误，无法解密备份', detail: '请确认输入的是创建备份时所用的同一主密码。' });
        else if (c === 'DECRYPT_FAILED') setStatusMsg({ kind: 'error', msg: '❌ 解密失败（AuthTag 校验不通过）', detail: '备份文件可能已被篡改或损坏；已按事务回滚。' });
        else if (c === 'BACKUP_FORMAT_INVALID') setStatusMsg({ kind: 'error', msg: '❌ 备份文件格式无效', detail: '缺少 schemaVersion / saltHex / cipherB64 等必要字段。' });
        else setStatusMsg({ kind: 'error', msg: '❌ 导入失败', detail: r.error ?? c ?? '未知错误' });
      }
    } catch (e) {
      setStatusMsg({ kind: 'error', msg: '❌ 导入异常（已按事务回滚）', detail: String(e) });
    } finally { setWorking(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button onClick={() => setMode('export')} className={cn(
          'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition flex items-center gap-1.5',
          mode === 'export' ? 'bg-white text-brand-700 shadow' : 'text-slate-600 hover:text-slate-800',
        )}><Download size={13}/> 导出</button>
        <button onClick={() => setMode('import')} className={cn(
          'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition flex items-center gap-1.5',
          mode === 'import' ? 'bg-white text-brand-700 shadow' : 'text-slate-600 hover:text-slate-800',
        )}><Upload size={13}/> 导入</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-[11.5px] font-semibold text-slate-600">主密码（{mode === 'export' ? '加密备份：请输入当前主密码' : '解密备份：请输入备份时的主密码'}）</span>
          <input type="password" value={mp} onChange={(e) => setMp(e.target.value)}
            placeholder={mode === 'export' ? '输入当前主密码以加密…' : '输入备份时主密码…'}
            disabled={working}
            className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 text-[12.5px] font-mono"/>
        </label>
        <label className="block">
          <span className="text-[11.5px] font-semibold text-slate-600">当前账户信息</span>
          <div className="mt-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600 space-y-0.5">
            <p>邮箱：<span className="font-mono text-slate-800">{meta?.accountEmail ?? '—'}</span></p>
            <p>Secret Key（掩码）：<span className="font-mono text-slate-800">{meta?.secretKeyMasked ?? '—'}</span></p>
            <p>项目：<b>{snap?.items.length ?? 0}</b> 条 · 分类 <b>{new Set((snap?.items ?? []).map((i) => i.category)).size}</b> 种</p>
          </div>
        </label>
      </div>

      {mode === 'import' && (
        <div>
          <p className="text-[11.5px] font-semibold text-slate-600 mb-1.5">冲突策略（遇到相同 ID 项目时）</p>
          <div className="grid md:grid-cols-3 gap-2">
            {[
              { k: 'keep-new' as const, label: '保留新的（跳过备份）', desc: '不导入重复的旧数据', Icon: Upload },
              { k: 'keep-old' as const, label: '替换（用备份覆盖）', desc: '强制覆盖本地当前值', Icon: Download },
              { k: 'duplicate-both' as const, label: '复制（两边都保留）', desc: '给备份副本分配新 ID', Icon: FileKey2 },
            ].map((o) => (
              <button key={o.k} onClick={() => setStrategy(o.k)} className={cn(
                'text-left p-3 rounded-xl border-2 transition',
                strategy === o.k ? 'border-brand-300 bg-brand-50/60 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-300 bg-white',
              )}>
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded-lg', strategy === o.k ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600')}><o.Icon size={13}/></div>
                  <p className={cn('text-[12px] font-semibold', strategy === o.k ? 'text-brand-700' : 'text-slate-700')}>{o.label}</p>
                </div>
                <p className="text-[10.5px] text-slate-500 mt-1 pl-8">{o.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {mode === 'export' && (
          <button onClick={exportNow} disabled={working || !mp} className={cn(
            'px-4 py-2 rounded-xl font-semibold text-[12.5px] transition flex items-center gap-2 shadow',
            (working || !mp) ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-brand-500 hover:bg-brand-600 text-white shadow-brand-500/20',
          )}>
            <Download size={14}/>
            {working ? '加密并下载中…' : `下载加密备份（${snap?.items.length ?? 0} 条）`}
          </button>
        )}
        {mode === 'import' && (
          <>
            <input type="file" ref={fileRef} accept=".json,.enc.json,application/json" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readFileAndImport(f);
              if (fileRef.current) fileRef.current.value = '';
            }} className="hidden"/>
            <button onClick={() => fileRef.current?.click()} disabled={working || !mp} className={cn(
              'px-4 py-2 rounded-xl font-semibold text-[12.5px] transition flex items-center gap-2 shadow',
              (working || !mp) ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-brand-500 hover:bg-brand-600 text-white shadow-brand-500/20',
            )}>
              <Upload size={14}/> {working ? '解密并恢复中…' : '选择备份文件并导入'}
            </button>
          </>
        )}
      </div>

      {statusMsg && (
        <div className={cn(
          'rounded-xl border px-4 py-3 text-[12px]',
          statusMsg.kind === 'success' && 'bg-emerald-50 border-emerald-200 text-emerald-800',
          statusMsg.kind === 'error'   && 'bg-rose-50 border-rose-200 text-rose-800',
          statusMsg.kind === 'warn'    && 'bg-amber-50 border-amber-200 text-amber-800',
          statusMsg.kind === 'info'    && 'bg-slate-50 border-slate-200 text-slate-700',
        )}>
          <p className="font-semibold flex items-center gap-1.5">
            {statusMsg.kind === 'success' && <ShieldCheck size={14}/>}
            {statusMsg.kind === 'error'   && <AlertTriangle size={14}/>}
            {statusMsg.kind === 'warn'    && <AlertTriangle size={14}/>}
            {statusMsg.kind === 'info'    && <Shield size={14}/>}
            {statusMsg.msg}
          </p>
          {statusMsg.detail && <p className="mt-0.5 opacity-90 break-words">{statusMsg.detail}</p>}
        </div>
      )}
    </div>
  );
};

/* ============== SettingsPanel（包含 settings + logs + danger） ============== */
const SettingsPanel: React.FC<{
  logs: LogEntry[];
  onRefreshLogs: () => void;
  onClearLogs: () => void;
}> = ({ logs, onRefreshLogs, onClearLogs }) => {
  const snap = useVaultStore((s) => s.vaultSnapshot);
  const update = useVaultStore((s) => s.updateSettings);
  const [saved, setSaved] = React.useState(false);
  const [dangerConfirm, setDangerConfirm] = useState('');

  // ⭐ Fix: 之前 !snap 直接 return null → 整页空白！现在显示骨架加载，绝不给用户空白页
  if (!snap) {
    return (
      <div className="grid md:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-5 animate-pulse">
            <div className="h-7 w-40 bg-slate-100 rounded-xl" />
            <div className="space-y-4">
              <div><div className="h-4 w-44 bg-slate-100 rounded mb-2" /><div className="h-11 w-full bg-slate-100 rounded-xl" /></div>
              <div><div className="h-4 w-44 bg-slate-100 rounded mb-2" /><div className="h-11 w-full bg-slate-100 rounded-xl" /></div>
              <div className="h-14 w-full bg-slate-100 rounded-xl" />
              <div className="h-14 w-full bg-slate-100 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  const s = snap.settings;

  const patch = async (p: any) => {
    await update(p);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const resetVault = async () => {
    if (dangerConfirm !== 'YES-DELETE-ALL') {
      alert('请输入 YES-DELETE-ALL 以确认重置整个保管库');
      return;
    }
    await chrome.storage.local.clear();
    alert('已清空 storage.local，页面即将刷新…');
    setTimeout(() => location.reload(), 300);
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
          <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2"><Settings2 size={18} /> 安全</h3>
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">自动锁定时间（分钟）</span>
            <input type="number" min={1} max={120} value={s.autoLockMinutes}
              onChange={(e) => patch({ autoLockMinutes: Math.max(1, Math.min(120, parseInt(e.target.value) || 1)) })}
              className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">复制后清空剪贴板（秒）</span>
            <input type="number" min={0} max={300} value={s.clipboardClearSeconds}
              onChange={(e) => patch({ clipboardClearSeconds: Math.max(0, Math.min(300, parseInt(e.target.value) || 0)) })}
              className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
            <span className="text-sm font-semibold text-slate-700">🛫 旅行模式（真删除非安全保管库）</span>
            <input type="checkbox" checked={s.travelMode}
              onChange={(e) => patch({ travelMode: e.target.checked })}
              className="w-5 h-5 accent-brand-500" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
            <span className="text-sm font-semibold text-slate-700">🛡️ Watchtower（纯本地模式 MVP）</span>
            <input type="checkbox" checked={s.watchtowerEnabled}
              onChange={(e) => patch({ watchtowerEnabled: e.target.checked })}
              className="w-5 h-5 accent-brand-500" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
            <span className="text-sm font-semibold text-slate-700">🌐 允许联网（HIBP / 云同步 预留）</span>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={!s.hibpOffline}
                onChange={(e) => patch({ hibpOffline: !e.target.checked })}
                className="w-5 h-5 accent-brand-500" disabled />
              <span className="text-xs text-slate-400">M3 之前强制关闭</span>
            </div>
          </label>
          {saved && <p className="text-xs text-emerald-600 font-semibold animate-pulse">✅ 已保存</p>}
        </div>

        <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
          <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2">🎨 外观 & 语言</h3>
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">主题</span>
            <select value={s.theme}
              onChange={(e) => patch({ theme: e.target.value as any })}
              className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300">
              <option value="system">跟随系统</option>
              <option value="dark">深色</option>
              <option value="light">浅色</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">语言</span>
            <select value={s.language}
              onChange={(e) => patch({ language: e.target.value as any })}
              className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300">
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English</option>
            </select>
          </label>

          <div className="p-4 rounded-xl bg-brand-50 border border-brand-100 text-xs text-brand-800 space-y-1.5">
            <p className="font-bold text-sm">🔒 不可修改的安全参数（防止降低安全性）</p>
            <p>PBKDF2 迭代次数：<b>{s.pbkdf2Iterations.toLocaleString()}</b> 次</p>
            <p>保管库 schema 版本：<b>v{s.vaultSchemaVersion}</b></p>
            <p>加密算法：<b>AES-256-GCM</b> · KDF：<b>PBKDF2-HMAC-SHA256</b></p>
            <p>熵估算法：<code>estimateEntropyBits()</code> · 复用哈希：<code>fnv1a32()</code></p>
          </div>
        </div>
      </div>

      {/* 运行日志 + 危险区 */}
      <div className="grid lg:grid-cols-[3fr,1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Shield size={16}/> 运行时日志（内存中最多 1000 条）</h3>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1"
                onClick={onRefreshLogs}
              >刷新</button>
              <button
                className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 flex items-center gap-1"
                onClick={onClearLogs}
              >清空</button>
            </div>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0 z-[1]">
                <tr>
                  <th className="text-left px-4 py-2 text-slate-500 font-semibold w-10">LV</th>
                  <th className="text-left px-4 py-2 text-slate-500 font-semibold w-40">时间</th>
                  <th className="text-left px-4 py-2 text-slate-500 font-semibold w-36">TAG</th>
                  <th className="text-left px-4 py-2 text-slate-500 font-semibold">内容</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-400">暂无日志</td></tr>
                )}
                {logs.map((e) => (
                  <tr key={e.id} className="border-t border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <span className={cn(
                        'px-2 py-0.5 rounded font-mono font-bold',
                        e.level === 'ERROR' ? 'bg-red-100 text-red-700' :
                        e.level === 'WARN'  ? 'bg-amber-100 text-amber-700' :
                        e.level === 'INFO'  ? 'bg-blue-100 text-blue-700' :
                                              'bg-slate-100 text-slate-500'
                      )}>{e.level}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-500 font-mono whitespace-nowrap">{new Date(e.timestamp).toLocaleTimeString('zh-CN')}</td>
                    <td className="px-4 py-2 text-brand-700 font-mono whitespace-nowrap">{e.tag}</td>
                    <td className="px-4 py-2 text-slate-700 break-all">
                      {e.message}
                      {!!e.payload && (
                        <pre className="mt-1 text-[10px] bg-slate-100 p-1.5 rounded max-w-full overflow-x-auto">
                          {JSON.stringify(e.payload, null, 0).slice(0, 240)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-red-50 border-2 border-red-200 space-y-3 h-fit">
          <h3 className="font-bold text-lg text-red-700 flex items-center gap-2"><AlertTriangle size={20} /> 危险操作</h3>
          <p className="text-sm text-red-800">
            ⚠️ 删除保管库 = 永久丢失所有密码 + 数据！<br/>
            请先导出加密备份。
          </p>
          <label className="block">
            <span className="text-sm font-semibold text-red-700">请输入 <code>YES-DELETE-ALL</code> 以确认：</span>
            <input
              type="text"
              value={dangerConfirm}
              onChange={(e) => setDangerConfirm(e.target.value)}
              placeholder="YES-DELETE-ALL"
              className="mt-1 w-full px-3 py-2 rounded-xl border-2 border-red-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-300 font-mono tracking-wider"
            />
          </label>
          <button
            onClick={resetVault}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-md w-full"
          >🗑️ 永久删除整个保管库</button>
        </div>
      </div>
    </div>
  );
};
