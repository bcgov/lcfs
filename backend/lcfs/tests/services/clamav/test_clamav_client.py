import socket
import threading
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest

from lcfs.services.clamav.client import (
    ClamAVService,
    FileTooLargeToScanException,
    ScanUnavailableException,
    VirusScanException,
)


class FakeClamd:
    """
    A localhost socket server that speaks just enough zINSTREAM to stand in
    for clamd. `behaviour` decides what happens after the stream starts.
    """

    def __init__(self, behaviour):
        self.behaviour = behaviour
        self.received = b""
        self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server.bind(("127.0.0.1", 0))
        self.server.listen(1)
        self.port = self.server.getsockname()[1]
        self.thread = threading.Thread(target=self._serve, daemon=True)
        self.thread.start()

    def _serve(self):
        conn, _ = self.server.accept()
        with conn:
            self.behaviour(self, conn)

    def read_stream(self, conn):
        """Read the command and every chunk up to the zero-length terminator."""
        data = b""
        while True:
            chunk = conn.recv(65536)
            if not chunk:
                break
            data += chunk
            if data.endswith(b"\0\0\0\0"):
                break
        self.received = data
        return data

    def close(self):
        self.server.close()
        self.thread.join(timeout=5)


def reply(text):
    def behaviour(fake, conn):
        fake.read_stream(conn)
        conn.sendall(text + b"\0")

    return behaviour


def hang_up_after_first_chunk(fake, conn):
    conn.recv(16)
    conn.close()


def never_reply(fake, conn):
    fake.read_stream(conn)
    threading.Event().wait(2)


@pytest.fixture
def upload():
    file = MagicMock()
    file.file = BytesIO(b"x" * 200_000)
    return file


def scan_with(behaviour, upload, timeout=5):
    fake = FakeClamd(behaviour)
    try:
        with patch("lcfs.services.clamav.client.settings") as settings:
            settings.clamav_host = "127.0.0.1"
            settings.clamav_port = fake.port
            settings.clamav_timeout_seconds = timeout
            return ClamAVService().scan_file(upload), fake
    finally:
        fake.close()


def test_clean_file_passes_and_streams_every_byte(upload):
    result, fake = scan_with(reply(b"stream: OK"), upload)

    assert result == "stream: OK"
    assert fake.received.startswith(b"zINSTREAM\0")
    # Command + 4 byte length prefix per chunk + payload + terminator
    payload = fake.received[len(b"zINSTREAM\0") : -4]
    body, pos = b"", 0
    while pos < len(payload):
        size = int.from_bytes(payload[pos : pos + 4], "big")
        body += payload[pos + 4 : pos + 4 + size]
        pos += 4 + size
    assert body == b"x" * 200_000
    assert upload.file.tell() == 0


def test_virus_is_rejected(upload):
    with pytest.raises(VirusScanException) as exc_info:
        scan_with(reply(b"stream: Win.Test.EICAR_HDB-1 FOUND"), upload)

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == "Viruses detected in file, please upload another"


def test_limit_heuristic_means_too_large_not_virus(upload):
    with pytest.raises(FileTooLargeToScanException) as exc_info:
        scan_with(
            reply(b"stream: Heuristics.Limits.Exceeded.MaxFileSize FOUND"), upload
        )

    assert exc_info.value.status_code == 422
    assert "too large" in exc_info.value.detail


def test_stream_size_limit_error_is_too_large(upload):
    with pytest.raises(FileTooLargeToScanException):
        scan_with(reply(b"INSTREAM size limit exceeded. ERROR"), upload)


def test_other_error_reply_fails_closed(upload):
    with pytest.raises(ScanUnavailableException) as exc_info:
        scan_with(reply(b"stream: Can't allocate memory ERROR"), upload)

    assert exc_info.value.status_code == 503


def test_empty_reply_fails_closed(upload):
    with pytest.raises(ScanUnavailableException):
        scan_with(reply(b""), upload)


def test_hang_up_without_reply_fails_closed(upload):
    # Whether the client sees a broken pipe first depends on socket buffers,
    # so only the outcome is fixed: the upload is refused.
    with pytest.raises((FileTooLargeToScanException, ScanUnavailableException)):
        scan_with(hang_up_after_first_chunk, upload)


def test_stalled_scanner_times_out(upload):
    with pytest.raises(ScanUnavailableException):
        scan_with(never_reply, upload, timeout=0.5)


def test_unreachable_scanner_fails_closed(upload):
    with patch("lcfs.services.clamav.client.settings") as settings:
        settings.clamav_host = "127.0.0.1"
        settings.clamav_port = 1  # Nothing listens here
        settings.clamav_timeout_seconds = 1
        with pytest.raises(ScanUnavailableException):
            ClamAVService().scan_file(upload)


@pytest.mark.anyio
async def test_async_scan_runs_the_same_checks(upload):
    fake = FakeClamd(reply(b"stream: Eicar-Signature FOUND"))
    try:
        with patch("lcfs.services.clamav.client.settings") as settings:
            settings.clamav_host = "127.0.0.1"
            settings.clamav_port = fake.port
            settings.clamav_timeout_seconds = 5
            with pytest.raises(VirusScanException):
                await ClamAVService().scan_file_async(upload)
    finally:
        fake.close()
