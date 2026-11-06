# ◈ CreativeAct CLI: Local Termux Ollama Platform

**CreativeAct CLI** is a resource-efficient, touch-friendly terminal application and companion studio for running, managing, and comparing local Ollama models within **Termux on Android** and on **Windows 11 Desktop**. Built using Python and the `rich` terminal library, it delivers responsive token streaming, side-by-side model benchmarking, persistent prompt templates, real-time grounded telemetry, and high-contrast OLED themes.

---

## 📚 Documentation Guides

- 🚀 **[Beginner's Quickstart Guide (QUICKSTART.md)](./QUICKSTART.md)**: Step-by-step setup for Android Termux, F-Droid installation, wake-lock configuration, and local network Ollama connection.
- 🪟 **[Windows 11 Desktop Setup Guide (DESKTOP_SETUP.md)](./DESKTOP_SETUP.md)**: Instructions for running as a native Windows 11 app (Windows Terminal, 1-click desktop batch shortcut, PWA via Edge/Chrome, or WSL2).

---

## ✨ Key Features

### 1. Model Management & Comparison Suite
- **Model List & Registry**: Inspect local Ollama models with parameter sizes (e.g. `1.2B`, `1.5B`, `3.8B`), quantization levels (`Q4_K_M`), disk footprint, and active model status.
- **⚖️ Side-by-Side Model Comparison**:
  - Toggle compare mode via `[c]` in CLI or the **Compare** button in the Web Studio.
  - Select any two models to generate a side-by-side comparison table of:
    - **Parameter Size**
    - **Quantization Level**
    - **Architecture Family**
    - **Storage Footprint**
    - **Last Inference Duration (`eval_duration_sec`)**
    - **Generation Speed (`tokens_per_second`)**
    - **Tokens Generated (`eval_count`)**
    - **Model Load Latency (`load_duration_ms`)**
- **Stream Pull Downloads**: Download new models (e.g., `llama3.2:1b`, `qwen2.5:1.5b`, `deepseek-r1:1.5b`) with live progress bars, transfer speeds, and SHA256 checksum verification.
- **Active Model Persistence**: Instantly switches and saves the active model to `$HOME/.config/ollama-cli/config.json`.
- **Model Deletion**: Safely delete unused models directly from the menu.

### 2. Touch-Friendly Soft-Keyboard REPL
- Designed specifically for mobile soft keyboards—**no multi-key chord shortcuts** or mouse traps that interfere with Android virtual keyboards.
- Single-character alphanumeric navigation:
  - `[1] Chat`: Interactive token streaming session with live speed counter (`t/s`).
  - `[2] Models`: Model management, pull, active selector, and side-by-side comparison (`[s/c/p/d/b]`).
  - `[3] Prompts`: Prompt template store with variable `{input}` substitution.
  - `[4] Metrics`: Inference telemetry & token speed panel.
  - `[5] Theme`: Dynamic High-Contrast Dark / Light mode toggle.
  - `[0] Exit`: Clean session termination.

### 3. Strict Grounded Telemetry
- Telemetry values (`eval_count`, `eval_duration`, `tokens_per_second`, `load_duration`) are extracted directly from Ollama response tokens.
- **Zero Hallucinated Metrics**: Missing or unbenchmarked metrics strictly display as `N/A`.

### 4. Resilient Mobile Terminal Engine
- **`SIGWINCH` Trapping**: Traps window resize signals to automatically re-render layouts when rotating between portrait and landscape.
- **Adaptive Auto-Collapse**: Automatically stacks side-by-side elements when viewport width is below 60 or 45 columns.
- **Network Drop Protection**: Catches `httpx.ConnectError` when the daemon is offline without crashing the CLI session.

---

## 🚀 Quick Start (Android Termux)

### 1. Install Prerequisites
In Termux (installed from F-Droid):
```bash
pkg update && pkg install -y python git curl
```

### 2. Install Required Python Packages
```bash
pip install --upgrade --no-cache-dir rich httpx
```

### 3. Automated 1-Click Installer
```bash
bash termux_ollama_cli/install_termux.sh
```
This sets up your configuration directory (`~/.config/ollama-cli`) and creates a global `ollama-cli` binary command in `$PREFIX/bin`.

### 4. Launch CreativeAct CLI
```bash
ollama-cli
```
*(Or run via python: `python3 -m termux_ollama_cli.app`)*.

---

## 🪟 Quick Start (Windows 11)

1. Install **[Ollama for Windows](https://ollama.com/download/windows)** (runs in system tray with GPU acceleration).
2. Install Python 3.10+ (ensure `Add python.exe to PATH` is checked).
3. In Windows Terminal:
   ```powershell
   pip install --upgrade rich httpx
   python -m termux_ollama_cli.app
   ```
4. *(Optional)* Run the Web Studio PWA by running `npm install && npm run dev` and installing via Edge or Chrome. See **[DESKTOP_SETUP.md](./DESKTOP_SETUP.md)** for full desktop shortcut setup.

---

## 📂 Project Architecture

```
/
├── termux_ollama_cli/
│   ├── __init__.py          # Python package entry
│   ├── app.py               # Main CLI controller, REPL loop & model comparison renderer
│   ├── config.py            # Config manager (~/.config/ollama-cli/config.json)
│   ├── models.py            # Model management (tags, streaming pull, delete, active model)
│   ├── metrics.py           # Telemetry parser & adaptive rich panel renderer
│   ├── storage.py           # JSON CRUD store for prompt templates (prompts.json)
│   ├── theme.py             # High-contrast dark/light ANSI-safe theme engine
│   └── install_termux.sh    # 1-click Termux installer script
├── src/                     # Interactive Web Studio & Termux emulator
│   ├── components/
│   │   ├── TerminalView.tsx # Interactive terminal emulator with model comparison
│   │   ├── CodeViewer.tsx   # Syntax-highlighted artifact inspector & ZIP export
│   │   └── ...
├── QUICKSTART.md            # Step-by-step beginner guide for Android Termux
├── DESKTOP_SETUP.md         # Windows 11 desktop setup guide
└── README.md                # Project documentation
```

---

## ⚙️ Configuration (`config.json`)

Saved at `$HOME/.config/ollama-cli/config.json`:
```json
{
  "host": "http://127.0.0.1:11434",
  "active_model": "llama3.2:1b",
  "theme": "dark",
  "timeout_seconds": 60.0,
  "max_context_tokens": 2048,
  "system_prompt": "You are a concise, helpful assistant running on a mobile terminal."
}
```

---

## 📄 License
Apache-2.0
