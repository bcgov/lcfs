"""OpenAI-compatible chat schemas."""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field
import time


class ChatMessage(BaseModel):
    """A chat message in OpenAI format."""

    role: Literal["user", "assistant", "system"]
    content: str
    name: Optional[str] = None


class ChatCompletionRequest(BaseModel):
    """OpenAI chat completion request format."""

    messages: List[ChatMessage]
    model: str = "lcfs-rag"
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=500, gt=0, le=2000)
    stream: Optional[bool] = False
    top_p: Optional[float] = Field(default=1.0, ge=0.0, le=1.0)
    frequency_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    presence_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    stop: Optional[List[str]] = None
    user: Optional[str] = None


class Usage(BaseModel):
    """Token usage information."""

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionChoice(BaseModel):
    """A chat completion choice."""

    index: int
    message: ChatMessage
    finish_reason: Optional[Literal["stop", "length", "content_filter"]] = None


class ChatCompletionResponse(BaseModel):
    """OpenAI chat completion response format."""

    id: str
    object: str = "chat.completion"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: List[ChatCompletionChoice]
    usage: Optional[Usage] = None


# Streaming schemas
class ChatCompletionChunkDelta(BaseModel):
    """Delta object for streaming responses."""

    role: Optional[Literal["assistant"]] = None
    content: Optional[str] = None
    metadata: Optional[dict] = None


class ChatCompletionChunkChoice(BaseModel):
    """A streaming chat completion choice."""

    index: int
    delta: ChatCompletionChunkDelta
    finish_reason: Optional[Literal["stop", "length", "content_filter"]] = None


class ChatCompletionChunk(BaseModel):
    """OpenAI chat completion chunk for streaming."""

    id: str
    object: str = "chat.completion.chunk"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: List[ChatCompletionChunkChoice]


class ErrorDetail(BaseModel):
    """Error detail object."""

    message: str
    type: str
    param: Optional[str] = None
    code: Optional[str] = None


class ErrorResponse(BaseModel):
    """OpenAI-compatible error response."""

    error: ErrorDetail


class EscalationRequest(BaseModel):
    """Support escalation request from the chat assistant."""

    issue_type: str = Field(
        ...,
        description="Type of issue: question, issue, feedback",
    )
    description: str = Field(..., description="User's description of their issue")
    user_email: str = Field(..., description="User's email for response")
    user_name: str = Field(..., description="User's name")
    organization_name: Optional[str] = Field(
        None, description="User's organization name"
    )
    organization_id: Optional[int] = Field(None, description="User's organization ID")
    conversation_history: Optional[str] = Field(
        None, description="Full conversation history with the assistant"
    )
    is_low_confidence: bool = Field(
        False, description="Whether this escalation was triggered by low AI confidence"
    )
    submitted_at: str = Field(..., description="Timestamp of submission")


class EscalationResponse(BaseModel):
    """Response after submitting an escalation request."""

    status: str
    message: str
    ticket_id: Optional[str] = None
