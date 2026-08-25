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
