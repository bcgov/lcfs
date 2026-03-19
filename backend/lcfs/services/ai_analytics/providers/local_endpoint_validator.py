from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


CLOUD_HOST_PATTERNS = (
    "openai.com",
    "anthropic.com",
    "googleapis.com",
    "vertexai",
    "huggingface.co",
    "replicate.com",
    "together.ai",
    "groq.com",
)


def _normalize_allowlist(raw_hosts: str) -> set[str]:
    hosts = {host.strip().lower() for host in raw_hosts.split(",") if host.strip()}
    hosts.update({"localhost", "127.0.0.1", "::1"})
    return hosts


def is_private_or_allowed_host(host: str, allowed_hosts: set[str]) -> bool:
    lowered = host.lower()
    if lowered in allowed_hosts:
        return True
    if any(pattern in lowered for pattern in CLOUD_HOST_PATTERNS):
        return False
    try:
        ip = ipaddress.ip_address(lowered)
        return ip.is_private or ip.is_loopback
    except ValueError:
        pass
    try:
        resolved = {
            ipaddress.ip_address(address)
            for address in socket.gethostbyname_ex(host)[2]
        }
    except socket.gaierror:
        return False
    return bool(resolved) and all(ip.is_private or ip.is_loopback for ip in resolved)


def validate_private_ai_url(url: str, settings, label: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError(f"{label} must be a valid http(s) URL.")
    allowed_hosts = _normalize_allowlist(settings.ai_analytics_allowed_internal_hosts)
    if settings.ai_analytics_allow_private_hosts_only and not is_private_or_allowed_host(
        parsed.hostname, allowed_hosts
    ):
        raise ValueError(
            f"{label} host '{parsed.hostname}' is not local/private. "
            "AI analytics is configured to fail closed for public endpoints."
        )
