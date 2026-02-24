from __future__ import annotations

from typing import TYPE_CHECKING, Callable, TypedDict

if TYPE_CHECKING:
    pass


class CommandInfo(TypedDict):
    desc: str
    args: str


COMMANDS: dict[str, CommandInfo] = {
    "init": {"desc": "Initialize and install hook", "args": ""},
    "uninstall": {"desc": "Remove hook from current repo", "args": ""},
    "sync": {"desc": "Sync context for current branch", "args": ""},
    "branches": {"desc": "List all branch contexts", "args": ""},
    "status": {"desc": "Show status", "args": ""},
    "reset": {"desc": "Reset context to template", "args": "[template]"},
    "doctor": {"desc": "Run diagnostics", "args": ""},
    "completion": {"desc": "Generate shell completion", "args": "<shell>"},
}

INTERNAL_COMMANDS: set[str] = {"on-checkout"}

_ALL_COMMANDS: set[str] = set(COMMANDS.keys()) | INTERNAL_COMMANDS


def get_command_handler(name: str) -> Callable[[list[str]], int]:
    from branchctx.commands import (
        cmd_branches,
        cmd_completion,
        cmd_doctor,
        cmd_init,
        cmd_on_checkout,
        cmd_reset,
        cmd_status,
        cmd_sync,
        cmd_uninstall,
    )

    handlers: dict[str, Callable[[list[str]], int]] = {
        "init": cmd_init,
        "uninstall": cmd_uninstall,
        "sync": cmd_sync,
        "branches": cmd_branches,
        "status": cmd_status,
        "on-checkout": cmd_on_checkout,
        "reset": cmd_reset,
        "doctor": cmd_doctor,
        "completion": cmd_completion,
    }

    assert set(handlers.keys()) == _ALL_COMMANDS, "COMMANDS and handlers are out of sync"

    if name not in handlers:
        raise ValueError(f"Unknown command: {name}")

    return handlers[name]


def get_all_command_names() -> set[str]:
    return _ALL_COMMANDS


def get_public_commands() -> dict[str, CommandInfo]:
    return COMMANDS
