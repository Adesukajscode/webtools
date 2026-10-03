#!/data/data/com.termux/files/usr/bin/bash
cd ~/webtools/public || exit 1
python3 - <<'PYEOF'
import re, os

SCRIPTS = [
  "icons.js", "app.js", "tools-extra.js", "tools-downloader.js",
  "tools-apk.js", "device-info.js", "reviews.js", "face.js",
  "hands.js", "youtube.js", "games.js", "media-tools.js",
  "analog-clock.js", "casino-slot.js", "lightning.js", "fix-all.js"
]

with open("app.html") as f:
    html = f.read()

# 1. Hapus SEMUA <script src="*.js"></script> untuk script kita
for s in SCRIPTS:
    html = re.sub(r'<script src="' + re.escape(s) + r'"></script>\s*', '', html)

# 2. Cek file yang ada — hanya inject yang ada
exists = [s for s in SCRIPTS if os.path.exists(s)]

# 3. Inject ulang sebelum </body> dengan defer
tags = "".join('<script src="%s" defer></script>' % s for s in exists)
html = html.replace("</body>", tags + "\n</body>")

with open("app.html", "w") as f:
    f.write(html)

print("[ok] Injected %d scripts (defer):" % len(exists))
for s in exists:
    print("   - " + s)
PYEOF
