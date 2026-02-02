"""Forms module - contains form-specific extractors."""

from .w2 import W2Extractor
from .form_1099int import Form1099INTExtractor
from .form_k1 import FormK1Extractor
from .form_k3 import FormK3Extractor, MultiPageK3Processor
from .form_8805 import Form8805Extractor, MultiPage8805Processor
from .form_8804 import Form8804Extractor, MultiPage8804Processor

__all__ = [
    "W2Extractor", 
    "Form1099INTExtractor", 
    "FormK1Extractor",
    "FormK3Extractor",
    "MultiPageK3Processor",
    "Form8805Extractor",
    "MultiPage8805Processor",
    "Form8804Extractor",
    "MultiPage8804Processor"
]

