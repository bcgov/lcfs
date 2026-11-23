"""
Analyze one VBA project with oletools and print the result as JSON.

Run as its own process (`python -I vba_probe.py < vbaProject.bin`) so that a
hostile file can be killed on a timeout, capped on memory and kept away from
the application's process. It imports nothing from lcfs on purpose: under -I
the application package may not be importable.
"""

import json
import os
import sys
import tempfile

MEMORY_LIMIT_BYTES = 1024**3
CPU_LIMIT_SECONDS = 60


def _limit_resources():
    try:
        import resource

        resource.setrlimit(resource.RLIMIT_CPU, (CPU_LIMIT_SECONDS, CPU_LIMIT_SECONDS))
        resource.setrlimit(resource.RLIMIT_AS, (MEMORY_LIMIT_BYTES, MEMORY_LIMIT_BYTES))
    except (ImportError, ValueError, OSError):
        # Not every platform enforces these (macOS ignores RLIMIT_AS)
        pass


def analyze(path: str) -> dict:
    from oletools.mraptor import MacroRaptor
    from oletools.olevba import VBA_Parser, VBA_Scanner

    parser = VBA_Parser(path, relaxed=False)
    try:
        # Attribute lines are module metadata, not code. Their GUIDs look like
        # hex strings, so scanning them flags every workbook as "encoded".
        modules = [
            _without_attributes(code or "")
            for _, stream_path, _, code in parser.extract_macros()
            if stream_path != "xlm_macro"
        ]
        code = "\n".join(modules)

        scanner = VBA_Scanner(code)
        keywords = [
            {"type": kw_type, "keyword": keyword}
            for kw_type, keyword, _ in scanner.scan(
                include_decoded_strings=False, deobfuscate=False
            )
        ]
        try:
            stomping = bool(parser.detect_vba_stomping())
        except Exception:
            # pcodedmp can't read every project (e.g. some 64-bit VBA7)
            stomping = None

        raptor = MacroRaptor(code)
        raptor.scan()

        return {
            "modules": len([module for module in modules if module.strip()]),
            "keywords": keywords,
            "autoexec": len(scanner.autoexec_keywords),
            "iocs": len(scanner.iocs),
            "encoded_strings": len(scanner.hex_strings)
            + len(scanner.base64_strings)
            + len(scanner.dridex_strings),
            "stomping": stomping,
            "writes_files": bool(raptor.write),
            "runs_programs": bool(raptor.execute),
            "references_projects": _references_other_projects(parser),
        }
    finally:
        parser.close()


def _without_attributes(code: str) -> str:
    return "\n".join(
        line
        for line in code.splitlines()
        if not line.lstrip().lower().startswith("attribute ")
    )


def _references_other_projects(parser) -> bool:
    """A REFERENCEPROJECT record in the dir stream loads code from another file."""
    from oletools.olevba import decompress_stream

    oles = [parser.ole_file] + [
        sub.ole_file for sub in (parser.ole_subfiles or []) if sub.ole_file
    ]
    for ole in oles:
        if ole is None:
            continue
        for path in ole.listdir():
            if path[-1].lower() != "dir":
                continue
            data = decompress_stream(bytearray(ole.openstream(path).read()))
            pos = 0
            while pos + 6 <= len(data):
                record_id = int.from_bytes(data[pos : pos + 2], "little")
                size = int.from_bytes(data[pos + 2 : pos + 6], "little")
                if record_id == 0x000E:  # REFERENCEPROJECT
                    return True
                # PROJECTVERSION's size field is fixed at 4 but it carries 6 bytes
                pos += 6 + (6 if record_id == 0x0009 else size)
    return False


def main() -> int:
    _limit_resources()
    data = sys.stdin.buffer.read()
    with tempfile.TemporaryDirectory() as workdir:
        # oletools can only check for stomping on a file on disk
        path = os.path.join(workdir, "vbaProject.bin")
        with open(path, "wb") as f:
            f.write(data)
        try:
            result = analyze(path)
        except Exception as e:
            result = {"error": f"{type(e).__name__}: {e}"}
    sys.stdout.write(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
