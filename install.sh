#!/usr/bin/env bash
# Usage: ./install.sh            link + enable the extension
#        ./install.sh uninstall  disable + unlink it
set -euo pipefail

UUID="exit-strategy@ashutosh"
SRC="$(cd "$(dirname "$0")" && pwd)/$UUID"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

if [[ "${1:-}" == "uninstall" ]]; then
    gnome-extensions disable "$UUID" 2>/dev/null || true
    rm -f "$DEST"
    echo "Removed $UUID. Log out and back in to unload it."
    exit 0
fi

mkdir -p "$(dirname "$DEST")"
ln -sfn "$SRC" "$DEST"
gsettings set org.gnome.shell disable-user-extensions false

if gnome-extensions enable "$UUID" 2>/dev/null; then
    echo "Enabled $UUID."
else
    echo "Linked $UUID. Log out and back in, then run: gnome-extensions enable $UUID"
fi

if ! tailscale debug prefs 2>/dev/null | grep -q "\"OperatorUser\": \"$USER\""; then
    echo "Tip: run 'sudo tailscale set --operator=\$USER' once so toggling needs no password."
fi
