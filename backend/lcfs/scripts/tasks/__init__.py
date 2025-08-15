"""
Tasks package for the dynamic scheduler.

This package contains modular task functions organized by functionality:
- fuel_code_expiry: Tasks related to fuel code expiration notifications

Each module should contain async functions that accept a db_session parameter
and return True for success or False for failure.
"""

from .fuel_code_expiry import notify_expiring_fuel_code

__version__ = "1.0.0"
__all__ = [
    "notify_expiring_fuel_code",
]

# Optional: Define task categories for documentation/discovery
TASK_CATEGORIES = {
    "fuel_code": ["fuel_code_expiry"],
}
