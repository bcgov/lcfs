from __future__ import annotations

from typing import Dict, Optional

from lcfs.services.ai_analytics.types import SessionContext


class SessionMemoryStore:
    """In-process session memory for lightweight follow-up support."""

    _sessions: Dict[str, SessionContext] = {}

    def get(self, session_id: str) -> Optional[SessionContext]:
        return self._sessions.get(session_id)

    def upsert(self, context: SessionContext) -> SessionContext:
        self._sessions[context.session_id] = context
        return context
