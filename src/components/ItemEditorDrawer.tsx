/**
 * components/ItemEditorDrawer.tsx
 * 新建/编辑 Item 的右侧抽屉组件
 *
 * 依赖：
 *  - src/shared/constants/category-templates.ts（24 分类默认字段 & 默认标题）
 *  - FieldRenderer（13 种字段渲染）
 *
 * 强约束：
 *  - 乐观锁 VERSION_CONFLICT → 三选一对话框（不静默覆盖）
 *  - 所有写操作使用 vaultStore（经过 IPC 到 BG 统一 AES-GCM 加密）
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Folder, Save, Tag as TagIcon, Plus, Minus, ChevronDown,
  RotateCcw, AlertTriangle, ArrowRightLeft, Copy, CheckCircle2, XCircle, Info,
  GripVertical, ChevronUp, ChevronDown as ChevronDownIcon, Settings2, Type, Key, Mail, Globe2, CalendarDays, Phone, Hash, FileText, Eye,
} from 'lucide-react';
import { cn, uuidv4 } from '@/lib/utils';
import { useVaultStore, ipcCall as _storeIpcCall } from '@/store/vaultStore';
import { Log as _coreLog } from '@/core/logger';
import type { Item, ItemCategory, Field } from '@/types/models';
import { CATEGORY_LABELS, CATEGORY_ICON } from '@/screens/HomeScreen';
import {
  CATEGORY_FIELD_TEMPLATES,
  buildFieldsFromTemplate,
  getDefaultTitle,
} from '@/shared/constants/category-templates';
import { FieldRenderer } from './FieldRenderer';

type Mode = 'create' | 'edit';

export type EditorDraft = {
  title: string;
  category: ItemCategory;
  favorite: boolean;
  tags: string[];
  fields: Field[];
  notesPlain: string;
  urls: string[];
  version?: number;
  id?: string;
};

const makeEmptyDraft = (initCategory?: ItemCategory): EditorDraft => {
  const cat: ItemCategory = initCategory ?? 'login';
  return {
    title: getDefaultTitle(cat),
    category: cat,
    favorite: false,
    tags: [],
    fields: buildFieldsFromTemplate(cat),
    notesPlain: '',
    urls: CATEGORY_FIELD_TEMPLATES[cat]?.defaultUrlCount
      ? new Array(CATEGORY_FIELD_TEMPLATES[cat]!.defaultUrlCount!).fill('')
      : [],
  };
};

const itemToDraft = (it: Item): EditorDraft => ({
  title: it.title,
  category: it.category,
  favorite: !!it.favorite,
  tags: [...it.tags],
  fields: it.fields.map((f) => ({ ...f })),
  notesPlain: it.notesPlain ?? '',
  urls: [...it.urls],
  version: it.version,
  id: it.id,
});

type ConflictDialogProps = {
  incoming: EditorDraft;
  current: EditorDraft;
  onClose: () => void;
  onForceOverwrite: () => void;
  onTakeCurrent: () => void;
};

const ConflictDialog: React.FC<ConflictDialogProps> = ({ incoming, current, onClose, onForceOverwrite, onTakeCurrent }) => {
  const diffs: { label: string; a: string; b: string; kind: 'title' | 'tag' | 'note' | 'url' | `field:${string}` }[] = [];
  if (incoming.title !== current.title) diffs.push({ label: '标题', a: current.title, b: incoming.title, kind: 'title' });
  if ((incoming.notesPlain ?? '') !== (current.notesPlain ?? '')) diffs.push({ label: '备注', a: current.notesPlain ?? '', b: incoming.notesPlain ?? '', kind: 'note' });
  incoming.fields.forEach((f) => {
    const cf = current.fields.find((x) => x.label === f.label);
    if (cf && cf.value !== f.value) diffs.push({ label: `字段「${f.label}」`, a: cf.value, b: f.value, kind: `field:${f.label}` });
  });
  incoming.urls.forEach((u, i) => {
    const cu = current.urls[i] ?? '';
    if (u !== cu) diffs.push({ label: `网址[${i + 1}]`, a: cu, b: u, kind: 'url' });
  });

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-[560px] max-w-full rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-amber-200 bg-amber-50 flex items-start gap-2">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-amber-800">检测到版本冲突（乐观锁 VERSION_CONFLICT）</p>
            <p className="text-[11.5px] text-amber-700 mt-0.5">此项目已被其他会话修改，本地草稿版本落后。请选择处理方式。</p>
          </div>
        </div>
        <div className="px-4 py-3 max-h-[46vh] overflow-auto space-y-2 border-b border-slate-100">
          {diffs.length === 0 && (
            <p className="text-[12px] text-slate-500">字段内容未检测到显著差异（可能是 tags/字段顺序等元数据不一致）</p>
          )}
          {diffs.map((d, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100">
              <div className="px-2.5 py-1.5 bg-slate-100/70 flex items-center gap-1.5">
                <ArrowRightLeft size={12} className="text-slate-500" />
                <p className="text-[11.5px] font-medium text-slate-700">{d.label}</p>
              </div>
              <div className="grid grid-cols-2 gap-px">
                <div className="bg-rose-50 px-2.5 py-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-rose-600 font-semibold">当前（保管库已存）</p>
                  <p className="text-[11.5px] text-slate-800 mt-0.5 break-all">{d.a ? d.a.replace(/./g, '*').slice(0, 24) : '（空）'}</p>
                </div>
                <div className="bg-brand-50 px-2.5 py-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold">您的草稿</p>
                  <p className="text-[11.5px] text-slate-800 mt-0.5 break-all">{d.b ? d.b.replace(/./g, '*').slice(0, 24) : '（空）'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 flex items-center justify-end gap-2 bg-slate-50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[12px] text-slate-700 hover:bg-slate-200 transition"
          >取消</button>
          <button
            onClick={onTakeCurrent}
            className="px-3 py-1.5 rounded-lg text-[12px] text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition flex items-center gap-1"
          ><RotateCcw size={13} /> 刷新为最新版本</button>
          <button
            onClick={onForceOverwrite}
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-brand-500 hover:bg-brand-600 transition flex items-center gap-1"
          ><Copy size={13} /> 强制用草稿覆盖</button>
        </div>
      </div>
    </div>
  );
};

type CategoryPickerProps = {
  value: ItemCategory;
  onChange: (c: ItemCategory) => void;
  disabled?: boolean;
};
const CategoryPicker: React.FC<CategoryPickerProps> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, []);
  const cats: ItemCategory[] = (Object.keys(CATEGORY_LABELS) as ItemCategory[])
    .filter((c) => !['password-history', 'custom'].includes(c));
  const LabelIcon: any = CATEGORY_ICON[value];
  return (
    <div ref={wrapRef} className="relative">
      <button
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 flex items-center gap-1.5 min-w-[140px]',
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-50',
        )}
      >
        {LabelIcon && <LabelIcon size={13} className="text-brand-600" />}
        <span className="flex-1 text-left">{CATEGORY_LABELS[value] ?? '未知分类'}</span>
        <ChevronDown size={12} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-40 w-[260px] max-h-[60vh] overflow-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100 py-1">
          {cats.map((c) => {
            const I: any = CATEGORY_ICON[c];
            const sel = c === value;
            return (
              <button
                key={c}
                onClick={() => { onChange(c); setOpen(false); }}
                className={cn(
                  'w-full px-3 py-2 flex items-center gap-2 text-left text-[12px]',
                  sel ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                {I && <I size={13} />}
                <span className="flex-1">{CATEGORY_LABELS[c] ?? c}</span>
                {sel && <CheckCircle2 size={13} className="text-brand-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

type TagEditorProps = {
  tags: string[];
  onChange: (t: string[]) => void;
};
const TagEditor: React.FC<TagEditorProps> = ({ tags, onChange }) => {
  const [draft, setDraft] = useState('');
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
        <TagIcon size={13} /> <span className="font-medium">标签</span>
      </div>
      <div className="rounded-lg border border-slate-200 p-2 min-h-[38px] bg-white flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-brand-100 focus-within:border-brand-300">
        {tags.map((t, i) => (
          <span key={i} className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] flex items-center gap-1 border border-brand-100">
            {t}
            <button onClick={() => onChange(tags.filter((_, idx) => idx !== i))} className="text-brand-500 hover:text-brand-700"><XCircle size={11} /></button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault();
              const v = draft.trim();
              if (!tags.includes(v)) onChange([...tags, v]);
              setDraft('');
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          placeholder="输入标签，按 Enter 新增"
          className="flex-1 min-w-[140px] bg-transparent outline-none text-[12px] placeholder:text-slate-400 py-0.5"
        />
      </div>
    </div>
  );
};

type UrlListEditorProps = { urls: string[]; onChange: (u: string[]) => void };
const UrlListEditor: React.FC<UrlListEditorProps> = ({ urls, onChange }) => {
  const [force, setForce] = useState(0);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px] text-slate-500">
        <div className="flex items-center gap-1.5"><Info size={13} /> <span className="font-medium">网址（登录域名匹配）</span></div>
        <button
          onClick={() => onChange([...urls, ''])}
          className="text-brand-600 hover:text-brand-700 font-medium text-[11px] flex items-center gap-0.5"
        ><Plus size={12} /> 新增</button>
      </div>
      <div className="space-y-1.5">
        {urls.map((u, i) => (
          <div key={`${i}-${force}`} className="flex items-center gap-1.5">
            <div className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 flex items-center gap-1.5 focus-within:ring-2 focus-within:ring-brand-100 focus-within:border-brand-300">
              <Folder size={12} className="text-slate-400 shrink-0" />
              <input
                value={u}
                onChange={(e) => { const nu = [...urls]; nu[i] = e.target.value; onChange(nu); }}
                placeholder="https://example.com"
                className="flex-1 outline-none bg-transparent text-[12px] placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={() => { onChange(urls.filter((_, idx) => idx !== i)); setForce((f) => f + 1); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50"
              title="移除此网址"
            ><Minus size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- 自定义字段类型开关 & 菜单 ---------- */
