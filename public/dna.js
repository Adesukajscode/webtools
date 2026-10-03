/* ═══════════════════════════════════════════════════════
   DNA Helix Background Animation — Canvas 2D
   ═══════════════════════════════════════════════════════ */
(function () {
  "use strict";

  // hormati preferensi aksesibilitas
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.getElementById("dna-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  // ── Konfigurasi helix ──
  const CONFIG = {
    baseCount: 40,       // jumlah pasangan basa
    radiusX: 0,          // di-set dinamis
    radiusY: 0,          // di-set dinamis
    spacing: 0,          // jarak antar base
    rotateSpeed: 0.35,   // radian per detik
    waveSpeed: 0.9,      // gelombang vertikal
    particles: 60,       // partikel ambient
  };

  // ── State ──
  let t = 0;
  let lastT = 0;
  let paused = false;

  // ── Warna (ambil dari CSS vars) ──
  function getColor(varName, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v || fallback;
  }

  // ── Partikel ambient (efek debu bintang) ──
  const particles = [];
  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < CONFIG.particles; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.4,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        a: Math.random() * 0.4 + 0.1,
      });
    }
  }
  initParticles();

  // ── Render satu frame ──
  function draw(now) {
    if (!lastT) lastT = now;
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    if (!paused) t += dt;

    ctx.clearRect(0, 0, W, H);

    // ambil warna theme
    const accent  = getColor("--accent",  "#00d4ff");
    const accent3 = getColor("--accent-3", "#a855f7");
    const accent4 = getColor("--accent-4", "#00ff9d");

    // ── Layout dinamis ──
    const cx = W * 0.5;
    const cy = H * 0.5;
    const helixH = Math.min(H * 0.85, 900);
    const helixW = Math.min(W * 0.28, 260);

    const baseCount = CONFIG.baseCount;
    const spacing = helixH / baseCount;
    const radiusX = helixW * 0.5;
    const radiusY = helixW * 0.12; // kedalaman pseudo-3D

    const rotation = t * CONFIG.rotateSpeed;
    const wave = t * CONFIG.waveSpeed;

    // ── Partikel ambient ──
    for (const p of particles) {
      if (!paused) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
      }
      ctx.beginPath();
      ctx.fillStyle = accent;
      ctx.globalAlpha = p.a * 0.5;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Strand 1 & 2: kumpulkan titik dulu biar bisa sort by depth ──
    const points1 = [];
    const points2 = [];

    for (let i = 0; i < baseCount; i++) {
      const yy = cy - helixH * 0.5 + i * spacing;
      const phase = rotation + (i / baseCount) * Math.PI * 6 + wave * 0.15;

      const x1 = cx + Math.cos(phase) * radiusX;
      const z1 = Math.sin(phase); // -1..1 (depan/belakang)
      const y1 = yy + Math.sin(phase + wave) * radiusY;

      const x2 = cx + Math.cos(phase + Math.PI) * radiusX;
      const z2 = Math.sin(phase + Math.PI);
      const y2 = yy + Math.sin(phase + Math.PI + wave) * radiusY;

      points1.push({ x: x1, y: y1, z: z1, i });
      points2.push({ x: x2, y: y2, z: z2, i });
    }

    // ── Rung (pasangan basa penghubung) ──
    for (let i = 0; i < baseCount; i++) {
      const a = points1[i];
      const b = points2[i];
      const depth = (a.z + b.z) / 2; // -1..1
      const alpha = 0.08 + (depth + 1) * 0.15; // 0.08..0.38
      const lw = 0.6 + (depth + 1) * 0.8;

      // pilih warna berdasarkan posisi
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, accent);
      grad.addColorStop(0.5, i % 2 === 0 ? accent3 : accent);
      grad.addColorStop(1, i % 3 === 0 ? accent4 : accent3);

      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Node (base pair titik) ──
    const all = points1.concat(points2);
    all.sort((p, q) => p.z - q.z); // belakang digambar dulu

    for (const p of all) {
      const depth = (p.z + 1) / 2;         // 0..1
      const r = 1.6 + depth * 2.6;         // 1.6..4.2
      const alpha = 0.25 + depth * 0.55;   // 0.25..0.80

      const color = p.i % 3 === 0 ? accent4 : p.i % 2 === 0 ? accent3 : accent;

      // glow luar
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * 0.35;
      ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // inti
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(draw);
  }

  // ── Pause saat tab tidak aktif (hemat CPU) ──
  document.addEventListener("visibilitychange", () => {
    paused = document.hidden;
    lastT = 0;
  });

  requestAnimationFrame(draw);
})();
