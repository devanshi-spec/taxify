"""Form K-1 (Schedule K-1 Form 1065) extractor module."""

from .extractor import FormK1Extractor
from .config import K1_1065_SYSTEM_PROMPT, K1_DETECTION_PATTERNS

__all__ = ["FormK1Extractor", "K1_1065_SYSTEM_PROMPT", "K1_DETECTION_PATTERNS"]
