"""Progress logging utilities for consistent user feedback."""

import sys
from typing import Optional


def log_progress(message: str, flush: bool = True) -> None:
    """
    Log a progress message with emoji.

    Args:
        message: The message to display
        flush: Whether to flush the output immediately
    """
    print(f"🔄 {message}", flush=flush)


def log_success(message: str, flush: bool = True) -> None:
    """
    Log a success message with emoji.

    Args:
        message: The message to display
        flush: Whether to flush the output immediately
    """
    print(f"✅ {message}", flush=flush)


def log_error(message: str, flush: bool = True) -> None:
    """
    Log an error message with emoji.

    Args:
        message: The message to display
        flush: Whether to flush the output immediately
    """
    print(f"❌ {message}", flush=flush)


def log_warning(message: str, flush: bool = True) -> None:
    """
    Log a warning message with emoji.

    Args:
        message: The message to display
        flush: Whether to flush the output immediately
    """
    print(f"⚠️  {message}", flush=flush)


def log_info(message: str, flush: bool = True) -> None:
    """
    Log an info message with emoji.

    Args:
        message: The message to display
        flush: Whether to flush the output immediately
    """
    print(f"ℹ️  {message}", flush=flush)


def log_step(step_number: int, total_steps: int, description: str, flush: bool = True) -> None:
    """
    Log a numbered step in a process.

    Args:
        step_number: Current step number
        total_steps: Total number of steps
        description: Description of the step
        flush: Whether to flush the output immediately
    """
    print(f"🔍 Step {step_number}/{total_steps}: {description}", flush=flush)


def log_subsection(message: str, flush: bool = True) -> None:
    """
    Log a subsection message with indentation.

    Args:
        message: The message to display
        flush: Whether to flush the output immediately
    """
    print(f"   {message}", flush=flush)


def log_bullet(message: str, flush: bool = True) -> None:
    """
    Log a bullet point message.

    Args:
        message: The message to display
        flush: Whether to flush the output immediately
    """
    print(f"   - {message}", flush=flush)


def log_metric(label: str, value: str, flush: bool = True) -> None:
    """
    Log a metric with consistent formatting.

    Args:
        label: The metric label
        value: The metric value
        flush: Whether to flush the output immediately
    """
    print(f"📊 {label}: {value}", flush=flush)


def log_timing(operation: str, duration_seconds: float, flush: bool = True) -> None:
    """
    Log operation timing information.

    Args:
        operation: Name of the operation
        duration_seconds: Duration in seconds
        flush: Whether to flush the output immediately
    """
    print(f"⏱️  {operation} completed in {duration_seconds:.1f}s", flush=flush)


def log_header(message: str, flush: bool = True) -> None:
    """
    Log a header message for major sections.

    Args:
        message: The header message
        flush: Whether to flush the output immediately
    """
    print(f"🚀 {message}", flush=flush)


def log_completion(message: str, flush: bool = True) -> None:
    """
    Log a completion message for major milestones.

    Args:
        message: The completion message
        flush: Whether to flush the output immediately
    """
    print(f"🎉 {message}", flush=flush)