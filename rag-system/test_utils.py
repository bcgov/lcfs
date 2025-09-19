#!/usr/bin/env python3
"""Test script to validate extracted utils functionality."""

import sys
from pathlib import Path

# Add utils to path
utils_path = Path(__file__).parent / "utils"
sys.path.insert(0, str(utils_path))

def test_imports():
    """Test that all utils can be imported."""
    print("🧪 Testing utils imports...")

    try:
        from document_stores import create_document_store
        from models import load_text_embedder
        from document_processing import load_documents
        from openai_adapter import run_openai_chat
        from config import get_env_config
        from pipeline_builder import build_hybrid_pipeline
        from progress_logging import log_success

        print("✅ All utils imported successfully")
        return True

    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False

def test_config():
    """Test configuration utilities."""
    print("🧪 Testing config utilities...")

    try:
        from config import get_env_config, validate_config

        config = get_env_config()
        is_valid = validate_config(config)

        print(f"✅ Config loaded with {len(config)} settings")
        print(f"✅ Config validation: {'passed' if is_valid else 'failed'}")
        return True

    except Exception as e:
        print(f"❌ Config test failed: {e}")
        return False

def test_document_store():
    """Test document store creation."""
    print("🧪 Testing document store creation...")

    try:
        from document_stores import create_document_store, create_bm25_store

        # Test in-memory store (should always work)
        store, is_persistent = create_document_store("memory")
        bm25_store = create_bm25_store()

        print(f"✅ Document stores created (persistent: {is_persistent})")
        return True

    except Exception as e:
        print(f"❌ Document store test failed: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return False

def test_openai_adapter():
    """Test OpenAI adapter utilities."""
    print("🧪 Testing OpenAI adapter...")

    try:
        from openai_adapter import validate_openai_messages, extract_user_query, estimate_tokens

        # Test message validation
        valid_messages = [{"role": "user", "content": "test"}]
        invalid_messages = [{"role": "invalid"}]

        assert validate_openai_messages(valid_messages) == True
        assert validate_openai_messages(invalid_messages) == False

        # Test query extraction
        query = extract_user_query(valid_messages)
        assert query == "test"

        # Test token estimation
        tokens = estimate_tokens(valid_messages)
        assert tokens > 0

        print("✅ OpenAI adapter utilities working")
        return True

    except Exception as e:
        print(f"❌ OpenAI adapter test failed: {e}")
        return False

def test_logging():
    """Test logging utilities."""
    print("🧪 Testing logging utilities...")

    try:
        from progress_logging import log_progress, log_success, log_error, log_header

        log_header("Testing logging functions")
        log_progress("Progress message test")
        log_success("Success message test")
        log_error("Error message test (this is a test)")

        print("✅ Logging utilities working")
        return True

    except Exception as e:
        print(f"❌ Logging test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🚀 Starting utils validation tests...\n")

    tests = [
        ("Import Test", test_imports),
        ("Config Test", test_config),
        ("Document Store Test", test_document_store),
        ("OpenAI Adapter Test", test_openai_adapter),
        ("Logging Test", test_logging),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n--- {test_name} ---")
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")

    print(f"\n🎯 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All utils validation tests passed! Utils are ready for use.")
        return True
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)