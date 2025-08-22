#!/usr/bin/env python3
"""
PII Scanner for Documentation

Scans markdown files for personally identifiable information patterns
and fails CI if new violations are detected.
"""

import os
import re
import sys
import json
from pathlib import Path

# PII patterns to detect
PII_PATTERNS = {
    'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    'us_phone': r'(\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})',
    'ssn': r'\b\d{3}-\d{2}-\d{4}\b',
    'credit_card': r'\b(?:\d{4}[-\s]?){3}\d{4}\b',
}

# Allowed patterns (test/example data)
ALLOWED_PATTERNS = [
    r'example@example\.com',
    r'test@test\.com',
    r'user@domain\.com',
    r'\+1234567890',  # Obviously fake number
    r'\+1555[0-9]{7}',  # 555 area code (fake)
    r'123-456-7890',  # Obviously fake format
]

def is_allowed_pattern(text):
    """Check if the detected PII is an allowed test pattern."""
    for pattern in ALLOWED_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False

def scan_file(file_path):
    """Scan a single file for PII patterns."""
    violations = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        for line_num, line in enumerate(content.split('\n'), 1):
            for pii_type, pattern in PII_PATTERNS.items():
                matches = re.finditer(pattern, line, re.IGNORECASE)
                for match in matches:
                    matched_text = match.group()
                    if not is_allowed_pattern(matched_text):
                        violations.append({
                            'file': str(file_path),
                            'line': line_num,
                            'type': pii_type,
                            'text': matched_text,
                            'context': line.strip()[:100]
                        })
                        
    except Exception as e:
        print(f"Error scanning {file_path}: {e}")
        
    return violations

def load_baseline():
    """Load existing PII baseline to allow grandfathered violations."""
    baseline_file = Path('.github/pii-baseline.json')
    if baseline_file.exists():
        with open(baseline_file, 'r') as f:
            return json.load(f)
    return []

def save_baseline(violations):
    """Save current violations as baseline."""
    baseline_file = Path('.github/pii-baseline.json')
    with open(baseline_file, 'w') as f:
        json.dump(violations, f, indent=2)

def main():
    """Main PII scanning function."""
    print("🔍 Scanning documentation for PII patterns...")
    
    # Find all markdown files
    md_files = []
    for root, dirs, files in os.walk('.'):
        # Skip node_modules, .next, .git
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
        
        for file in files:
            if file.endswith('.md'):
                md_files.append(Path(root) / file)
    
    print(f"📄 Found {len(md_files)} markdown files")
    
    # Scan all files
    all_violations = []
    for file_path in md_files:
        violations = scan_file(file_path)
        all_violations.extend(violations)
    
    # Load baseline
    baseline_violations = load_baseline()
    baseline_signatures = {
        f"{v['file']}:{v['line']}:{v['type']}:{v['text']}"
        for v in baseline_violations
    }
    
    # Check for new violations
    new_violations = []
    for violation in all_violations:
        signature = f"{violation['file']}:{violation['line']}:{violation['type']}:{violation['text']}"
        if signature not in baseline_signatures:
            new_violations.append(violation)
    
    # Report results
    if all_violations:
        print(f"\n⚠️  Found {len(all_violations)} total PII patterns:")
        for violation in all_violations:
            status = "NEW" if violation in new_violations else "EXISTING"
            print(f"  [{status}] {violation['file']}:{violation['line']} - {violation['type']}: {violation['text']}")
    
    if new_violations:
        print(f"\n❌ FAILURE: {len(new_violations)} new PII violations detected!")
        print("\nNew violations:")
        for violation in new_violations:
            print(f"  📍 {violation['file']}:{violation['line']}")
            print(f"     Type: {violation['type']}")
            print(f"     Text: {violation['text']}")
            print(f"     Context: {violation['context']}")
            print()
        
        print("To fix:")
        print("1. Remove or redact the PII from the files above")
        print("2. Use obviously fake data (e.g., +1234567890, example@example.com)")
        print("3. If this is legitimate test data, add it to ALLOWED_PATTERNS")
        
        sys.exit(1)
    
    if all_violations:
        print(f"\n✅ All {len(all_violations)} PII patterns are grandfathered (existed in baseline)")
    else:
        print("\n✅ No PII patterns detected!")
    
    # Update baseline if running in update mode
    if '--update-baseline' in sys.argv:
        save_baseline(all_violations)
        print("📝 Updated PII baseline")

if __name__ == '__main__':
    main()
