"""
History Manager Service
=======================
Manages persistence of extracted form history using Supabase database.
"""

import os
from datetime import datetime, timezone
from typing import List, Optional
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Table name
EXTRACTIONS_TABLE = "extractions"


class HistoryManager:
    """Manages form extraction history persistence in Supabase."""
    
    def __init__(self):
        """Initialize the history manager with Supabase client."""
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    def save_entry(
        self,
        filename: str,
        form_types: List[str],
        extracted_forms: List[dict],
        usage: Optional[dict] = None
    ) -> dict:
        """
        Save a new extraction entry to Supabase.
        
        Args:
            filename: Original filename of the document
            form_types: List of form types detected (e.g., ["W-2", "1099-INT"])
            extracted_forms: List of extracted form data objects
            usage: Optional API usage metadata
        
        Returns:
            The saved history entry
        """
        entry = {
            "filename": filename,
            "form_types": form_types,
            "total_forms_extracted": len(extracted_forms),
            "extracted_forms": extracted_forms,
            "usage": usage
        }
        
        result = self.supabase.table(EXTRACTIONS_TABLE).insert(entry).execute()
        
        if result.data:
            return result.data[0]
        return entry
    
    def get_history(self, limit: int = 50) -> List[dict]:
        """
        Get extraction history from Supabase, sorted by most recent first.
        
        Args:
            limit: Maximum number of entries to return (default 50)
        
        Returns:
            List of history entries
        """
        result = self.supabase.table(EXTRACTIONS_TABLE) \
            .select("*") \
            .order("extracted_at", desc=True) \
            .limit(limit) \
            .execute()
        
        # Convert to camelCase for API response consistency
        files = []
        for row in result.data or []:
            files.append({
                "id": row.get("id"),
                "filename": row.get("filename"),
                "extractedAt": row.get("extracted_at"),
                "formTypes": row.get("form_types", []),
                "totalFormsExtracted": row.get("total_forms_extracted", 0),
                "extractedForms": row.get("extracted_forms", []),
                "usage": row.get("usage")
            })
        
        return files
    
    def clear_history(self) -> None:
        """Clear all history entries (use with caution)."""
        self.supabase.table(EXTRACTIONS_TABLE).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()


# Singleton instance
history_manager = HistoryManager()

