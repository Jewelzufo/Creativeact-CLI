"""
Model Management Engine for Termux Ollama CLI.
Interacts with the Ollama daemon HTTP API (/api/tags, /api/pull, /api/delete).
Renders progress bars with rich for downloads, lists local models, and sets the active model.
"""
import json
from typing import List, Dict, Any, Optional, Tuple, Callable
import httpx
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    BarColumn,
    DownloadColumn,
    TransferSpeedColumn,
    TimeRemainingColumn,
)

from .config import load_config, update_config_value

def format_size(bytes_val: Optional[int]) -> str:
    """Format bytes into readable MB or GB string."""
    if bytes_val is None or bytes_val <= 0:
        return "N/A"
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if bytes_val < 1024.0:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.1f} PB"

def get_ollama_host() -> str:
    """Get configured Ollama host URL without trailing slash."""
    config = load_config()
    host = config.get("host", "http://127.0.0.1:11434")
    return host.rstrip("/")

def check_ollama_health() -> Tuple[bool, str]:
    """
    Check if the Ollama daemon is reachable.
    Returns (is_online, message).
    """
    host = get_ollama_host()
    try:
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(f"{host}/api/version")
            if resp.status_code == 200:
                data = resp.json()
                version = data.get("version", "unknown")
                return True, f"Ollama {version} connected at {host}"
            return False, f"Unexpected response ({resp.status_code}) from {host}"
    except httpx.ConnectError:
        return False, f"Cannot connect to {host}. Ensure 'ollama serve' is running."
    except httpx.TimeoutException:
        return False, f"Connection timed out contacting {host}."
    except Exception as e:
        return False, f"Error reaching {host}: {str(e)}"

def list_installed_models() -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """
    Query local Ollama instance for installed models.
    Returns (models_list, error_string).
    """
    host = get_ollama_host()
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(f"{host}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                return data.get("models", []), None
            return [], f"HTTP error {resp.status_code} fetching models."
    except httpx.ConnectError:
        return [], f"Failed to connect to Ollama host at {host}."
    except Exception as e:
        return [], str(e)

def get_active_model() -> str:
    """Get the currently configured active model name."""
    config = load_config()
    return config.get("active_model", "llama3.2:1b")

def set_active_model(model_name: str) -> bool:
    """Sets active model name in configuration."""
    update_config_value("active_model", model_name.strip())
    return True

def delete_model(model_name: str) -> Tuple[bool, str]:
    """Delete a model from local Ollama instance."""
    host = get_ollama_host()
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.request(
                "DELETE",
                f"{host}/api/delete",
                json={"name": model_name}
            )
            if resp.status_code == 200:
                return True, f"Model '{model_name}' successfully removed."
            return False, f"Failed to delete model: {resp.text}"
    except Exception as e:
        return False, f"Error during deletion: {str(e)}"

def pull_model_stream(
    model_name: str,
    console: Console,
    status_callback: Optional[Callable[[str, int, int], None]] = None
) -> Tuple[bool, str]:
    """
    Pulls a model from Ollama library with streaming progress visualization.
    Uses rich Progress bar with fallback for mobile narrow viewports.
    """
    host = get_ollama_host()
    terminal_width = console.width
    is_compact = terminal_width < 60

    console.print(f"[bold cyan]Connecting to {host} to pull '{model_name}'...[/bold cyan]")

    progress_columns = (
        [
            SpinnerColumn(),
            TextColumn("[bold cyan]{task.fields[status]}[/bold cyan]"),
            BarColumn(bar_width=15 if is_compact else 30),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            DownloadColumn() if not is_compact else TextColumn(""),
            TimeRemainingColumn() if not is_compact else TextColumn(""),
        ]
        if not is_compact
        else [
            SpinnerColumn(),
            TextColumn("[bold cyan]{task.fields[status]}[/bold cyan]"),
            BarColumn(bar_width=12),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        ]
    )

    try:
        with httpx.Client(timeout=None) as client:
            with client.stream(
                "POST",
                f"{host}/api/pull",
                json={"name": model_name, "stream": True}
            ) as response:
                if response.status_code != 200:
                    return False, f"Failed to initiate pull: HTTP {response.status_code}"

                with Progress(*progress_columns, console=console, transient=False) as progress:
                    task = progress.add_task("pull", total=100, status="initializing", completed=0)

                    for line in response.iter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            status_msg = data.get("status", "downloading")
                            total_bytes = data.get("total", 0)
                            completed_bytes = data.get("completed", 0)

                            if total_bytes > 0:
                                progress.update(
                                    task,
                                    total=total_bytes,
                                    completed=completed_bytes,
                                    status=status_msg[:24] if is_compact else status_msg
                                )
                            else:
                                progress.update(
                                    task,
                                    status=status_msg[:24] if is_compact else status_msg
                                )

                            if status_callback:
                                status_callback(status_msg, completed_bytes, total_bytes)

                        except json.JSONDecodeError:
                            continue

                # Auto set as active model on successful pull
                set_active_model(model_name)
                return True, f"Model '{model_name}' pulled successfully and set as active."

    except httpx.ConnectError:
        return False, f"Cannot connect to Ollama daemon at {host}."
    except Exception as e:
        return False, f"Pull failed: {str(e)}"
