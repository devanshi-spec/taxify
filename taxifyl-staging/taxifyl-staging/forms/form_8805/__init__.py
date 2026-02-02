"""
Form 8805 Module
================
Extracts data from Form 8805 (Foreign Partner's Information Statement).
"""

from .extractor import Form8805Extractor, MultiPage8805Processor

__all__ = ["Form8805Extractor", "MultiPage8805Processor"]
