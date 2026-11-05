"""
Theme Engine for Termux Ollama CLI.
Provides High-Contrast Dark and Light themes using standard ANSI color palettes
to guarantee compatibility with mobile Android terminals without TrueColor artifacts.
"""
from rich.theme import Theme
from rich.console import Console
from .config import load_config, update_config_value

DARK_THEME_STYLES = {
    "info": "cyan",
    "warning": "yellow",
    "danger": "bold red",
    "success": "bold green",
    "prompt": "bold magenta",
    "user_msg": "bold white on grey23",
    "assistant_msg": "green",
    "model_tag": "bold yellow",
    "metric_value": "bold green",
    "border": "bright_blue",
    "header": "bold cyan",
    "menu_number": "bold yellow",
    "menu_text": "white",
    "hint": "dim white",
}

LIGHT_THEME_STYLES = {
    "info": "bold blue",
    "warning": "bold dark_orange",
    "danger": "bold red",
    "success": "bold dark_green",
    "prompt": "bold purple",
    "user_msg": "bold black on grey85",
    "assistant_msg": "black",
    "model_tag": "bold dark_blue",
    "metric_value": "bold dark_green",
    "border": "blue",
    "header": "bold black",
    "menu_number": "bold dark_blue",
    "menu_text": "black",
    "hint": "grey50",
}

def create_theme(theme_name: str = "dark") -> Theme:
    """Builds a rich.theme.Theme instance."""
    styles = LIGHT_THEME_STYLES if theme_name.lower() == "light" else DARK_THEME_STYLES
    return Theme(styles)

def get_current_theme_name() -> str:
    """Returns 'dark' or 'light' from config."""
    config = load_config()
    return config.get("theme", "dark")

def toggle_theme() -> str:
    """Toggles theme between dark and light, updates config, and returns new name."""
    current = get_current_theme_name()
    new_theme = "light" if current == "dark" else "dark"
    update_config_value("theme", new_theme)
    return new_theme

def apply_theme_to_console(console: Console, theme_name: str) -> None:
    """Applies theme to a Rich console."""
    console.push_theme(create_theme(theme_name))
