/* Hesap Makinesi - arayüz */
(function () {
  'use strict';
  const C = window.Calc;
  const VERSION = '1.0.1';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  const settings = Object.assign({ fix: 'norm', sound: false, theme: 'lacivert' }, store.get('hm.set', {}));
  let history = store.get('hm.hist', []);
  const st = C.newState();
  (function restore() {
    const s = store.get('hm.state', null);
    if (!s) return;
    try {
      st.lines = (s.lines || []).map(l => ({ tokens: l.tokens, v: C.deser(l.v), frac: !!l.frac, t: l.t, ansUsed: C.deser(l.a), preUsed: C.deser(l.p) }));
      st.ans = C.deser(s.ans) || st.ans;
      st.preAns = C.deser(s.preAns) || st.preAns;
    } catch (e) { st.lines = []; }
  })();
  function saveState() {
    store.set('hm.state', {
      lines: st.lines.slice(-30).map(l => ({ tokens: l.tokens, v: C.ser(l.v), frac: l.frac, t: l.t, a: C.ser(l.ansUsed), p: C.ser(l.preUsed) })),
      ans: C.ser(st.ans), preAns: C.ser(st.preAns)
    });
  }
  const saveHist = () => store.set('hm.hist', history.slice(-500));
  const saveSet = () => store.set('hm.set', settings);

  const fmtOpt = () => ({ fix: settings.fix === 'norm' ? null : +settings.fix });
  function valueHTML(v, frac) {
    if (frac) {
      const f = C.asFraction(v);
      if (f) return (f.neg ? '−' : '') + `<span class="fr"><span class="nu">${f.n}</span><span class="de">${f.d}</span></span>`;
    }
    return esc(C.format(v, fmtOpt()));
  }
  function valueText(v, frac) {
    if (frac) { const t = C.fractionText(v); if (t) return t; }
    return C.format(v, Object.assign(fmtOpt(), { sup: false }));
  }

  const CLOSE_OR_SEP = new Set(['⟫', '⟩', '|', '‖']);
  function tokensHTML(toks, cp, ctx) {
    const out = [];
    const stack = [];
    const CUR = '<span class="cr"></span>';
    let inExp = false;
    const slotIfEmpty = i => { if (CLOSE_OR_SEP.has(toks[i]) && cp !== i) out.push('<span class="slot"></span>'); };
    const dotBefore = [];
    for (let i = 0; i < toks.length;) {
      if (/^\d$/.test(toks[i]) && toks[i - 1] !== ',' && toks[i - 1] !== 'E' && !(toks[i - 1] === '−' && toks[i - 2] === 'E') && !/^\d$/.test(toks[i - 1] || '')) {
        let j = i; while (j < toks.length && /^\d$/.test(toks[j])) j++;
        for (let k = i + 1; k < j; k++) if ((j - k) % 3 === 0) dotBefore[k] = true;
        i = j;
      } else if (toks[i] === ',' || toks[i] === 'E') {
        i++; while (i < toks.length && (/^\d$/.test(toks[i]) || (toks[i] === '−' && toks[i - 1] === 'E'))) i++;
      } else i++;
    }
    for (let i = 0; i <= toks.length; i++) {
      const t = toks[i];
      if (inExp && !(t !== undefined && (/^\d$/.test(t) || (t === '−' && toks[i - 1] === 'E')))) {
        if (toks[i - 1] === 'E' && cp !== i) out.push('<span class="slot"></span>');
        if (cp === i) { out.push(CUR); cp = -1; }
        out.push('</sup>'); inExp = false;
      }
      if (dotBefore[i]) out.push('.');
      if (cp === i) out.push(CUR);
      if (t === undefined) break;
      switch (t) {
        case '⟨': stack.push('fr'); out.push('<span class="fr"><span class="nu">'); slotIfEmpty(i + 1); break;
        case '|': out.push('</span><span class="de">'); slotIfEmpty(i + 1); break;
        case '⟩': stack.pop(); out.push('</span></span>'); break;
        case '√(': stack.push('rad'); out.push('<span class="rad"><span class="rs">√</span><span class="ri">'); slotIfEmpty(i + 1); break;
        case '∛(': stack.push('rad'); out.push('<span class="rad"><span class="rs" style="padding-left:.3em"><span class="ix">3</span>√</span><span class="ri">'); slotIfEmpty(i + 1); break;
        case 'xrt(': stack.push('rad'); out.push('<span class="rad"><span class="rs" style="padding-left:.45em"><span class="ix">'); slotIfEmpty(i + 1); break;
        case '‖': out.push('</span>√</span><span class="ri">'); slotIfEmpty(i + 1); break;
        case '^(': stack.push('sup'); out.push('<sup>'); slotIfEmpty(i + 1); break;
        case '⟫': { const s = stack.pop(); out.push(s === 'sup' ? '</sup>' : '</span></span>'); break; }
        case '²': out.push('<sup>2</sup>'); break;
        case 'E': out.push('×10<sup>'); inExp = true; break;
        case 'Ans': out.push(ctx && ctx.ans ? '(' + esc(C.format(ctx.ans, fmtOpt())) + ')' : 'Ans'); break;
        case 'PreAns': out.push(ctx && ctx.pre ? '(' + esc(C.format(ctx.pre, fmtOpt())) + ')' : 'PreAns'); break;
        default: out.push(esc(t));
      }
    }
    return out.join('');
  }

  const lcd = $('lcd');
  function fit(el, minPx) {
    el.style.fontSize = '';
    let fs = parseFloat(getComputedStyle(el).fontSize);
    let guard = 0;
    while (el.scrollWidth > el.clientWidth + 1 && fs > minPx && guard++ < 40) { fs -= 2; el.style.fontSize = fs + 'px'; }
  }
  function render() {
    const lines = st.lines.slice(-25);
    const base = st.lines.length - lines.length;
    let h = '';
    lines.forEach((l, i) => {
      h += `<div class="ln tap" data-line="${base + i}"><div class="e">${tokensHTML(l.tokens, -1)}</div><div class="r">${valueHTML(l.v, l.frac)}</div></div>`;
    });
    let res = '';
    let cls = 'r';
    if (st.error) { res = st.error === 'math' ? 'Matematik Hatası' : 'Sözdizimi Hatası'; cls += ' err'; }
    else { const v = C.live(st); res = v ? valueHTML(v, false) : ''; }
    h += `<div class="cur"><div class="e">${tokensHTML(st.tokens, st.cp)}</div><div class="${cls}">${res}</div></div>`;
    lcd.innerHTML = h;
    lcd.querySelectorAll('.r').forEach(r => fit(r, r.closest('.cur') ? 18 : 12));
    document.body.classList.toggle('shift', st.shift);
    $('status').textContent = (st.shift ? 'S · ' : '') + (settings.fix === 'norm' ? 'NORM' : 'FIX ' + settings.fix);
  }

  let actx = null;
  function click() {
    if (!settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square'; o.frequency.value = 1800;
      g.gain.setValueAtTime(0.06, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.03);
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.035);
    } catch (e) { }
  }

  let toastT = null;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 1600);
  }

  function open(id) {
    document.querySelectorAll('.sheet').forEach(s => { s.hidden = true; });
    if (id === 'history') renderHistory();
    if (id === 'settings') renderSettings();
    if (id === 'themes') renderThemes();
    $(id).hidden = false;
  }
  function closeAll() { document.querySelectorAll('.sheet').forEach(s => { s.hidden = true; }); }
  document.querySelectorAll('.sheet').forEach(s => {
    s.addEventListener('click', e => {
      if (e.target === s) { closeAll(); return; }
      const o = e.target.closest('[data-open]'); if (o) { open(o.dataset.open); return; }
      if (e.target.closest('[data-close]')) closeAll();
    });
  });
  $('btnMenu').onclick = () => open('menu');
  $('btnSettings').onclick = () => open('settings');
  $('btnTheme').onclick = () => open('themes');

  function dayLabel(t) { return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function timeLabel(t) { return new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }
  function renderHistory() {
    const list = $('paperList');
    if (!history.length) { list.innerHTML = '<div class="empty">Henüz hesap yok. Yaptığın hesaplar burada birikir.</div>'; return; }
    let h = '', last = '';
    for (let i = history.length - 1; i >= 0; i--) {
      const e = history[i];
      const d = dayLabel(e.t);
      if (d !== last) { h += `<div class="pd">${d}</div>`; last = d; }
      const v = C.deser(e.v);
      h += `<div class="pe" data-h="${i}"><span class="t">${timeLabel(e.t)}</span>${tokensHTML(e.tokens, -1, { ans: C.deser(e.a), pre: C.deser(e.p) })} = <b>${valueHTML(v, false)}</b></div>`;
    }
    list.innerHTML = h;
  }
  $('paperList').addEventListener('click', e => {
    const r = e.target.closest('[data-h]');
    if (!r) return;
    const en = history[+r.dataset.h];
    st.tokens = en.tokens.slice(); st.cp = st.tokens.length; st.error = null;
    closeAll(); render();
  });
  function confirmClear(text, fn) {
    $('confirmText').textContent = text;
    $('confirmOk').onclick = () => { fn(); closeAll(); render(); };
    open('confirm');
  }
  const clearHistory = () => { history = []; saveHist(); toast('Geçmiş temizlendi'); };
  $('histClear').onclick = () => confirmClear('Geçmiş tamamen silinsin mi?', clearHistory);
  $('setClear').onclick = () => confirmClear('Geçmiş tamamen silinsin mi?', clearHistory);

  function renderSettings() {
    $('segFix').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.fix === String(settings.fix)));
    $('togSound').setAttribute('aria-checked', settings.sound ? 'true' : 'false');
  }
  $('segFix').addEventListener('click', e => {
    const b = e.target.closest('[data-fix]'); if (!b) return;
    settings.fix = b.dataset.fix; saveSet(); renderSettings(); render();
  });
  $('togSound').onclick = () => { settings.sound = !settings.sound; saveSet(); renderSettings(); click(); };

  const THEMES = [
    { id: 'lacivert', name: 'Lacivert', body: '#1B2333', lcd: '#EEF1E6', key: '#3A4864', acc: '#E07A2E' },
    { id: 'gece', name: 'Gece', body: '#111214', lcd: '#D9DDCB', key: '#33363B', acc: '#E3A33A' },
    { id: 'kagit', name: 'Kağıt', body: '#E7E1D3', lcd: '#FBFAF4', key: '#FAF7EF', acc: '#C8553D' }
  ];
  function applyTheme() {
    document.body.dataset.theme = settings.theme;
    const t = THEMES.find(x => x.id === settings.theme) || THEMES[0];
    document.querySelector('meta[name=theme-color]').setAttribute('content', t.body);
  }
  function renderThemes() {
    $('themeList').innerHTML = THEMES.map(t => `<button class="th${t.id === settings.theme ? ' on' : ''}" data-theme="${t.id}"><div class="sw" style="background:${t.body}"><i style="background:${t.lcd}"></i><b><span style="background:${t.key}"></span><span style="background:${t.key}"></span><span style="background:${t.acc}"></span></b></div>${t.name}</button>`).join('');
  }
  $('themeList').addEventListener('click', e => {
    const b = e.target.closest('[data-theme]'); if (!b) return;
    settings.theme = b.dataset.theme; saveSet(); applyTheme(); renderThemes();
  });

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise((res, rej) => {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); } finally { ta.remove(); }
    });
  }
  $('clipCopy').onclick = () => {
    const lv = C.live(st);
    let text = null;
    if (lv) text = valueText(lv, false);
    else if (st.lines.length) { const l = st.lines[st.lines.length - 1]; text = valueText(l.v, l.frac); }
    closeAll();
    if (!text) { toast('Kopyalanacak sonuç yok'); return; }
    copyText(text).then(() => toast('Kopyalandı: ' + text), () => toast('Kopyalanamadı'));
  };
  $('clipPaste').onclick = async () => {
    closeAll();
    try {
      const txt = await navigator.clipboard.readText();
      const t = C.pasteTokens(txt);
      if (!t) { toast('Panodaki metin sayı değil'); return; }
      st.tokens.splice(st.cp, 0, ...t); st.cp += t.length; st.error = null;
      render();
    } catch (e) { toast('Pano okunamadı'); }
  };

  function handle(key) {
    click();
    const fx = C.press(st, key);
    for (const f of fx) {
      if (f.type === 'historyAdd') {
        const l = f.line;
        history.push({ tokens: l.tokens, v: C.ser(l.v), t: l.t, a: C.ser(l.ansUsed), p: C.ser(l.preUsed) });
        saveHist();
      } else if (f.type === 'confirmClear') {
        confirmClear('Ekran ve geçmiş tamamen silinsin mi?', () => { st.lines = []; st.tokens = []; st.cp = 0; history = []; saveHist(); saveState(); });
      } else if (f.type === 'copy') open('clip');
      else if (f.type === 'openHistory') open('history');
    }
    saveState();
    render();
  }
  $('kb').addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (b) handle(b.dataset.k);
  });
  lcd.addEventListener('click', e => {
    const l = e.target.closest('[data-line]');
    if (!l) return;
    const line = st.lines[+l.dataset.line];
    if (!line) return;
    st.tokens = line.tokens.slice(); st.cp = st.tokens.length; st.error = null; st.recall = +l.dataset.line;
    render();
  });
  const KEYS = { '+': 'add', '-': 'sub', '*': 'mul', 'x': 'mul', '/': 'div', '(': 'lp', ')': 'rp', ',': 'comma', '.': 'comma', 'Enter': 'eq', '=': 'eq', 'Backspace': 'del', 'Escape': 'ac', 'Delete': 'ac', 'ArrowLeft': 'left', 'ArrowRight': 'right', 'ArrowUp': 'up', 'ArrowDown': 'down', '%': 'percent', '^': 'pow', 'p': 'pi', 'r': 'sqrt', 's': 'sd' };
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey) return;
    if (!document.querySelectorAll('.sheet:not([hidden])').length) {
      let k = /^\d$/.test(e.key) ? e.key : KEYS[e.key];
      if (k === 'percent') { st.shift = true; k = 'lp'; }
      else if (k === 'pi') { st.shift = true; k = 'exp'; }
      if (k) { e.preventDefault(); handle(k); }
    } else if (e.key === 'Escape') closeAll();
  });

  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());

  $('ver').textContent = 'sürüm ' + VERSION;
  applyTheme();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.__hm = { st, handle, render, settings };
})();
