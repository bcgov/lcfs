"""Sanitize rich text submitted by the EOC editors."""

from html import escape
from html.parser import HTMLParser
from urllib.parse import urlsplit

_ALLOWED_TAGS = {
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "i",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "span",
    "strong",
    "u",
    "ul",
}
_VOID_TAGS = {"br"}
_DROP_CONTENT_TAGS = {"iframe", "object", "script", "style", "svg"}


def _safe_href(value: str) -> bool:
    normalized = value.strip()
    if any(ord(character) < 0x20 or ord(character) == 0x7F for character in normalized):
        return False
    parsed = urlsplit(normalized)
    if parsed.scheme:
        return parsed.scheme.lower() in {"http", "https", "mailto"}
    first_segment = normalized.split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
    return ":" not in first_segment


class _RichTextSanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.drop_content_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if self.drop_content_depth:
            if tag in _DROP_CONTENT_TAGS:
                self.drop_content_depth += 1
            return
        if tag in _DROP_CONTENT_TAGS:
            self.drop_content_depth = 1
            return
        if tag not in _ALLOWED_TAGS:
            return

        safe_attrs = ""
        if tag == "a":
            href = next(
                (value for name, value in attrs if name.lower() == "href"), None
            )
            if href and _safe_href(href):
                safe_attrs = f' href="{escape(href, quote=True)}"'
        self.parts.append(f"<{tag}{safe_attrs}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag.lower() not in _VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.drop_content_depth:
            if tag in _DROP_CONTENT_TAGS:
                self.drop_content_depth -= 1
            return
        if tag in _ALLOWED_TAGS and tag not in _VOID_TAGS:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if not self.drop_content_depth:
            self.parts.append(escape(data))


def sanitize_eoc_rich_text(value: str | None) -> str:
    """Keep Quill formatting while removing executable markup and attributes."""
    if not value:
        return ""
    parser = _RichTextSanitizer()
    parser.feed(value)
    parser.close()
    return "".join(parser.parts)
