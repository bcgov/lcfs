"""The folder feature's hard scope boundary (#4925).

Folders exist only for the surfaces named here. Every folder route
validates parent_type against this set before doing anything else, so the
feature cannot leak into an existing document surface through a bug or a
mistyped constant. Extending folders to another surface is one string
here plus frontend wiring — no schema change.
"""

FOLDER_ENABLED_PARENT_TYPES = frozenset({"designatedAction"})

# One level below the cap is still creatable; easier to relax than impose.
MAX_FOLDER_DEPTH = 5

# Product overrides, by parent type. Empty right now: the business area
# asked for subfolders on designated actions (2026-09-01), lifting the
# earlier one-level cap, so every surface runs at MAX_FOLDER_DEPTH. The
# lever stays because capping a surface again — or capping a new surface
# from day one — should be one entry here, not a code change.
FOLDER_MAX_DEPTH_BY_PARENT = {}


def max_folder_depth(parent_type: str) -> int:
    return FOLDER_MAX_DEPTH_BY_PARENT.get(parent_type, MAX_FOLDER_DEPTH)
