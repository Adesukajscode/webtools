// ── TABS ──
document.querySelectorAll('#tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tool-' + btn.dataset.tool).classList.add('active');
  });
});

function out(id, html) {
  document.getElementById(id).innerHTML = html;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function kv(k, v) {
  return `<div><span class="key">${esc(k)}</span>: <span class="val">${esc(v)}</span></div>`;
}

// ── HASH ──
async function genHash(algo) {
  const text = document.getElementById('hash-input').value;
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest(algo, enc);
  const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
  out('hash-output', kv(algo, hex));
}

// ── BASE64 ──
function b64Encode() {
  try {
    const t = document.getElementById('b64-input').value;
    out('b64-output', btoa(unescape(encodeURIComponent(t))));
  } catch(e) { out('b64-output', `<span class="err">${e.message}</span>`); }
}
function b64Decode() {
  try {
    const t = document.getElementById('b64-input').value.trim();
    out('b64-output', decodeURIComponent(escape(atob(t))));
  } catch(e) { out('b64-output', `<span class="err">Invalid base64</span>`); }
}

// ── URL ──
function urlEncode() {
  out('url-output', encodeURIComponent(document.getElementById('url-input').value));
}
function urlDecode() {
  try { out('url-output', decodeURIComponent(document.getElementById('url-input').value)); }
  catch(e) { out('url-output', `<span class="err">${e.message}</span>`); }
}
function urlParse() {
  try {
    const u = new URL(document.getElementById('url-input').value);
    let html = '';
    ['protocol','hostname','port','pathname','search','hash','origin'].forEach(k => {
      html += kv(k, u[k] || '(kosong)');
    });
    const params = [...u.searchParams.entries()];
    if (params.length) {
      html += '<div style="margin-top:8px"><span class="key">query params:</span></div>';
      params.forEach(([k,v]) => html += kv('  ' + k, v));
    }
    out('url-output', html);
  } catch(e) { out('url-output', `<span class="err">URL tidak valid</span>`); }
}

// ── HEX ──
function hexEncode() {
  const t = document.getElementById('hex-input').value;
  const hex = [...new TextEncoder().encode(t)].map(b => b.toString(16).padStart(2,'0')).join('');
  out('hex-output', hex);
}
function hexDecode() {
  try {
    const h = document.getElementById('hex-input').value.replace(/\s/g,'');
    const bytes = h.match(/.{1,2}/g).map(b => parseInt(b,16));
    out('hex-output', new TextDecoder().decode(new Uint8Array(bytes)));
  } catch(e) { out('hex-output', `<span class="err">Hex tidak valid</span>`); }
}

// ── JWT ──
function jwtDecode() {
  try {
    const t = document.getElementById('jwt-input').value.trim();
    const [h, p, s] = t.split('.');
    if (!h || !p) throw new Error('format JWT: header.payload.signature');
    const dec = x => JSON.parse(atob(x.replace(/-/g,'+').replace(/_/g,'/')));
    const header = dec(h);
    const payload = dec(p);
    let html = '<div><span class="key">HEADER:</span></div>';
    html += `<div class="val">${esc(JSON.stringify(header,null,2))}</div>`;
    html += '<div style="margin-top:8px"><span class="key">PAYLOAD:</span></div>';
    html += `<div class="val">${esc(JSON.stringify(payload,null,2))}</div>`;
    if (payload.exp) {
      const exp = new Date(payload.exp * 1000);
      const now = new Date();
      const status = exp > now ? '✅ masih valid' : '❌ sudah expired';
      html += `<div style="margin-top:8px"><span class="key">expires:</span> ${exp.toLocaleString()} ${status}</div>`;
    }
    out('jwt-output', html);
  } catch(e) { out('jwt-output', `<span class="err">${e.message}</span>`); }
}

// ── UUID ──
function genUUID(n) {
  const ids = [];
  for (let i=0; i<n; i++) ids.push(crypto.randomUUID());
  out('uuid-output', ids.join('\n'));
}

// ── PASSWORD ──
function genPassword() {
  const len = +document.getElementById('pw-len').value;
  let chars = '';
  if (document.getElementById('pw-upper').checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (document.getElementById('pw-lower').checked) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (document.getElementById('pw-digit').checked) chars += '0123456789';
  if (document.getElementById('pw-sym').checked)   chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!chars) return out('pw-output', '<span class="err">pilih minimal 1 opsi</span>');
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  const pw = [...arr].map(x => chars[x % chars.length]).join('');
  out('pw-output', esc(pw));
}

// ── QR ──
function genQR() {
  const t = document.getElementById('qr-input').value || 'https://netlify.com';
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(t)}`;
  out('qr-output', `<img src="${url}" alt="QR code" style="background:#fff;padding:8px">`);
}

// ── JSON ──
function jsonFormat(n) {
  try {
    const o = JSON.parse(document.getElementById('json-input').value);
    out('json-output', esc(JSON.stringify(o, null, n)));
  } catch(e) { out('json-output', `<span class="err">${e.message}</span>`); }
}
function jsonMinify() {
  try {
    const o = JSON.parse(document.getElementById('json-input').value);
    out('json-output', esc(JSON.stringify(o)));
  } catch(e) { out('json-output', `<span class="err">${e.message}</span>`); }
}

// ── REGEX ──
function testRegex() {
  try {
    const p = document.getElementById('regex-pattern').value;
    const f = document.getElementById('regex-flags').value;
    const t = document.getElementById('regex-text').value;
    const re = new RegExp(p, f);
    const matches = [...t.matchAll(re)];
    let html = kv('total matches', matches.length);
    if (matches.length) {
      html += '<div style="margin-top:8px"><span class="key">matches:</span></div>';
      matches.slice(0,50).forEach((m,i) => {
        html += `<div>  [${i}] <span class="val">"${esc(m[0])}"</span> <span class="dim">@ index ${m.index}</span></div>`;
        if (m.length > 1) {
          m.slice(1).forEach((g,j) => html += `<div class="dim">    group ${j+1}: ${esc(g)}</div>`);
        }
      });
    }
    out('regex-output', html);
  } catch(e) { out('regex-output', `<span class="err">${e.message}</span>`); }
}

// ── COLOR ──
function convertColor() {
  const c = document.getElementById('color-input').value.trim();
  try {
    let r, g, b;
    if (c.startsWith('#')) {
      const h = c.slice(1);
      const full = h.length === 3 ? h.split('').map(x => x+x).join('') : h;
      r = parseInt(full.slice(0,2),16);
      g = parseInt(full.slice(2,4),16);
      b = parseInt(full.slice(4,6),16);
    } else if (c.startsWith('rgb')) {
      [r,g,b] = c.match(/\d+/g).map(Number);
    } else {
      // hsl → rgb
      const [hh, ss, ll] = c.match(/\d+(\.\d+)?/g).map(Number);
      const s = ss/100, l = ll/100;
      const k = n => (n + hh/30) % 12;
      const a = s * Math.min(l, 1-l);
      const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
      r = Math.round(f(0)*255); g = Math.round(f(8)*255); b = Math.round(f(4)*255);
    }
    const hex = '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
    const max = Math.max(r,g,b)/255, min = Math.min(r,g,b)/255;
    const l = (max+min)/2;
    let h2 = 0, s2 = 0;
    if (max !== min) {
      const d = max - min;
      s2 = l > 0.5 ? d/(2-max-min) : d/(max+min);
      h2 = max === r/255 ? ((g/255 - b/255)/d + (g < b ? 6 : 0)) :
           max === g/255 ? ((b/255 - r/255)/d + 2) : ((r/255 - g/255)/d + 4);
      h2 *= 60;
    }
    let html = '';
    html += kv('HEX', hex);
    html += kv('RGB', `rgb(${r}, ${g}, ${b})`);
    html += kv('HSL', `hsl(${h2.toFixed(1)}, ${(s2*100).toFixed(1)}%, ${(l*100).toFixed(1)}%)`);
    html += `<div style="margin-top:10px;height:60px;background:${hex};border-radius:6px;border:1px solid var(--border)"></div>`;
    out('color-output', html);
  } catch(e) { out('color-output', `<span class="err">Format warna tidak dikenali</span>`); }
}

// ── CRON ──
function parseCron() {
  const c = document.getElementById('cron-input').value.trim();
  const parts = c.split(/\s+/);
  if (parts.length !== 5) return out('cron-output', '<span class="err">Butuh 5 field: menit jam tgl bulan hari</span>');
  const [m,h,dom,mo,dow] = parts;
  const names = {
    minute: m, hour: h, 'day of month': dom, month: mo, 'day of week': dow
  };
  const human = {
    '*': 'setiap', '*/5': 'setiap 5',
    '*/15': 'setiap 15', '*/30': 'setiap 30'
  };
  let html = '';
  Object.entries(names).forEach(([k,v]) => html += kv(k, v + (human[v] ? ` (${human[v]})` : '')));
  // rough human reading
  let desc = 'Jalan ';
  if (m === '*' && h === '*') desc += 'setiap menit';
  else if (m.startsWith('*/')) desc += `setiap ${m.slice(2)} menit`;
  else desc += `pada menit ${m}`;
  if (h !== '*') desc += `, jam ${h}`;
  if (dom !== '*') desc += `, tanggal ${dom}`;
  if (mo !== '*') desc += `, bulan ${mo}`;
  if (dow !== '*') desc += `, hari ke-${dow} (0=Minggu)`;
  html += `<div style="margin-top:8px"><span class="key">perkiraan:</span> <span class="val">${esc(desc)}</span></div>`;
  out('cron-output', html);
}

// ── IP ──
async function lookupIP() {
  const ip = document.getElementById('ip-input').value.trim();
  out('ip-output', '<span class="dim">querying...</span>');
  try {
    const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
    const r = await fetch(url);
    const d = await r.json();
    if (d.error) return out('ip-output', `<span class="err">${d.reason || 'error'}</span>`);
    let html = '';
    ['ip','city','region','country_name','postal','latitude','longitude','timezone','org','asn'].forEach(k => {
      if (d[k]) html += kv(k, d[k]);
    });
    out('ip-output', html);
  } catch(e) {
    out('ip-output', `<span class="err">${e.message}</span>`);
  }
}

// ── TEXT ──
function textStats() {
  const t = document.getElementById('text-input').value;
  const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  let html = '';
  html += kv('characters', t.length);
  html += kv('words', words);
  html += kv('lines', t.split('\n').length);
  html += kv('bytes', new TextEncoder().encode(t).length);
  out('text-output', html);
}
function textCase(mode) {
  const t = document.getElementById('text-input').value;
  const map = {
    upper:   t.toUpperCase(),
    lower:   t.toLowerCase(),
    title:   t.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()),
    reverse: [...t].reverse().join(''),
    slug:    t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  };
  out('text-output', esc(map[mode]));
}

// ── TIME ──
function timeNow() {
  const now = new Date();
  let html = '';
  html += kv('unix (s)', Math.floor(now.getTime()/1000));
  html += kv('unix (ms)', now.getTime());
  html += kv('ISO', now.toISOString());
  html += kv('local', now.toLocaleString());
  html += kv('UTC', now.toUTCString());
  out('time-output', html);
}
function timeParse() {
  const v = document.getElementById('time-input').value.trim() || Date.now();
  let d = new Date(/^\d+$/.test(v) ? (+v < 1e12 ? +v * 1000 : +v) : v);
  if (isNaN(d)) return out('time-output', '<span class="err">format tidak valid</span>');
  let html = '';
  html += kv('ISO', d.toISOString());
  html += kv('local', d.toLocaleString());
  html += kv('UTC', d.toUTCString());
  html += kv('unix', Math.floor(d.getTime()/1000));
  out('time-output', html);
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  timeNow();
  convertColor();
});
