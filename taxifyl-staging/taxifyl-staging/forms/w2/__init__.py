"""W-2 Form extractor module."""

from .extractor import W2Extractor
from .config import W2_SYSTEM_PROMPT, W2_DETECTION_PATTERNS

__all__ = ["W2Extractor", "W2_SYSTEM_PROMPT", "W2_DETECTION_PATTERNS"]
