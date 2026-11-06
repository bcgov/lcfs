import structlog
import socket

from starlette.concurrency import run_in_threadpool

from lcfs.settings import settings

logger = structlog.get_logger(__name__)

CHUNK_SIZE = 64 * 1024


class FileScanException(Exception):
    """Base class for scan results that must stop an upload."""

    status_code = 422
    detail = "File could not be scanned, please upload another"

    def __init__(self, message: str | None = None):
        super().__init__(message or self.detail)


class VirusScanException(FileScanException):
    """Custom exception for virus detection."""

    detail = "Viruses detected in file, please upload another"


class FileTooLargeToScanException(FileScanException):
    """clamd stopped before scanning all of the file."""

    detail = (
        "File is too large or complex to scan for viruses, "
        "please upload a smaller file"
    )


class ScanUnavailableException(FileScanException):
    """clamd could not be reached or gave no usable answer."""

    status_code = 503
    detail = "File could not be scanned for viruses right now, please try again later"


class ClamAVService:
    def __init__(self):
        pass

    def scan_file(self, file):
        """
        Stream the file to clamd and fail closed: anything other than a clean
        result raises a FileScanException.
        """
        file.file.seek(0)
        try:
            reply, send_interrupted = self._instream(file.file)
        except OSError as e:
            # Covers refused connections, DNS failures and timeouts
            logger.error("ClamAV scan failed", error=str(e))
            raise ScanUnavailableException(str(e)) from e
        finally:
            file.file.seek(0)

        return self._check_reply(reply, send_interrupted)

    async def scan_file_async(self, file):
        """Run the blocking scan off the event loop."""
        return await run_in_threadpool(self.scan_file, file)

    def _instream(self, stream) -> tuple[str, bool]:
        timeout = settings.clamav_timeout_seconds
        address = (settings.clamav_host, settings.clamav_port)
        with socket.create_connection(address, timeout=timeout) as sock:
            send_interrupted = False
            try:
                sock.sendall(b"zINSTREAM\0")
                while chunk := stream.read(CHUNK_SIZE):
                    sock.sendall(len(chunk).to_bytes(4, byteorder="big") + chunk)
                sock.sendall(b"\0\0\0\0")  # Zero-length chunk ends the stream
            except (BrokenPipeError, ConnectionResetError):
                # clamd hangs up early when a stream limit is hit. Its reply,
                # if one arrived, says why.
                send_interrupted = True
            return self._read_reply(sock), send_interrupted

    @staticmethod
    def _read_reply(sock) -> str:
        data = b""
        while not data.endswith(b"\0"):
            try:
                chunk = sock.recv(4096)
            except ConnectionResetError:
                break
            if not chunk:
                break
            data += chunk
        return data.rstrip(b"\0").decode("utf-8", errors="replace").strip()

    @staticmethod
    def _check_reply(reply: str, send_interrupted: bool = False) -> str:
        if reply.endswith(": OK"):
            return reply

        if reply.endswith(" FOUND"):
            signature = reply.split(": ", 1)[-1].removesuffix(" FOUND")
            if signature.startswith("Heuristics.Limits.Exceeded"):
                logger.error("File exceeded ClamAV scan limits", result=reply)
                raise FileTooLargeToScanException(reply)
            logger.error("Virus detected", result=reply)
            raise VirusScanException(f"Virus detected: {reply}")

        if "size limit exceeded" in reply.lower() or (send_interrupted and not reply):
            logger.error("File exceeded ClamAV stream limit", result=reply)
            raise FileTooLargeToScanException(reply or "stream closed by clamd")

        logger.error("Unexpected ClamAV reply", result=reply)
        raise ScanUnavailableException(f"Unexpected ClamAV reply: {reply!r}")
