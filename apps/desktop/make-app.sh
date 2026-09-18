#!/bin/zsh
# Builds MockFlow.app — a double-clickable, properly branded macOS bundle.
#
# It is a copy of the Electron runtime with our name, identifier and icon, and
# a stub entry point that loads the desktop shell from this checkout. That last
# part is what stops it being distributable: the code and node_modules still
# live in the repo. It exists so the app opens from Finder or Spotlight with
# its own name and icon instead of showing up as "Electron".
set -e
ROOT=${0:A:h:h:h}
DEST=${1:-$ROOT/dist-app}
APP="$DEST/MockFlow.app"

ELECTRON_APP=$(ls -d "$ROOT"/node_modules/.pnpm/electron@*/node_modules/electron/dist/Electron.app 2>/dev/null | head -1)
[[ -n "$ELECTRON_APP" ]] || { echo "Electron runtime not found — run: pnpm install" >&2; exit 1; }

echo "Copying the Electron runtime…"
rm -rf "$APP"; mkdir -p "$DEST"
cp -R "$ELECTRON_APP" "$APP"

# Rename the executable so the process, and therefore the dock, says MockFlow.
mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/MockFlow"
rm -f "$APP/Contents/Resources/electron.icns"
cp "$ROOT/brand/MockFlow.icns" "$APP/Contents/Resources/MockFlow.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>MockFlow</string>
  <key>CFBundleDisplayName</key><string>MockFlow</string>
  <key>CFBundleIdentifier</key><string>dev.mockflow.desktop</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>MockFlow</string>
  <key>CFBundleIconFile</key><string>MockFlow</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key><true/>
</dict></plist>
PLIST

# Electron runs Contents/Resources/app if it exists. This stub hands straight
# over to the shell in the repo.
mkdir -p "$APP/Contents/Resources/app"
cat > "$APP/Contents/Resources/app/package.json" <<PKG
{ "name": "mockflow", "productName": "MockFlow", "version": "0.1.0", "main": "main.js" }
PKG
cat > "$APP/Contents/Resources/app/main.js" <<MAIN
// Finder gives a process a minimal PATH; the servers this starts need node on it.
process.env.PATH = '/opt/homebrew/bin:/usr/local/bin:' + (process.env.PATH || '');
// The bundle is nowhere near the code, so say where the code is.
process.env.MOCKFLOW_ROOT = '$ROOT';
require('$ROOT/apps/desktop/src/main.js');
MAIN

# Editing a signed bundle invalidates its signature, and macOS then refuses to
# launch it. An ad-hoc signature is enough for a local build.
echo "Signing…"
codesign --force --deep --sign - "$APP" 2>/dev/null || echo "  (codesign failed; the app may need a right-click > Open the first time)"

touch "$APP"
echo "Built $APP"
