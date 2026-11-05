# CreativeAct CLI: Local Termux Ollama Platform

**CreativeAct CLI** is a resource-efficient, touch-friendly terminal application designed for running and managing local Ollama instances within Termux on Android devices. Built using Python and the `rich` library, it provides a seamless mobile terminal experience with complete model management, streaming chat responses, prompt templates, telemetry tracking, and dynamic high-contrast themes.

---

## ✨ Key Features

1. **Model Management Engine**
   - **List Installed Models**: Query local Ollama daemon for available models with size and quantization details.
   - **Download / Pull Models**: Stream downloads of new models (e.g., `llama3.2:1b`, `qwen2.5:1.5b`, `deepseek-r1:1.5b`) with real-time `rich` progress bars and speed indicators.
   - **Set Active Model**: Configure and persist the active model directly in `$HOME/.config/ollama-cli/config.json`.
   - **Model Deletion**: Clean up unneeded local models with confirmation prompts.

2. **Touch-Friendly Numeric REPL**
   - Designed for virtual soft keyboards on Android without complex multi-key hotkey chords.
   - Single-character menu navigation:
     - `[1] Chat`: Interactive streaming conversation with the active model.
     - `[2] Models`: Model management suite.
     - `[3] Prompts`: Prompt template store & rapid launcher.
     - `[4] Metrics`: Inference telemetry & token speed panel.
     - `[5] Theme`: Dynamic Dark/Light mode toggle.
     - `[0] Exit`: Clean session termination.

3. **Inference Telemetry & Metrics**
   - Parses `eval_count`, `eval_duration`, `load_duration`, and tokens per second directly from Ollama response tokens.
   - Strict grounding: Unreported or missing metrics default to `N/A` with no synthetic estimations.

4. **Resilient Mobile Architecture**
   - **SIGWINCH Trapping**: Automatic re-rendering on screen orientation rotation.
   - **Auto-Collapsing Viewports**: Adapts tables and panels for narrow mobile screens (< 45 cols, < 60 cols, or full desktop view).
   - **Network Error Recovery**: Handles Ollama daemon disconnects gracefully with connection warning panels and retry flows.

---

## 🚀 Quick Start in Android Termux

### 1. Install Prerequisites & Python
```bash
pkg update && pkg install -y python
```

### 2. Install Required Python Packages
```bash
pip install --upgrade --no-cache-dir rich httpx
```

### 3. Automated Termux Installer
You can use the included automated installation script (`install_termux.sh`):
```bash
bash termux_ollama_cli/install_termux.sh
```
This automatically configures your config directory (`~/.config/ollama-cli`), installs dependencies, and creates a global `ollama-cli` binary command in `$PREFIX/bin`.

### 4. Run CreativeAct CLI
Simply type:
```bash
ollama-cli
```
Or run directly via Python module:
```bash
python3 -m termux_ollama_cli.app
```

---

## 📂 Project Architecture

```
/
├── termux_ollama_cli/
│   ├── __init__.py       # Package marker
│   ├── app.py            # Main CLI controller & REPL loop
│   ├── config.py         # Configuration manager (~/.config/ollama-cli/config.json)
│   ├── models.py         # Model management (list, pull, delete, active model setter)
│   ├── metrics.py        # Telemetry parser & adaptive rich panel renderer
│   ├── storage.py        # JSON CRUD store for prompt templates (prompts.json)
│   ├── theme.py          # High-contrast dark/light theme engine
│   └── install_termux.sh # 1-click Termux installer script
├── src/                  # Web Studio interactive simulator interface
└── README.md             # Documentation
```

---

## ⚙️ Configuration File (`config.json`)
Stored at `~/.config/ollama-cli/config.json`:
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
