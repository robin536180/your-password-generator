/**
 * core/logger.ts - 分级日志系统（INFO/WARN/ERROR/DEBUG）
 *
 * 所有与"当前需求"相关的关键位置必须完整打印入参/出参
 * 格式： [1P][级别][时间戳][标签] 消息内容
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  level: LogLevel;
  timestamp: number;
  tag: string;
  message: string;
  payload?: unknown;
}

const LEVEL_NUM: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const __memoryBuffer__: LogEntry[] = [];
let __minLevel__: LogLevel =
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV ? 'DEBUG' : 'INFO') as LogLevel;

const PREFIX = '[1P]';

const write = (level: LogLevel, tag: string, message: string, payload?: unknown) => {
  if (LEVEL_NUM[level] < LEVEL_NUM[__minLevel__]) return;

  const ts = Date.now();
  const iso = new Date(ts).toISOString();

  // 写入 memory buffer（最多 1000 条，可从 options 页面查看）
  const entry: LogEntry = {
    id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    timestamp: ts,
    tag,
    message,
    payload,
  };
  __memoryBuffer__.push(entry);
  if (__memoryBuffer__.length > 1000) __memoryBuffer__.shift();

  // 控制台输出（使用对应的 console 方法以便 DevTools 正确着色）
  const line = `${PREFIX}[${level}][${iso}][${tag}] ${message}`;
  switch (level) {
    case 'DEBUG':
      console.debug(line, payload ?? '');
      break;
    case 'INFO':
      console.info(line, payload ?? '');
      break;
    case 'WARN':
      console.warn(line, payload ?? '');
      break;
    case 'ERROR':
      console.error(line, payload ?? '');
      break;
  }
};

export const Log = {
  debug: (tag: string, message: string, payload?: unknown) => write('DEBUG', tag, message, payload),
  info:  (tag: string, message: string, payload?: unknown) => write('INFO',  tag, message, payload),
  warn:  (tag: string, message: string, payload?: unknown) => write('WARN',  tag, message, payload),
  error: (tag: string, message: string, payload?: unknown) => write('ERROR', tag, message, payload),
  setMinLevel: (lv: LogLevel) => { __minLevel__ = lv; },
  getBuffer: (): readonly LogEntry[] => __memoryBuffer__.slice(),
  clearBuffer: () => { __memoryBuffer__.length = 0; },
};
