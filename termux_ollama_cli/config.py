"""
Configuration Manager for Termux Ollama CLI.
Stores active model, host endpoint, and theme settings in $HOME/.config/ollama-cli/config.json.
Compatible with Android Termux storage paths.
"""
import os
import json
from typing import Dict, Any

DEFAULT_CONFIG: Dict[str, Any] = {
    "host": "http://127.0.0.1:11434",
    "active_model": "llama3.2:1b",
    "theme": "dark",
    "timeout_seconds": 60.0,
    "max_context_tokens": 2048,
    "system_prompt": "You are a concise, helpful assistant running on a mobile terminal.",
}

def get_config_dir() -> str:
    """Returns the configuration directory path under user home."""
    base_dir = os.path.expanduser("~")
    config_dir = os.path.join(base_dir, ".config", "ollama-cli")
    os.makedirs(config_dir, exist_ok=True)
    return config_dir

def get_config_path() -> str:
    """Returns full path to config.json."""
    return os.path.join(get_config_dir(), "config.json")

def load_config() -> Dict[str, Any]:
    """Loads configuration from JSON file or returns defaults."""
    path = get_config_path()
    if not os.path.exists(path):
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Merge with defaults for any missing keys
            config = DEFAULT_CONFIG.copy()
            config.update(data)
            return config
    except Exception:
        return DEFAULT_CONFIG.copy()

def save_config(config: Dict[str, Any]) -> bool:
    """Saves configuration to JSON file."""
    try:
        path = get_config_path()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
        return True
    except Exception:
        return False

def update_config_value(key: str, value: Any) -> Dict[str, Any]:
    """Updates a single key in config and persists to disk."""
    config = load_config()
    config[key] = value
    save_config(config)
    return config