import type { FieldType } from '@/types/models';

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string; Icon: any }[] = [
  { value: 'text', label: '文本', Icon: Type },
  { value: 'password', label: '密码', Icon: Key },
  { value: 'concealed', label: '隐藏', Icon: Eye },
  { value: 'textarea', label: '长文本', Icon: FileText },
  { value: 'email', label: '邮箱', Icon: Mail },
  { value: 'url', label: '链接', Icon: Globe2 },
  { value: 'tel', label: '电话', Icon: Phone },
  { value: 'creditcard', label: '银行卡号', Icon: Hash },
  { value: 'date', label: '日期', Icon: CalendarDays },
  { value: 'monthYear', label: '月/年', Icon: CalendarDays },
  { value: 'otp', label: 'TOTP 种子', Icon: Key },
  { value: 'file', label: '附件引用', Icon: Folder },
];

type FieldTypeSwitcherProps = { current: FieldType; onChange: (t: FieldType) => void };
const FieldTypeSwitcher: React.FC<FieldTypeSwitcherProps> = ({ current, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, []);
  const curr = FIELD_TYPE_OPTIONS.find((o) => o.value === current) ?? FIELD_TYPE_OPTIONS[0];
  const CurIcon = curr.Icon as any;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1 rounded text-slate-500 hover:text-brand-600 hover:bg-brand-50"
        title={`类型：${curr.label}（点击切换）`}
      ><CurIcon size={13} /></button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[160px] bg-white border border-slate-200 rounded-lg shadow-xl py-1 divide-y divide-slate-100 max-h-[50vh] overflow-auto">
          {FIELD_TYPE_OPTIONS.map((o) => {
            const I = o.Icon as any;
            const sel = o.value === current;
            return (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  'w-full px-2.5 py-1.5 text-[11.5px] flex items-center gap-1.5 text-left',
                  sel ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                <I size={12} /> <span className="flex-1">{o.label}</span>
                {sel && <CheckCircle2 size={11} className="text-brand-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

type AddCustomFieldMenuProps = { onAdd: (type: FieldType, label: string) => void };
const AddCustomFieldMenu: React.FC<AddCustomFieldMenuProps> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', fn);
    return () => window.removeEventListener('mousedown', fn);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[11.5px] text-brand-700 hover:bg-brand-50 font-semibold flex items-center gap-1"
      ><Plus size={12} /> 添加自定义字段</button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[200px] bg-white border border-slate-200 rounded-lg shadow-xl py-1 divide-y divide-slate-100 max-h-[60vh] overflow-auto">
          {FIELD_TYPE_OPTIONS.map((o) => {
            const I = o.Icon as any;
            return (
              <button
                key={o.value}
                onClick={() => {
                  const label = window.prompt(`新建【${o.label}】字段，请输入字段名：`, `自定义${o.label}`);
                  if (label && label.trim()) {
                    onAdd(o.value, label.trim());
                  }
                  setOpen(false);
                }}
                className="w-full px-2.5 py-1.5 text-[11.5px] flex items-center gap-1.5 text-left text-slate-700 hover:bg-brand-50 hover:text-brand-700"
              >
                <I size={12} />
                <span className="flex-1">{o.label}</span>
                <ChevronDown size={11} className="-rotate-90 text-slate-300" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

type Toast = { id: number; kind: 'success' | 'error' | 'warn' | 'info'; title: string; detail?: string };

export type ItemEditorDrawerProps = {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  initialCategory?: ItemCategory;
  initialItem?: Item;
};

export const ItemEditorDrawer: React.FC<ItemEditorDrawerProps> = ({
  open, onClose, mode, initialCategory, initialItem,
}) => {
  const createItem = useVaultStore((s) => s.createItem);
  const updateItem = useVaultStore((s) => s.updateItem);
  const duplicateItem = useVaultStore((s) => s.duplicateItem);
  const currentSnapshot = useVaultStore((s) => s.vaultSnapshot);
  const refreshStatus = useVaultStore((s) => s.refreshStatus);

  const [draft, setDraft] = useState<EditorDraft>(() =>
    mode === 'edit' && initialItem ? itemToDraft(initialItem) : makeEmptyDraft(initialCategory),
  );
  const [saving, setSaving] = useState(false);
  const [conflictState, setConflictState] = useState<null | { incoming: EditorDraft; currentInStore: EditorDraft }>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(1);
  const pushToast = (kind: Toast['kind'], title: string, detail?: string) => {
    const id = toastSeq.current++;
    setToasts((list) => [...list, { id, kind, title, detail }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3500);
  };

  useEffect(() => {
    if (!open) return;
    setDraft(mode === 'edit' && initialItem ? itemToDraft(initialItem) : makeEmptyDraft(initialCategory));
    setConflictState(null);
    setSaving(false);
  }, [open, mode, initialItem, initialCategory]);

  /* ---------- 分类切换：create 模式可换；edit 模式保留分类 ---------- */
  const canChangeCategory = mode === 'create';
  const changeCategory = (c: ItemCategory) => {
    if (!canChangeCategory) return;
    setDraft((d) => {
      const mergedFields: Field[] = buildFieldsFromTemplate(c);
      d.fields.forEach((src) => {
        const dst = mergedFields.find((f) => f.label === src.label && f.type === src.type);
        if (dst) dst.value = src.value;
        else mergedFields.push({ ...src, id: uuidv4() });
      });
      return {
        ...d,
        category: c,
        title: d.title === getDefaultTitle(d.category) ? getDefaultTitle(c) : d.title,
        fields: mergedFields,
        urls: d.urls.length > 0 ? d.urls : (CATEGORY_FIELD_TEMPLATES[c]?.defaultUrlCount ? new Array(CATEGORY_FIELD_TEMPLATES[c]!.defaultUrlCount!).fill('') : []),
      };
    });
  };

  /* ---------- 保存 ---------- */
  const runSave = async (forceOverwrite = false) => {
    if (!draft.title.trim()) { pushToast('warn', '标题不能为空'); return; }
    setSaving(true);
    const payload = {
      id: draft.id,
      category: draft.category,
      title: draft.title.trim(),
      favorite: draft.favorite,
      tags: draft.tags,
      fields: draft.fields,
      notesPlain: draft.notesPlain,
      urls: draft.urls.filter((u) => u.trim()),
      version: forceOverwrite ? undefined : draft.version,
    };
    try {
      let saved: Item | null = null;
      if (mode === 'create') {
        saved = await createItem({ ...payload, category: draft.category, title: payload.title, fields: draft.fields });
      } else {
        saved = await updateItem({ ...payload, id: draft.id! });
      }
      if (saved) {
        pushToast('success', mode === 'create' ? '已创建项目' : '已保存', saved.title);
        setConflictState(null);
        window.setTimeout(() => { setSaving(false); onClose(); }, 120);
        return;
      }
      /* 乐观锁失败：current 从快照拉最新 */
      if (mode === 'edit' && draft.id && currentSnapshot) {
        const latest = currentSnapshot.items.find((i) => i.id === draft.id);
        if (latest) {
          setConflictState({ incoming: draft, currentInStore: itemToDraft(latest) });
          setSaving(false);
          return;
        }
      }
      /* 兜底：store 返回 null 但没抛错（理论不应到达，防未来回归）→ 再发一次请求拿具体错误 */
      const snoop = await _storeIpcCall<Item>(
        mode === 'create' ? 'ITEM_CREATE' : 'ITEM_UPDATE',
        (mode === 'create'
          ? { ...payload, category: draft.category, title: payload.title, fields: draft.fields }
          : { ...payload, id: draft.id! }) as any,
      );
      const detail = (!snoop.ok && (snoop.error || snoop.code))
        ? `${snoop.error}${snoop.code ? ` [code=${snoop.code}]` : ''}`
        : '保存失败（请打开扩展 DevTools → Service Worker → Console 查看完整 ERROR 日志）';
      try {
        _coreLog.error('EDITOR:SAVE_FAIL', `保存失败(兜底路径) mode=${mode} draft=${JSON.stringify({ id: draft.id, title: draft.title, category: draft.category, fieldsCount: draft.fields.length })} snoop=${JSON.stringify(snoop)}`);
      } catch { /* ignore */ }
      pushToast('error', '保存失败', detail);
    } catch (err: any) {
      /* ⭐ createItem/updateItem 现在 IPC 失败会抛带 message 的 Error，直接取 err.message 就是具体原因！
         —— 例: "保管库未解锁，请先解锁 [code=LOCKED]" / "标题不能为空" / "乐观锁冲突版本不一致 [code=VERSION_CONFLICT]" */
      const msg: string = err?.message ?? String(err ?? '保存异常');
      const code: string | undefined = err?.code;
      const full = code ? `${msg} [code=${code}]` : msg;
      try {
        _coreLog.error('EDITOR:SAVE_FAIL', `保存异常 mode=${mode} err=${full}`);
      } catch { /* ignore */ }
      /* ⭐ M3-BF10 修复：BG 返回 LOCKED 说明 Service Worker 被回收导致内存密钥丢失（MV3 固有）。
       *   先弹提示，再延迟跳转解锁界面 —— toast 在组件内部，立即跳转会导致抽屉卸载、toast 丢失。 */
      if (code === 'LOCKED') {
        pushToast('warn', '保管库已锁定，请重新解锁');
        window.setTimeout(() => { void refreshStatus(); }, 1200);
      } else {
        pushToast('error', '保存失败', full);
      }
    }
    setSaving(false);
  };

  const runDuplicate = async () => {
    if (!draft.id) return;
    const r = await duplicateItem(draft.id);
    if (r) {
      pushToast('success', '已创建副本', r.title);
      window.setTimeout(() => onClose(), 150);
    } else {
      pushToast('error', '复制失败');
    }
  };

  const titleRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (open) setTimeout(() => titleRef.current?.focus(), 120); }, [open]);

  const subtitleText = useMemo(() => {
    const u = draft.fields.find((f) => f.label === '用户名' || f.label === '邮箱地址');
    return u ? u.value : undefined;
  }, [draft.fields]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={() => !saving && onClose()} />

      {/* 抽屉主体 */}
      <div className="absolute right-0 top-0 bottom-0 w-[460px] max-w-[92vw] bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right">
        {/* 顶栏 */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <button onClick={() => !saving && onClose()} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="关闭">
            <X size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              {mode === 'create' ? '新建项目' : '编辑项目'}
            </p>
            <input
              ref={titleRef}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="项目标题"
              className="w-full outline-none bg-transparent text-[16px] font-bold text-slate-800 placeholder:text-slate-400 mt-0.5 truncate"
            />
            {subtitleText && <p className="text-[11px] text-slate-500 truncate mt-0.5">{subtitleText}</p>}
          </div>
          <CategoryPicker value={draft.category} onChange={changeCategory} disabled={!canChangeCategory} />
        </div>

        {/* 主体 */}
        <div className="flex-1 overflow-auto px-4 py-4 space-y-5">
          {/* ⭐ 收藏 */}
          <label className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer text-[12px] text-slate-700 w-fit">
            <input
              type="checkbox"
              checked={draft.favorite}
              onChange={(e) => setDraft({ ...draft, favorite: e.target.checked })}
              className="h-3.5 w-3.5 accent-brand-600"
            />
            <span>收藏此项目</span>
          </label>

          {/* 标签 */}
          <TagEditor tags={draft.tags} onChange={(t) => setDraft({ ...draft, tags: t })} />

          {/* Fields 列表 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[12px] text-slate-500 pt-1">
              <div className="flex items-center gap-1.5"><Settings2 size={13} /> <span className="font-medium">字段（拖动 / 上移下移）</span></div>
              <AddCustomFieldMenu onAdd={(type, label) => {
                setDraft((d) => ({
                  ...d,
                  fields: [...d.fields, {
                    id: uuidv4(),
                    label,
                    type,
                    value: '',
                    custom: true,
                  }],
                }));
              }} />
            </div>
            {draft.fields.map((field, idx) => (
              <div
                key={field.id}
                className="group relative rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50/50 -mx-1.5 px-1.5 py-2 transition"
              >
                <div className="absolute left-0 top-2.5 -translate-x-full pr-1 opacity-0 group-hover:opacity-100 transition flex flex-col">
                  <button
                    onClick={() => {
                      if (idx === 0) return;
                      setDraft((d) => {
                        const nf = [...d.fields];
                        [nf[idx - 1], nf[idx]] = [nf[idx], nf[idx - 1]];
                        return { ...d, fields: nf };
                      });
                    }}
                    disabled={idx === 0}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                    title="上移"
                  ><ChevronUp size={14} /></button>
                  <button
                    onClick={() => {
                      if (idx === draft.fields.length - 1) return;
                      setDraft((d) => {
                        const nf = [...d.fields];
                        [nf[idx + 1], nf[idx]] = [nf[idx], nf[idx + 1]];
                        return { ...d, fields: nf };
                      });
                    }}
                    disabled={idx === draft.fields.length - 1}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                    title="下移"
                  ><ChevronDownIcon size={14} /></button>
                </div>
                <div className="absolute right-1 top-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 z-10 bg-white rounded-lg border border-slate-200 shadow-sm px-0.5 py-0.5">
                  <button
                    onClick={() => {
                      const newLabel = window.prompt(`修改字段名：`, field.label);
                      if (newLabel == null || !newLabel.trim()) return;
                      setDraft((d) => ({
                        ...d,
                        fields: d.fields.map((f) => f.id === field.id ? { ...f, label: newLabel.trim(), custom: true } : f),
                      }));
                    }}
                    className="p-1 rounded text-slate-500 hover:text-brand-600 hover:bg-brand-50"
                    title="修改字段名"
                  ><Type size={13} /></button>
                  <FieldTypeSwitcher
                    current={field.type}
                    onChange={(nt) => setDraft((d) => ({
                      ...d,
                      fields: d.fields.map((f) => f.id === field.id ? { ...f, type: nt, custom: true } : f),
                    }))}
                  />
                  <button
                    onClick={() => {
                      if (!field.custom && !window.confirm('此字段为模板默认字段，确定删除？恢复可通过切回分类重建。')) return;
                      setDraft((d) => ({ ...d, fields: d.fields.filter((f) => f.id !== field.id) }));
                    }}
                    className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                    title={field.custom ? '删除此字段' : '删除（模板默认字段）'}
                  ><XCircle size={13} /></button>
                </div>
                <div className="absolute right-[120px] top-2.5 opacity-0 group-hover:opacity-50 transition hidden">
                  <GripVertical size={14} className="text-slate-400" />
                </div>
                <FieldRenderer
                  field={field}
                  onChange={(patch) => {
                    setDraft((d) => {
                      const newFields = d.fields.map((f) => {
                        if (f.id !== field.id) return f;
                        return { ...f, ...patch };
                      });
                      return { ...d, fields: newFields };
                    });
                  }}
                  readOnly={false}
                />
              </div>
            ))}
          </div>

          {/* URLs */}
          <UrlListEditor
            urls={draft.urls}
            onChange={(u) => setDraft({ ...draft, urls: u })}
          />

          {/* notesPlain 大文本备注 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
              <Info size={13} /> <span className="font-medium">安全备注（加密存储）</span>
            </div>
            <textarea
              value={draft.notesPlain}
              onChange={(e) => setDraft({ ...draft, notesPlain: e.target.value })}
              rows={5}
              placeholder="在此输入详细的自由文本备注，例如二次验证问题、特殊登录步骤、联系人信息等。"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none text-[12.5px] text-slate-700 placeholder:text-slate-400 resize-y focus:ring-2 focus:ring-brand-100 focus:border-brand-300 leading-relaxed"
            />
          </div>

          {/* 底部：edit 模式显示操作区（复制） */}
          {mode === 'edit' && (
            <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
              <button
                onClick={runDuplicate}
                className="px-2.5 py-1.5 rounded-lg text-[12px] text-slate-600 border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
              ><Copy size={13} /> 创建副本</button>
              <div className="text-[10.5px] text-slate-400">
                {draft.version != null && <>版本 v{draft.version}</>}
              </div>
            </div>
          )}
          <div className="h-12" />
        </div>

        {/* 底栏 */}
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center gap-2">
          <button
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg text-[12px] text-slate-700 hover:bg-slate-200 transition disabled:opacity-60"
          >取消</button>
          <div className="flex-1" />
          <button
            onClick={() => runSave(false)}
            disabled={saving || !draft.title.trim()}
            className="px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-brand-500 hover:bg-brand-600 transition flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {saving ? '保存中…' : (mode === 'create' ? '创建' : '保存')}
          </button>
        </div>
      </div>

      {/* Toast 容器 */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[110] space-y-1.5 w-[320px] max-w-[80%]">
        {toasts.map((t) => {
          const bg = t.kind === 'success' ? 'bg-emerald-50 border-emerald-200'
            : t.kind === 'error' ? 'bg-rose-50 border-rose-200'
            : t.kind === 'warn' ? 'bg-amber-50 border-amber-200'
            : 'bg-slate-50 border-slate-200';
          const ic = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : t.kind === 'warn' ? AlertTriangle : Info;
          const tx = t.kind === 'success' ? 'text-emerald-700' : t.kind === 'error' ? 'text-rose-700' : t.kind === 'warn' ? 'text-amber-700' : 'text-slate-700';
          const Icon = ic as any;
          return (
            <div key={t.id} className={cn('rounded-lg border shadow-md px-3 py-2 flex items-start gap-2 animate-in slide-in-from-top', bg)}>
              <Icon size={14} className={cn('mt-0.5 shrink-0', tx)} />
              <div className="min-w-0 flex-1">
                <p className={cn('text-[12px] font-semibold leading-tight', tx)}>{t.title}</p>
                {t.detail && <p className="text-[11px] text-slate-600 mt-0.5 break-words">{t.detail}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* 冲突对话框 */}
      {conflictState && (
        <ConflictDialog
          incoming={conflictState.incoming}
          current={conflictState.currentInStore}
          onClose={() => setConflictState(null)}
          onForceOverwrite={() => { setConflictState(null); runSave(true); }}
          onTakeCurrent={() => {
            const ld = conflictState.currentInStore;
            setDraft(ld);
            setConflictState(null);
            pushToast('info', '已刷新为最新版本', '请重新编辑并保存');
          }}
        />
      )}
    </div>
  );
};
