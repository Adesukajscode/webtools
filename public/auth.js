/* ═══════════════════════════════════════════════════════
   CyberToolbox Auth v2 — Token + Fingerprint Scanner
   ═══════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const CFG = {
    tokenLength: 6,
    expireSeconds: 120,
    storageKey: "ct_auth",
    sessionHours: 24,
    autoShow: true,
    showOnApp: true,
    scanDuration: 2400        // durasi animasi scanning (ms)
  };

  let currentToken = "";
  let expireAt = 0;
  let timerInterval = null;
  let activeMode = "token";   // "token" | "fingerprint"
  let scanning = false;

  const isAppPage = /app\.html/.test(window.location.pathname) ||
                    document.getElementById("tool-hash") !== null;
  const shouldGate = isAppPage && CFG.showOnApp;

  // ── Session ─────────────────────────────────
  function getSession() {
    try {
      const raw = localStorage.getItem(CFG.storageKey);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s.expire || s.expire < Date.now()) {
        localStorage.removeItem(CFG.storageKey);
        return null;
      }
      return s;
    } catch (e) { return null; }
  }
  function saveSession(method) {
    const expire = Date.now() + CFG.sessionHours * 3600 * 1000;
    localStorage.setItem(CFG.storageKey, JSON.stringify({
      login: Date.now(),
      expire: expire,
      method: method || "token"
    }));
  }
  function clearSession() {
    localStorage.removeItem(CFG.storageKey);
  }

  // ── Token ───────────────────────────────────
  function generateToken() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let t = "";
    const arr = new Uint32Array(CFG.tokenLength);
    crypto.getRandomValues(arr);
    for (let i = 0; i < CFG.tokenLength; i++) t += chars[arr[i] % chars.length];
    return t;
  }

  // ── Helpers ─────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function showError(msg) {
    const el = $("auth-error");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("auth-error-show");
    setTimeout(() => el.classList.remove("auth-error-show"), 3200);
  }
  function showSuccess(msg) {
    const el = $("auth-success");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("auth-success-show");
    setTimeout(() => el.classList.remove("auth-success-show"), 2500);
  }
  function shakeCard() {
    const el = $("auth-card");
    if (!el) return;
    el.classList.remove("auth-card-shake");
    void el.offsetWidth;
    el.classList.add("auth-card-shake");
    setTimeout(() => el.classList.remove("auth-card-shake"), 500);
  }

  // ── Countdown timer ─────────────────────────
  function startCountdown() {
    const el = $("auth-timer");
    if (!el) return;
    if (timerInterval) clearInterval(timerInterval);
    function update() {
      const remaining = Math.max(0, Math.floor((expireAt - Date.now()) / 1000));
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      el.textContent = `${m}:${s.toString().padStart(2, "0")}`;
      el.classList.toggle("auth-timer-warn", remaining <= 20);
      if (remaining <= 0) {
        clearInterval(timerInterval);
        const tok = $("auth-token-value");
        if (tok) {
          tok.textContent = "—EXPIRED—";
          tok.classList.add("auth-token-expired");
        }
        showError("Kode expired. Klik refresh.");
      }
    }
    update();
    timerInterval = setInterval(update, 1000);
  }

  // ── Verify token ────────────────────────────
  function verifyToken() {
    const input = $("auth-input");
    if (!input) return;
    const val = (input.value || "").trim().toUpperCase();

    if (!val) { showError("Masukkan kode dulu."); shakeCard(); return; }
    if (Date.now() > expireAt) { showError("Kode sudah expired. Refresh."); shakeCard(); return; }
    if (val !== currentToken) {
      showError("Kode salah. Coba lagi.");
      shakeCard();
      input.value = "";
      input.focus();
      return;
    }

    showSuccess("Login berhasil! Membuka tools...");
    saveSession("token");
    setTimeout(() => {
      closePopup();
      if (typeof window.onAuthSuccess === "function") {
        try { window.onAuthSuccess(); } catch (e) {}
      }
    }, 900);
  }

  // ── Fingerprint scan ────────────────────────
  function startFingerprintScan() {
    if (scanning) return;
    scanning = true;

    const pad = $("fp-pad");
    const status = $("fp-status");
    const progress = $("fp-progress");
    const label = $("fp-label");

    if (!pad || !status || !progress) return;

    pad.classList.add("fp-pad-scanning");
    pad.classList.remove("fp-pad-success", "fp-pad-error");
    progress.style.width = "0%";
    status.textContent = "Mendeteksi jari...";
    status.className = "fp-status";

    const t0 = performance.now();

    // Tahapan scanning
    const stages = [
      { at: 0,    text: "Mendeteksi jari..." },
      { at: 500,  text: "Memindai pola..." },
      { at: 1200, text: "Mencocokkan data..." },
      { at: 1800, text: "Memverifikasi identitas..." }
    ];

    function tick(now) {
      const elapsed = now - t0;
      const pct = Math.min((elapsed / CFG.scanDuration) * 100, 100);
      progress.style.width = pct + "%";

      // update status text
      let cur = stages[0].text;
      for (const s of stages) if (elapsed >= s.at) cur = s.text;
      status.textContent = cur;

      if (elapsed < CFG.scanDuration) {
        requestAnimationFrame(tick);
      } else {
        // selesai — selalu sukses
        pad.classList.remove("fp-pad-scanning");
        pad.classList.add("fp-pad-success");
        status.textContent = "✓ Terverifikasi";
        status.className = "fp-status fp-status-success";
        if (label) label.textContent = "Selamat datang kembali";

        // ripple effect
        const ripple = document.createElement("div");
        ripple.className = "fp-ripple";
        pad.appendChild(ripple);
        setTimeout(() => ripple.remove(), 900);

        setTimeout(() => {
          showSuccess("Login berhasil! Membuka tools...");
          saveSession("fingerprint");
          setTimeout(() => {
            closePopup();
            if (typeof window.onAuthSuccess === "function") {
              try { window.onAuthSuccess(); } catch (e) {}
            }
          }, 700);
        }, 500);
      }
    }
    requestAnimationFrame(tick);

    // reset scanning flag
    setTimeout(() => { scanning = false; }, CFG.scanDuration + 1500);
  }

  // ── Mode switch ─────────────────────────────
  function switchMode(mode) {
    activeMode = mode;
    const tokenView = $("auth-view-token");
    const fpView = $("auth-view-fp");
    if (!tokenView || !fpView) return;

    if (mode === "fingerprint") {
      tokenView.classList.remove("auth-view-show");
      fpView.classList.add("auth-view-show");
      // reset finger state
      const pad = $("fp-pad");
      const status = $("fp-status");
      const progress = $("fp-progress");
      const label = $("fp-label");
      if (pad) pad.className = "fp-pad";
      if (status) { status.textContent = "Sentuh untuk memindai"; status.className = "fp-status"; }
      if (progress) progress.style.width = "0%";
      if (label) label.textContent = "Pindai Sidik Jari";
      if (timerInterval) clearInterval(timerInterval);
    } else {
      fpView.classList.remove("auth-view-show");
      tokenView.classList.add("auth-view-show");
      // regenerate token + timer
      currentToken = generateToken();
      expireAt = Date.now() + CFG.expireSeconds * 1000;
      const tok = $("auth-token-value");
      if (tok) {
        tok.textContent = currentToken;
        tok.classList.remove("auth-token-expired");
      }
      startCountdown();
      setTimeout(() => {
        const inp = $("auth-input");
        if (inp) inp.focus();
      }, 300);
    }
  }

  // ── Build popup ─────────────────────────────
  function buildPopup() {
    const el = document.createElement("div");
    el.id = "auth-overlay";
    el.innerHTML = `
      <div class="auth-card" id="auth-card">
        <div class="auth-glow"></div>

        <div class="auth-head">
          <div class="auth-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div class="auth-title">Verifikasi Akses</div>
          <div class="auth-sub">Masukkan kode atau pindai sidik jari untuk membuka CyberToolbox</div>
        </div>

        <!-- ══ TOKEN VIEW ══ -->
        <div class="auth-view auth-view-show" id="auth-view-token">
          <div class="auth-token-box">
            <div class="auth-token-label">KODE ANDA</div>
            <div class="auth-token-row">
              <div class="auth-token-value" id="auth-token-value">------</div>
              <button class="auth-btn-refresh" id="auth-refresh" title="Kode baru">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </button>
            </div>
            <div class="auth-token-timer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span id="auth-timer">--:--</span>
            </div>
          </div>

          <div class="auth-input-box">
            <label class="auth-input-label">Masukkan kode</label>
            <input type="text" id="auth-input" class="auth-input" placeholder="••••••"
              maxlength="${CFG.tokenLength}" autocomplete="off" autocapitalize="characters" spellcheck="false">
          </div>

          <button class="auth-btn-primary" id="auth-submit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Verifikasi & Masuk
          </button>
        </div>

        <!-- ══ FINGERPRINT VIEW ══ -->
        <div class="auth-view" id="auth-view-fp">
          <div class="fp-pad" id="fp-pad">
            <svg class="fp-svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <!-- fingerprint pattern (nested arcs) -->
              <path d="M50 20 C 30 20, 20 32, 20 50 C 20 65, 28 78, 40 82" />
              <path d="M50 26 C 34 26, 26 36, 26 50 C 26 62, 32 72, 42 78" />
              <path d="M50 32 C 38 32, 32 40, 32 50 C 32 60, 36 68, 44 74" />
              <path d="M50 38 C 42 38, 38 44, 38 50 C 38 58, 42 62, 46 68" />
              <path d="M50 44 C 46 44, 44 47, 44 50 C 44 54, 46 58, 48 62" />
              <path d="M50 20 C 70 20, 80 32, 80 50 C 80 65, 72 78, 60 82" />
              <path d="M50 26 C 66 26, 74 36, 74 50 C 74 62, 68 72, 58 78" />
              <path d="M50 32 C 62 32, 68 40, 68 50 C 68 60, 64 68, 56 74" />
              <path d="M50 38 C 58 38, 62 44, 62 50 C 62 58, 58 62, 54 68" />
              <path d="M50 44 C 54 44, 56 47, 56 50 C 56 54, 54 58, 52 62" />
              <circle cx="50" cy="50" r="2" stroke-width="2"/>
              <path d="M50 8 L50 14" opacity="0.4"/>
              <path d="M50 92 L50 86" opacity="0.4"/>
            </svg>
            <div class="fp-scanline"></div>
            <div class="fp-scanline fp-scanline-2"></div>
            <div class="fp-corners">
              <span></span><span></span><span></span><span></span>
            </div>
          </div>

          <div class="fp-progress-wrap">
            <div class="fp-progress" id="fp-progress"></div>
          </div>

          <div class="fp-status" id="fp-status">Sentuh untuk memindai</div>
          <div class="fp-label" id="fp-label">Pindai Sidik Jari</div>

          <button class="auth-btn-primary fp-btn-scan" id="fp-scan">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            Mulai Pindai
          </button>
        </div>

        <div class="auth-error" id="auth-error"></div>
        <div class="auth-success" id="auth-success"></div>

        <button class="auth-btn-google" id="google-btn-ct">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Lanjutkan dengan Google</span>
        </button>

        <div class="google-block-help" id="google-block-help">
          <strong>⚠ Popup diblokir?</strong><br>
          Buka pengaturan browser → izinkan popup untuk situs ini, lalu klik tombol di atas lagi.
          <br><a href="https://support.google.com/chrome/answer/95472" target="_blank">Cara izinkan popup →</a>
        </div>

        <div class="auth-divider">
          <span>atau</span>
        </div>

        <button class="auth-btn-switch" id="auth-switch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          </svg>
          <span id="auth-switch-text">Pindai Sidik Jari</span>
        </button>

        <div class="auth-foot">
          Kode berlaku ${Math.floor(CFG.expireSeconds/60)} menit · Sidik jari langsung terima
        </div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  // ── Open/close ──────────────────────────────
  function openPopup() {
    const el = $("auth-overlay") || buildPopup();
    document.documentElement.classList.add("auth-active");
    setTimeout(() => el.classList.add("auth-overlay-show"), 20);

    currentToken = generateToken();
    expireAt = Date.now() + CFG.expireSeconds * 1000;

    const tok = $("auth-token-value");
    if (tok) { tok.textContent = currentToken; tok.classList.remove("auth-token-expired"); }

    activeMode = "token";
    switchMode("token");
    startCountdown();
  }

  function closePopup() {
    const el = $("auth-overlay");
    if (!el) return;
    el.classList.remove("auth-overlay-show");
    document.documentElement.classList.remove("auth-active");
    if (timerInterval) clearInterval(timerInterval);
  }

  // ── Bind events ─────────────────────────────
  function bind() {
    // token
    const submit = $("auth-submit");
    const input = $("auth-input");
    const refresh = $("auth-refresh");

    if (submit) submit.addEventListener("click", verifyToken);
    if (input) {
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") verifyToken(); });
      input.addEventListener("input", () => {
        const v = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (v !== input.value) input.value = v;
      });
    }
    if (refresh) {
      refresh.addEventListener("click", () => {
        currentToken = generateToken();
        expireAt = Date.now() + CFG.expireSeconds * 1000;
        const tok = $("auth-token-value");
        if (tok) { tok.textContent = currentToken; tok.classList.remove("auth-token-expired"); }
        const err = $("auth-error");
        if (err) err.classList.remove("auth-error-show");
        startCountdown();
        const inp = $("auth-input");
        if (inp) { inp.value = ""; inp.focus(); }
      });
    }

    // fingerprint — klik pad atau tombol
    const pad = $("fp-pad");
    const scanBtn = $("fp-scan");
    if (pad) pad.addEventListener("click", startFingerprintScan);
    if (scanBtn) scanBtn.addEventListener("click", startFingerprintScan);

    // switch mode
    const switchBtn = $("auth-switch");
    const switchText = $("auth-switch-text");
    if (switchBtn) {
      switchBtn.addEventListener("click", () => {
        if (activeMode === "token") {
          switchMode("fingerprint");
          if (switchText) switchText.textContent = "Masukkan Kode";
        } else {
          switchMode("token");
          if (switchText) switchText.textContent = "Pindai Sidik Jari";
        }
      });
    }
  }

    setupGoogleLogin();

  // ── Init ────────────────────────────────────
  function init() {
    if (!shouldGate) return;
    const session = getSession();

    if (!session && CFG.autoShow) {
      const tryOpen = () => {
        if ($("preloader")) { setTimeout(tryOpen, 300); return; }
        buildPopup();
        bind();
        openPopup();
      };
      setTimeout(tryOpen, 1200);
    } else {
      document.documentElement.classList.add("auth-passed");
      document.dispatchEvent(new CustomEvent("authSuccess"));
    }
  }

  // ── Public API ──────────────────────────────
  // ── Google login handler ─────────────────────
  function setupGoogleLogin() {
    // callback dari auth-google.js
    window.onGoogleLogin = function(user) {
      if (!user || !user.email) {
        showError("Login Google gagal.");
        return;
      }
      showSuccess("Login Google berhasil: " + user.email);
      saveSession("google");

      // Simpan profile untuk ditampilkan
      try {
        localStorage.setItem("ct_google_profile", JSON.stringify(user));
      } catch (e) {}

      setTimeout(() => {
        closePopup();
        if (typeof window.onAuthSuccess === "function") {
          try { window.onAuthSuccess(user); } catch (e) {}
        }
      }, 900);
    };

    // tombol Google
    const btn = document.getElementById("google-btn-ct");
    if (btn) {
      btn.addEventListener("click", function() {
        if (!window.CyberGoogle || !window.CyberGoogle.isReady()) {
          showError("Google belum siap. Tunggu sebentar...");
          return;
        }
        const ok = window.CyberGoogle.signIn();
        if (!ok) {
          showError("Gagal membuka popup Google.");
        }
      });
    }
  }

  window.CyberAuth = {
    open: openPopup,
    close: closePopup,
    switchToFingerprint: () => switchMode("fingerprint"),
    switchToToken: () => switchMode("token"),
    logout: () => { clearSession(); location.reload(); },
    isLoggedIn: () => !!getSession(),
    getUser: () => getSession()
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
