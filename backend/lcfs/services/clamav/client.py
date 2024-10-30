import structlog
import socket

from lcfs.settings import settings

logger = structlog.get_logger(__name__)


class VirusScanException(Exception):
    """Custom exception for virus detection."""

    pass


class ClamAVService:
    def __init__(self):
        pass

    def scan_file(self, file):
        # Create a socket connection to ClamAV

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.connect((settings.clamav_host, settings.clamav_port))
            sock.sendall(b"zINSTREAM\0")  # Initiate the INSTREAM scan

            # Reset file pointer and send the file in chunks to ClamAV
            file.file.seek(0)
            while True:
                chunk = file.file.read(1024)
                if not chunk:
                    break
                size = len(chunk).to_bytes(4, byteorder="big")
                sock.sendall(size + chunk)

            sock.sendall(b"\0\0\0\0")  # Send a zero-length chunk to signal end

            # Read ClamAV's response
            response = sock.recv(1024)
            result = response.decode("utf-8").strip()

            # Reset file pointer after scan
            file.file.seek(0)

            # Check the response for virus detection
            if "FOUND" in result:
                logger.error(
                    "Virus detected",
                    result=result,
                )
                raise VirusScanException(f"Virus detected: {result}")

        return result
