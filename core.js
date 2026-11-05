/* Hesap Makinesi - hesap motoru ve tuş mantığı (tarayıcı + node) */
(function (root) {
  'use strict';

  // ---------- Rasyonel sayılar ----------
  const MAXBITS = 4000;
  const babs = x => (x < 0n ? -x : x);
  const gcd = (a, b) => { a = babs(a); b = babs(b); while (b) { [a, b] = [b, a % b]; } return a; };
  const bitlen = x => babs(x).toString(16).length * 4;

  class MathErr extends Error { constructor() { super('math'); this.kind = 'math'; } }
  class SynErr extends Error { constructor() { super('syntax'); this.kind = 'syntax'; } }

  function R(n, d = 1n) {
    if (d === 0n) throw new MathErr();
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    n /= g; d /= g;
    if (bitlen(n) > MAXBITS || bitlen(d) > MAXBITS) return F(ratToNum(n, d));
    return { ex: true, n, d };
  }
  function F(v) {
    if (!isFinite(v)) throw new MathErr();
    return { ex: false, v };
  }
  function ratToNum(n, d) {
    const a = Number(n), b = Number(d);
    if (isFinite(a) && isFinite(b)) return a / b;
    // çok büyük: ölçekleyerek
    const shift = BigInt(Math.max(bitlen(n), bitlen(d)) - 1000);
    if (shift <= 0n) return a / b;
    return Number(n >> shift) / Number(d >> shift);
  }
  const num = x => (x.ex ? ratToNum(x.n, x.d) : x.v);
  const isInt = x => x.ex && x.d === 1n;
  const isZero = x => (x.ex ? x.n === 0n : x.v === 0);
  const sign = x => (x.ex ? (x.n > 0n ? 1 : x.n < 0n ? -1 : 0) : Math.sign(x.v));

  function add(a, b) { return a.ex && b.ex ? R(a.n * b.d + b.n * a.d, a.d * b.d) : F(num(a) + num(b)); }
  function sub(a, b) { return a.ex && b.ex ? R(a.n * b.d - b.n * a.d, a.d * b.d) : F(num(a) - num(b)); }
  function mul(a, b) { return a.ex && b.ex ? R(a.n * b.n, a.d * b.d) : F(num(a) * num(b)); }
  function div(a, b) {
    if (isZero(b)) throw new MathErr();
    return a.ex && b.ex ? R(a.n * b.d, a.d * b.n) : F(num(a) / num(b));
  }
  function neg(a) { return a.ex ? R(-a.n, a.d) : F(-a.v); }

  function iroot(x, k) { // x>=0 BigInt, k>=1 -> floor(x^(1/k))
    if (x < 2n) return x;
    const kb = BigInt(k);
    let r = BigInt(Math.floor(Math.pow(Number(x), 1 / k)));
    if (r < 1n) r = 1n;
    if (!isFinite(Number(x))) { // Newton
      r = 1n << BigInt(Math.ceil(bitlen(x) / k));
      for (;;) {
        const nr = ((kb - 1n) * r + x / r ** (kb - 1n)) / kb;
        if (nr >= r) break;
        r = nr;
      }
    }
    while (r ** kb > x) r--;
    while ((r + 1n) ** kb <= x) r++;
    return r;
  }
  function exactRoot(a, k) { // a exact, k int >=1; returns exact or null
    if (!a.ex) return null;
    const s = a.n < 0n ? -1n : 1n;
    if (s < 0n && k % 2 === 0) throw new MathErr();
    const n = babs(a.n);
    const rn = iroot(n, k), rd = iroot(a.d, k);
    const kb = BigInt(k);
    if (rn ** kb === n && rd ** kb === a.d) return R(s * rn, rd);
    return null;
  }
  function realRoot(x, k) { // float real k-th root
    if (x < 0) { if (k % 2 === 0) throw new MathErr(); return -Math.pow(-x, 1 / k); }
    return Math.pow(x, 1 / k);
  }
  function sqrt(a) {
    if (sign(a) < 0) throw new MathErr();
    return exactRoot(a, 2) || F(Math.sqrt(num(a)));
  }
  function cbrt(a) { return exactRoot(a, 3) || F(Math.cbrt(num(a))); }
  function nroot(k, a) { // k-th root of a
    if (isZero(k)) throw new MathErr();
    if (isInt(k) && babs(k.n) <= 1000n) {
      const kk = Number(babs(k.n));
      let r = exactRoot(a, kk) || F(realRoot(num(a), kk));
      if (k.n < 0n) r = div(R(1n), r);
      return r;
    }
    return pow(a, div(R(1n), k));
  }
  function pow(a, b) {
    if (isInt(b)) {
      const k = b.n;
      if (isZero(a) && k <= 0n) throw new MathErr();
      if (a.ex && babs(k) <= 100000n && bitlen(a.n) * Number(babs(k)) < MAXBITS && bitlen(a.d) * Number(babs(k)) < MAXBITS) {
        const e = babs(k);
        const r = R(a.n ** e, a.d ** e);
        return k < 0n ? div(R(1n), r) : r;
      }
      const v = Math.pow(num(a), Number(k));
      return F(v);
    }
    const x = num(a), y = num(b);
    if (x < 0) {
      // negatif taban: üs tek paydalı kesirse gerçek kök
      if (b.ex && b.d % 2n === 1n && babs(b.d) <= 1000n) {
        const r = realRoot(x, Number(b.d));
        return F(Math.pow(r, Number(b.n)));
      }
      throw new MathErr();
    }
    if (b.ex && babs(b.d) <= 1000n && babs(b.n) <= 1000n) {
      const r = exactRoot(a, Number(b.d));
      if (r) return pow(r, R(b.n));
    }
    if (x === 0 && y < 0) throw new MathErr();
    return F(Math.pow(x, y));
  }

  // ---------- Sözcükleyici + ayrıştırıcı ----------
  const OPENERS = new Set(['√(', '∛(', '^(', 'xrt(', '⟨', '(']);
  const isDigit = t => t.length === 1 && t >= '0' && t <= '9';

  function lex(toks) {
    const out = [];
    let i = 0;
    while (i < toks.length) {
      const t = toks[i];
      if (isDigit(t) || t === ',' || t === 'E') {
        let ip = '', fp = '', hasComma = false, mant = false;
        while (i < toks.length && (isDigit(toks[i]) || toks[i] === ',')) {
          if (toks[i] === ',') { if (hasComma) throw new SynErr(); hasComma = true; }
          else { if (hasComma) fp += toks[i]; else ip += toks[i]; }
          mant = true; i++;
        }
        if (mant && ip === '' && fp === '') throw new SynErr();
        let n = mant ? BigInt((ip || '0') + fp) : 1n;
        let d = 10n ** BigInt(fp.length);
        if (toks[i] === 'E') {
          i++;
          let s = 1n, ed = '';
          if (toks[i] === '−') { s = -1n; i++; }
          while (i < toks.length && isDigit(toks[i])) { ed += toks[i]; i++; }
          if (ed === '') throw new SynErr();
          const e = BigInt(ed);
          if (e > 400n) { if (s > 0n) throw new MathErr(); n = 0n; d = 1n; }
          else if (s > 0n) n *= 10n ** e; else d *= 10n ** e;
        }
        out.push({ k: 'num', v: R(n, d) });
        continue;
      }
      out.push({ k: t });
      i++;
    }
    return out;
  }

  function parse(toks, env) {
    const L = lex(toks);
    let p = 0;
    const peek = () => L[p] && L[p].k;
    const atEnd = () => p >= L.length;
    const startsPrimary = k => k === 'num' || k === 'π' || k === 'Ans' || k === 'PreAns' || OPENERS.has(k);
    const closesValue = k => k === ')' || k === '⟫' || k === '⟩' || k === 'π' || k === 'Ans' || k === 'PreAns' || k === '²' || k === '%';

    function expect(k, optionalAtEnd) {
      if (peek() === k) { p++; return; }
      if (optionalAtEnd && atEnd()) return;
      throw new SynErr();
    }
    function expr() {
      let v = term();
      while (peek() === '+' || peek() === '−') {
        const op = L[p++].k;
        const r = term();
        v = op === '+' ? add(v, r) : sub(v, r);
      }
      return v;
    }
    function term() {
      let v = factor();
      while (peek() === '×' || peek() === '÷') {
        const op = L[p++].k;
        const r = factor();
        v = op === '×' ? mul(v, r) : div(v, r);
      }
      return v;
    }
    function factor() {
      let v = unary();
      for (;;) {
        const k = peek();
        if (k === undefined) break;
        const prev = L[p - 1] && L[p - 1].k;
        if ((startsPrimary(k) && k !== 'num') || (k === 'num' && closesValue(prev))) v = mul(v, power());
        else break;
      }
      return v;
    }
    function unary() {
      if (peek() === '−') { p++; return neg(unary()); }
      if (peek() === '+') { p++; return unary(); }
      return power();
    }
    function power() {
      let v = postfix();
      while (peek() === '^(') {
        p++;
        const e = expr();
        expect('⟫', true);
        v = applyPostfix(pow(v, e));
      }
      return v;
    }
    function applyPostfix(v) {
      for (;;) {
        if (peek() === '²') { p++; v = mul(v, v); }
        else if (peek() === '%') { p++; v = div(v, R(100n)); }
        else return v;
      }
    }
    function postfix() { return applyPostfix(primary()); }
    function primary() {
      const t = L[p];
      if (!t) throw new SynErr();
      p++;
      switch (t.k) {
        case 'num': return t.v;
        case 'π': return F(Math.PI);
        case 'Ans': return env.ans || R(0n);
        case 'PreAns': return env.preAns || R(0n);
        case '(': { const v = expr(); expect(')', true); return v; }
        case '√(': { const v = expr(); expect('⟫', true); return sqrt(v); }
        case '∛(': { const v = expr(); expect('⟫', true); return cbrt(v); }
        case 'xrt(': { const k = expr(); expect('‖'); const v = expr(); expect('⟫', true); return nroot(k, v); }
        case '⟨': { const a = expr(); expect('|'); const b = expr(); expect('⟩', true); return div(a, b); }
        default: throw new SynErr();
      }
    }
    if (atEnd()) throw new SynErr();
    const v = expr();
    if (!atEnd()) throw new SynErr();
    return v;
  }

  function evaluate(toks, env = {}) {
    try { return { ok: true, v: parse(toks, env) }; }
    catch (e) {
      if (e.kind === 'math') return { ok: false, err: 'math' };
      if (e.kind === 'syntax') return { ok: false, err: 'syntax' };
      if (e instanceof RangeError) return { ok: false, err: 'math' };
      throw e;
    }
  }

  // ---------- Biçimlendirme (Türkçe: 5.005,25) ----------
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  const supStr = s => String(s).split('').map(c => SUP[c] || c).join('');
  const group = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  function sigDigits(x, sig) {
    if (x.ex) {
      const neg = x.n < 0n, n = babs(x.n), d = x.d;
      let e = n.toString().length - d.toString().length;
      const ge = e >= 0 ? n >= d * 10n ** BigInt(e) : n * 10n ** BigInt(-e) >= d;
      if (!ge) e -= 1;
      const sh = sig - 1 - e;
      let q = sh >= 0 ? (n * 10n ** BigInt(sh) * 2n + d) / (2n * d) : (n * 2n + d * 10n ** BigInt(-sh)) / (2n * d * 10n ** BigInt(-sh));
      if (q.toString().length > sig) { q /= 10n; e += 1; }
      return { neg, digits: q.toString(), e };
    }
    const s = Math.abs(x.v).toExponential(sig - 1);
    const [m, ex] = s.split('e');
    return { neg: x.v < 0, digits: m.replace('.', ''), e: parseInt(ex, 10) };
  }
  function sci(neg, digits, e, sup) {
    const dg = digits.replace(/0+$/, '') || '0';
    const m = dg[0] + (dg.length > 1 ? ',' + dg.slice(1) : '');
    return (neg ? '−' : '') + m + '×10' + (sup ? supStr(e) : '^' + e);
  }
  function format(x, opt = {}) {
    const fix = opt.fix == null ? null : opt.fix;
    const sup = opt.sup !== false;
    if (isZero(x)) return fix ? '0,' + '0'.repeat(fix) : '0';
    if (isInt(x) && babs(x.n) < 10n ** 15n) {
      const s = group(babs(x.n).toString());
      return (x.n < 0n ? '−' : '') + s + (fix ? ',' + '0'.repeat(fix) : '');
    }
    const probe = sigDigits(x, 15);
    if (probe.e >= 15 || probe.e < -9) {
      const s = sigDigits(x, 10);
      return sci(s.neg, s.digits, s.e, sup);
    }
    if (fix != null) {
      let neg, q;
      if (x.ex) {
        neg = x.n < 0n;
        const n = babs(x.n), sc = 10n ** BigInt(fix);
        q = (n * sc * 2n + x.d) / (2n * x.d);
      } else {
        neg = x.v < 0;
        q = BigInt(Math.round(Math.abs(x.v) * Math.pow(10, fix)));
      }
      let s = q.toString().padStart(fix + 1, '0');
      const ip = s.slice(0, s.length - fix), fp = s.slice(s.length - fix);
      if (q === 0n) neg = false;
      return (neg ? '−' : '') + group(ip) + (fix ? ',' + fp : '');
    }
    const sig = probe.e + 1 >= 10 ? 15 : 10;
    const s = sigDigits(x, sig);
    let { digits, e } = s;
    let ip, fp;
    if (e >= 0) {
      digits = digits.padEnd(e + 1, '0');
      ip = digits.slice(0, e + 1); fp = digits.slice(e + 1);
    } else {
      ip = '0'; fp = '0'.repeat(-e - 1) + digits;
    }
    fp = fp.replace(/0+$/, '');
    const out = group(ip) + (fp ? ',' + fp : '');
    return (s.neg && out !== '0' ? '−' : '') + out;
  }
  function asFraction(x) {
    if (!x.ex || x.d === 1n) return null;
    if (x.d >= 10n ** 10n || babs(x.n) >= 10n ** 10n) return null;
    return { neg: x.n < 0n, n: babs(x.n).toString(), d: x.d.toString() };
  }
  function fractionText(x) {
    const f = asFraction(x);
    return f ? (f.neg ? '−' : '') + f.n + '/' + f.d : null;
  }

  // ---------- Serileştirme ----------
  const ser = x => (x == null ? null : x.ex ? { n: x.n.toString(), d: x.d.toString() } : { v: x.v });
  const deser = o => (o == null ? null : 'v' in o ? { ex: false, v: o.v } : { ex: true, n: BigInt(o.n), d: BigInt(o.d) });

  // ---------- Tuş mantığı ----------
  const CLOSERS = new Set(['⟫', '⟩', '|', '‖']);
  const TEMPLATES = { '√(': ['√(', '⟫'], '∛(': ['∛(', '⟫'], '^(': ['^(', '⟫'], 'xrt(': ['xrt(', '‖', '⟫'], '⟨': ['⟨', '|', '⟩'] };

  function newState() {
    return { tokens: [], cp: 0, lines: [], ans: R(0n), preAns: R(0n), shift: false, error: null, recall: -1 };
  }

  function templateSpan(toks, start) {
    let depth = 0;
    const parts = [start];
    for (let i = start; i < toks.length; i++) {
      const t = toks[i];
      if (TEMPLATES[t]) { depth++; continue; }
      if (t === '⟫' || t === '⟩') { depth--; if (depth === 0) { parts.push(i); return parts; } continue; }
      if ((t === '|' || t === '‖') && depth === 1) parts.push(i);
    }
    return null;
  }
  function openerOf(toks, i) {
    let depth = 0;
    for (let j = i - 1; j >= 0; j--) {
      const t = toks[j];
      if (t === '⟫' || t === '⟩') depth++;
      else if (TEMPLATES[t]) { if (depth === 0) return j; depth--; }
    }
    return -1;
  }

  function insert(st, arr, cursorOffset) {
    st.tokens.splice(st.cp, 0, ...arr);
    st.cp += cursorOffset == null ? arr.length : cursorOffset;
  }
  const AUTO_ANS = new Set(['+', '−', '×', '÷', '²', '%', '^(']);

  function backspace(st) {
    if (st.cp === 0) return;
    const t = st.tokens[st.cp - 1];
    if (CLOSERS.has(t)) {
      const o = openerOf(st.tokens, st.cp - 1);
      const span = o >= 0 ? templateSpan(st.tokens, o) : null;
      if (span && span[span.length - 1] - o === span.length - 1) {
        st.tokens.splice(o, span.length); st.cp = o; return;
      }
      st.cp -= 1; return;
    }
    if (TEMPLATES[t]) {
      const span = templateSpan(st.tokens, st.cp - 1);
      if (span && span[span.length - 1] - span[0] === span.length - 1) {
        st.tokens.splice(span[0], span.length); st.cp = span[0];
      } else st.cp -= 1;
      return;
    }
    st.tokens.splice(st.cp - 1, 1); st.cp -= 1;
  }

  function closeParen(st) {
    const next = st.tokens[st.cp];
    if (next === '⟫' || next === '⟩' || next === '|' || next === '‖') {
      const o = openerOf(st.tokens, st.cp);
      let bal = 0;
      for (let i = o + 1; i < st.cp; i++) {
        const t = st.tokens[i];
        if (t === '(') bal++; else if (t === ')') bal--;
        else if (CLOSERS.has(t)) bal = 0;
      }
      if (bal <= 0) { st.cp += 1; return; }
    }
    insert(st, [')']);
  }

  function press(st, key) {
    const fx = [];
    if (st.error && key !== 'shift') {
      st.error = null;
      if (key === 'ac' || key === 'left' || key === 'right' || key === 'del') { if (key !== 'ac') return fx; }
    }
    const sh = st.shift;
    if (key === 'shift') { st.shift = !st.shift; return fx; }
    st.shift = false;
    if (sh) {
      const map = { lp: 'percent', sqrt: 'cbrt', pow: 'xrt', exp: 'pi', ans: 'preans', ac: 'clrall', '0': 'copy', eq: 'history' };
      if (map[key]) key = map[key];
    }
    const emptyAfterEval = st.tokens.length === 0 && st.lines.length > 0;
    const ins = (arr, off) => {
      if (emptyAfterEval && AUTO_ANS.has(arr[0])) { st.tokens = ['Ans']; st.cp = 1; }
      insert(st, arr, off);
      st.recall = -1;
    };

    switch (key) {
      case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9': ins([key]); break;
      case 'comma': ins([',']); break;
      case 'add': ins(['+']); break;
      case 'sub': ins(['−']); break;
      case 'mul': ins(['×']); break;
      case 'div': ins(['÷']); break;
      case 'lp': ins(['(']); break;
      case 'rp': closeParen(st); break;
      case 'percent': ins(['%']); break;
      case 'sq': ins(['²']); break;
      case 'pow': ins(TEMPLATES['^('], 1); break;
      case 'xrt': ins(TEMPLATES['xrt('], 1); break;
      case 'sqrt': ins(TEMPLATES['√('], 1); break;
      case 'cbrt': ins(TEMPLATES['∛('], 1); break;
      case 'frac': ins(TEMPLATES['⟨'], 1); break;
      case 'exp': ins(['E']); break;
      case 'pi': ins(['π']); break;
      case 'ans': ins(['Ans']); break;
      case 'preans': ins(['PreAns']); break;
      case 'del': backspace(st); break;
      case 'ac': st.tokens = []; st.cp = 0; st.recall = -1; break;
      case 'clrall': fx.push({ type: 'confirmClear' }); break;
      case 'copy': fx.push({ type: 'copy' }); break;
      case 'history': fx.push({ type: 'openHistory' }); break;
      case 'left': if (st.cp > 0) st.cp--; break;
      case 'right': if (st.cp < st.tokens.length) st.cp++; break;
      case 'up': {
        if (!st.lines.length) break;
        st.recall = st.recall < 0 ? st.lines.length - 1 : Math.max(0, st.recall - 1);
        st.tokens = st.lines[st.recall].tokens.slice(); st.cp = st.tokens.length; break;
      }
      case 'down': {
        if (st.recall < 0) break;
        if (st.recall >= st.lines.length - 1) { st.recall = -1; st.tokens = []; st.cp = 0; break; }
        st.recall++; st.tokens = st.lines[st.recall].tokens.slice(); st.cp = st.tokens.length; break;
      }
      case 'eq': case 'sd': {
        if (!st.tokens.length) {
          if (key === 'sd' && st.lines.length) {
            const l = st.lines[st.lines.length - 1];
            if (asFraction(l.v)) l.frac = !l.frac;
          }
          break;
        }
        const r = evaluate(st.tokens, st);
        if (!r.ok) { st.error = r.err; break; }
        const line = { tokens: st.tokens.slice(), v: r.v, frac: key === 'sd' && !!asFraction(r.v), t: Date.now(), ansUsed: st.ans, preUsed: st.preAns };
        st.lines.push(line);
        if (st.lines.length > 60) st.lines.shift();
        st.preAns = st.ans; st.ans = r.v;
        st.tokens = []; st.cp = 0; st.recall = -1;
        fx.push({ type: 'historyAdd', line });
        break;
      }
      default: break;
    }
    return fx;
  }

  function live(st) {
    if (!st.tokens.length) return null;
    const r = evaluate(st.tokens, st);
    return r.ok ? r.v : null;
  }

  function pasteTokens(text) {
    let s = String(text).trim().replace(/\s+/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else s = s.replace(/\./g, ',');
    const map = { '*': '×', 'x': '×', '×': '×', '/': '÷', '÷': '÷', '-': '−', '−': '−', '+': '+', '(': '(', ')': ')', ',': ',', '%': '%' };
    const out = [];
    for (const c of s) {
      if (c >= '0' && c <= '9') out.push(c);
      else if (map[c]) out.push(map[c]);
      else return null;
    }
    return out.length ? out : null;
  }

  const api = { R, F, num, evaluate, format, asFraction, fractionText, newState, press, live, ser, deser, pasteTokens, templateSpan, TEMPLATES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof self !== 'undefined' ? self : this);
