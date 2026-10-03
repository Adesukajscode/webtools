/* ═══════════════════════════════════════════════════════
   Google Sign-In — GIS id_token flow (client-side only)
   Anti-block: popup → redirect fallback
   ═══════════════════════════════════════════════════════ */
(function () {
  "use strict";

  // ── KONFIGURASI ─────────────────────────────
  const CFG = {
    // GANTI DENGAN CLIENT ID VEX
    clientId: "378343687083-61ma2sr8ll86gkt1oqp07acin7k8940m.apps.googleusercontent.com",

    // Mode: "popup" (default) atau "redirect"
    uxMode: "popup",

    // Durasi timeout deteksi popup blocked (ms)
    popupBlockDetectMs: 2500,

    // Redirect URI (otomatis dari lokasi)
    getRedirectUri: () => window.location.origin + window.location.pathname,

    // Storage key
    userKey: "ct_google_user",
  };

  // ── State ───────────────────────────────────
  let gsiReady = false;
  let gsiCallback = null;

  // ── Load GIS library ────────────────────────
  function loadGSI() {
    return new Promise((resolve) => {
      if (window.google && window.google.accounts) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = () => {
        console.warn("[google] GIS library gagal load");
        resolve();
      };
      document.head.appendChild(s);
    });
  }

  // ── Decode JWT (id_token) ───────────────────
  function decodeJWT(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("invalid JWT");
      const payload = JSON.parse(
        decodeURIComponent(
          atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
            .split("")
            .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        )
      );
      return payload;
    } catch (e) {
      console.error("[google] JWT decode error:", e);
      return null;
    }
  }

  // ── Handle credential dari Google ───────────
  function handleCredential(response) {
    console.log("[google] credential received");
    const payload = decodeJWT(response.credential);
    if (!payload) {
      if (typeof showAuthError === "function") {
        showAuthError("Gagal decode data Google.");
      }
      return;
    }

    const user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      given_name: payload.given_name,
      family_name: payload.family_name,
      picture: payload.picture,
      email_verified: payload.email_verified,
      loginAt: Date.now(),
    };

    // Simpan user
    try {
      localStorage.setItem(CFG.userKey, JSON.stringify(user));
    } catch (e) {}

    console.log("[google] user:", user.email);

    // Callback ke auth.js
    if (typeof window.onGoogleLogin === "function") {
      window.onGoogleLogin(user);
    }
  }

  // ── Deteksi apakah popup diblokir ───────────
  function isPopupLikelyBlocked() {
    // Heuristik: cek beberapa detik setelah trigger,
    // apakah window masih sama (popup gagal terbuka)
    // Tapi kita pakai fallback: kalau dalam 3 detik tidak ada callback,
    // tawarkan fallback redirect.
    return false; // akan di-override oleh timeout
  }

  // ── Render tombol GSI (hidden) ──────────────
  function renderHiddenButton() {
    if (!window.google || !window.google.accounts) return;

    // Container tersembunyi
    let hidden = document.getElementById("gsi-hidden-container");
    if (!hidden) {
      hidden = document.createElement("div");
      hidden.id = "gsi-hidden-container";
      hidden.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;";
      document.body.appendChild(hidden);
    }

    // Render tombol GSI asli
    google.accounts.id.initialize({
      client_id: CFG.clientId,
      callback: handleCredential,
      ux_mode: CFG.uxMode,
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true, // FedCM — lebih anti-block
    });

    google.accounts.id.renderButton(hidden, {
      type: "standard",
      size: "large",
      theme: "outline",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
    });

    gsiReady = true;
    console.log("[google] GSI button rendered (hidden)");
  }

  // ── Trigger Google Sign-In ──────────────────
  function triggerSignIn() {
    if (!gsiReady) {
      console.warn("[google] GSI belum siap");
      return false;
    }

    // Cari tombol GSI di dalam container tersembunyi
    const hidden = document.getElementById("gsi-hidden-container");
    if (!hidden) return false;

    // Coba klik iframe GSI langsung
    const iframe = hidden.querySelector("iframe");
    if (iframe) {
      iframe.click();
      console.log("[google] iframe clicked");
      return true;
    }

    // Fallback: cari div dengan id berakhiran "-overlay"
    const overlay = hidden.querySelector('[id$="-overlay"]');
    if (overlay) {
      overlay.click();
      console.log("[google] overlay clicked");
      return true;
    }

    // Fallback terakhir: klik container
    const btn = hidden.querySelector("div[role='button']");
    if (btn) {
      btn.click();
      return true;
    }

    console.warn("[google] tombol tidak ditemukan");
    return false;
  }

  // ── Fallback: redirect mode ─────────────────
  function redirectToGoogle() {
    // Buat URL OAuth manual (implicit flow)
    const params = new URLSearchParams({
      client_id: CFG.clientId,
      redirect_uri: CFG.getRedirectUri(),
      response_type: "id_token",
      scope: "openid email profile",
      nonce: crypto.randomUUID(),
      state: crypto.randomUUID(),
      prompt: "select_account",
    });
    // Catatan: Google Identity Services tidak support manual implicit flow
    // Kalau popup blocked, kita tampilkan pesan ke user
    if (typeof showAuthError === "function") {
      showAuthError("Popup diblokir. Izinkan popup di browser, lalu coba lagi.");
    }
    console.warn("[google] popup blocked — minta user izinkan popup");
    return false;
  }

  // ── Detect popup blocked ────────────────────
  function detectPopupBlock() {
    // Setelah trigger, tunggu 3 detik
    // Kalau tidak ada callback handleCredential → kemungkinan blocked
    let called = false;
    const origHandler = handleCredential;

    // Override sementara
    window.onGoogleLogin = (user) => {
      called = true;
      if (typeof origHandler === "function") origHandler(user);
    };

    setTimeout(() => {
      if (!called) {
        console.warn("[google] popup tidak muncul (kemungkinan blocked)");
        // Tampilkan tombol fallback
        showPopupBlockedHelp();
      }
    }, CFG.popupBlockDetectMs);
  }

  function showPopupBlockedHelp() {
    const help = document.getElementById("google-block-help");
    if (help) {
      help.style.display = "block";
    }
  }

  // ── Check redirect result (kalau user sudah login via redirect) ──
  function checkRedirectResult() {
    const hash = window.location.hash;
    if (!hash || hash.indexOf("id_token=") === -1) return;
    const params = new URLSearchParams(hash.substring(1));
    const idToken = params.get("id_token");
    if (id_token) {
      handleCredential({ credential: id_token });
      // Bersihkan hash
      history.replaceState(null, "", window.location.pathname);
    }
  }

  // ── Get saved user ──────────────────────────
  function getSavedUser() {
    try {
      const raw = localStorage.getItem(CFG.userKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // ── Clear user ──────────────────────────────
  function clearUser() {
    localStorage.removeItem(CFG.userKey);
    if (window.google && window.google.accounts && google.accounts.id) {
      try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    }
  }

  // ── Init ────────────────────────────────────
  async function init() {
    if (!CFG.clientId || CFG.clientId.indexOf("GANTI") === 0) {
      console.warn("[google] Client ID belum diisi. Edit auth-google.js");
      return;
    }

    // Cek redirect result dulu
    checkRedirectResult();

    // Load GIS
    await loadGSI();

    // Tunggu GIS siap
    if (window.google && window.google.accounts) {
      renderHiddenButton();
    } else {
      // retry max 5x
      let retry = 0;
      const interval = setInterval(() => {
        retry++;
        if (window.google && window.google.accounts) {
          clearInterval(interval);
          renderHiddenButton();
        } else if (retry > 10) {
          clearInterval(interval);
          console.warn("[google] GIS gagal load setelah 5 detik");
        }
      }, 500);
    }
  }

  // ── Expose API ──────────────────────────────
  window.CyberGoogle = {
    signIn: () => {
      const ok = triggerSignIn();
      if (ok) detectPopupBlock();
      return ok;
    },
    redirect: redirectToGoogle,
    getUser: getSavedUser,
    logout: clearUser,
    isReady: () => gsiReady,
    config: CFG,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
