#!/bin/bash
# macOS installer — "YouTube -> Resolve" Workflow Integration Plugin.
#
#   bash install.sh          # COPY (default, reliable)
#   bash install.sh symlink  # SYMLINK (edit in repo, Resolve sees changes)
#
set -euo pipefail

MODE="${1:-copy}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_NAME="com.bartoszkwiatek.yt2resolve"
PLUGIN_SRC="$HERE/$PLUGIN_NAME"
PLUGINS_ROOT="/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins"
DEST="$PLUGINS_ROOT/$PLUGIN_NAME"
NODE_NAME="WorkflowIntegration.node"
NODE_SRC="/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Workflow Integrations/Examples/SamplePlugin/$NODE_NAME"

[ -d "$PLUGIN_SRC" ] || { echo "ERROR: plugin folder not found: $PLUGIN_SRC" >&2; exit 1; }

# WorkflowIntegration.node is Blackmagic's proprietary module — NOT shipped in the repo.
# Copy it from the local Resolve install (also guarantees the right OS/arch build).
if [ ! -f "$PLUGIN_SRC/$NODE_NAME" ]; then
    if [ -f "$NODE_SRC" ]; then
        cp "$NODE_SRC" "$PLUGIN_SRC/$NODE_NAME"
        echo "Copied $NODE_NAME from the local Resolve install."
    else
        echo "ERROR: $NODE_NAME not found in Resolve at:" >&2
        echo "  $NODE_SRC" >&2
        echo "Install DaVinci Resolve Studio (with the Developer package) and retry." >&2
        exit 1
    fi
fi

mkdir -p "$PLUGINS_ROOT"
rm -rf -- "$DEST"
if [ "$MODE" = "symlink" ]; then
    ln -s "$PLUGIN_SRC" "$DEST"
    echo "OK — SYMLINK: $DEST -> $PLUGIN_SRC"
else
    cp -R "$PLUGIN_SRC" "$DEST"
    echo "OK — COPY: $DEST"
fi

echo
echo "Next: restart DaVinci Resolve -> Workspace -> Workflow Integrations -> YouTube -> Resolve"
