"""
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
        "template": "Summarize the following text in 3 concise bullet points:\n\n{input}",
        "description": "3-bullet rapid summary for mobile reading"
    },
    {
        "id": "code_explain",
        "title": "Explain Code",
        "template": "Explain how this code works in plain English, noting any potential bugs or performance bottlenecks:\n\n{input}",
        "description": "Code explanation with bug identification"
    },
    {
        "id": "shell_helper",
        "title": "Termux / Shell Command",
        "template": "Provide the exact Linux/Termux command to accomplish this task. Provide command first, then a 1-sentence explanation:\n\n{input}",
        "description": "Fast command generator for Android Termux"
    },
    {
        "id": "grammar_fix",
        "title": "Fix Grammar & Tone",
        "template": "Correct any grammar, spelling, and phrasing issues in this text while keeping it natural and professional:\n\n{input}",
        "description": "Polish text and fix grammar"
    },
    {
        "id": "git_commit",
        "title": "Conventional Commit",
        "template": "Generate 3 clean conventional commit message options for the following git diff / description:\n\n{input}",
        "description": "feat/fix conventional commit generator"
    }
]

def get_prompts_file_path() -> str:
    """Returns path to prompts.json."""
    return os.path.join(get_config_dir(), "prompts.json")

def load_prompts() -> List[Dict[str, str]]:
    """Loads all prompt templates from disk or initializes defaults."""
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
    """Saves prompts list to disk."""
    try:
        path = get_prompts_file_path()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(prompts, f, indent=2)
        return True
    except Exception:
        return False

def get_prompt_by_id(prompt_id: str) -> Optional[Dict[str, str]]:
    """Retrieves a single prompt by ID."""
    prompts = load_prompts()
    for p in prompts:
        if p.get("id") == prompt_id:
            return p
    return None

def add_prompt(prompt_id: str, title: str, template: str, description: str = "") -> bool:
    """Adds a new prompt template or overwrites existing ID."""
    prompts = load_prompts()
    # Filter out existing with same ID
    prompts = [p for p in prompts if p.get("id") != prompt_id]
    prompts.append({
        "id": prompt_id.strip().lower().replace(" ", "_"),
        "title": title.strip(),
        "template": template.strip(),
        "description": description.strip()
    })
    return save_prompts(prompts)

def delete_prompt(prompt_id: str) -> bool:
    """Deletes a prompt template by ID."""
    prompts = load_prompts()
    filtered = [p for p in prompts if p.get("id") != prompt_id]
    if len(filtered) < len(prompts):
        return save_prompts(filtered)
    return False
