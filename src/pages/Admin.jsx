import { useState, useEffect, useRef, useCallback } from 'react';
import { decks as initialDecks, colorMeta, playstyleMeta } from '../data/decks';
import { coupons as initialCoupons } from '../data/coupons';
import {
  Plus, Trash2, Edit2, Download, X, Check,
  ChevronUp, ChevronDown, Upload, Settings, Lock, Eye, EyeOff, Github,
  ImagePlus, Loader2, RefreshCw, ArrowUpDown, Tag
} from 'lucide-react';

// ─── Color / gradient presets ─────────────────────────────────────────────────
const COLOR_PRESETS = {
  red:          { accentColor: '#ef4444', gradientFrom: '#1a0000', gradientTo: '#0a0000', glowClass: 'glow-red' },
  blue:         { accentColor: '#3b82f6', gradientFrom: '#00001a', gradientTo: '#000010', glowClass: 'glow-blue' },
  black:        { accentColor: '#7c3aed', gradientFrom: '#0d0020', gradientTo: '#050010', glowClass: 'glow-purple' },
  white:        { accentColor: '#f59e0b', gradientFrom: '#1a1400', gradientTo: '#0a0a00', glowClass: 'glow-gold' },
  green:        { accentColor: '#22c55e', gradientFrom: '#001a00', gradientTo: '#000a00', glowClass: 'glow-green' },
  'black,white':{ accentColor: '#d4af37', gradientFrom: '#1a0a0a', gradientTo: '#0a0a1a', glowClass: 'glow-gold' },
  'black,green':{ accentColor: '#22c55e', gradientFrom: '#0d0020', gradientTo: '#001a00', glowClass: 'glow-green' },
  'black,red':  { accentColor: '#ef4444', gradientFrom: '#1a0000', gradientTo: '#0d0020', glowClass: 'glow-red' },
  'blue,red':   { accentColor: '#818cf8', gradientFrom: '#1a0000', gradientTo: '#00001a', glowClass: 'glow-blue' },
  'blue,white': { accentColor: '#60a5fa', gradientFrom: '#00001a', gradientTo: '#1a1400', glowClass: 'glow-blue' },
  'green,white':{ accentColor: '#4ade80', gradientFrom: '#001a00', gradientTo: '#1a1400', glowClass: 'glow-green' },
  'blue,green': { accentColor: '#34d399', gradientFrom: '#00001a', gradientTo: '#001a00', glowClass: 'glow-green' },
  'red,white':  { accentColor: '#f87171', gradientFrom: '#1a0000', gradientTo: '#1a1400', glowClass: 'glow-red' },
  'green,red':  { accentColor: '#f97316', gradientFrom: '#1a0000', gradientTo: '#001a00', glowClass: 'glow-red' },
  'black,blue': { accentColor: '#818cf8', gradientFrom: '#00001a', gradientTo: '#0d0020', glowClass: 'glow-blue' },
  'colorless':  { accentColor: '#9ca3af', gradientFrom: '#1a1a1a', gradientTo: '#0d0d0d', glowClass: 'glow-gray' },
};
const COLOR_LABELS = {
  red: 'Mono Red', blue: 'Mono Blue', black: 'Mono Black', white: 'Mono White', green: 'Mono Green',
  'black,white': 'White / Black', 'black,green': 'Black / Green', 'black,red': 'Black / Red',
  'blue,red': 'Blue / Red', 'blue,white': 'Blue / White', 'green,white': 'Green / White',
  'blue,green': 'Simic', 'red,white': 'Red / White', 'green,red': 'Gruul', 'black,blue': 'Dimir', 'colorless': 'Colorless',
};
const MTG_COLORS = [
  { key: 'white',     symbol: 'W', hex: '#f59e0b' },
  { key: 'blue',      symbol: 'U', hex: '#3b82f6' },
  { key: 'black',     symbol: 'B', hex: '#7c3aed' },
  { key: 'red',       symbol: 'R', hex: '#ef4444' },
  { key: 'green',     symbol: 'G', hex: '#22c55e' },
  { key: 'colorless', symbol: '◇', hex: '#9ca3af' },
];
// Difficulty is now a 0–10 numeric scale (step 0.5)
const REPO_OWNER = 'lotustemplar';
const REPO_NAME  = 'lotus-pro-decks';

function colorKey(c) { return [...c].sort().join(','); }
function toSlug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Append -commander-deck if not already present — boosts SEO for deck URLs
  return base.endsWith('-commander-deck') ? base : `${base}-commander-deck`;
}
function deriveColorMeta(colors) {
  if (!colors.length) return { accentColor: '#6366f1', gradientFrom: '#0a0a1a', gradientTo: '#1a0a1a', glowClass: 'glow-purple', colorLabel: 'Colorless' };
  if (colors.length === 1 && colors[0] === 'colorless') return { accentColor: '#9ca3af', gradientFrom: '#1a1a1a', gradientTo: '#0d0d0d', glowClass: 'glow-gray', colorLabel: 'Colorless' };
  if (colors.length >= 3) return { accentColor: '#ec4899', gradientFrom: '#1a001a', gradientTo: '#001a1a', glowClass: 'glow-pink', colorLabel: 'Multicolor' };
  const key = colorKey(colors);
  const preset = COLOR_PRESETS[key] || COLOR_PRESETS[colors[0]] || COLOR_PRESETS.black;
  return { ...preset, colorLabel: COLOR_LABELS[key] || colors.map(c => c[0].toUpperCase() + c.slice(1)).join(' / ') };
}
function imageFilename(p) { return p ? p.split('/').pop() : ''; }
function buildImagePath(f) { return f ? `${import.meta.env.BASE_URL}images/${f}` : null; }

// ─── Hash helper ──────────────────────────────────────────────────────────────
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────
function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

