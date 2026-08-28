/* ============================================================
 * popup.js — 密码 + 用户名生成器总控制器
 * ------------------------------------------------------------
 *   1) 通用工具函数层（复用）
 *   2) 密码生成器三模式（原有逻辑保持兼容）
 *   3) 用户名生成器三模式（新增，1:1 对齐 1Password）
 *   4) 事件绑定层 + 日志埋点
 * ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  /* ============================================================
   *  0. 日志埋点工具
   * ============================================================ */
  const LOG_PREFIX = '[1P-Generator]';
  const Log = {
    info: (tag, msg) => console.log(`${LOG_PREFIX}[INFO][${new Date().toISOString()}][${tag}] ${msg}`),
    warn: (tag, msg) => console.warn(`${LOG_PREFIX}[WARN][${new Date().toISOString()}][${tag}] ${msg}`),
    error: (tag, msg) => console.error(`${LOG_PREFIX}[ERROR][${new Date().toISOString()}][${tag}] ${msg}`)
  };

  /* ============================================================
   *  1. 通用工具函数 & 全局字符集常量
   * ============================================================ */
  const CHARSET = {
    LOWER:   'abcdefghijklmnopqrstuvwxyz',
    UPPER:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    NUMBERS: '0123456789',
    SYMBOLS: '!@#$%^&*()_+~`|}{[]:;?><,./-='
  };

  const getRandomInt = (max) => Math.floor(Math.random() * Math.max(1, max));

  /** 通用：更新滑块轨道渐变背景 */
  const updateSliderBackground = (sliderEl) => {
    const val = parseInt(sliderEl.value, 10);
    const min = parseInt(sliderEl.min, 10);
    const max = parseInt(sliderEl.max, 10);
    const pct = max === min ? 50 : ((val - min) / (max - min)) * 100;
    sliderEl.style.setProperty('--value', `${pct}%`);
  };

  /**
   * 通用：同步「滑块 + 数字输入框」
   * @param {number} val    用户输入值
   * @param {object} cfg    {min, max, default} 模式配置
   * @param {HTMLInputElement} sliderEl 滑块元素
   * @param {HTMLInputElement} inputEl  数字输入元素
   * @param {string} modeName 日志用标签
   * @returns {number} 修正后的有效数值
   */
  const syncLength = (val, cfg, sliderEl, inputEl, modeName) => {
    let value = parseInt(val, 10);
    if (isNaN(value)) {
      Log.warn(modeName, `数值非法(${val})，回退默认值=${cfg.default}`);
      value = cfg.default;
    }
    if (value < cfg.min) {
      Log.warn(modeName, `数值越界低值(${value}<${cfg.min})，修正为min=${cfg.min}`);
      value = cfg.min;
    }
    if (value > cfg.max) {
      Log.warn(modeName, `数值越界高值(${value}>${cfg.max})，修正为max=${cfg.max}`);
      value = cfg.max;
    }
    sliderEl.value = value;
    inputEl.value = value;
    updateSliderBackground(sliderEl);
    return value;
  };

  /**
   * 通用：按字符着色（数字蓝、符号红、字母黑）
   * @param {string} text  原始字符串
   * @param {string} mode  'pin' 全体视为数字；'memorable' 分隔符视为符号；默认逐字符判断
   * @returns {string} HTML 字符串
   */
  const formatStringWithColors = (text, mode = 'default') => {
    if (mode === 'pin') {
      return `<span class="char-number">${text}</span>`;
    }
    if (mode === 'memorable') {
      return text
        .replace(/-/g, '<span class="char-symbol">-</span>')
        .replace(/([^<>]+)(?=<|$)/g, (m) => m ? `<span class="char-letter">${m}</span>` : '');
    }
    // default / random / custom 模式 — 逐字符精细着色
    let html = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (/[0-9]/.test(ch)) {
        html += `<span class="char-number">${ch}</span>`;
      } else if (/[^a-zA-Z0-9]/.test(ch)) {
        html += `<span class="char-symbol">${ch}</span>`;
      } else {
        html += `<span class="char-letter">${ch}</span>`;
      }
    }
    return html;
  };

  /** 兼容层：保留旧函数名（供外部引用） */
  const formatPassword = formatStringWithColors;

  /* ============================================================
   *  2. 全局状态 & DOM 引用
   * ============================================================ */
  const state = {
    activeTopTab: 'password',   // 'password' | 'username'
    pwdMode: 'random',          // 'random' | 'memorable' | 'pin'
    usrMode: 'random'           // 'random' | 'memorable' | 'custom'
  };

  // --- 密码生成器 DOM ---
  const pwdEls = {
    tabs: document.querySelectorAll('#password-panel .type-btn'),
    lengthSlider: document.getElementById('pwd-length-slider'),
    lengthInput:  document.getElementById('pwd-length-input'),
    output:       document.getElementById('password-output'),
    btnCopy:      document.getElementById('pwd-btn-copy'),
    btnRefresh:   document.getElementById('pwd-btn-refresh'),
    optNumbers:   document.getElementById('pwd-opt-numbers'),
    optSymbols:   document.getElementById('pwd-opt-symbols'),
    optCapitalize:document.getElementById('pwd-opt-capitalize'),
    optFullwords: document.getElementById('pwd-opt-fullwords'),
    optsRandom:   document.getElementById('pwd-options-random'),
    optsMemorable:document.getElementById('pwd-options-memorable'),
    optsPin:      document.getElementById('pwd-options-pin')
  };

  // --- 用户名生成器 DOM ---
  const usrEls = {
    tabs: document.querySelectorAll('#username-panel .type-btn'),
    lengthSlider: document.getElementById('usr-length-slider'),
    lengthInput:  document.getElementById('usr-length-input'),
    output:       document.getElementById('username-output'),
    btnCopy:      document.getElementById('usr-btn-copy'),
    btnRefresh:   document.getElementById('usr-btn-refresh'),
    optNumbers:   document.getElementById('usr-opt-numbers'),
    optSymbols:   document.getElementById('usr-opt-symbols'),
    optCapitalize:document.getElementById('usr-opt-capitalize'),
    optFullwords: document.getElementById('usr-opt-fullwords'),
    optMidNumbers:document.getElementById('usr-opt-mid-numbers'),
    optMidSymbols:document.getElementById('usr-opt-mid-symbols'),
    optsRandom:   document.getElementById('usr-options-random'),
    optsMemorable:document.getElementById('usr-options-memorable'),
    optsCustom:   document.getElementById('usr-options-custom'),
    customFields: document.getElementById('usr-custom-fields'),
    customPrefix: document.getElementById('usr-custom-prefix'),
    customSuffix: document.getElementById('usr-custom-suffix')
  };

  // --- 顶层 Tab DOM ---
  const topTabBtns = document.querySelectorAll('.top-tab-btn');
  const passwordPanel = document.getElementById('password-panel');
  const usernamePanel = document.getElementById('username-panel');

  /* ============================================================
   *  3. 模式配置（长度范围 / 默认值 / 选项）
   * ============================================================ */
  const PWD_MODE_CFG = {
    random:    { min: 8,   max: 100, default: 20 },
    memorable: { min: 3,   max: 15,  default: 4  },
    pin:       { min: 3,   max: 12,  default: 6  }
  };
  const USR_MODE_CFG = {
    random:    { min: 8,   max: 32,  default: 8  },
    memorable: { min: 2,   max: 8,   default: 4  },
    custom:    { min: 4,   max: 32,  default: 12 }
  };

  /* ============================================================
   *  4-A. 密码生成器 — 三种模式（原逻辑完整保留 + 增强）
   * ============================================================ */
  const generateRandomPassword = (length, useNum, useSym) => {
    const { LOWER, UPPER, NUMBERS, SYMBOLS } = CHARSET;
    let chars = LOWER + UPPER;
    const guaranteed = [
      LOWER[getRandomInt(LOWER.length)],
      UPPER[getRandomInt(UPPER.length)]
    ];
    if (useNum) { chars += NUMBERS; guaranteed.push(NUMBERS[getRandomInt(NUMBERS.length)]); }
    if (useSym) { chars += SYMBOLS; guaranteed.push(SYMBOLS[getRandomInt(SYMBOLS.length)]); }

    let pwd = '';
    for (let i = guaranteed.length; i < length; i++) {
      pwd += chars[getRandomInt(chars.length)];
    }
    pwd += guaranteed.join('');
    return pwd.split('').sort(() => 0.5 - Math.random()).join('');
  };

  const generateMemorablePassword = (count, capitalize, fullWords) => {
    const source = fullWords ? (typeof words !== 'undefined' ? words : []) : (typeof syllables !== 'undefined' ? syllables : []);
    if (!source || source.length === 0) return '';
    const parts = [];
    for (let i = 0; i < count; i++) {
      let w = source[getRandomInt(source.length)] || '';
      if (capitalize && w.length) w = w.charAt(0).toUpperCase() + w.slice(1);
      parts.push(w);
    }
    return parts.join('-');
  };

  const generatePinPassword = (length) => {
    const { NUMBERS } = CHARSET;
    let pwd = '';
    for (let i = 0; i < length; i++) pwd += NUMBERS[getRandomInt(NUMBERS.length)];
    return pwd;
  };

  /** 密码总入口 */
  const generatePassword = () => {
    const len = parseInt(pwdEls.lengthSlider.value, 10);
    let pwd = '';
    const mode = state.pwdMode;

    if (mode === 'random') {
      pwd = generateRandomPassword(len, pwdEls.optNumbers.checked, pwdEls.optSymbols.checked);
    } else if (mode === 'memorable') {
      pwd = generateMemorablePassword(len, pwdEls.optCapitalize.checked, pwdEls.optFullwords.checked);
    } else if (mode === 'pin') {
      pwd = generatePinPassword(len);
    }

    Log.info('PWD-GENERATE', `mode=${mode}, len=${len}, options={num:${pwdEls.optNumbers.checked},sym:${pwdEls.optSymbols.checked},cap:${pwdEls.optCapitalize.checked},fw:${pwdEls.optFullwords.checked}} → 结果=${pwd} (长度:${pwd.length})`);

    pwdEls.output.innerHTML = formatStringWithColors(pwd, mode);
    pwdEls.btnCopy.textContent = '复制密码';
    pwdEls.btnCopy.classList.remove('success');
  };

  /* ============================================================
   *  4-B. 用户名生成器 — 三种模式（新增）
   * ============================================================ */

  /** 随机用户名：字母+可选数字+可选符号（默认8字符） */
  const generateRandomUsername = (length, useNum, useSym) => {
    const { LOWER, UPPER, NUMBERS, SYMBOLS } = CHARSET;
    let chars = LOWER + UPPER;
    const guaranteed = [
      LOWER[getRandomInt(LOWER.length)],
      UPPER[getRandomInt(UPPER.length)]
    ];
    if (useNum) { chars += NUMBERS; guaranteed.push(NUMBERS[getRandomInt(NUMBERS.length)]); }
    if (useSym) { chars += SYMBOLS; guaranteed.push(SYMBOLS[getRandomInt(SYMBOLS.length)]); }

    let res = '';
    for (let i = guaranteed.length; i < length; i++) {
      res += chars[getRandomInt(chars.length)];
    }
    res += guaranteed.join('');
    return res.split('').sort(() => 0.5 - Math.random()).join('');
  };

  /** 易记用户名：单词组合（同密码的memorable模式，但长度范围为2-8词） */
  const generateMemorableUsername = (count, capitalize, fullWords) => {
    const source = fullWords ? (typeof words !== 'undefined' ? words : []) : (typeof syllables !== 'undefined' ? syllables : []);
    if (!source || source.length === 0) return '';
    const parts = [];
    for (let i = 0; i < count; i++) {
      let w = source[getRandomInt(source.length)] || '';
      if (capitalize && w.length) w = w.charAt(0).toUpperCase() + w.slice(1);
      parts.push(w);
    }
    return parts.join('-');
  };

  /**
   * 自定义用户名： prefix + 随机中段 + suffix
   * @param {number} midLength 中段随机部分的目标长度
   */
  const generateCustomUsername = (midLength, useNum, useSym, prefix = '', suffix = '') => {
    const { LOWER, UPPER, NUMBERS, SYMBOLS } = CHARSET;
    let chars = LOWER + UPPER;
    const guaranteed = [
      LOWER[getRandomInt(LOWER.length)],
      UPPER[getRandomInt(UPPER.length)]
    ];
    if (useNum) { chars += NUMBERS; guaranteed.push(NUMBERS[getRandomInt(NUMBERS.length)]); }
    if (useSym) { chars += SYMBOLS; guaranteed.push(SYMBOLS[getRandomInt(SYMBOLS.length)]); }

    // 确保中段长度至少等于 guaranteed 长度
    const realMidLen = Math.max(midLength, guaranteed.length);
    let mid = '';
    for (let i = guaranteed.length; i < realMidLen; i++) {
      mid += chars[getRandomInt(chars.length)];
    }
    mid += guaranteed.join('');
    mid = mid.split('').sort(() => 0.5 - Math.random()).join('');

    return (prefix || '') + mid + (suffix || '');
  };

  /** 用户名总入口 */
  const generateUsername = () => {
    const len = parseInt(usrEls.lengthSlider.value, 10);
    const mode = state.usrMode;
    let username = '';

    if (mode === 'random') {
      username = generateRandomUsername(len, usrEls.optNumbers.checked, usrEls.optSymbols.checked);
    } else if (mode === 'memorable') {
      username = generateMemorableUsername(len, usrEls.optCapitalize.checked, usrEls.optFullwords.checked);
    } else if (mode === 'custom') {
      const prefix = usrEls.customPrefix.value || '';
      const suffix = usrEls.customSuffix.value || '';
      username = generateCustomUsername(len, usrEls.optMidNumbers.checked, usrEls.optMidSymbols.checked, prefix, suffix);
    }

    const opts = {
      random:   `num:${usrEls.optNumbers.checked},sym:${usrEls.optSymbols.checked}`,
      memorable:`cap:${usrEls.optCapitalize.checked},fw:${usrEls.optFullwords.checked}`,
      custom:   `prefix:"${usrEls.customPrefix.value}",suffix:"${usrEls.customSuffix.value}",midNum:${usrEls.optMidNumbers.checked},midSym:${usrEls.optMidSymbols.checked}`
    };
    Log.info('USR-GENERATE', `mode=${mode}, len=${len}, options={${opts[mode]}} → 结果=${username} (长度:${username.length})`);

    const colorMode = mode === 'memorable' ? 'memorable' : 'default';
    usrEls.output.innerHTML = formatStringWithColors(username, colorMode);
    usrEls.btnCopy.textContent = '复制用户名';
    usrEls.btnCopy.classList.remove('success');
  };

  /* ============================================================
   *  5. 通用：复制到剪贴板（带日志+视觉反馈）
   * ============================================================ */
  const copyToClipboard = (text, btnEl, kindText) => {
    navigator.clipboard.writeText(text).then(() => {
      Log.info('Clipboard', `${kindText} 复制成功: ${text}`);
      btnEl.textContent = '已复制！';
      btnEl.classList.add('success');
      setTimeout(() => {
        btnEl.textContent = kindText;
        btnEl.classList.remove('success');
      }, 2000);
    }).catch((err) => {
      Log.error('Clipboard', `${kindText} 复制失败! error=${err && err.message ? err.message : String(err)}`);
      btnEl.textContent = '复制失败';
      btnEl.classList.add('error');
      setTimeout(() => {
        btnEl.textContent = kindText;
        btnEl.classList.remove('error');
      }, 2000);
    });
  };

  /* ============================================================
   *  6. 顶层 Tab 切换
   * ============================================================ */
  const switchTopTab = (tab) => {
    state.activeTopTab = tab;
    topTabBtns.forEach(b => {
      const isActive = b.dataset.topTab === tab;
      b.classList.toggle('active', isActive);
    });
    const showPwd = tab === 'password';
    passwordPanel.classList.toggle('hidden', !showPwd);
    usernamePanel.classList.toggle('hidden', showPwd);
    Log.info('TOP-TAB', `切换顶层面板 → ${showPwd ? '密码生成器' : '用户名生成器'}`);
  };

  /* ============================================================
   *  7. 密码生成器：二级模式切换 + 事件绑定
   * ============================================================ */
  const switchPwdMode = (mode) => {
    state.pwdMode = mode;
    pwdEls.tabs.forEach(t => t.classList.toggle('active', t.dataset.type === mode));
    // 显示对应选项区
    pwdEls.optsRandom.classList.add('hidden');
    pwdEls.optsMemorable.classList.add('hidden');
    pwdEls.optsPin.classList.add('hidden');
    if (mode === 'random')    pwdEls.optsRandom.classList.remove('hidden');
    if (mode === 'memorable') pwdEls.optsMemorable.classList.remove('hidden');
    if (mode === 'pin')       pwdEls.optsPin.classList.remove('hidden');
    // 更新滑块边界 + 重新生成
    const cfg = PWD_MODE_CFG[mode];
    pwdEls.lengthSlider.min = cfg.min;
    pwdEls.lengthSlider.max = cfg.max;
    pwdEls.lengthInput.min  = cfg.min;
    pwdEls.lengthInput.max  = cfg.max;
    syncLength(cfg.default, cfg, pwdEls.lengthSlider, pwdEls.lengthInput, `PWD-${mode}`);
    Log.info('PWD-MODE', `切换密码模式 → ${mode} (范围 ${cfg.min}-${cfg.max}, 默认 ${cfg.default})`);
    generatePassword();
  };

  // 密码二级类型 Tab 点击
  pwdEls.tabs.forEach(tab => {
    tab.addEventListener('click', (e) => switchPwdMode(e.currentTarget.dataset.type));
  });

  // 密码滑块 + 数字输入 联动
  pwdEls.lengthSlider.addEventListener('input', (e) => {
    pwdEls.lengthInput.value = e.target.value;
    updateSliderBackground(pwdEls.lengthSlider);
    generatePassword();
  });
  pwdEls.lengthInput.addEventListener('change', (e) => {
    const cfg = PWD_MODE_CFG[state.pwdMode];
    syncLength(e.target.value, cfg, pwdEls.lengthSlider, pwdEls.lengthInput, `PWD-${state.pwdMode}`);
    generatePassword();
  });
  pwdEls.lengthInput.addEventListener('input', (e) => {
    const cfg = PWD_MODE_CFG[state.pwdMode];
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= cfg.min && v <= cfg.max) {
      pwdEls.lengthSlider.value = v;
      updateSliderBackground(pwdEls.lengthSlider);
      generatePassword();
    }
  });

  // 密码选项开关变化
  [pwdEls.optNumbers, pwdEls.optSymbols, pwdEls.optCapitalize, pwdEls.optFullwords].forEach(o => {
    o.addEventListener('change', generatePassword);
  });

  // 密码复制/刷新按钮
  pwdEls.btnRefresh.addEventListener('click', () => {
    Log.info('PWD-REFRESH', '用户手动刷新密码');
    generatePassword();
  });
  pwdEls.btnCopy.addEventListener('click', () => {
    copyToClipboard(pwdEls.output.textContent, pwdEls.btnCopy, '复制密码');
  });

  /* ============================================================
   *  8. 用户名生成器：二级模式切换 + 事件绑定
   * ============================================================ */
  const switchUsrMode = (mode) => {
    state.usrMode = mode;
    usrEls.tabs.forEach(t => t.classList.toggle('active', t.dataset.type === mode));
    // 显示对应选项区
    usrEls.optsRandom.classList.add('hidden');
    usrEls.optsMemorable.classList.add('hidden');
    usrEls.optsCustom.classList.add('hidden');
    if (mode === 'random')    usrEls.optsRandom.classList.remove('hidden');
    if (mode === 'memorable') usrEls.optsMemorable.classList.remove('hidden');
    if (mode === 'custom')    usrEls.optsCustom.classList.remove('hidden');
    // custom 模式额外显示前后缀输入
    usrEls.customFields.classList.toggle('hidden', mode !== 'custom');
    // 更新滑块边界 + 重新生成
    const cfg = USR_MODE_CFG[mode];
    usrEls.lengthSlider.min = cfg.min;
    usrEls.lengthSlider.max = cfg.max;
    usrEls.lengthInput.min  = cfg.min;
    usrEls.lengthInput.max  = cfg.max;
    syncLength(cfg.default, cfg, usrEls.lengthSlider, usrEls.lengthInput, `USR-${mode}`);
    Log.info('USR-MODE', `切换用户名模式 → ${mode} (范围 ${cfg.min}-${cfg.max}, 默认 ${cfg.default})`);
    generateUsername();
  };

  // 用户名二级类型 Tab 点击
  usrEls.tabs.forEach(tab => {
    tab.addEventListener('click', (e) => switchUsrMode(e.currentTarget.dataset.type));
  });

  // 用户名滑块 + 数字输入 联动
  usrEls.lengthSlider.addEventListener('input', (e) => {
    usrEls.lengthInput.value = e.target.value;
    updateSliderBackground(usrEls.lengthSlider);
    generateUsername();
  });
  usrEls.lengthInput.addEventListener('change', (e) => {
    const cfg = USR_MODE_CFG[state.usrMode];
    syncLength(e.target.value, cfg, usrEls.lengthSlider, usrEls.lengthInput, `USR-${state.usrMode}`);
    generateUsername();
  });
  usrEls.lengthInput.addEventListener('input', (e) => {
    const cfg = USR_MODE_CFG[state.usrMode];
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= cfg.min && v <= cfg.max) {
      usrEls.lengthSlider.value = v;
      updateSliderBackground(usrEls.lengthSlider);
      generateUsername();
    }
  });

  // 用户名选项开关变化
  [usrEls.optNumbers, usrEls.optSymbols,
   usrEls.optCapitalize, usrEls.optFullwords,
   usrEls.optMidNumbers, usrEls.optMidSymbols].forEach(o => {
    o.addEventListener('change', generateUsername);
  });

  // 自定义模式：前后缀输入即时生效
  usrEls.customPrefix.addEventListener('input', generateUsername);
  usrEls.customSuffix.addEventListener('input', generateUsername);

  // 用户名复制/刷新按钮
  usrEls.btnRefresh.addEventListener('click', () => {
    Log.info('USR-REFRESH', '用户手动刷新用户名');
    generateUsername();
  });
  usrEls.btnCopy.addEventListener('click', () => {
    copyToClipboard(usrEls.output.textContent, usrEls.btnCopy, '复制用户名');
  });

  /* ============================================================
   *  9. 顶层 Tab 绑定
   * ============================================================ */
  topTabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => switchTopTab(e.currentTarget.dataset.topTab));
  });

  /* ============================================================
   *  10. 初始化（弹窗打开即生成默认值）
   * ============================================================ */
  const init = () => {
    // 初始化密码生成器：默认 random 模式
    switchPwdMode('random');
    // 初始化用户名生成器：默认 random 模式（不主动触发，切换到该面板时已被 switchTopTab 控制；但这里先预渲染滑块背景一次，避免第一帧样式错乱）
    updateSliderBackground(pwdEls.lengthSlider);
    updateSliderBackground(usrEls.lengthSlider);
    generateUsername(); // 预先生成一次，避免用户切换Tab时看到占位符
    switchTopTab('password'); // 回到默认密码面板
    Log.info('INIT', '弹窗初始化完成。密码模式=random, 用户名模式=random');
  };

  init();
});
