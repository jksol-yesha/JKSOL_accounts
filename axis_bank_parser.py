import re
from typing import Dict, Optional

class AxisBankCorporateParser:
    """
    Parser for extracting metadata from Axis Bank corporate account statements.
    """
    def __init__(self, text: str):
        self.text = text
        self.normalized_text = self._normalize_whitespace(text)

    def _normalize_whitespace(self, text: str) -> str:
        """Replace multiple spaces and newlines with a single space."""
        return re.sub(r'\s+', ' ', text).strip()

    def extract_metadata(self) -> Dict[str, Optional[str]]:
        """Extract all required metadata fields from the statement text."""
        return {
            "bank_name": "AXIS_BANK",
            "account_holder_name": self._extract_account_holder_name(),
            "ifsc_code": self._extract_ifsc_code(),
            "opening_balance": self._extract_opening_balance()
        }

    def _extract_account_holder_name(self) -> Optional[str]:
        """
        Extract account holder name which typically appears after 
        'Account Statement Report' and before 'Joint Holder' or 'Address'.
        """
        # Looking for the text between 'Account Statement Report' and 'Joint Holder' or 'Address'
        pattern = r'Account\s*Statement\s*Report\s*(.*?)(?:Joint\s*Holder|Address|Branch|Account\s*No)'
        match = re.search(pattern, self.normalized_text, re.IGNORECASE)
        
        if match:
            name = match.group(1).strip()
            # If we matched but the string is empty, return None
            if name:
                return name
        return None

    def _extract_ifsc_code(self) -> Optional[str]:
        """
        Extract IFSC code, tolerant to OCR spacing, missing colons, and case differences.
        Axis Bank IFSC codes start with UTIB followed by 7 characters.
        """
        # Pattern: IFSC Code : UTIB0000848
        # Allows optional 'Code', optional colon, flexible whitespace
        pattern = r'IFSC\s*(?:Code)?\s*:?\s*([A-Za-z]{4}0[A-Za-z0-9]{6})'
        match = re.search(pattern, self.normalized_text, re.IGNORECASE)
        
        if match:
            return match.group(1).upper()
        return None

    def _extract_opening_balance(self) -> Optional[str]:
        """
        Extract opening balance, tolerant to missing 'INR', missing colons, and OCR issues.
        """
        # Try finding it with INR first: Opening Balance: INR 15,88,289.60
        pattern_with_inr = r'Opening\s*Balance\s*:?\s*(INR\s*[\d,]+\.\d{2})'
        match = re.search(pattern_with_inr, self.normalized_text, re.IGNORECASE)
        
        if match:
            # Normalize internal spaces in INR x,xxx.xx to INR x,xxx.xx
            val = match.group(1)
            val = re.sub(r'INR\s+', 'INR ', val, flags=re.IGNORECASE)
            return val.upper()
            
        # Try finding it without INR: Opening Balance: 15,88,289.60
        pattern_without_inr = r'Opening\s*Balance\s*:?\s*([\d,]+\.\d{2})'
        match = re.search(pattern_without_inr, self.normalized_text, re.IGNORECASE)
        
        if match:
            return f"INR {match.group(1)}"
            
        return None

def parse_axis_bank_statement(text: str) -> Dict[str, Optional[str]]:
    """
    Main entry point for parsing an Axis Bank statement.
    """
    parser = AxisBankCorporateParser(text)
    return parser.extract_metadata()
