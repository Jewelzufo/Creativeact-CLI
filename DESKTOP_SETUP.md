# 🪟 CreativeAct CLI — Windows 11 Desktop Setup Guide

This guide provides step-by-step instructions for running **CreativeAct CLI** and its companion studio on **Windows 11**.

You can run CreativeAct CLI on Windows 11 in two ways:
1. **Method 1: Native Windows 11 CLI App** (Python + Windows Terminal + Ollama for Windows) — *Recommended for direct terminal use & 1-click desktop shortcut*
2. **Method 2: Web Studio Desktop App (PWA)** (Runs as an installed standalone desktop window via Edge or Chrome)
3. **Method 3: WSL2 (Windows Subsystem for Linux)** (Full Linux environment on Windows 11)

---

## ⚡ Method 1: Run Native CLI on Windows 11

### Step 1: Install Ollama for Windows
1. Download the official Windows installer from [ollama.com/download/windows](https://ollama.com/download/windows).
2. Run `OllamaSetup.exe`.
3. After installation, Ollama will automatically start and run in your Windows system tray (default address: `http://127.0.0.1:11434`).
4. *(Optional — To share models with your Android Termux device on the same Wi-Fi)*:
   - Open Windows **Settings** > **System** > **About** > **Advanced system settings**.
   - Click **Environment Variables** > Under **User variables**, click **New**:
     - Variable name: `OLLAMA_HOST`
     - Variable value: `0.0.0.0:11434`
   - Restart Ollama from the system tray.

---

### Step 2: Install Python on Windows 11
1. Open PowerShell or Command Prompt and check if Python is installed:
   ```powershell
   python --version
   ```
2. If not installed, download **Python 3.10+** from [python.org/downloads](https://www.python.org/downloads/) or run:
   ```powershell
   winget install Python.Python.3.12
   ```
   > ⚠️ **Important**: During installation, check the box: **"Add python.exe to PATH"**.

---

### Step 3: Install Required Python Libraries
Open **Windows Terminal** (PowerShell) and run:
```powershell
pip install --upgrade rich httpx
```

---

### Step 4: Download CreativeAct CLI
Clone or download the project folder to your preferred directory (e.g., `C:\CreativeAct-CLI`):
```powershell
git clone https://github.com/your-username/CreativeAct-CLI.git C:\CreativeAct-CLI
cd C:\CreativeAct-CLI
```

---

### Step 5: Run the CLI
In PowerShell or Windows Terminal, execute:
```powershell
python -m termux_ollama_cli.app
```

---

### Step 6: Create a 1-Click Desktop Shortcut
To launch CreativeAct CLI directly from your Windows 11 Desktop:

1. In the project folder (`C:\CreativeAct-CLI`), create a file named `launch_creativeact.bat`:
   ```bat
   @echo off
   title CreativeAct CLI
   cd /d "%~dp0"
   wt.exe -p "PowerShell" python -m termux_ollama_cli.app
   if %errorlevel% neq 0 (
       python -m termux_ollama_cli.app
       pause
   )
   ```
2. Right-click `launch_creativeact.bat` > Select **Show more options** > **Send to** > **Desktop (create shortcut)**.
3. Right-click the new Desktop shortcut > **Properties**:
   - In the **General** tab, rename it to `CreativeAct CLI`.
   - Click **Change Icon...** to pick any terminal or robot icon.
4. Double-click the shortcut anytime to launch the CLI in Windows Terminal!

---

## 🌐 Method 2: Run the Web Studio as an Installed Windows 11 App (PWA)

If you want the visual interactive terminal, column resizer, model manager, and code inspector running as an independent desktop window:

### Step 1: Install Node.js
If you don't have Node.js installed on Windows 11:
```powershell
winget install OpenJS.NodeJS.LTS
```

### Step 2: Install Dependencies & Start Local Server
Open PowerShell in the project directory:
```powershell
npm install
npm run dev
```
The server will start at `http://localhost:3000` (or `http://localhost:5173`).

### Step 3: Install as a Windows 11 Desktop App
1. Open **Microsoft Edge** or **Google Chrome** and navigate to `http://localhost:3000`.
2. Look at the right side of the address bar:
   - In **Edge**: Click the **App available** icon or click `...` > **Apps** > **Install this site as an app** > Name it **CreativeAct CLI**.
   - In **Chrome**: Click `...` > **Cast, save, and share** > **Install CreativeAct CLI...**.
3. Check **"Pin to taskbar"** and **"Create Desktop shortcut"**.
4. CreativeAct CLI will now run in its own standalone borderless window with full Windows 11 Snap Layouts support!

---

## 🐧 Method 3: Run via Windows Subsystem for Linux (WSL2)

If you prefer an authentic Linux environment identical to Termux:

1. Enable WSL2 in Windows 11 (if not already enabled):
   ```powershell
   wsl --install
   ```
2. Open Ubuntu from your Start menu and update packages:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y python3 python3-pip curl git
   ```
3. Install dependencies:
   ```bash
   pip3 install --upgrade rich httpx
   ```
4. Run the installer:
   ```bash
   cd ~/CreativeAct-CLI
   bash termux_ollama_cli/install_termux.sh
   ```
5. Launch with:
   ```bash
   ollama-cli
   ```
   *(WSL2 connects seamlessly to Ollama running on your Windows host via `http://localhost:11434`)*.

---

## 🔍 Troubleshooting on Windows 11

| Issue | Resolution |
| :--- | :--- |
| **`python: command not found`** | Ensure Python is added to Windows PATH. Search "Edit the system environment variables" in Start menu and add Python to `Path`. |
| **Colors look plain / ANSI codes not showing** | Use **Windows Terminal** (pre-installed on Windows 11) instead of legacy Command Prompt (`cmd.exe`). Windows Terminal has full ANSI 256 and TrueColor support. |
| **`httpx.ConnectError: Cannot connect to 127.0.0.1:11434`** | Verify that Ollama for Windows is running in the system tray. Open browser and test `http://127.0.0.1:11434` (it should display *"Ollama is running"*). |
| **Firewall blocking Android phone connection** | In Windows Defender Firewall, allow port `11434` (Inbound Rule: TCP port 11434) so your mobile Termux app can access models hosted on your PC GPU. |
