"""
CreativeAct CLI
Local Termux Ollama Platform
A resource-efficient, touch-friendly terminal application for Ollama within Termux on Android.
Features:
- Single-character menu optimized for soft keyboards: [1] Chat, [2] Models, [3] Prompts, [4] Metrics, [5] Theme, [0] Exit
- Model management: list models, download/pull new models with progress bars, switch active model
- Streaming token engine with Rich Live view and auto-collapsing metrics
- Dynamic SIGWINCH handling for mobile screen orientation changes
- Resilient error handling for mobile network drops and daemon disconnects
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
            # Ultra-compact 1-line header for < 45 cols
            self.console.print(f"[bold cyan]◈ CreativeAct CLI[/bold cyan] [dim]({active_model})[/dim]")
        elif width < 65:
            # Compact 2-line header for < 65 cols
            header_text = f"[bold cyan]◈ CreativeAct CLI — Local Termux Ollama Platform[/bold cyan]\n[dim]Model:[/dim] [yellow]{active_model}[/yellow] [dim]| Host:[/dim] [cyan]{host}[/cyan]"
            self.console.print(Panel(header_text, border_style="dim", padding=(0, 1)))
        else:
            # Full table header for >= 65 cols
            table = Table.grid(expand=True)
            table.add_column(justify="left", ratio=2)
            table.add_column(justify="right", ratio=1)
            table.add_row(
                f"[bold cyan]◈ CreativeAct CLI — Local Termux Ollama Platform[/bold cyan]",
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
            # Single-column vertical list for small mobile screens
            self.console.print("\n[bold]Select an option:[/bold]")
            for key, name, desc in options:
                self.console.print(f" [bold yellow]\\[{key}][/bold yellow] [bold]{name}[/bold] [dim]· {desc}[/dim]")
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
            val = input(f"\n{prompt_text}").strip()
            return val
        except (KeyboardInterrupt, EOFError):
            return "0"

    def chat_loop(self, initial_prompt: Optional[str] = None):
        """Interactive streaming chat loop."""
        active_model = get_active_model()
        host = get_ollama_host()
        self.console.clear()
        self.console.print(f"[bold cyan]─── Chat Session: [yellow]{active_model}[/yellow] ───[/bold cyan]")
        self.console.print("[dim]Type your message. Type ':q' or press Enter on empty line to exit.[/dim]\n")

        # Check connectivity first
        is_ok, msg = check_ollama_health()
        if not is_ok:
            self.console.print(Panel(f"[bold red]Connection Warning:[/bold red] {msg}\n[yellow]Continuing in offline preview mode.[/yellow]", border_style="red"))

        conversation_history: List[Dict[str, str]] = []

        # If a prompt template was launched directly
        first_input = initial_prompt

        while True:
            if first_input is not None:
                user_msg = first_input
                first_input = None
                self.console.print(f"[bold yellow]> Prompt Template:[/bold yellow]\n{user_msg}\n")
            else:
                try:
                    user_msg = input("\n[user]> ").strip()
                except (KeyboardInterrupt, EOFError):
                    break

            if not user_msg or user_msg == ":q":
                break

            conversation_history.append({"role": "user", "content": user_msg})

            # Stream response
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
                                    # Collect final telemetry metrics
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
                # Show quick inline speed
                if metrics.tokens_per_second is not None:
                    self.console.print(f"[dim]⚡ Speed: [bold green]{metrics.tokens_per_second:.1f} t/s[/bold green] ({metrics.eval_count} tokens in {metrics.eval_duration_sec:.2f}s)[/dim]")
                else:
                    self.console.print("[dim]⚡ Speed: N/A[/dim]")

        except httpx.ConnectError:
            self.console.print(Panel(
                f"[bold red]Connection Lost:[/bold red] Could not reach Ollama daemon at {host}.\nPlease check that 'ollama serve' is running.",
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
            self.console.print(f"[bold cyan]─── Model Management (Active: [yellow]{active}[/yellow]) ───[/bold cyan]\n")

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

            self.console.print("\n[bold]Options:[/bold]")
            self.console.print(" [bold yellow]\\[s][/bold yellow] Set active model by number")
            self.console.print(" [bold yellow]\\[c][/bold yellow] Compare two models side-by-side")
            self.console.print(" [bold yellow]\\[p][/bold yellow] Pull / Download new model (e.g. llama3.2:1b, qwen2.5:1.5b)")
            self.console.print(" [bold yellow]\\[d][/bold yellow] Delete model")
            self.console.print(" [bold yellow]\\[b][/bold yellow] Back to main menu")

            sub_choice = self.prompt_input("Models choice [s/c/p/d/b]: ").lower()

            if sub_choice in ["b", "0", "q", ""]:
                break
            elif sub_choice == "s":
                if not models:
                    self.console.print("[red]No models available to select.[/red]")
                    input("\nPress Enter to continue...")
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
                input("\nPress Enter to continue...")

            elif sub_choice == "c":
                if len(models) < 2:
                    self.console.print("[red]Need at least 2 models installed to perform comparison.[/red]")
                    input("\nPress Enter to continue...")
                    continue
                num_a = self.prompt_input(f"Enter first model # (1-{len(models)}): ")
                num_b = self.prompt_input(f"Enter second model # (1-{len(models)}): ")
                try:
                    idx_a = int(num_a) - 1
                    idx_b = int(num_b) - 1
                    if 0 <= idx_a < len(models) and 0 <= idx_b < len(models):
                        self.render_model_comparison(models[idx_a], models[idx_b])
                    else:
                        self.console.print("[red]Invalid model numbers selected.[/red]")
                except ValueError:
                    self.console.print("[red]Please enter valid numbers.[/red]")
                input("\nPress Enter to continue...")

            elif sub_choice == "p":
                model_to_pull = self.prompt_input("Enter model tag to download (e.g. qwen2.5:1.5b, llama3.2:1b): ").strip()
                if model_to_pull:
                    ok, msg = pull_model_stream(model_to_pull, self.console)
                    if ok:
                        self.console.print(f"[bold green]Success:[/bold green] {msg}")
                    else:
                        self.console.print(f"[bold red]Failed:[/bold red] {msg}")
                    input("\nPress Enter to continue...")

            elif sub_choice == "d":
                del_target = self.prompt_input("Enter model name to delete: ").strip()
                if del_target:
                    confirm = self.prompt_input(f"Confirm delete '{del_target}'? [y/N]: ").lower()
                    if confirm == "y":
                        ok, msg = delete_model(del_target)
                        self.console.print(f"[{'green' if ok else 'red'}]{msg}[/{'green' if ok else 'red'}]")
                    input("\nPress Enter to continue...")

    def render_model_comparison(self, mA: Dict[str, Any], mB: Dict[str, Any]):
        """Render side-by-side comparison table between two models."""
        self.console.clear()
        name_a = mA.get("name", "Model A")
        name_b = mB.get("name", "Model B")
        details_a = mA.get("details", {}) or {}
        details_b = mB.get("details", {}) or {}

        param_a = details_a.get("parameter_size", "N/A")
        param_b = details_b.get("parameter_size", "N/A")
        quant_a = details_a.get("quantization_level", "Q4_K_M")
        quant_b = details_b.get("quantization_level", "Q4_K_M")
        family_a = details_a.get("family", "N/A")
        family_b = details_b.get("family", "N/A")
        size_a = format_size(mA.get("size"))
        size_b = format_size(mB.get("size"))

        latest = self.metrics_session.latest()
        speed_str = f"{latest.tokens_per_second:.1f} t/s" if latest and latest.tokens_per_second is not None else "N/A"
        eval_dur = f"{latest.eval_duration_sec:.2f} s" if latest and latest.eval_duration_sec is not None else "N/A"
        load_dur = f"{latest.load_duration_ms:.1f} ms" if latest and latest.load_duration_ms is not None else "N/A"

        width = self.get_width()
        active = get_active_model()

        if width < 50:
            self.console.print(f"[bold cyan]─── Model Comparison ───[/bold cyan]\n")
            self.console.print(f"[bold yellow]Model A:[/bold yellow] [bold]{name_a}[/bold] {'(Active)' if name_a == active else ''}")
            self.console.print(f" · Params: {param_a} | Quant: {quant_a} | Size: {size_a}\n")
            self.console.print(f"[bold magenta]Model B:[/bold magenta] [bold]{name_b}[/bold] {'(Active)' if name_b == active else ''}")
            self.console.print(f" · Params: {param_b} | Quant: {quant_b} | Size: {size_b}\n")
            self.console.print(f"[dim]Last Inference (session): {eval_dur} | Speed: {speed_str}[/dim]")
        else:
            table = Table(title=f"⚖ Model Comparison: {name_a} vs {name_b}", header_style="bold cyan", border_style="dim")
            table.add_column("Specification", style="dim", no_wrap=True)
            table.add_column(f"{name_a} {'(Active)' if name_a == active else ''}", style="bold yellow")
            table.add_column(f"{name_b} {'(Active)' if name_b == active else ''}", style="bold magenta")

            table.add_row("Parameter Size", str(param_a), str(param_b))
            table.add_row("Quantization Level", str(quant_a), str(quant_b))
            table.add_row("Architecture Family", str(family_a), str(family_b))
            table.add_row("Disk Footprint", size_a, size_b)
            table.add_row("Last Eval Duration", eval_dur if name_a == active else "N/A", eval_dur if name_b == active else "N/A")
            table.add_row("Last Speed (Tokens/s)", speed_str if name_a == active else "N/A", speed_str if name_b == active else "N/A")
            table.add_row("Last Load Latency", load_dur if name_a == active else "N/A", load_dur if name_b == active else "N/A")
            self.console.print(table)

    def prompt_store_menu(self):
        """Prompt templates management and rapid execution."""
        while True:
            self.console.clear()
            self.console.print("[bold cyan]─── Prompt Template Store ───[/bold cyan]\n")
            prompts = load_prompts()

            table = Table(show_header=True, header_style="bold cyan", border_style="dim", box=None)
            table.add_column("#", style="bold yellow", width=3)
            table.add_column("Title", style="bold")
            table.add_column("Description", style="dim")

            for idx, p in enumerate(prompts, start=1):
                table.add_row(str(idx), p.get("title", ""), p.get("description", ""))
            self.console.print(table)

            self.console.print("\n[bold]Options:[/bold]")
            self.console.print(" [bold yellow]\\[r][/bold yellow] Run prompt with input")
            self.console.print(" [bold yellow]\\[a][/bold yellow] Add new prompt template")
            self.console.print(" [bold yellow]\\[d][/bold yellow] Delete prompt")
            self.console.print(" [bold yellow]\\[b][/bold yellow] Back to main menu")

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
                        self.console.print(f"\n[cyan]Template:[/cyan] {selected.get('title')}")
                        user_arg = self.prompt_input("Enter content for {input}: ")
                        formatted_prompt = template.replace("{input}", user_arg)
                        self.chat_loop(initial_prompt=formatted_prompt)
                except ValueError:
                    self.console.print("[red]Invalid selection.[/red]")
                    input("\nPress Enter to continue...")

            elif choice == "a":
                pid = self.prompt_input("Identifier (e.g. fix_bugs): ")
                title = self.prompt_input("Display Title: ")
                desc = self.prompt_input("Short description: ")
                self.console.print("[dim]Use '{input}' as variable placeholder.[/dim]")
                tmpl = self.prompt_input("Template text: ")
                if pid and title and tmpl:
                    add_prompt(pid, title, tmpl, desc)
                    self.console.print("[bold green]Prompt template saved![/bold green]")
                input("\nPress Enter to continue...")

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
                input("\nPress Enter to continue...")

    def show_metrics_view(self):
        """Display last session metrics and telemetry stats."""
        self.console.clear()
        self.console.print("[bold cyan]─── Inference Telemetry & Metrics ───[/bold cyan]\n")
        latest = self.metrics_session.latest()
        render_metrics_panel(latest, self.console, title="Latest Generation")

        avg = self.metrics_session.average_speed()
        if avg is not None:
            self.console.print(f"\n[bold]Session Average Speed:[/bold] [bold green]{avg:.1f} tokens/sec[/bold green] over {len(self.metrics_session.history)} inferences")
        else:
            self.console.print("\n[dim]Grounding status: All metrics are parsed directly from Ollama response tokens. No fake latency estimates.[/dim]")

        input("\nPress Enter to return to menu...")

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
                self.console.print("\n[cyan]Terminating Termux Ollama session. Goodbye![/cyan]")
                self.running = False
            else:
                self.console.print("[yellow]Invalid option. Please enter 0, 1, 2, 3, 4, or 5.[/yellow]")


def main():
    app = TermuxOllamaApp()
    app.run()


if __name__ == "__main__":
    main()
