from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Type

from pydantic import BaseModel, ValidationError


class StructuredLlmError(Exception):
    """Raised when a local model call fails or cannot be parsed."""


class LocalLLMClient(ABC):
    """Abstract interface for local-only structured generation."""

    provider_name: str
    model_name: str

    @abstractmethod
    async def generate_json(
        self,
        prompt: str,
        response_model: Type[BaseModel],
    ) -> BaseModel:
        """Generate and validate structured JSON from a local model."""

    def validate_json_response(
        self,
        raw_text: str,
        response_model: Type[BaseModel],
    ) -> BaseModel:
        parsed = self._extract_json(raw_text)
        try:
            return response_model.model_validate(parsed)
        except ValidationError as exc:
            raise StructuredLlmError(f"Invalid structured model response: {exc}") from exc

    def _extract_json(self, raw_text: str) -> Dict[str, Any]:
        text = raw_text.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if "\n" in text:
                text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(text[start : end + 1])
                except json.JSONDecodeError as exc:
                    raise StructuredLlmError("Model did not return valid JSON.") from exc
            raise StructuredLlmError("Model did not return valid JSON.")
