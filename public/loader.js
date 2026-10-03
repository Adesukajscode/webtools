/* ═══════════════════════════════════════════════════════
   CyberToolbox Preloader — Animated Loading Screen
   ═══════════════════════════════════════════════════════ */
(function () {
  "use strict";

  // ── Konfigurasi ─────────────────────────────
  const CFG = {
    minDuration: 1400,     // durasi minimum (ms) — biar animasi keliatan
    maxDuration: 6000,     // durasi maksimum — paksa hilang kalau kelamaan
    fadeOutMs: 600,        // durasi fade-out
    showProgress: true,    // tampilkan progress %
    showText: true,        // tampilkan status text
    messages: [
      "Menyiapkan tools...",
      "Memuat antarmuka...",
      "Menghubungkan CDN...",
      "Hampir selesai...",
      "Selamat datang ✦"
    ]
  };

  // ── Inject HTML loader ──────────────────────
  function createLoader() {
    const el = document.createElement("div");
    el.id = "preloader";
    el.innerHTML = `
      <div class="preloader-inner">
        <div class="preloader-logo">
          <div class="preloader-ring"></div>
          <div class="preloader-ring preloader-ring-2"></div>
          <div class="preloader-ring preloader-ring-3"></div>
          <div class="preloader-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
        </div>
        <div class="preloader-title">CyberToolbox</div>
        <div class="preloader-progress">
          <div class="preloader-bar" id="preloader-bar"></div>
        </div>
        <div class="preloader-status" id="preloader-status">Memuat...</div>
        <div class="preloader-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  // ── Jalankan preloader ──────────────────────
  function runPreloader() {
    const el = createLoader();
    const bar = document.getElementById("preloader-bar");
    const status = document.getElementById("preloader-status");

    const t0 = performance.now();
    let progress = 0;
    let done = false;
    let msgIndex = 0;

    // progress increment dengan easing random (organik)
    function tick() {
      if (done) return;
      const elapsed = performance.now() - t0;

      // makin lama, makin lambat (biar keliatan natural)
      const pct = Math.min(elapsed / CFG.minDuration, 1);
      const target = Math.min(pct * 85 + Math.random() * 10, 95);

      if (target > progress) {
        progress = target;
        bar.style.width = progress + "%";
        if (CFG.showProgress) status.textContent = Math.floor(progress) + "%";
      }

      // ganti pesan berkala
      if (CFG.showText) {
        const newIdx = Math.min(Math.floor((elapsed / CFG.minDuration) * CFG.messages.length), CFG.messages.length - 1);
        if (newIdx !== msgIndex) {
          msgIndex = newIdx;
          status.textContent = CFG.messages[msgIndex];
        }
      }

      if (elapsed < CFG.maxDuration) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);

    // selesai saat window.loaded DAN minimum duration tercapai
    const finish = () => {
      if (done) return;
      done = true;

      const elapsed = performance.now() - t0;
      const remaining = Math.max(CFG.minDuration - elapsed, 0);

      setTimeout(() => {
        progress = 100;
        bar.style.width = "100%";
        if (CFG.showText) status.textContent = CFG.messages[CFG.messages.length - 1];

        // fade out
        setTimeout(() => {
          el.classList.add("preloader-hide");
          document.documentElement.classList.add("loaded");
          setTimeout(() => el.remove(), CFG.fadeOutMs);
        }, 350);
      }, remaining);
    };

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish);
      // fallback: paksa hilang setelah maxDuration
      setTimeout(finish, CFG.maxDuration);
    }
  }

  // ── Start ───────────────────────────────────
  if (document.readyState === "loading") {
    // inject saat DOM siap, biar body sudah ada
    document.addEventListener("DOMContentLoaded", runPreloader);
  } else {
    runPreloader();
  }
})();
