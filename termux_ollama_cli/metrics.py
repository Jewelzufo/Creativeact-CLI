"""
Metrics Engine and Panel for Termux Ollama CLI.
Tracks inference metrics (eval_count, eval_duration, load_duration, tokens/sec)
and renders adaptive compact Rich panels/tables for mobile viewports.
Strict grounding: Missing metrics are displayed as 'N/A' (no synthetic estimation).
"""
from typing import Dict, Any, Optional, List
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

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
        return (ns / 1_000_000_000.0) if ns is not None and ns > 0 else None

    def to_dict(self) -> Dict[str, str]:
        """Convert metrics to human-readable grounded display strings."""
        return {
            "Tokens Generated (eval_count)": f"{self.eval_count}" if self.eval_count is not None else "N/A",
            "Eval Duration": f"{self.eval_duration_sec:.2f} s" if self.eval_duration_sec is not None else "N/A",
            "Speed (Tokens / sec)": f"{self.tokens_per_second:.1f} t/s" if self.tokens_per_second is not None else "N/A",
            "Model Load Duration": f"{self.load_duration_ms:.1f} ms" if self.load_duration_ms is not None else "N/A",
            "Prompt Tokens": f"{self.prompt_eval_count}" if self.prompt_eval_count is not None else "N/A",
            "Prompt Eval Time": f"{self.prompt_eval_duration_sec:.2f} s" if self.prompt_eval_duration_sec is not None else "N/A",
        }

class MetricsSession:
    """Stores session-wide metrics history."""
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
    """
    Renders metrics inside a border-adaptive panel or table.
    Auto-collapses for mobile viewports (< 60 columns or < 40 columns).
    """
    width = console.width
    if not metrics or not metrics.raw:
        console.print(Panel("[dim]No inference metrics available yet.[/dim]", title=title, border_style="dim"))
        return

    data = metrics.to_dict()

    if width < 45:
        # Micro-mobile vertical stack (< 45 cols)
        text_lines = []
        for key, val in data.items():
            short_key = key.split(" (")[0]
            val_style = "bold green" if "t/s" in val else "bold cyan" if val != "N/A" else "dim"
            text_lines.append(f"[dim]{short_key}:[/dim] [{val_style}]{val}[/{val_style}]")
        content = "\n".join(text_lines)
        console.print(Panel(content, title=f"⚡ {title}", border_style="cyan", padding=(0, 1)))

    elif width < 65:
        # Medium mobile table (< 65 cols)
        table = Table(title=title, show_header=True, header_style="bold cyan", border_style="dim", box=None, padding=(0, 1))
        table.add_column("Metric", style="dim", no_wrap=True)
        table.add_column("Value", justify="right")

        for key, val in data.items():
            short_key = key.split(" (")[0]
            val_style = "bold green" if "t/s" in val else "bold yellow" if "Duration" in key else "bold cyan" if val != "N/A" else "dim"
            table.add_row(short_key, f"[{val_style}]{val}[/{val_style}]")
        console.print(table)

    else:
        # Full tablet / desktop table
        table = Table(title=f"🚀 {title}", show_header=True, header_style="bold magenta", border_style="blue")
        table.add_column("Telemetry Key", style="cyan", no_wrap=True)
        table.add_column("Value", justify="right", style="bold")
        table.add_column("Grounding Status", justify="center", style="dim")

        for key, val in data.items():
            status = "[green]Live Telemetry[/green]" if val != "N/A" else "[dim]Not Reported[/dim]"
            val_style = "bold green" if "t/s" in val else "bold yellow" if "Duration" in key else "white"
            table.add_row(key, f"[{val_style}]{val}[/{val_style}]", status)
        console.print(table)
