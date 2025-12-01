#!/usr/bin/env python3
"""
Health check script for SMPL processing container
Verifies that all required dependencies and models are available
"""
import sys
import os

def check_dependencies():
    """Check that all required Python packages are importable"""
    required_packages = [
        'torch', 'torchvision', 'cv2', 'numpy', 'scipy',
        'PIL', 'skimage', 'boto3', 'yaml', 'smplx'
    ]
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✓ {package} available")
        except ImportError as e:
            print(f"✗ {package} missing: {e}")
            return False
    return True

def check_model_paths():
    """Check that SMPL model directories exist"""
    model_paths = [
        '/app/models/smpl',
        '/app/weights',
        '/app/configs'
    ]
    
    for path in model_paths:
        if os.path.exists(path):
            print(f"✓ {path} exists")
        else:
            print(f"✗ {path} missing")
            return False
    return True

if __name__ == '__main__':
    if check_dependencies() and check_model_paths():
        print("Health check passed")
        sys.exit(0)
    else:
        print("Health check failed")
        sys.exit(1)