async function testGitHubToken(token) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`,
    { headers: ghHeaders(token) }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const j = await res.json();
  // Verify we have push access
  if (!j.permissions?.push) throw new Error('Token is read-only — enable Contents: Write');
  return true;
}

async function ghPut(path, content, message, token) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  const headers = ghHeaders(token);
  let sha;
  const check = await fetch(url, { headers });
  if (check.ok) { const j = await check.json(); sha = j.sha; }
  const body = { message, content, ...(sha ? { sha } : {}) };
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'GitHub API error'); }
  return res.json();
}

async function uploadToGitHub(file, token) {
  const filename = file.name.toLowerCase().replace(/\s+/g, '-');
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  await ghPut(`public/images/${filename}`, base64, `Add deck image: ${filename}`, token);
  return filename;
}

async function pushDecksJs(deckList, token, message = 'Update decks via admin panel') {
  const content = btoa(unescape(encodeURIComponent(generateDecksJs(deckList))));
  await ghPut('src/data/decks.js', content, message, token);
}

// ─── Generate / push coupons.js ───────────────────────────────────────────────
function generateCouponsJs(list) {
  const entries = list.map(c =>
    `  { code: ${JSON.stringify(c.code)}, percent: ${c.percent}, active: ${c.active}, multiUse: ${c.multiUse}, description: ${JSON.stringify(c.description || '')} }`
  ).join(',\n');
  return `export const coupons = [\n${entries}\n];\n`;
}

async function pushCouponsJs(list, token) {
  const content = btoa(unescape(encodeURIComponent(generateCouponsJs(list))));
  await ghPut('src/data/coupons.js', content, 'Update coupons via admin panel', token);
}

// ─── Generate decks.js content ────────────────────────────────────────────────
function generateDecksJs(deckList) {
  const entries = deckList.map(deck => {
    const fn = imageFilename(deck.image);
    const imageStr = fn ? `\`\${import.meta.env.BASE_URL}images/${fn}\`` : 'null';
    const decklist = deck.fullDecklist
      .map(s => `      { section: ${JSON.stringify(s.section)}, cards: ${JSON.stringify(s.cards)} }`)
      .join(',\n');
    const included = (deck.included || []).map(i => `"${i}"`).join(', ');
    // Elite tier fields (optional — omitted entirely for single-tier decks)
    const eliteDecklist = (deck.eliteDecklist || [])
      .map(s => `      { section: ${JSON.stringify(s.section)}, cards: ${JSON.stringify(s.cards)} }`)
      .join(',\n');
    const eliteIncluded = (deck.eliteIncluded || []).map(i => `"${i}"`).join(', ');
    const eliteFields = deck.elitePrice != null ? `
    elitePrice: ${deck.elitePrice},
    eliteStripePrice: ${JSON.stringify(deck.eliteStripePrice || '')},
    eliteDecklist: [\n${eliteDecklist}\n    ],
    eliteIncluded: [${eliteIncluded}],` : '';
    return `  {
    id: ${deck.id},
    name: ${JSON.stringify(deck.name)},
    commander: ${JSON.stringify(deck.commander)},
    price: ${deck.price},
    bracket: ${deck.bracket},
    colors: ${JSON.stringify(deck.colors)},
    colorLabel: ${JSON.stringify(deck.colorLabel)},
    difficulty: ${typeof deck.difficulty === 'number' ? deck.difficulty : JSON.stringify(deck.difficulty)},
    playstyles: ${JSON.stringify(deck.playstyles)},
    description: ${JSON.stringify(deck.description || '')},
    image: ${imageStr},
    gradientFrom: ${JSON.stringify(deck.gradientFrom)},
    gradientTo: ${JSON.stringify(deck.gradientTo)},
    accentColor: ${JSON.stringify(deck.accentColor)},
    glowClass: ${JSON.stringify(deck.glowClass || 'glow-purple')},
    strategy: ${JSON.stringify(deck.strategy || '')},
    wins: ${JSON.stringify(deck.wins || '')},
    pilotGuide: ${JSON.stringify(deck.pilotGuide || '')},
    openingHand: ${JSON.stringify(deck.openingHand || '')},
    upgradePath: ${JSON.stringify(deck.upgradePath || '')},
    tokensNeeded: ${JSON.stringify(deck.tokensNeeded || '')},
    fullDecklist: [\n${decklist}\n    ],
    included: [${included}],
    featured: ${!!deck.featured},
    premium: ${!!deck.premium},
    quantity: ${deck.quantity ?? 10},
    stripePrice: ${JSON.stringify(deck.stripePrice || '')},
    ourCost: ${deck.ourCost ?? 0},
    slug: ${JSON.stringify(deck.slug || toSlug(deck.name || ''))},${eliteFields}
  }`;
  }).join(',\n');

  return `export const decks = [\n${entries}\n];\n
export const colorMeta = {
  red:       { label: "Red",        hex: "#ef4444", icon: "🔥", desc: "Aggro & Burn",        glowClass: "glow-red" },
  blue:      { label: "Blue",       hex: "#3b82f6", icon: "💧", desc: "Control & Combo",      glowClass: "glow-blue" },
  black:     { label: "Black",      hex: "#7c3aed", icon: "💀", desc: "Sacrifice & Drain",    glowClass: "glow-purple" },
  white:     { label: "White",      hex: "#f59e0b", icon: "☀️", desc: "Lifegain & Tokens",    glowClass: "glow-gold" },
  green:     { label: "Green",      hex: "#22c55e", icon: "🌿", desc: "Ramp & Creatures",     glowClass: "glow-green" },
  multi:     { label: "Multicolor", hex: "#ec4899", icon: "✨", desc: "All Combinations",     glowClass: "glow-pink" },
  colorless: { label: "Colorless",  hex: "#9ca3af", icon: "◇",  desc: "Eldrazi & Artifacts",  glowClass: "glow-gray" },
};

export const playstyleMeta = [
  "Aggro", "Tokens", "Aristocrats", "Sacrifice", "Spellslinger",
  "Ramp", "Lifegain", "Control", "Reanimator", "Storm",
  "Counters", "Tribal", "Drain", "Go Wide", "Superfriends",
];
`;
}

const FIXED_DECKLIST_SECTIONS = [
  'Commander',
  'Ramp & Mana',
  'Creatures & Synergy Engines',
  'Interaction & Protection',
  'Lands',
];

function normalizeDecklist(existing) {
  return FIXED_DECKLIST_SECTIONS.map(name => {
    const found = (existing || []).find(s => s.section === name);
    return found ? { ...found } : { section: name, cards: [] };
  });
}

const BLANK_DECK = {
  name: '', commander: '', price: 149, bracket: 2,
  colors: [], colorLabel: '', difficulty: 5, playstyles: [],
  description: '', image: null,
  accentColor: '#6366f1', gradientFrom: '#0a0a1a', gradientTo: '#1a0a1a', glowClass: 'glow-purple',
  strategy: '', wins: '', pilotGuide: '', openingHand: '', upgradePath: '', tokensNeeded: '',
  fullDecklist: FIXED_DECKLIST_SECTIONS.map(section => ({ section, cards: [] })),
  included: ['99-card Commander deck', 'Pilot guide booklet', 'Synergy cheat sheet', 'Upgrade path guide', 'Storage sleeve set'],
  featured: false, quantity: 10, stripePrice: '', ourCost: 0, slug: '',
};

// ─── Small UI helpers ─────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm
          placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors" />
    </div>
  );
}
function TextArea({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm
          placeholder-gray-600 focus:outline-none focus:border-blue-500 leading-relaxed resize-none transition-colors" />
    </div>
  );
}
const TOGGLE_COLORS = { blue: '#3b82f6', orange: '#f97316' };
function Toggle({ checked, onChange, label, accent = 'blue' }) {
  const activeColor = TOGGLE_COLORS[accent] ?? TOGGLE_COLORS.blue;
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div onClick={() => onChange(!checked)}
        className="w-10 h-6 rounded-full transition-colors relative shrink-0"
        style={{ background: checked ? activeColor : '#374151' }}>
        <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }} />
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}

// ─── Password gate ────────────────────────────────────────────────────────────
const STORED_HASH_KEY = 'admin_pw_hash';
const SESSION_KEY     = 'admin_authed';
const CORRECT_HASH    = import.meta.env.VITE_ADMIN_PASSWORD_HASH || null;

