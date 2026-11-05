#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Termux Ollama Rich CLI Auto-Installer
# Optimized for Android devices running Termux
# ==============================================================================

set -e

echo -e "\033[1;36m[+] Initializing Termux Ollama CLI Setup...\033[0m"

# 1. Update and install python if missing
if ! command -v python3 &> /dev/null; then
    echo -e "\033[1;33m[+] Installing Python in Termux...\033[0m"
    pkg update -y && pkg install -y python
fi

# 2. Install lightweight required dependencies
echo -e "\033[1;33m[+] Installing 'rich' and 'httpx' via pip...\033[0m"
pip install --upgrade --no-cache-dir rich httpx

# 3. Create config directory
CONFIG_DIR="$HOME/.config/ollama-cli"
mkdir -p "$CONFIG_DIR"

# 4. Install launcher script in Termux bin
INSTALL_BIN="$PREFIX/bin/ollama-cli"
cat << 'EOF' > "$INSTALL_BIN"
#!/data/data/com.termux/files/usr/bin/bash
export PYTHONUNBUFFERED=1
python3 -m termux_ollama_cli.app "$@"
EOF

chmod +x "$INSTALL_BIN"

echo -e "\033[1;32m[✔] Termux Ollama CLI successfully installed!\033[0m"
echo -e "\033[1;37mRun '\033[1;33mollama-cli\033[1;37m' anytime from your Termux terminal.\033[0m"
