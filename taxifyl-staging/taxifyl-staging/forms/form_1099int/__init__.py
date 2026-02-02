"""Form 1099-INT extractor module."""

from .extractor import Form1099INTExtractor
from .config import INT_1099_SYSTEM_PROMPT, INT_1099_DETECTION_PATTERNS

__all__ = ["Form1099INTExtractor", "INT_1099_SYSTEM_PROMPT", "INT_1099_DETECTION_PATTERNS"]
