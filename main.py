#!/usr/bin/env python3
import sys
import os

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.engine.auditor import CodeAuditor

def main():
    # If a target directory is provided, use it. Otherwise, audit the current directory.
    target = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    # Initialize and run the auditor
    auditor = CodeAuditor(target)
    auditor.run()

if __name__ == "__main__":
    main()
