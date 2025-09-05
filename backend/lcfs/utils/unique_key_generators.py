from typing import Optional

ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def base36_to_int(s: str) -> int:
    s = s.strip().upper()
    if not s:
        raise ValueError("Empty base-36 string.")
    n = 0
    for ch in s:
        try:
            v = ALPHABET.index(ch)
        except ValueError:
            raise ValueError(f"Invalid base-36 character: {ch!r}") from None
        n = n * 36 + v
    return n


def int_to_base36(n: int) -> str:
    if n < 0:
        raise ValueError("Negative values are not supported.")
    if n == 0:
        return "0"
    s = ""
    while n:
        n, r = divmod(n, 36)
        s = ALPHABET[r] + s
    return s


def next_base36(current: Optional[str], width: int = 5) -> str:
    """
    Return the next base-36 code after `current`, zero-padded to `width`.
    - If `current` is None/blank: returns 00001.
    - Raises OverflowError if the next value exceeds the width's capacity.
    """
    max_n = 36**width - 1
    if not current:  # None or ""
        n = 1  # start at 00001
    else:
        n = base36_to_int(current) + 1

    if n > max_n:
        raise OverflowError(f"Exceeded maximum base-36 value for width={width}.")

    return int_to_base36(n).zfill(width)
