"""
Form K-3 Module
================
Schedule K-3 (Form 1065) Partner's Share of International Tax Information.
"""

from .extractor import FormK3Extractor, MultiPageK3Processor
from .config import K3_1065_SYSTEM_PROMPT, K3_DETECTION_PATTERNS

__all__ = [
    "FormK3Extractor",
    "MultiPageK3Processor", 
    "K3_1065_SYSTEM_PROMPT",
    "K3_DETECTION_PATTERNS"
]
