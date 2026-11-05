export interface PythonArtifact {
  name: string;
  path: string;
  language: string;
  description: string;
  code: string;
}

export const PYTHON_FILES: PythonArtifact[] = [
  {
    name: 'app.py',
    path: 'termux_ollama_cli/app.py',
    language: 'python',
    description: 'CreativeAct CLI: Local Termux Ollama Platform controller with soft-keyboard numeric REPL, live stream engine, and SIGWINCH handler.',
    code: `#!/usr/bin/env python3
"""
CreativeAct CLI
Local Termux Ollama Platform
A resource-efficient, touch-friendly terminal application for Ollama within Termux on Android.
"""

import sys
import os
import shutil
import signal
import json
from typing import Optional, List, Dict, Any
import httpx

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.live import Live
from rich.markdown import Markdown
from rich.spinner import Spinner

from .config import load_config, get_config_path
from .storage import load_prompts, add_prompt, delete_prompt, get_prompt_by_id
from .models import (
    list_installed_models,
    set_active_model,
    get_active_model,
    pull_model_stream,
    delete_model,
    check_ollama_health,
    get_ollama_host,
    format_size,
)
from .metrics import InferenceMetrics, MetricsSession, render_metrics_panel
from .theme import create_theme, get_current_theme_name, toggle_theme


class TermuxOllamaApp:
    def __init__(self):
        self.config = load_config()
        self.theme_name = get_current_theme_name()
        self.console = Console(theme=create_theme(self.theme_name), force_terminal=True)
        self.metrics_session = MetricsSession()
        self.running = True
        self.terminal_width, self.terminal_height = shutil.get_terminal_size((40, 24))
        self._setup_signals()

    def _setup_signals(self):
        """Setup SIGWINCH trap for dynamic screen orientation re-rendering."""
        if hasattr(signal, "SIGWINCH"):
            try:
                signal.signal(signal.SIGWINCH, self._handle_winch)
            except Exception:
                pass

    def _handle_winch(self, signum, frame):
        """Handle screen resize/rotation on Android Termux."""
        self.terminal_width, self.terminal_height = shutil.get_terminal_size((40, 24))
        self.console.width = self.terminal_width

    def get_width(self) -> int:
        self.terminal_width, self.terminal_height = shutil.get_terminal_size((40, 24))
        return self.terminal_width

    def show_header(self):
        """Render touch-friendly adaptive header."""
        width = self.get_width()
        active_model = get_active_model()
        host = get_ollama_host()

        if width < 45:
            self.console.print(f"[bold cyan]◈ Ollama CLI[/bold cyan] [dim]({active_model})[/dim]")
        elif width < 65:
            header_text = f"[bold cyan]◈ Termux Ollama CLI[/bold cyan]\\n[dim]Model:[/dim] [yellow]{active_model}[/yellow] [dim]| Host:[/dim] [cyan]{host}[/cyan]"
            self.console.print(Panel(header_text, border_style="dim", padding=(0, 1)))
        else:
            table = Table.grid(expand=True)
            table.add_column(justify="left", ratio=2)
            table.add_column(justify="right", ratio=1)
            table.add_row(
                f"[bold cyan]◈ Termux Ollama Interactive CLI[/bold cyan]",
                f"[dim]Theme:[/dim] [bold]{self.theme_name.upper()}[/bold]"
            )
            table.add_row(
                f"[dim]Active Model:[/dim] [bold yellow]{active_model}[/bold yellow]",
                f"[dim]Endpoint:[/dim] [cyan]{host}[/cyan]"
            )
            self.console.print(Panel(table, border_style="cyan", padding=(0, 1)))

    def render_menu(self):
        """Render numeric single-character menu optimized for soft keyboards."""
        width = self.get_width()
        options = [
            ("1", "Chat", "Interactive streaming conversation"),
            ("2", "Models", "List, pull, or switch active model"),
            ("3", "Prompts", "Manage and launch prompt templates"),
            ("4", "Metrics", "View token eval speed & load latency"),
            ("5", "Theme", f"Toggle Dark/Light ({self.theme_name})"),
            ("0", "Exit", "Close application"),
        ]

        if width < 50:
            self.console.print("\\n[bold]Select an option:[/bold]")
            for key, name, desc in options:
                self.console.print(f" [bold yellow]\\\\[{key}][/bold yellow] [bold]{name}[/bold] [dim]· {desc}[/dim]")
        else:
            table = Table(show_header=False, box=None, padding=(0, 1))
            table.add_column("Key", style="bold yellow", width=5)
            table.add_column("Action", style="bold")
            table.add_column("Description", style="dim")
            for key, name, desc in options:
                table.add_row(f"[{key}]", name, desc)
            self.console.print(table)

    def prompt_input(self, prompt_text: str = "Choice [0-5]: ") -> str:
        """Read standard alphanumeric line input safe for soft keyboards."""
        try:
            val = input(f"\\n{prompt_text}").strip()
            return val
        except (KeyboardInterrupt, EOFError):
            return "0"

    def chat_loop(self, initial_prompt: Optional[str] = None):
        """Interactive streaming chat loop."""
        active_model = get_active_model()
        host = get_ollama_host()
        self.console.clear()
        self.console.print(f"[bold cyan]─── Chat Session: [yellow]{active_model}[/yellow] ───[/bold cyan]")
        self.console.print("[dim]Type your message. Type ':q' or press Enter on empty line to exit.[/dim]\\n")

        is_ok, msg = check_ollama_health()
        if not is_ok:
            self.console.print(Panel(f"[bold red]Connection Warning:[/bold red] {msg}\\n[yellow]Continuing in offline preview mode.[/yellow]", border_style="red"))

        conversation_history: List[Dict[str, str]] = []
        first_input = initial_prompt

        while True:
            if first_input is not None:
                user_msg = first_input
                first_input = None
                self.console.print(f"[bold yellow]> Prompt Template:[/bold yellow]\\n{user_msg}\\n")
            else:
                try:
                    user_msg = input("\\n[user]> ").strip()
                except (KeyboardInterrupt, EOFError):
                    break

            if not user_msg or user_msg == ":q":
                break

            conversation_history.append({"role": "user", "content": user_msg})
            self.stream_response(conversation_history, active_model, host)

    def stream_response(self, history: List[Dict[str, str]], model: str, host: str):
        """Stream response chunk-by-chunk using rich.live.Live."""
        self.console.print(f"[bold green]assistant ({model}):[/bold green]")
        accumulated_text = ""
        last_metrics_raw: Dict[str, Any] = {}

        try:
            with httpx.Client(timeout=120.0) as client:
                with client.stream(
                    "POST",
                    f"{host}/api/chat",
                    json={
                        "model": model,
                        "messages": history,
                        "stream": True,
                        "options": {"num_ctx": self.config.get("max_context_tokens", 2048)}
                    }
                ) as response:
                    if response.status_code != 200:
                        self.console.print(f"[bold red]Ollama API Error {response.status_code}:[/bold red] {response.text}")
                        return

                    with Live(
                        Markdown(""),
                        console=self.console,
                        refresh_per_second=12,
                        transient=False
                    ) as live:
                        for chunk in response.iter_lines():
                            if not chunk:
                                continue
                            try:
                                payload = json.loads(chunk)
                                if "message" in payload and "content" in payload["message"]:
                                    delta = payload["message"]["content"]
                                    accumulated_text += delta
                                    live.update(Markdown(accumulated_text))

                                if payload.get("done", False):
                                    last_metrics_raw = {
                                        "eval_count": payload.get("eval_count"),
                                        "eval_duration": payload.get("eval_duration"),
                                        "load_duration": payload.get("load_duration"),
                                        "prompt_eval_count": payload.get("prompt_eval_count"),
                                        "prompt_eval_duration": payload.get("prompt_eval_duration"),
                                    }
                            except json.JSONDecodeError:
                                continue

            history.append({"role": "assistant", "content": accumulated_text})

            if last_metrics_raw:
                metrics = self.metrics_session.record(last_metrics_raw)
                if metrics.tokens_per_second is not None:
                    self.console.print(f"[dim]⚡ Speed: [bold green]{metrics.tokens_per_second:.1f} t/s[/bold green] ({metrics.eval_count} tokens in {metrics.eval_duration_sec:.2f}s)[/dim]")
                else:
                    self.console.print("[dim]⚡ Speed: N/A[/dim]")

        except httpx.ConnectError:
            self.console.print(Panel(
                f"[bold red]Connection Lost:[/bold red] Could not reach Ollama daemon at {host}.\\nPlease check that 'ollama serve' is running.",
                border_style="red"
            ))
        except Exception as e:
            self.console.print(Panel(f"[bold red]Stream Error:[/bold red] {str(e)}", border_style="red"))

    def model_management_menu(self):
        """Model management: list, pull with rich progress, set active, or delete."""
        while True:
            self.console.clear()
            active = get_active_model()
            width = self.get_width()
            self.console.print(f"[bold cyan]─── Model Management (Active: [yellow]{active}[/yellow]) ───[/bold cyan]\\n")

            models, err = list_installed_models()
            if err:
                self.console.print(Panel(f"[yellow]Ollama Notice:[/yellow] {err}", border_style="yellow"))

            if models:
                table = Table(show_header=True, header_style="bold cyan", border_style="dim", box=None)
                table.add_column("#", style="bold yellow", width=3)
                table.add_column("Model Name", style="bold")
                if width >= 55:
                    table.add_column("Size", justify="right")
                    table.add_column("Modified", style="dim")
                table.add_column("Status", justify="center")

                for idx, m in enumerate(models, start=1):
                    m_name = m.get("name", "unknown")
                    is_active = (m_name == active) or (m_name == f"{active}:latest")
                    status_text = "[bold green]● Active[/bold green]" if is_active else "[dim]Available[/dim]"
                    size_str = format_size(m.get("size"))
                    mod_str = m.get("modified_at", "")[:10]

                    if width >= 55:
                        table.add_row(str(idx), m_name, size_str, mod_str, status_text)
                    else:
                        table.add_row(str(idx), m_name, status_text)
                self.console.print(table)
            else:
                self.console.print("[dim]No installed models found on this Ollama host.[/dim]")

            self.console.print("\\n[bold]Options:[/bold]")
            self.console.print(" [bold yellow]\\\\[s][/bold yellow] Set active model by number")
            self.console.print(" [bold yellow]\\\\[p][/bold yellow] Pull / Download new model (e.g. llama3.2:1b, qwen2.5:1.5b)")
            self.console.print(" [bold yellow]\\\\[d][/bold yellow] Delete model")
            self.console.print(" [bold yellow]\\\\[b][/bold yellow] Back to main menu")

            sub_choice = self.prompt_input("Models choice [s/p/d/b]: ").lower()

            if sub_choice in ["b", "0", "q", ""]:
                break
            elif sub_choice == "s":
                if not models:
                    self.console.print("[red]No models available to select.[/red]")
                    input("\\nPress Enter to continue...")
                    continue
                num_str = self.prompt_input(f"Enter model number (1-{len(models)}): ")
                try:
                    idx = int(num_str) - 1
                    if 0 <= idx < len(models):
                        selected = models[idx].get("name", "")
                        set_active_model(selected)
                        self.console.print(f"[bold green]Active model set to '{selected}'![/bold green]")
                    else:
                        self.console.print("[red]Invalid index.[/red]")
                except ValueError:
                    self.console.print("[red]Please enter a valid number.[/red]")
                input("\\nPress Enter to continue...")

            elif sub_choice == "p":
                model_to_pull = self.prompt_input("Enter model tag to download (e.g. qwen2.5:1.5b, llama3.2:1b): ").strip()
                if model_to_pull:
                    ok, msg = pull_model_stream(model_to_pull, self.console)
                    if ok:
                        self.console.print(f"[bold green]Success:[/bold green] {msg}")
                    else:
                        self.console.print(f"[bold red]Failed:[/bold red] {msg}")
                    input("\\nPress Enter to continue...")

            elif sub_choice == "d":
                del_target = self.prompt_input("Enter model name to delete: ").strip()
                if del_target:
                    confirm = self.prompt_input(f"Confirm delete '{del_target}'? [y/N]: ").lower()
                    if confirm == "y":
                        ok, msg = delete_model(del_target)
                        self.console.print(f"[{'green' if ok else 'red'}]{msg}[/{'green' if ok else 'red'}]")
                    input("\\nPress Enter to continue...")

    def prompt_store_menu(self):
        """Prompt templates management and rapid execution."""
        while True:
            self.console.clear()
            self.console.print("[bold cyan]─── Prompt Template Store ───[/bold cyan]\\n")
            prompts = load_prompts()

            table = Table(show_header=True, header_style="bold cyan", border_style="dim", box=None)
            table.add_column("#", style="bold yellow", width=3)
            table.add_column("Title", style="bold")
            table.add_column("Description", style="dim")

            for idx, p in enumerate(prompts, start=1):
                table.add_row(str(idx), p.get("title", ""), p.get("description", ""))
            self.console.print(table)

            self.console.print("\\n[bold]Options:[/bold]")
            self.console.print(" [bold yellow]\\\\[r][/bold yellow] Run prompt with input")
            self.console.print(" [bold yellow]\\\\[a][/bold yellow] Add new prompt template")
            self.console.print(" [bold yellow]\\\\[d][/bold yellow] Delete prompt")
            self.console.print(" [bold yellow]\\\\[b][/bold yellow] Back to main menu")

            choice = self.prompt_input("Prompts choice [r/a/d/b]: ").lower()
            if choice in ["b", "0", "q", ""]:
                break
            elif choice == "r":
                num_str = self.prompt_input(f"Enter prompt number to run (1-{len(prompts)}): ")
                try:
                    idx = int(num_str) - 1
                    if 0 <= idx < len(prompts):
                        selected = prompts[idx]
                        template = selected.get("template", "")
                        self.console.print(f"\\n[cyan]Template:[/cyan] {selected.get('title')}")
                        user_arg = self.prompt_input("Enter content for {input}: ")
                        formatted_prompt = template.replace("{input}", user_arg)
                        self.chat_loop(initial_prompt=formatted_prompt)
                except ValueError:
                    self.console.print("[red]Invalid selection.[/red]")
                    input("\\nPress Enter to continue...")

            elif choice == "a":
                pid = self.prompt_input("Identifier (e.g. fix_bugs): ")
                title = self.prompt_input("Display Title: ")
                desc = self.prompt_input("Short description: ")
                self.console.print("[dim]Use '{input}' as variable placeholder.[/dim]")
                tmpl = self.prompt_input("Template text: ")
                if pid and title and tmpl:
                    add_prompt(pid, title, tmpl, desc)
                    self.console.print("[bold green]Prompt template saved![/bold green]")
                input("\\nPress Enter to continue...")

            elif choice == "d":
                num_str = self.prompt_input(f"Enter prompt number to delete (1-{len(prompts)}): ")
                try:
                    idx = int(num_str) - 1
                    if 0 <= idx < len(prompts):
                        pid = prompts[idx].get("id", "")
                        delete_prompt(pid)
                        self.console.print(f"[bold green]Prompt '{pid}' deleted.[/bold green]")
                except ValueError:
                    self.console.print("[red]Invalid index.[/red]")
                input("\\nPress Enter to continue...")

    def show_metrics_view(self):
        """Display last session metrics and telemetry stats."""
        self.console.clear()
        self.console.print("[bold cyan]─── Inference Telemetry & Metrics ───[/bold cyan]\\n")
        latest = self.metrics_session.latest()
        render_metrics_panel(latest, self.console, title="Latest Generation")

        avg = self.metrics_session.average_speed()
        if avg is not None:
            self.console.print(f"\\n[bold]Session Average Speed:[/bold] [bold green]{avg:.1f} tokens/sec[/bold green] over {len(self.metrics_session.history)} inferences")
        else:
            self.console.print("\\n[dim]Grounding status: All metrics are parsed directly from Ollama response tokens. No fake latency estimates.[/dim]")

        input("\\nPress Enter to return to menu...")

    def toggle_theme_view(self):
        """Toggle Dark / Light theme dynamically."""
        new_theme = toggle_theme()
        self.theme_name = new_theme
        self.console = Console(theme=create_theme(new_theme), force_terminal=True)
        self.console.print(f"[bold green]Theme switched to {new_theme.upper()} High-Contrast mode![/bold green]")

    def run(self):
        """Main REPL loop with single-character soft keyboard navigation."""
        while self.running:
            self.console.clear()
            self.show_header()
            self.render_menu()
            choice = self.prompt_input("Select [0-5]: ")

            if choice == "1":
                self.chat_loop()
            elif choice == "2":
                self.model_management_menu()
            elif choice == "3":
                self.prompt_store_menu()
            elif choice == "4":
                self.show_metrics_view()
            elif choice == "5":
                self.toggle_theme_view()
            elif choice in ["0", "q", "exit"]:
                self.console.print("\\n[cyan]Terminating Termux Ollama session. Goodbye![/cyan]")
                self.running = False
            else:
                self.console.print("[yellow]Invalid option. Please enter 0, 1, 2, 3, 4, or 5.[/yellow]")


def main():
    app = TermuxOllamaApp()
    app.run()


if __name__ == "__main__":
    main()
`
  },
  {
    name: 'models.py',
    path: 'termux_ollama_cli/models.py',
    language: 'python',
    description: 'Model management engine: list installed models, stream pull downloads with rich progress bar, set active model, delete models.',
    code: `"""
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
    """Check if the Ollama daemon is reachable."""
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
    """Query local Ollama instance for installed models."""
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
    """Pulls a model from Ollama library with streaming progress visualization."""
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

                set_active_model(model_name)
                return True, f"Model '{model_name}' pulled successfully and set as active."

    except httpx.ConnectError:
        return False, f"Cannot connect to Ollama daemon at {host}."
    except Exception as e:
        return False, f"Pull failed: {str(e)}"
`
  },
  {
    name: 'metrics.py',
    path: 'termux_ollama_cli/metrics.py',
    language: 'python',
    description: 'Metrics engine: parses Ollama inference telemetry, strictly grounds values with N/A fallbacks, and renders adaptive Rich panels.',
    code: `"""
Metrics Engine and Panel for Termux Ollama CLI.
Tracks inference metrics and renders adaptive compact Rich panels/tables.
Strict grounding: Missing metrics are displayed as 'N/A'.
"""
from typing import Dict, Any, Optional, List
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

class InferenceMetrics:
    def __init__(self, raw_data: Optional[Dict[str, Any]] = None):
        self.raw: Dict[str, Any] = raw_data or {}

    @property
    def eval_count(self) -> Optional[int]:
        val = self.raw.get("eval_count")
        return int(val) if val is not None else None

    @property
    def eval_duration_ns(self) -> Optional[int]:
        val = self.raw.get("eval_duration")
        return int(val) if val is not None else None

    @property
    def eval_duration_sec(self) -> Optional[float]:
        ns = self.eval_duration_ns
        return (ns / 1_000_000_000.0) if ns is not None and ns > 0 else None

    @property
    def tokens_per_second(self) -> Optional[float]:
        count = self.eval_count
        sec = self.eval_duration_sec
        if count is not None and sec is not None and sec > 0:
            return count / sec
        return None

    @property
    def load_duration_ms(self) -> Optional[float]:
        ns = self.raw.get("load_duration")
        return (ns / 1_000_000.0) if ns is not None else None

    @property
    def prompt_eval_count(self) -> Optional[int]:
        val = self.raw.get("prompt_eval_count")
        return int(val) if val is not None else None

    @property
    def prompt_eval_duration_sec(self) -> Optional[float]:
        ns = self.raw.get("prompt_eval_duration")
        return (ns / 1_000_000_000.0) if ns is not None else None

    def to_dict(self) -> Dict[str, str]:
        return {
            "Tokens Generated (eval_count)": f"{self.eval_count}" if self.eval_count is not None else "N/A",
            "Eval Duration": f"{self.eval_duration_sec:.2f} s" if self.eval_duration_sec is not None else "N/A",
            "Speed (Tokens / sec)": f"{self.tokens_per_second:.1f} t/s" if self.tokens_per_second is not None else "N/A",
            "Model Load Duration": f"{self.load_duration_ms:.1f} ms" if self.load_duration_ms is not None else "N/A",
            "Prompt Tokens": f"{self.prompt_eval_count}" if self.prompt_eval_count is not None else "N/A",
            "Prompt Eval Time": f"{self.prompt_eval_duration_sec:.2f} s" if self.prompt_eval_duration_sec is not None else "N/A",
        }

class MetricsSession:
    def __init__(self, max_history: int = 10):
        self.history: List[InferenceMetrics] = []
        self.max_history = max_history

    def record(self, raw_data: Dict[str, Any]) -> InferenceMetrics:
        metrics = InferenceMetrics(raw_data)
        self.history.append(metrics)
        if len(self.history) > self.max_history:
            self.history.pop(0)
        return metrics

    def latest(self) -> Optional[InferenceMetrics]:
        return self.history[-1] if self.history else None

    def average_speed(self) -> Optional[float]:
        speeds = [m.tokens_per_second for m in self.history if m.tokens_per_second is not None]
        if speeds:
            return sum(speeds) / len(speeds)
        return None

def render_metrics_panel(metrics: Optional[InferenceMetrics], console: Console, title: str = "Inference Metrics") -> None:
    width = console.width
    if not metrics or not metrics.raw:
        console.print(Panel("[dim]No inference metrics available yet.[/dim]", title=title, border_style="dim"))
        return

    data = metrics.to_dict()

    if width < 45:
        text_lines = []
        for key, val in data.items():
            short_key = key.split(" (")[0]
            val_style = "bold green" if "t/s" in val else "bold cyan" if val != "N/A" else "dim"
            text_lines.append(f"[dim]{short_key}:[/dim] [{val_style}]{val}[/{val_style}]")
        content = "\\n".join(text_lines)
        console.print(Panel(content, title=f"⚡ {title}", border_style="cyan", padding=(0, 1)))

    elif width < 65:
        table = Table(title=title, show_header=True, header_style="bold cyan", border_style="dim", box=None, padding=(0, 1))
        table.add_column("Metric", style="dim", no_wrap=True)
        table.add_column("Value", justify="right")

        for key, val in data.items():
            short_key = key.split(" (")[0]
            val_style = "bold green" if "t/s" in val else "bold yellow" if "Duration" in key else "bold cyan" if val != "N/A" else "dim"
            table.add_row(short_key, f"[{val_style}]{val}[/{val_style}]")
        console.print(table)

    else:
        table = Table(title=f"🚀 {title}", show_header=True, header_style="bold magenta", border_style="blue")
        table.add_column("Telemetry Key", style="cyan", no_wrap=True)
        table.add_column("Value", justify="right", style="bold")
        table.add_column("Grounding Status", justify="center", style="dim")

        for key, val in data.items():
            status = "[green]Live Telemetry[/green]" if val != "N/A" else "[dim]Not Reported[/dim]"
            val_style = "bold green" if "t/s" in val else "bold yellow" if "Duration" in key else "white"
            table.add_row(key, f"[{val_style}]{val}[/{val_style}]", status)
        console.print(table)
`
  },
  {
    name: 'storage.py',
    path: 'termux_ollama_cli/storage.py',
    language: 'python',
    description: 'PromptStore: JSON CRUD storage for prompt templates at $HOME/.config/ollama-cli/prompts.json.',
    code: `"""
Prompt Template Store for Termux Ollama CLI.
Manages CRUD operations for prompt templates saved at $HOME/.config/ollama-cli/prompts.json.
"""
import os
import json
from typing import List, Dict, Optional
from .config import get_config_dir

DEFAULT_PROMPTS: List[Dict[str, str]] = [
    {
        "id": "summarize",
        "title": "Quick Summarize",
        "template": "Summarize the following text in 3 concise bullet points:\\n\\n{input}",
        "description": "3-bullet rapid summary for mobile reading"
    },
    {
        "id": "code_explain",
        "title": "Explain Code",
        "template": "Explain how this code works in plain English, noting any potential bugs or performance bottlenecks:\\n\\n{input}",
        "description": "Code explanation with bug identification"
    },
    {
        "id": "shell_helper",
        "title": "Termux / Shell Command",
        "template": "Provide the exact Linux/Termux command to accomplish this task. Provide command first, then a 1-sentence explanation:\\n\\n{input}",
        "description": "Fast command generator for Android Termux"
    },
    {
        "id": "grammar_fix",
        "title": "Fix Grammar & Tone",
        "template": "Correct any grammar, spelling, and phrasing issues in this text while keeping it natural and professional:\\n\\n{input}",
        "description": "Polish text and fix grammar"
    },
    {
        "id": "git_commit",
        "title": "Conventional Commit",
        "template": "Generate 3 clean conventional commit message options for the following git diff / description:\\n\\n{input}",
        "description": "feat/fix conventional commit generator"
    }
]

def get_prompts_file_path() -> str:
    return os.path.join(get_config_dir(), "prompts.json")

def load_prompts() -> List[Dict[str, str]]:
    path = get_prompts_file_path()
    if not os.path.exists(path):
        save_prompts(DEFAULT_PROMPTS)
        return DEFAULT_PROMPTS.copy()
    try:
        with open(path, "r", encoding="utf-8") as f:
            prompts = json.load(f)
            if isinstance(prompts, list):
                return prompts
            return DEFAULT_PROMPTS.copy()
    except Exception:
        return DEFAULT_PROMPTS.copy()

def save_prompts(prompts: List[Dict[str, str]]) -> bool:
    try:
        path = get_prompts_file_path()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(prompts, f, indent=2)
        return True
    except Exception:
        return False

def add_prompt(prompt_id: str, title: str, template: str, description: str = "") -> bool:
    prompts = load_prompts()
    prompts = [p for p in prompts if p.get("id") != prompt_id]
    prompts.append({
        "id": prompt_id.strip().lower().replace(" ", "_"),
        "title": title.strip(),
        "template": template.strip(),
        "description": description.strip()
    })
    return save_prompts(prompts)

def delete_prompt(prompt_id: str) -> bool:
    prompts = load_prompts()
    filtered = [p for p in prompts if p.get("id") != prompt_id]
    if len(filtered) < len(prompts):
        return save_prompts(filtered)
    return False
`
  },
  {
    name: 'config.py',
    path: 'termux_ollama_cli/config.py',
    language: 'python',
    description: 'Configuration manager: handles $HOME/.config/ollama-cli/config.json with active model persistence and safe defaults.',
    code: `"""
Configuration Manager for Termux Ollama CLI.
Stores active model, host endpoint, and theme settings in $HOME/.config/ollama-cli/config.json.
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
    base_dir = os.path.expanduser("~")
    config_dir = os.path.join(base_dir, ".config", "ollama-cli")
    os.makedirs(config_dir, exist_ok=True)
    return config_dir

def get_config_path() -> str:
    return os.path.join(get_config_dir(), "config.json")

def load_config() -> Dict[str, Any]:
    path = get_config_path()
    if not os.path.exists(path):
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            config = DEFAULT_CONFIG.copy()
            config.update(data)
            return config
    except Exception:
        return DEFAULT_CONFIG.copy()

def save_config(config: Dict[str, Any]) -> bool:
    try:
        path = get_config_path()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
        return True
    except Exception:
        return False

def update_config_value(key: str, value: Any) -> Dict[str, Any]:
    config = load_config()
    config[key] = value
    save_config(config)
    return config
`
  },
  {
    name: 'theme.py',
    path: 'termux_ollama_cli/theme.py',
    language: 'python',
    description: 'Theme engine: High-Contrast Dark and Light color maps with ANSI fallback safety.',
    code: `"""
Theme Engine for Termux Ollama CLI.
Provides High-Contrast Dark and Light themes using standard ANSI color palettes.
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
    styles = LIGHT_THEME_STYLES if theme_name.lower() == "light" else DARK_THEME_STYLES
    return Theme(styles)

def get_current_theme_name() -> str:
    config = load_config()
    return config.get("theme", "dark")

def toggle_theme() -> str:
    current = get_current_theme_name()
    new_theme = "light" if current == "dark" else "dark"
    update_config_value("theme", new_theme)
    return new_theme
`
  },
  {
    name: 'install_termux.sh',
    path: 'termux_ollama_cli/install_termux.sh',
    language: 'bash',
    description: '1-click automated Termux installer script: verifies python, installs rich & httpx, and creates the launcher binary.',
    code: `#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Termux Ollama Rich CLI Auto-Installer
# Optimized for Android devices running Termux
# ==============================================================================

set -e

echo -e "\\033[1;36m[+] Initializing Termux Ollama CLI Setup...\\033[0m"

if ! command -v python3 &> /dev/null; then
    echo -e "\\033[1;33m[+] Installing Python in Termux...\\033[0m"
    pkg update -y && pkg install -y python
fi

echo -e "\\033[1;33m[+] Installing 'rich' and 'httpx' via pip...\\033[0m"
pip install --upgrade --no-cache-dir rich httpx

CONFIG_DIR="$HOME/.config/ollama-cli"
mkdir -p "$CONFIG_DIR"

INSTALL_BIN="$PREFIX/bin/ollama-cli"
cat << 'EOF' > "$INSTALL_BIN"
#!/data/data/com.termux/files/usr/bin/bash
export PYTHONUNBUFFERED=1
python3 -m termux_ollama_cli.app "$@"
EOF

chmod +x "$INSTALL_BIN"

echo -e "\\033[1;32m[✔] Termux Ollama CLI successfully installed!\\033[0m"
echo -e "\\033[1;37mRun '\\033[1;33mollama-cli\\033[1;37m' anytime from your Termux terminal.\\033[0m"
`
  },
  {
    name: 'QUICKSTART.md',
    path: 'QUICKSTART.md',
    language: 'markdown',
    description: "Beginner's quickstart guide with step-by-step Termux setup and Ollama backend configuration.",
    code: `# CreativeAct CLI — Beginner's Quickstart Guide
Local Termux Ollama Platform on Android

1. Install Termux from F-Droid (not Google Play)
2. Run wake-lock:
   termux-wake-lock
3. Update & Install dependencies:
   pkg update && pkg install -y python git curl
   pip install --upgrade rich httpx
4. Install CreativeAct CLI:
   bash termux_ollama_cli/install_termux.sh
5. Run:
   ollama-cli
6. In menu:
   - [2] Models -> [p] pull 'llama3.2:1b'
   - [2] Models -> [s] set as active
   - [1] Chat -> start streaming conversation!
`
  }
];