function LoginGate({ onAuth }) {
  const [pw, setPw]           = useState('');
  const [show, setShow]       = useState(false);
  const [err, setErr]         = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode]       = useState('login'); // 'login' | 'setup'

  // First-run: no server hash AND no locally stored hash → show setup
  const localHash = localStorage.getItem(STORED_HASH_KEY);
  const hasAnyHash = CORRECT_HASH || localHash;

  useEffect(() => {
    if (!hasAnyHash) setMode('setup');
  }, [hasAnyHash]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pw.trim()) return;
    setLoading(true);
    setErr('');
    const entered = await sha256(pw);

    if (mode === 'setup') {
      // First-run: save hash locally, log in
      localStorage.setItem(STORED_HASH_KEY, entered);
      localStorage.setItem(SESSION_KEY, '1');
      onAuth();
      return;
    }

    // Normal login: check server hash first, then local hash fallback
    const match = (CORRECT_HASH && entered === CORRECT_HASH)
      || (!CORRECT_HASH && localHash && entered === localHash);
    if (match) {
      localStorage.setItem(SESSION_KEY, '1');
      onAuth();
    } else {
      setErr('Incorrect password.');
      setPw('');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Lock size={24} className="text-blue-400" />
          </div>
        </div>
        <h1 className="text-2xl font-display font-bold text-white text-center mb-1">
          {mode === 'setup' ? 'Create Admin Password' : 'Admin Access'}
        </h1>
        <p className="text-gray-500 text-sm text-center mb-8">
          {mode === 'setup'
            ? 'First time setup — choose a password for this admin panel.'
            : 'Lotus Pro Decks admin panel'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={e => { setPw(e.target.value); setErr(''); }}
              placeholder="Password"
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white
                placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {err && <p className="text-red-400 text-sm text-center">{err}</p>}
          <button type="submit" disabled={loading || !pw}
            className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === 'setup' ? 'Set Password & Enter' : 'Sign In'}
          </button>
        </form>
        {mode === 'setup' && (
          <p className="text-xs text-gray-600 text-center mt-4">
            Password is hashed and stored locally in your browser.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── GitHub settings panel ────────────────────────────────────────────────────
function GitHubSettings({ token, onSave, onClose }) {
  const [val, setVal]         = useState(token || '');
  const [show, setShow]       = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');  // '' | 'ok' | error string

  async function handleTest() {
    const t = val.trim();
    if (!t) { setTestMsg('Paste a token first.'); return; }
    setTesting(true); setTestMsg('');
    try {
      await testGitHubToken(t);
      setTestMsg('ok');
    } catch (err) {
      setTestMsg(err.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md bg-[#0f1629] rounded-2xl border border-white/10 p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <Github size={20} className="text-gray-400" />
          <h2 className="font-display font-bold text-white">GitHub Integration</h2>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <p className="text-sm text-gray-400 mb-4 leading-relaxed">
          Create a fine-grained token at{' '}
          <a href="https://github.com/settings/tokens?type=fine-grained" target="_blank" rel="noreferrer"
            className="text-blue-400 underline">github.com/settings/tokens</a>.
          Set <strong className="text-gray-300">Repository access → Only select → lotus-pro-decks</strong>,
          then <strong className="text-gray-300">Permissions → Contents → Read and write</strong>.
        </p>
        <div className="relative mb-2">
          <input type={show ? 'text' : 'password'} value={val} onChange={e => { setVal(e.target.value); setTestMsg(''); }}
            placeholder="github_pat_… or ghp_…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-white text-sm
              font-mono focus:outline-none focus:border-blue-500 transition-colors" />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {/* Test result */}
        {testMsg === 'ok' && (
          <p className="text-green-400 text-xs flex items-center gap-1 mb-3"><Check size={12} /> Connected — write access confirmed.</p>
        )}
        {testMsg && testMsg !== 'ok' && (
          <p className="text-red-400 text-xs mb-3">✗ {testMsg}</p>
        )}
        {!testMsg && <p className="text-xs text-gray-600 mb-3">Token is stored only in your browser.</p>}

        <div className="flex gap-2 mb-4">
          <button onClick={handleTest} disabled={testing || !val.trim()}
            className="flex-1 py-2 rounded-xl border border-white/10 text-gray-300 hover:text-white
              text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {testing ? <><Loader2 size={13} className="animate-spin" /> Testing…</> : 'Test Connection'}
          </button>
        </div>

        <div className="flex gap-3">
          <button onClick={() => { onSave(val.trim()); onClose(); }}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
            Save Token
          </button>
          {token && (
            <button onClick={() => { onSave(''); onClose(); }}
              className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-colors">
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Logo uploader ────────────────────────────────────────────────────────────
function LogoUploader({ token }) {
  const fileRef = useRef();
  const [state, setState] = useState('idle'); // idle | uploading | done | error
  const [errMsg, setErrMsg] = useState('');
  const [preview, setPreview] = useState(null);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    // Always show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    if (!token) { setErrMsg('No GitHub token — connect one to push the logo.'); setState('error'); return; }

    setState('uploading'); setErrMsg('');
    try {
      // Force filename to logo.png regardless of what user uploaded
      const renamed = new File([file], 'logo.png', { type: file.type });
      await uploadToGitHub(renamed, token);
      setState('done'); setTimeout(() => setState('idle'), 4000);
    } catch (err) {
      setErrMsg(err.message); setState('error');
    }
  }

  const logoSrc = preview || `${import.meta.env.BASE_URL}images/logo.png`;

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Site Logo</label>
      <div
        onClick={() => fileRef.current.click()}
        className="relative cursor-pointer flex items-center gap-4 p-3 rounded-xl border border-dashed border-white/15
          hover:border-white/30 transition-colors group"
      >
        <div className="w-28 h-14 rounded-lg bg-[#0a0e1a] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
          <img src={logoSrc} alt="Logo" className="max-w-full max-h-full object-contain p-1"
            onError={e => { e.target.style.display = 'none'; }} />
        </div>
        <div>
          <div className="text-sm text-gray-300 group-hover:text-white transition-colors font-medium flex items-center gap-2">
            <Upload size={13} /> Replace logo
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {token ? 'Pushed to GitHub automatically' : 'Connect GitHub token to auto-push'}
          </div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {state === 'uploading' && <p className="text-blue-400 text-xs flex items-center gap-1 mt-1"><Loader2 size={11} className="animate-spin" /> Uploading…</p>}
      {state === 'done'     && <p className="text-green-400 text-xs flex items-center gap-1 mt-1"><Check size={11} /> Logo pushed — site redeploying.</p>}
      {state === 'error'    && <p className="text-red-400 text-xs mt-1">{errMsg}</p>}
    </div>
  );
}

// ─── Image upload button ──────────────────────────────────────────────────────
function ImageUploader({ token, currentImage, onUploaded }) {
  const fileRef  = useRef();
  const [state, setState] = useState('idle'); // idle | uploading | done | error
  const [errMsg, setErrMsg] = useState('');

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErrMsg('Not an image file'); return; }

    if (!token) {
      // No token — just preview locally
      onUploaded(file.name, URL.createObjectURL(file));
      return;
    }

    setState('uploading');
    setErrMsg('');
    try {
      const filename = await uploadToGitHub(file, token);
      onUploaded(filename, buildImagePath(filename));
      setState('done');
      setTimeout(() => setState('idle'), 3000);
    } catch (err) {
      setErrMsg(err.message);
      setState('error');
    }
  }

  const hasImage = !!currentImage;

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Deck Image</label>
      <div
        onClick={() => fileRef.current.click()}
        className="relative cursor-pointer rounded-xl border-2 border-dashed transition-colors overflow-hidden group"
        style={{ borderColor: hasImage ? 'transparent' : 'rgba(255,255,255,0.12)' }}
      >
        {hasImage ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-xl">
            <img src={currentImage} alt="" className="w-full h-full object-contain bg-[#0a0e1a]" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity
              flex items-center justify-center">
              <div className="flex items-center gap-2 text-white text-sm font-medium">
                <Upload size={16} /> Replace image
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 flex flex-col items-center gap-3 text-gray-600 hover:text-gray-400 transition-colors">
            <ImagePlus size={28} />
            <div className="text-sm text-center">
              <span className="text-blue-400 font-medium">Click to upload</span> a PNG or JPG
              {token && <div className="text-xs mt-0.5 text-gray-600">Auto-pushed to GitHub</div>}
              {!token && <div className="text-xs mt-0.5 text-yellow-600">Set GitHub token to auto-push</div>}
            </div>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {state === 'uploading' && (
        <div className="flex items-center gap-2 mt-2 text-blue-400 text-xs">
          <Loader2 size={12} className="animate-spin" /> Uploading to GitHub…
        </div>
      )}
      {state === 'done' && (
        <div className="flex items-center gap-2 mt-2 text-green-400 text-xs">
          <Check size={12} /> Pushed! Deploy triggered automatically.
        </div>
      )}
      {state === 'error' && (
        <div className="mt-2 text-red-400 text-xs">{errMsg}</div>
      )}
      {!token && hasImage && (
        <p className="text-xs text-yellow-600 mt-1">Add a GitHub token to auto-push images.</p>
      )}
    </div>
  );
}

// ─── Main admin component ─────────────────────────────────────────────────────
export default function Admin() {
  // Auth
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(SESSION_KEY));

  // GitHub token
  const [ghToken, setGhToken] = useState(() => localStorage.getItem('admin_gh_token') || '');
  const [showGhSettings, setShowGhSettings] = useState(false);

  // Deck state
  const [deckList, setDeckList] = useState(() => {
    try {
      const saved = localStorage.getItem('adminDecks');
      if (!saved) return initialDecks.map(d => ({ ...d, quantity: d.quantity ?? 10 }));
      const parsed = JSON.parse(saved);

      // Build a lookup of source decklists so we can repair stale localStorage
      const sourceById = Object.fromEntries(initialDecks.map(d => [d.id, d]));

      // For each deck in localStorage, restore fullDecklist from source if:
      //   (a) all sections are empty — stale admin push wiped the cards, OR
      //   (b) none of the section names match our 5 fixed names — old format
      const fixed = FIXED_DECKLIST_SECTIONS;
      const merged = parsed.map(d => {
        const src = sourceById[d.id];
        if (!src) return d; // custom deck not in source — keep as-is
        const dl = d.fullDecklist || [];
        const hasCards   = dl.some(s => s.cards && s.cards.length > 0);
        const hasFixedNames = dl.some(s => fixed.includes(s.section));
        // Pull in elite fields from source if this deck got upgraded to CORE/ELITE after last admin save
        const elitePatch = src.elitePrice != null && d.elitePrice == null
          ? { elitePrice: src.elitePrice, eliteStripePrice: src.eliteStripePrice || '', eliteDecklist: src.eliteDecklist || [], eliteIncluded: src.eliteIncluded || [] }
          : {};
        if (!hasCards || !hasFixedNames) {
          // Restore from source; preserve admin-only fields (price, qty, stripePrice…)
          return { ...d, fullDecklist: src.fullDecklist, ...elitePatch };
        }
        return { ...d, ...elitePatch };
      });

      // Also add any brand-new decks from source not yet in localStorage
      const existingIds = new Set(parsed.map(d => d.id));
      const newDecks = initialDecks
        .filter(d => !existingIds.has(d.id))
        .map(d => ({ ...d, quantity: d.quantity ?? 10 }));
      return newDecks.length ? [...merged, ...newDecks] : merged;
    } catch { return initialDecks.map(d => ({ ...d, quantity: d.quantity ?? 10 })); }
  });

  const [editing, setEditing]     = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [decklistTier, setDecklistTier] = useState('core'); // 'core' | 'elite' — controls which decklist is shown in edit view
  const [savedFlash, setSaved]    = useState(false);
  const [exportFlash, setExport]  = useState(false);
  // push status: 'idle' | 'pushing' | 'done' | 'error'
  const [pushStatus,    setPushStatus]    = useState('idle');
  const [pushError,     setPushError]     = useState('');
  // bulk-push (Push All Decks button)
  const [bulkPushStatus, setBulkPushStatus] = useState('idle'); // 'idle' | 'pushing' | 'done' | 'error'
  const [bulkPushError,  setBulkPushError]  = useState('');
  const [marginPct,     setMarginPct]     = useState(40);
  const [orderDirty,    setOrderDirty]    = useState(false);
  const [orderPushing,  setOrderPushing]  = useState(false);
  const [orderPushOk,   setOrderPushOk]   = useState(false);
  const [deleteDirty,   setDeleteDirty]   = useState(false);
  const [deletePushing, setDeletePushing] = useState(false);
  const [deletePushOk,  setDeletePushOk]  = useState(false);
  const [deletePushErr, setDeletePushErr] = useState('');
  const [waitlistCounts, setWaitlistCounts] = useState({}); // { [deckId]: number }
  const [restockMsg,    setRestockMsg]    = useState('');   // shown after restock send

  // ── Admin view: 'decks' | 'coupons' ──────────────────────────────────────────
  const [adminView, setAdminView] = useState('decks');

  // ── Coupon state ──────────────────────────────────────────────────────────────
  const [couponList, setCouponList] = useState(() => {
    try {
      const saved = localStorage.getItem('adminCoupons');
      return saved ? JSON.parse(saved) : initialCoupons;
    } catch { return initialCoupons; }
  });
  const [couponPushStatus, setCouponPushStatus] = useState('idle'); // 'idle'|'pushing'|'done'|'error'
  const [couponPushError,  setCouponPushError]  = useState('');
  // New coupon form fields
  const [newCode,     setNewCode]     = useState('');
  const [newPercent,  setNewPercent]  = useState(10);
  const [newMultiUse, setNewMultiUse] = useState(true);
  const [newDesc,     setNewDesc]     = useState('');

  useEffect(() => { localStorage.setItem('adminDecks',   JSON.stringify(deckList));   }, [deckList]);
  useEffect(() => { localStorage.setItem('adminCoupons', JSON.stringify(couponList)); }, [couponList]);
  useEffect(() => { localStorage.setItem('admin_gh_token', ghToken); }, [ghToken]);

  // Fetch waitlist counts on mount (best-effort — fails silently if KV not set up)
  const fetchWaitlistCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/waitlist-counts');
      if (res.ok) setWaitlistCounts(await res.json());
    } catch {}
  }, []);
  useEffect(() => { fetchWaitlistCounts(); }, [fetchWaitlistCounts]);

  if (!authed) return <LoginGate onAuth={() => setAuthed(true)} />;

  // ── List helpers ─────────────────────────────────────────────────────────────
  function syncFromSource() {
    const sourceById = Object.fromEntries(initialDecks.map(d => [d.id, d]));
    const existingIds = new Set(deckList.map(d => d.id));

    // Refresh fullDecklist for every existing deck from source
    const refreshed = deckList.map(d => {
      const src = sourceById[d.id];
      if (!src) return d;
      const elitePatch = src.elitePrice != null && d.elitePrice == null
        ? { elitePrice: src.elitePrice, eliteStripePrice: src.eliteStripePrice || '', eliteDecklist: src.eliteDecklist || [], eliteIncluded: src.eliteIncluded || [] }
        : {};
      return { ...d, fullDecklist: src.fullDecklist, ...elitePatch };
    });

    // Add brand-new decks from source
    const newDecks = initialDecks
      .filter(d => !existingIds.has(d.id))
      .map(d => ({ ...d, quantity: d.quantity ?? 10 }));

    setDeckList(newDecks.length ? [...refreshed, ...newDecks] : refreshed);
    alert(`Decklists refreshed from source${newDecks.length ? ` and ${newDecks.length} new deck(s) added` : ''}.`);
  }
  // ── Coupon helpers ───────────────────────────────────────────────────────────
  async function saveCoupons() {
    if (!ghToken) { alert('Connect a GitHub token first.'); return; }
    setCouponPushStatus('pushing'); setCouponPushError('');
    try {
      await pushCouponsJs(couponList, ghToken);
      setCouponPushStatus('done');
      setTimeout(() => setCouponPushStatus('idle'), 6000);
    } catch (err) {
      setCouponPushError(err.message);
      setCouponPushStatus('error');
    }
  }
  function addCoupon() {
    const code = newCode.trim();
    if (!code) return;
    setCouponList(l => [...l, { code, percent: Number(newPercent) || 10, active: true, multiUse: newMultiUse, description: newDesc.trim() }]);
    setNewCode(''); setNewPercent(10); setNewMultiUse(true); setNewDesc('');
  }
  function removeCoupon(i) {
    if (!window.confirm(`Remove coupon "${couponList[i].code}"?`)) return;
    setCouponList(l => l.filter((_, j) => j !== i));
  }
  function toggleCouponActive(i)   { setCouponList(l => l.map((c, j) => j === i ? { ...c, active:   !c.active   } : c)); }
  function toggleCouponMultiUse(i) { setCouponList(l => l.map((c, j) => j === i ? { ...c, multiUse: !c.multiUse } : c)); }

  function newDeck()  { setEditing({ ...BLANK_DECK, id: Date.now() }); setActiveTab('basic'); }
  function editDeck(d) {
    const copy = JSON.parse(JSON.stringify(d));
    // Always normalize to the 5 fixed sections so old data in localStorage migrates cleanly
    copy.fullDecklist = normalizeDecklist(copy.fullDecklist);
    if (copy.eliteDecklist) copy.eliteDecklist = normalizeDecklist(copy.eliteDecklist);
    setEditing(copy);
    setActiveTab('basic');
    setDecklistTier('core');
  }
  function deleteDeck(id) {
    if (!window.confirm('Delete this deck?')) return;
    setDeckList(p => p.filter(d => d.id !== id));
    if (editing?.id === id) setEditing(null);
    setDeleteDirty(true);
    setDeletePushOk(false);
    setDeletePushErr('');
  }
  function moveDeck(id, dir) {
    setDeckList(p => {
      const i = p.findIndex(d => d.id === id), j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const a = [...p]; [a[i], a[j]] = [a[j], a[i]]; return a;
    });
    setOrderDirty(true);
    setOrderPushOk(false);
  }

  async function publishOrder() {
    if (!ghToken) {
      alert('Connect a GitHub token first (click the GitHub button in the top bar).');
      return;
    }
    setOrderPushing(true);
    try {
      await pushDecksJs(deckList, ghToken);
      setOrderDirty(false);
      setOrderPushOk(true);
      setTimeout(() => setOrderPushOk(false), 4000);
    } catch (err) {
      alert('Failed to publish order: ' + err.message);
    } finally {
      setOrderPushing(false);
    }
  }

  async function publishDeletion() {
    if (!ghToken) {
      alert('Connect a GitHub token first (click the GitHub button in the top bar).');
      return;
    }
    setDeletePushing(true);
    setDeletePushErr('');
    try {
      await pushDecksJs(deckList, ghToken);
      setDeleteDirty(false);
      setDeletePushOk(true);
      setTimeout(() => setDeletePushOk(false), 4000);
    } catch (err) {
      setDeletePushErr(err.message);
    } finally {
      setDeletePushing(false);
    }
  }

  async function pushAllDecks() {
    if (!ghToken) {
      alert('Connect a GitHub token first (click the GitHub button in the top bar).');
      return;
    }
    setBulkPushStatus('pushing');
    setBulkPushError('');
    try {
      // Normalize every deck's fullDecklist to the 5 fixed sections before pushing
      // This repairs any stale localStorage data without touching text fields
      const normalized = deckList.map(d => ({
        ...d,
        fullDecklist: normalizeDecklist(d.fullDecklist),
      }));
      setDeckList(normalized); // update localStorage too so it stays clean
      await pushDecksJs(normalized, ghToken, 'Sync all decks — normalize sections via admin panel');
      setBulkPushStatus('done');
      setTimeout(() => setBulkPushStatus('idle'), 6000);
    } catch (err) {
      setBulkPushError(err.message);
      setBulkPushStatus('error');
    }
  }

  // ── Edit helpers ─────────────────────────────────────────────────────────────
  function set(k, v)    { setEditing(p => ({ ...p, [k]: v })); }
  function toggleColor(c) {
    const next = editing.colors.includes(c) ? editing.colors.filter(x => x !== c) : [...editing.colors, c];
    setEditing(p => ({ ...p, colors: next, ...deriveColorMeta(next) }));
  }
  function toggleStyle(t) {
    set('playstyles', editing.playstyles.includes(t) ? editing.playstyles.filter(x => x !== t) : [...editing.playstyles, t]);
  }
  async function saveDeck() {
    setPushStatus('pushing'); setPushError(''); setRestockMsg('');

    // ── 0. Detect restock BEFORE mutating state ───────────────────────────────
    const prevDeck   = deckList.find(d => d.id === editing.id);
    const wasOOS     = prevDeck ? (prevDeck.quantity === 0 || prevDeck.inStock === false) : false;
    const nowInStock = editing.quantity > 0 && editing.inStock !== false;
    const isRestock  = wasOOS && nowInStock;

    // ── 1. Sync with Stripe (non-fatal if it fails) ──────────────────────────
    let finalDeck = { ...editing };
    try {
      const stripeRes = await fetch('/api/create-stripe-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deckId:        String(editing.id),
          name:          editing.name || 'Untitled Deck',
          description:   editing.description || '',
          priceInCents:  Math.round((editing.price || 0) * 100),
          commander:     editing.commander || '',
          bracket:       editing.bracket,
          colors:        editing.colors,
        }),
      });
      if (stripeRes.ok) {
        const { priceId } = await stripeRes.json();
        finalDeck = { ...finalDeck, stripePrice: priceId };
      } else {
        const errBody = await stripeRes.json().catch(() => ({}));
        console.warn('[Admin] Stripe sync non-OK:', stripeRes.status, errBody.error);
      }
    } catch (err) {
      console.warn('[Admin] Stripe sync failed (non-fatal):', err.message);
    }

    // ── 2. Update local / localStorage state ────────────────────────────────
    setEditing(finalDeck);
    const exists = deckList.some(d => d.id === finalDeck.id);
    const next = exists
      ? deckList.map(d => d.id === finalDeck.id ? finalDeck : d)
      : [...deckList, finalDeck];
    setDeckList(next);
    setSaved(true); setTimeout(() => setSaved(false), 2000);

    console.log('[Admin] saveDeck — ghToken present:', !!ghToken, 'stripePrice:', finalDeck.stripePrice);

    // ── 3. Push decks.js to GitHub ───────────────────────────────────────────
    if (ghToken) {
      try {
        await pushDecksJs(next, ghToken);
        setPushStatus('done'); setTimeout(() => setPushStatus('idle'), 5000);

        // ── 4. Send restock emails if applicable ──────────────────────────────
        if (isRestock) {
          try {
            const r = await fetch('/api/send-restock-emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deckId:    String(finalDeck.id),
                deckName:  finalDeck.name,
                deckPrice: finalDeck.price,
              }),
            });
            const data = await r.json();
            if (data.sent > 0) {
              setRestockMsg(`📧 Restock emails sent to ${data.sent} subscriber${data.sent !== 1 ? 's' : ''}.`);
              fetchWaitlistCounts(); // refresh counts
            } else {
              setRestockMsg('✓ Restocked — no waitlist subscribers to notify.');
            }
          } catch (err) {
            console.warn('[Admin] restock email error (non-fatal):', err.message);
          }
        }
      } catch (err) {
        console.error('[Admin] push failed:', err);
        setPushStatus('error'); setPushError(err.message);
      }
    } else {
      setPushStatus('error');
      setPushError('No GitHub token — click the GitHub button and save your token first.');
    }
  }
  function addSection() { set('fullDecklist', [...editing.fullDecklist, { section: 'New Section', cards: [] }]); }
  function removeSection(i) { set('fullDecklist', editing.fullDecklist.filter((_, idx) => idx !== i)); }
  function updateSection(i, key, val) {
    set('fullDecklist', editing.fullDecklist.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  }
  function setSectionCards(i, text) {
    updateSection(i, 'cards', text.split('\n').map(c => c.trim()).filter(Boolean));
  }
  function setEliteSectionCards(i, text) {
    const cards = text.split('\n').map(c => c.trim()).filter(Boolean);
    const dl = normalizeDecklist(editing.eliteDecklist);
    set('eliteDecklist', dl.map((s, idx) => idx === i ? { ...s, cards } : s));
  }

  // ── Export ───────────────────────────────────────────────────────────────────
  function downloadDecksJs() {
    const blob = new Blob([generateDecksJs(deckList)], { type: 'text/javascript' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'decks.js'; a.click();
    URL.revokeObjectURL(url);
    setExport(true); setTimeout(() => setExport(false), 2000);
  }

  // ── List view ────────────────────────────────────────────────────────────────
  if (!editing) return (
    <div className="min-h-screen bg-[#0a0e1a] pt-20 pb-20 px-4 sm:px-6">
      {showGhSettings && (
        <GitHubSettings token={ghToken} onSave={setGhToken} onClose={() => setShowGhSettings(false)} />
      )}
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Deck Admin</h1>
            <p className="text-gray-500 text-sm mt-0.5">{deckList.length} deck{deckList.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowGhSettings(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10
                text-gray-400 hover:text-white text-sm transition-colors"
              title={ghToken ? 'GitHub connected' : 'Connect GitHub'}>
              <Github size={15} />
              <span className="hidden sm:inline">{ghToken ? 'GitHub ✓' : 'GitHub'}</span>
            </button>
            <button onClick={syncFromSource}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10
                text-gray-400 hover:text-white text-sm transition-colors"
              title="Pull new decks added to decks.js into the admin">
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <button onClick={downloadDecksJs}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10
                text-gray-300 hover:text-white text-sm font-medium transition-colors">
              <Download size={14} />
              <span className="hidden sm:inline">{exportFlash ? 'Downloaded!' : 'Download decks.js'}</span>
            </button>
            <button
              onClick={pushAllDecks}
              disabled={bulkPushStatus === 'pushing'}
              title="Normalize all deck sections and push entire decks.js to GitHub in one commit"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500
                text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {bulkPushStatus === 'pushing'
                ? <><Loader2 size={14} className="animate-spin" /> Pushing…</>
                : bulkPushStatus === 'done'
                  ? <><Check size={14} /> All Live!</>
                  : <><Upload size={14} /><span className="hidden sm:inline"> Push All Decks</span></>
              }
            </button>
            <button onClick={newDeck}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500
                text-white text-sm font-semibold transition-colors">
              <Plus size={16} /> New Deck
            </button>
          </div>
        </div>

        {/* ── Section tabs ─────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/3 border border-white/8 w-fit">
          <button
            onClick={() => setAdminView('decks')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              adminView === 'decks' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Decks
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400">{deckList.length}</span>
          </button>
          <button
            onClick={() => setAdminView('coupons')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              adminView === 'coupons' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Tag size={13} /> Coupons
            {couponList.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                {couponList.length}
              </span>
            )}
          </button>
        </div>

        {adminView === 'decks' && (<>

        {!ghToken && (
          <div className="mb-4 p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/20 text-yellow-400 text-sm flex items-center gap-3">
            <Github size={14} className="shrink-0" />
            <span>Connect your <button onClick={() => setShowGhSettings(true)} className="underline font-medium">GitHub token</button> to upload images directly from the admin.</span>
          </div>
        )}

        {ghToken ? (
          <div className="mb-4 p-3 rounded-xl bg-green-500/8 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
            <Check size={14} className="shrink-0" />
            GitHub connected — edits are published automatically when you save.
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/20 text-yellow-400 text-sm flex items-center gap-3">
            <Github size={14} className="shrink-0" />
            <span>
              <button onClick={() => setShowGhSettings(true)} className="underline font-medium">Connect a GitHub token</button>{' '}
              to publish changes automatically. Without it, use <em>Download decks.js</em> to deploy manually.
            </span>
          </div>
        )}

        {/* Bulk-push feedback banner */}
        {(bulkPushStatus === 'done' || bulkPushStatus === 'error') && (
          <div className={`mb-4 p-3 rounded-xl border text-sm flex items-center justify-between gap-3 ${
            bulkPushStatus === 'done'
              ? 'bg-green-500/8 border-green-500/20 text-green-400'
              : 'bg-red-500/8 border-red-500/20 text-red-400'
          }`}>
            <div className="flex items-center gap-2">
              {bulkPushStatus === 'done'
                ? <><Check size={14} className="shrink-0" /> All decks pushed — sections normalized &amp; site is rebuilding.</>
                : <><span className="shrink-0">✗</span> Push failed: {bulkPushError}</>
              }
            </div>
            <button onClick={() => setBulkPushStatus('idle')} className="text-gray-500 hover:text-white transition-colors shrink-0">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Site Settings */}
        <div className="mb-6 p-4 rounded-2xl bg-white/3 border border-white/8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Site Settings</p>
          <LogoUploader token={ghToken} />
        </div>

        {/* Order-changed banner */}
        {(orderDirty || orderPushOk) && (
          <div className={`mb-3 p-3 rounded-xl border text-sm flex items-center justify-between gap-3 transition-colors ${
            orderPushOk
              ? 'bg-green-500/8 border-green-500/20 text-green-400'
              : 'bg-orange-500/10 border-orange-500/30 text-orange-300'
          }`}>
            <div className="flex items-center gap-2">
              {orderPushOk
                ? <><Check size={14} className="shrink-0" /> Order saved — live site updated.</>
                : <><ArrowUpDown size={14} className="shrink-0" /> Deck order changed — not yet live.</>
              }
            </div>
            {orderDirty && (
              <button
                onClick={publishOrder}
                disabled={orderPushing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400
                  text-white text-xs font-semibold transition-colors disabled:opacity-50 shrink-0"
              >
                {orderPushing
                  ? <><Loader2 size={12} className="animate-spin" /> Publishing…</>
                  : <><Upload size={12} /> Publish Order</>
                }
              </button>
            )}
          </div>
        )}

        {/* Deletion pending banner */}
        {(deleteDirty || deletePushOk || deletePushErr) && (
          <div className={`mb-3 p-3 rounded-xl border text-sm flex items-center justify-between gap-3 transition-colors ${
            deletePushOk
              ? 'bg-green-500/8 border-green-500/20 text-green-400'
              : deletePushErr
                ? 'bg-red-500/8 border-red-500/20 text-red-400'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            <div className="flex items-center gap-2">
              {deletePushOk
                ? <><Check size={14} className="shrink-0" /> Deletion published — live site updated.</>
                : deletePushErr
                  ? <><span className="shrink-0">✗</span> Push failed: {deletePushErr}</>
                  : <><Trash2 size={14} className="shrink-0" /> Deck deleted locally — not yet removed from live site.</>
              }
            </div>
            {deleteDirty && (
              <button
                onClick={publishDeletion}
                disabled={deletePushing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400
                  text-white text-xs font-semibold transition-colors disabled:opacity-50 shrink-0"
              >
                {deletePushing
                  ? <><Loader2 size={12} className="animate-spin" /> Publishing…</>
                  : <><Upload size={12} /> Publish Deletion</>
                }
              </button>
            )}
          </div>
        )}

        <div className="space-y-2">
          {deckList.map((deck, idx) => (
            <div key={deck.id}
              className="flex items-center gap-4 p-4 rounded-2xl bg-white/3 border border-white/8
                hover:border-white/15 transition-colors group">
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0"
                style={{ background: `linear-gradient(135deg, ${deck.gradientFrom}, ${deck.gradientTo})` }}>
                {deck.image && <img src={deck.image} alt="" className="w-full h-full object-contain" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate flex items-center gap-2">
                  {deck.name || 'Untitled'}
                  {(deck.quantity === 0 || deck.inStock === false) && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 shrink-0">SOLD OUT</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-2">
                  <span>{deck.commander || '—'}</span>
                  <span className="text-gray-700">·</span>
                  <span>B{deck.bracket}</span>
                  <span className="text-gray-700">·</span>
                  <span>${deck.price}</span>
                  <span className="text-gray-700">·</span>
                  <span>Qty: {deck.quantity ?? '—'}</span>
                  {waitlistCounts[String(deck.id)] > 0 && (
                    <>
                      <span className="text-gray-700">·</span>
                      <span className="text-purple-400 font-medium">🔔 {waitlistCounts[String(deck.id)]} waiting</span>
                    </>
                  )}
                </div>
              </div>
              <div className="hidden sm:flex gap-1">
                {deck.colors.map(c => <span key={c} className="w-3 h-3 rounded-full" style={{ background: colorMeta[c]?.hex }} />)}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${deck.featured ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-gray-600'}`}>
                {deck.featured ? 'Featured' : 'Hidden'}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => moveDeck(deck.id, -1)} disabled={idx === 0}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white disabled:opacity-20 transition-colors">
                  <ChevronUp size={13} />
                </button>
                <button onClick={() => moveDeck(deck.id, 1)} disabled={idx === deckList.length - 1}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white disabled:opacity-20 transition-colors">
                  <ChevronDown size={13} />
                </button>
                <button onClick={() => editDeck(deck)}
                  className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors ml-1">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => deleteDeck(deck.id)}
                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        </>) /* end adminView === 'decks' */}

        {/* ── Coupons tab ───────────────────────────────────────────────────── */}
        {adminView === 'coupons' && (
          <div className="space-y-4">

            {/* GitHub banner */}
            {!ghToken && (
              <div className="p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/20 text-yellow-400 text-sm flex items-center gap-3">
                <Github size={14} className="shrink-0" />
                <span>Connect your <button onClick={() => setShowGhSettings(true)} className="underline font-medium">GitHub token</button> to save coupons to the live site.</span>
              </div>
            )}

            {/* Add coupon form */}
            <div className="p-4 rounded-2xl bg-white/3 border border-white/8">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Add New Coupon</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Code</label>
                  <input
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCoupon()}
                    placeholder="e.g. SAVE10"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm
                      placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">% Off</label>
                  <input
                    type="number" min={1} max={100}
                    value={newPercent}
                    onChange={e => setNewPercent(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm
                      focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Usage type</label>
                  <select
                    value={newMultiUse ? 'multi' : 'once'}
                    onChange={e => setNewMultiUse(e.target.value === 'multi')}
                    className="w-full bg-[#1a1f2e] border border-white/10 rounded-xl px-3 py-2 text-white text-sm
                      focus:outline-none focus:border-purple-500 transition-colors"
                  >
                    <option value="multi">Multiple use</option>
                    <option value="once">1-time only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <input
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Optional note"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm
                      placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>
              <button
                onClick={addCoupon}
                disabled={!newCode.trim()}
                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500
                  text-white text-sm font-semibold transition-colors disabled:opacity-40"
              >
                <Plus size={14} /> Add Coupon
              </button>
            </div>

            {/* Coupon list */}
            {couponList.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm rounded-2xl bg-white/3 border border-white/8">
                No coupons yet. Add one above.
              </div>
            ) : (
              <div className="space-y-2">
                {couponList.map((c, i) => (
                  <div key={i}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                      c.active ? 'bg-white/3 border-white/8' : 'bg-white/1 border-white/4 opacity-50'
                    }`}
                  >
                    {/* Code + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-white text-sm tracking-wide">{c.code}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                          {c.percent}% off
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          c.multiUse
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                            : 'bg-orange-500/15 text-orange-400 border-orange-500/20'
                        }`}>
                          {c.multiUse ? '∞ Multi-use' : '1× Only'}
                        </span>
                        {c.description && (
                          <span className="text-xs text-gray-500 italic">{c.description}</span>
                        )}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleCouponActive(i)}
                        title={c.active ? 'Click to disable' : 'Click to enable'}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                          c.active
                            ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                            : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {c.active ? 'Active' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => toggleCouponMultiUse(i)}
                        title="Toggle single / multi use"
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                          c.multiUse
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                            : 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20'
                        }`}
                      >
                        {c.multiUse ? '∞ Multi' : '1× Only'}
                      </button>
                      <button
                        onClick={() => removeCoupon(i)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Save to GitHub */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveCoupons}
                disabled={couponPushStatus === 'pushing'}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500
                  text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {couponPushStatus === 'pushing'
                  ? <><Loader2 size={14} className="animate-spin" /> Pushing…</>
                  : couponPushStatus === 'done'
                    ? <><Check size={14} /> Coupons Live!</>
                    : <><Upload size={14} /> Save Coupons to GitHub</>
                }
              </button>
              {couponPushStatus === 'error' && (
                <span className="text-xs text-red-400">Push failed: {couponPushError}</span>
              )}
              {couponPushStatus === 'done' && (
                <span className="text-xs text-green-400">Saved — site rebuilding (~1 min).</span>
              )}
            </div>

          </div>
        )} {/* end adminView === 'coupons' */}

      </div>
    </div>
  );

  // ── Edit view ────────────────────────────────────────────────────────────────
  const ac = editing.accentColor;
  return (
    <div className="min-h-screen bg-[#0a0e1a] pt-20 pb-20">
      {showGhSettings && (
        <GitHubSettings token={ghToken} onSave={setGhToken} onClose={() => setShowGhSettings(false)} />
      )}

      {/* Fixed toast — always visible regardless of scroll */}
      {(pushStatus === 'pushing' || pushStatus === 'done' || pushStatus === 'error') && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full shadow-2xl">
          {pushStatus === 'pushing' && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#0f1629] border border-blue-500/30 text-blue-300 text-sm">
              <Loader2 size={16} className="animate-spin shrink-0" />
              Pushing to GitHub — redeploying in ~60s…
            </div>
          )}
          {pushStatus === 'done' && (
            <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-[#0f1629] border border-green-500/30 text-sm">
              <div className="flex items-center gap-3 text-green-400">
                <Check size={16} className="shrink-0" />
                Live! Site is rebuilding now.
              </div>
              {restockMsg && (
                <div className="text-blue-300 text-xs pl-7">{restockMsg}</div>
              )}
            </div>
          )}
          {pushStatus === 'error' && (
            <div className="p-4 rounded-2xl bg-[#0f1629] border border-red-500/30 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                <div className="flex-1">
                  <p className="text-red-400 font-semibold mb-0.5">Push failed</p>
                  <p className="text-gray-400 text-xs leading-relaxed">{pushError}</p>
                </div>
                <button onClick={() => setPushStatus('idle')} className="text-gray-600 hover:text-white shrink-0">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Edit header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setEditing(null)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <X size={14} /> Back to list
          </button>
          <div className="flex gap-2">
            <button onClick={() => setShowGhSettings(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10
                text-gray-400 hover:text-white text-sm transition-colors">
              <Github size={14} /> {ghToken ? 'GitHub ✓' : 'GitHub'}
            </button>
            <button onClick={downloadDecksJs}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10
                text-gray-300 hover:text-white text-sm font-medium transition-colors">
              <Download size={14} /> Download decks.js
            </button>
            <button onClick={saveDeck} disabled={pushStatus === 'pushing'}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60"
              style={{ background: pushStatus === 'done' ? '#22c55e' : savedFlash ? '#16a34a' : '#2563eb' }}>
              {pushStatus === 'pushing'
                ? <><Loader2 size={14} className="animate-spin" /> Pushing…</>
                : pushStatus === 'done'
                  ? <><Check size={14} /> Live!</>
                  : savedFlash
                    ? <><Check size={14} /> Saved</>
                    : ghToken ? 'Save & Publish' : 'Save Deck'}
            </button>
          </div>
        </div>

        {/* Push status bar */}
        {pushStatus === 'pushing' && (
          <div className="mb-4 flex items-center gap-2 text-blue-400 text-sm p-3 rounded-xl bg-blue-500/8 border border-blue-500/20">
            <Loader2 size={14} className="animate-spin shrink-0" />
            Pushing to GitHub — site will redeploy in ~60 seconds…
          </div>
        )}
        {pushStatus === 'done' && (
          <div className="mb-4 flex items-center gap-2 text-green-400 text-sm p-3 rounded-xl bg-green-500/8 border border-green-500/20">
            <Check size={14} className="shrink-0" />
            Pushed! GitHub is rebuilding the site now.
          </div>
        )}
        {pushStatus === 'error' && (
          <div className="mb-4 text-red-400 text-sm p-3 rounded-xl bg-red-500/8 border border-red-500/20">
            <strong>Push failed:</strong> {pushError}
            {!ghToken && ' — connect a GitHub token to enable auto-push.'}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Preview + Inventory */}
          <div className="lg:col-span-1 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Live Preview</p>
            <div className="rounded-2xl overflow-hidden border border-white/8"
              style={{ boxShadow: `0 8px 32px ${ac}33, 0 0 0 1px ${ac}22` }}>
              <div className="relative aspect-square w-full overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${editing.gradientFrom}, ${editing.gradientTo})` }}>
                {editing.image
                  ? <img src={editing.image} alt={editing.name} className="absolute inset-0 w-full h-full object-contain" />
                  : <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-10 select-none">⚔</div>}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
                <div className="absolute top-3 left-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black/60 border border-white/10"
                    style={{ color: editing.bracket === 2 ? '#4ade80' : editing.bracket === 3 ? '#facc15' : editing.bracket === 4 ? '#ef4444' : '#f87171' }}>
                    Bracket {editing.bracket}
                  </span>
                </div>
                <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-black/70 border border-white/15 text-white font-bold text-sm">
                  ${editing.price}
                </div>
                <div className="absolute bottom-3 left-3 flex gap-1.5">
                  {editing.colors.map(c => <span key={c} className="w-4 h-4 rounded-full border border-white/20" style={{ background: colorMeta[c]?.hex }} />)}
                </div>
              </div>
              <div className="p-4 bg-[#0f1629]">
                <div className="font-bold text-white truncate mb-0.5">{editing.name || 'Deck Name'}</div>
                <div className="text-xs text-gray-500 mb-2 truncate">{editing.commander || 'Commander'}</div>
                <div className="flex flex-wrap gap-1">
                  {editing.playstyles.slice(0, 3).map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${ac}18`, color: ac, border: `1px solid ${ac}33` }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Inventory */}
            <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inventory</p>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Quantity in Stock</label>
                <input type="number" min="0" value={editing.quantity ?? 0}
                  onChange={e => set('quantity', parseInt(e.target.value) || 0)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm
                    focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <Toggle checked={editing.inStock !== false} onChange={v => set('inStock', v)} label="Show as In Stock" />
              <Toggle checked={!!editing.featured} onChange={v => set('featured', v)} label="Featured (hero & homepage)" />
              <Toggle checked={!!editing.premium} onChange={v => set('premium', v)} label="Premium (fire border + Limited Edition badge)" accent="orange" />
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-2">
            <div className="flex border-b border-white/8 mb-6">
              {['Basic', 'Content', 'Decklist'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())}
                  className={`px-5 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.toLowerCase() ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
                  }`}>{tab}</button>
              ))}
            </div>

            {/* Basic tab */}
            {activeTab === 'basic' && (
              <div className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Deck Name" value={editing.name} onChange={v => set('name', v)} placeholder="e.g. Meren Graveyard Engine" />
                  <Field label="Commander" value={editing.commander} onChange={v => set('commander', v)} placeholder="e.g. Meren of Clan Nel Toth" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Price ($)</label>
                    <input type="number" min="0" value={editing.price} onChange={e => set('price', parseInt(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Bracket</label>
                    <div className="flex gap-2 h-[42px]">
                      {[2, 3, 4].map(b => (
                        <button key={b} onClick={() => set('bracket', b)}
                          className="flex-1 rounded-xl text-sm font-bold border transition-colors"
                          style={editing.bracket === b
                            ? { background: `${ac}22`, borderColor: `${ac}88`, color: ac }
                            : { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: '#6b7280' }}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Difficulty — <span style={{ color: editing.difficulty <= 3 ? '#22c55e' : editing.difficulty <= 5 ? '#84cc16' : editing.difficulty <= 6.5 ? '#f59e0b' : editing.difficulty <= 8 ? '#f97316' : '#ef4444' }}>
                        {editing.difficulty}/10 &nbsp;
                        {editing.difficulty <= 2 ? 'Casual' : editing.difficulty <= 4 ? 'Beginner' : editing.difficulty <= 6 ? 'Focused' : editing.difficulty <= 7.5 ? 'Advanced' : 'Expert'}
                      </span>
                    </label>
                    <input
                      type="range" min={0} max={10} step={0.5}
                      value={editing.difficulty}
                      onChange={e => set('difficulty', Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-0.5 select-none">
                      <span>0 Casual</span><span>5 Focused</span><span>10 Expert</span>
                    </div>
                  </div>
                </div>

                {/* Cost & Margin Calculator */}
                <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cost &amp; Margin Calculator</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Our Cost */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">Our Cost ($)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={editing.ourCost ?? 0}
                          onChange={e => set('ourCost', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm
                            focus:outline-none focus:border-purple-500 transition-colors"
                        />
                      </div>
                    </div>
                    {/* Margin slider */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">
                        Target Margin —{' '}
                        <span className="text-white font-semibold">{marginPct}%</span>
                        <span className="text-gray-600 ml-2">({(100 / (100 - marginPct)).toFixed(2)}× markup)</span>
                      </label>
                      <input
                        type="range" min={0} max={90} step={1}
                        value={marginPct}
                        onChange={e => setMarginPct(Number(e.target.value))}
                        className="w-full accent-purple-500 mt-1.5"
                      />
                      <div className="flex justify-between text-[10px] text-gray-600 mt-0.5 select-none">
                        <span>0%</span><span>45%</span><span>90%</span>
                      </div>
                    </div>
                  </div>

                  {/* Result */}
                  {(editing.ourCost ?? 0) > 0 ? (() => {
                    const suggested = editing.ourCost / (1 - marginPct / 100);
                    const profit    = suggested - editing.ourCost;
                    return (
                      <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-purple-500/8 border border-purple-500/20">
                        <div>
                          <div className="text-[11px] text-gray-500 mb-0.5">Suggested selling price</div>
                          <div className="text-2xl font-bold text-white">${suggested.toFixed(2)}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Profit: <span className="text-green-400 font-medium">${profit.toFixed(2)}</span>
                            &nbsp;·&nbsp; {marginPct}% gross margin
                          </div>
                        </div>
                        <button
                          onClick={() => set('price', Math.round(suggested))}
                          className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white
                            bg-purple-600 hover:bg-purple-500 transition-colors"
                        >
                          Apply ↑
                        </button>
                      </div>
                    );
                  })() : (
                    <p className="text-xs text-gray-600">Enter your cost above to see the suggested selling price.</p>
                  )}
                </div>

                {/* Color identity */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Color Identity</label>
                  <div className="flex gap-2 mb-2">
                    {MTG_COLORS.map(c => (
                      <button key={c.key} onClick={() => toggleColor(c.key)}
                        className="w-12 h-12 rounded-xl font-bold text-sm border-2 transition-all"
                        style={editing.colors.includes(c.key)
                          ? { background: c.hex + '25', borderColor: c.hex, color: c.hex }
                          : { background: 'transparent', borderColor: 'rgba(255,255,255,0.12)', color: '#4b5563' }}>
                        {c.symbol}
                      </button>
                    ))}
                  </div>
                  <input value={editing.colorLabel} onChange={e => set('colorLabel', e.target.value)}
                    placeholder="Color label (auto-filled, override if needed)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm
                      placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>

                {/* Playstyles */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Playstyles</label>
                  <div className="flex flex-wrap gap-2">
                    {playstyleMeta.map(tag => (
                      <button key={tag} onClick={() => toggleStyle(tag)}
                        className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all"
                        style={editing.playstyles.includes(tag)
                          ? { background: `${ac}22`, borderColor: `${ac}66`, color: ac }
                          : { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: '#6b7280' }}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image upload */}
                <ImageUploader
                  token={ghToken}
                  currentImage={editing.image}
                  onUploaded={(filename, previewUrl) => {
                    set('image', previewUrl || buildImagePath(filename));
                  }}
                />

                {/* ── Elite Tier ─────────────────────────────────────────────── */}
                <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Elite Tier</p>
                      <p className="text-xs text-gray-600 mt-0.5">Adds a premium upsell tier with a separate decklist, price, and included items.</p>
                    </div>
                    <Toggle
                      checked={editing.elitePrice != null}
                      onChange={v => {
                        if (v) {
                          setEditing(p => ({
                            ...p,
                            elitePrice: Math.round(p.price * 1.7),
                            eliteStripePrice: '',
                            eliteDecklist: normalizeDecklist(p.fullDecklist),
                            eliteIncluded: [...(p.included || [])],
                          }));
                        } else {
                          setEditing(p => {
                            const next = { ...p };
                            delete next.elitePrice;
                            delete next.eliteStripePrice;
                            delete next.eliteDecklist;
                            delete next.eliteIncluded;
                            return next;
                          });
                        }
                      }}
                      label="Enable Elite tier"
                    />
                  </div>

                  {editing.elitePrice != null && (
                    <div className="space-y-3 pt-1 border-t border-white/8">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Elite Price ($)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={editing.elitePrice ?? ''}
                            onChange={e => set('elitePrice', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm
                              focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Elite Stripe Price ID</label>
                          <input
                            type="text"
                            value={editing.eliteStripePrice ?? ''}
                            onChange={e => set('eliteStripePrice', e.target.value.trim())}
                            placeholder="price_…  (paste from Stripe dashboard)"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm
                              font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                          Elite Included <span className="text-gray-600 normal-case font-normal">(one item per line)</span>
                        </label>
                        <textarea
                          value={(editing.eliteIncluded || []).join('\n')}
                          onChange={e => set('eliteIncluded', e.target.value.split('\n').map(l => l.trim()).filter(Boolean))}
                          rows={5}
                          placeholder={"100-card Commander deck\nPilot guide booklet\nElite Build upgrade card\nUpgrade path guide\nStorage sleeve set"}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm
                            placeholder-gray-600 focus:outline-none focus:border-blue-500 leading-relaxed resize-none transition-colors"
                        />
                      </div>
                      <p className="text-xs text-gray-600">
                        💡 Go to the <strong className="text-gray-400">Decklist</strong> tab to edit the Elite 100-card list separately from Core.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Content tab */}
            {activeTab === 'content' && (
              <div className="space-y-4">
                <TextArea label="Short Description" value={editing.description} onChange={v => set('description', v)} rows={2} placeholder="One-liner shown on the card" />
                <TextArea label="Strategy" value={editing.strategy} onChange={v => set('strategy', v)} rows={4} placeholder="How the deck works overall" />
                <TextArea label="How This Deck Wins" value={editing.wins} onChange={v => set('wins', v)} rows={3} />
                <TextArea label="Beginner Pilot Guide" value={editing.pilotGuide} onChange={v => set('pilotGuide', v)} rows={4} />
                <TextArea label="Opening Hand Tips" value={editing.openingHand} onChange={v => set('openingHand', v)} rows={3} />
                <TextArea label="Upgrade Path" value={editing.upgradePath} onChange={v => set('upgradePath', v)} rows={3} />
                <TextArea label="Tokens Needed" value={editing.tokensNeeded} onChange={v => set('tokensNeeded', v)} rows={2} />
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">What's Included <span className="text-gray-600 normal-case font-normal">(one item per line)</span></label>
                  <textarea
                    value={(editing.included || []).join('\n')}
                    onChange={e => set('included', e.target.value.split('\n').map(l => l.trim()).filter(Boolean))}
                    rows={5}
                    placeholder={"99-card Commander deck\nPilot guide booklet\nSynergy cheat sheet\nUpgrade path guide\nStorage sleeve set"}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm
                      placeholder-gray-600 focus:outline-none focus:border-blue-500 leading-relaxed resize-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Decklist tab */}
            {activeTab === 'decklist' && (
              <div className="space-y-4">
                {/* Core / Elite switcher — only shown when Elite is enabled */}
                {editing.elitePrice != null && (
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1 p-1 rounded-xl bg-white/3 border border-white/8 w-fit">
                      <button
                        onClick={() => setDecklistTier('core')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          decklistTier === 'core' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Core
                      </button>
                      <button
                        onClick={() => setDecklistTier('elite')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors`}
                        style={decklistTier === 'elite'
                          ? { background: `${editing.accentColor}33`, color: editing.accentColor }
                          : { color: '#6b7280' }}
                      >
                        Elite ✦
                      </button>
                    </div>
                    <span className="text-xs text-gray-600">
                      {decklistTier === 'core' ? `$${editing.price} — Core decklist` : `$${editing.elitePrice} — Elite decklist`}
                    </span>
                  </div>
                )}

                <p className="text-xs text-gray-500">One card per line per section. Sections are fixed.</p>
                {FIXED_DECKLIST_SECTIONS.map((sectionName, i) => {
                  const isElite = editing.elitePrice != null && decklistTier === 'elite';
                  const activeDL = isElite
                    ? normalizeDecklist(editing.eliteDecklist)
                    : (editing.fullDecklist || []);
                  const section = activeDL[i] ?? { section: sectionName, cards: [] };
                  return (
                    <div key={`${decklistTier}-${sectionName}`}
                      className="p-4 rounded-xl border"
                      style={{
                        background: 'rgba(255,255,255,0.018)',
                        borderColor: isElite ? `${editing.accentColor}33` : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <p className="text-sm font-semibold text-white mb-3">{sectionName}</p>
                      <textarea
                        value={section.cards.join('\n')}
                        onChange={e => isElite
                          ? setEliteSectionCards(i, e.target.value)
                          : setSectionCards(i, e.target.value)
                        }
                        rows={Math.max(4, section.cards.length + 2)}
                        placeholder="One card per line…"
                        className="w-full bg-[#0a0e1a] border border-white/8 rounded-lg px-3 py-2.5 text-gray-300 text-sm
                          font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-none transition-colors"
                      />
                      <div className="text-xs text-gray-600 mt-1">{section.cards.length} cards</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
