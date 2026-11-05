# 🚀 CreativeAct CLI — Beginner's Quickstart Guide
**Local Termux Ollama Platform on Android**

This step-by-step guide will walk you through setting up and running your first local AI model on an Android device using **CreativeAct CLI** and **Termux**.

---

## 📋 Prerequisites

### 1. Install Termux
> ⚠️ **Important**: Do **not** install Termux from Google Play Store (it is outdated and unmaintained).
* Download and install **Termux** from [F-Droid](https://f-droid.org/packages/com.termux/) or the [Termux GitHub Releases](https://github.com/termux/termux-app/releases).

### 2. Keep Termux Active (Prevent Android OS Kill)
Android battery management aggressively closes background apps. Before long downloads or inferences, run:
```bash
termux-wake-lock
```
*(You can release it later with `termux-wake-unlock`)*.

---

## ⚡ Step-by-Step Installation

### Step 1: Update Termux Packages
Open Termux and run:
```bash
pkg update && pkg upgrade -y
```
*(If prompted about config files, press Enter to accept the defaults).*

### Step 2: Install Python and Dependencies
Install Python and curl:
```bash
pkg install -y python git curl
```

Install the required lightweight Python libraries:
```bash
pip install --upgrade --no-cache-dir rich httpx
```

### Step 3: Download CreativeAct CLI
You can copy the `termux_ollama_cli` directory to your home folder or download it directly:
```bash
git clone https://github.com/your-username/CreativeAct-CLI.git ~/CreativeAct-CLI
cd ~/CreativeAct-CLI
```

### Step 4: Run the Auto-Installer
Execute the installation script to configure your environment and create the global launcher command:
```bash
bash termux_ollama_cli/install_termux.sh
```

Once installed, the `ollama-cli` command is accessible from anywhere in Termux!

---

## 🧠 Setting Up Your Ollama Backend

CreativeAct CLI connects to an Ollama daemon over HTTP (default: `http://127.0.0.1:11434`). You have two options:

### Option A: Connect to Ollama Running on Your Local Network (Recommended for Best Speed)
If you already run Ollama on your PC, Mac, or home server on the same Wi-Fi network:
1. Allow Ollama to listen on your network by starting it with:
   - **Linux / macOS**: `OLLAMA_HOST=0.0.0.0:11434 ollama serve`
   - **Windows**: Set environment variable `OLLAMA_HOST=0.0.0.0:11434` and restart Ollama.
2. Find your computer's local IP address (e.g., `192.168.1.50`).
3. Set this host in CreativeAct CLI's configuration:
   ```bash
   # In ~/.config/ollama-cli/config.json, update "host":
   nano ~/.config/ollama-cli/config.json
   # Or configure it directly inside CreativeAct CLI settings!
   ```

### Option B: Running Ollama Locally Inside Termux (ARM64)
If your Android phone has an ARM64 processor and 6GB+ RAM, you can run Ollama directly in Termux using `proot-distro`:
```bash
pkg install -y proot-distro
proot-distro install ubuntu
proot-distro login ubuntu
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &
```

---

## 🎮 First Run & Walkthrough

Start the CLI anytime with:
```bash
ollama-cli
```

### 1. Download Your First Mobile Model
In the main menu, press `2` for **Models**, then press `p` to pull a model. Recommended models for mobile devices:
- `llama3.2:1b` (1.3 GB — Fast, lightweight, great general assistant)
- `qwen2.5:1.5b` (0.98 GB — Excellent coding and reasoning)
- `deepseek-r1:1.5b` (1.1 GB — Mathematical and step-by-step reasoning)

Watch the real-time Rich progress bar download and verify your model.

### 2. Set the Active Model
In the Models menu (`[2]`), press `s` and enter the number corresponding to your downloaded model. It is instantly saved to `config.json`.

### 3. Start Chatting
Press `1` to enter **Chat Stream**:
```
[user]> Explain quantum computing in 2 simple sentences
```
Tokens stream directly to your screen with live tokens-per-second (`t/s`) speed calculation.
Type `:q` or press Enter on an empty line to return to the menu.

### 4. Use Built-in Prompt Templates
Press `3` for **Prompts**:
- `[1] Quick Summarize`: Summarize articles into 3 bullet points.
- `[2] Explain Code`: Analyze code snippets and find bugs.
- `[3] Termux / Shell Command`: Ask for commands in plain English.
- `[4] Fix Grammar & Tone`: Polish drafts for messaging.

### 5. Check Real-Time Telemetry
Press `4` for **Metrics** to inspect:
- `eval_count` (exact tokens generated)
- `eval_duration` (inference execution time)
- `Speed (Tokens / sec)`
- `load_duration` (model wake latency)
*(All values are grounded from actual response tokens. No synthetic estimates!)*

### 6. Toggle Display Theme
Press `5` for **Theme** to switch between **High-Contrast Dark** and **Clean Light** modes tailored for OLED screens and outdoor daylight readability.

---

## 🛠️ Troubleshooting FAQ

| Problem | Solution |
| :--- | :--- |
| **`Cannot connect to 127.0.0.1:11434`** | Ensure the Ollama server is running with `ollama serve`. If running on PC, check that `OLLAMA_HOST=0.0.0.0:11434` is set and both devices are on the same Wi-Fi network. |
| **Keyboard covers the menu** | CreativeAct CLI uses single-character numeric inputs (`[1]`, `[2]`, etc.) specifically so you only need to tap one number and Enter. |
| **Termux closes in background** | Run `termux-wake-lock` and disable battery optimization for the Termux app in Android Settings. |
| **Screen orientation rotated** | The app traps `SIGWINCH` and automatically collapses table columns when switching between portrait and landscape modes. |
