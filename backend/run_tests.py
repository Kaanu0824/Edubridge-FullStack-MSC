"""
run_tests.py
============
EduBridge full test runner.

Usage:
    python run_tests.py              # run all tests
    python run_tests.py --verbose    # detailed output
    python run_tests.py --suite api  # one suite only (utils|models|api|fusion)
"""

import os
import sys
import time
import argparse
import unittest

# ── Make sure backend root AND tests/ are on the path ─────────────────────────
BASE      = os.path.dirname(os.path.abspath(__file__))
TESTS_DIR = os.path.join(BASE, "tests")

if BASE      not in sys.path: sys.path.insert(0, BASE)
if TESTS_DIR not in sys.path: sys.path.insert(0, TESTS_DIR)

# ── Colour helpers ─────────────────────────────────────────────────────────────
GREEN  = "\033[92m"; RED    = "\033[91m"; YELLOW = "\033[93m"
CYAN   = "\033[96m"; BOLD   = "\033[1m";  RESET  = "\033[0m"

def green(s):  return f"{GREEN}{s}{RESET}"
def red(s):    return f"{RED}{s}{RESET}"
def yellow(s): return f"{YELLOW}{s}{RESET}"
def cyan(s):   return f"{CYAN}{s}{RESET}"
def bold(s):   return f"{BOLD}{s}{RESET}"

# ── Suite registry ─────────────────────────────────────────────────────────────
SUITES = {
    "utils":  ("test_utils",  "Utility Functions     (base64 decode, MFCC, class index)"),
    "models": ("test_models", "ML Model Tests        (face, voice, chatbot inference)"),
    "api":    ("test_api",    "API Endpoint Tests    (all 7 Flask endpoints)"),
    "fusion": ("test_fusion", "Stress Fusion Tests   (formula, boundaries, API integration)"),
}

# ── Runner ─────────────────────────────────────────────────────────────────────
def run_suite(module_name, verbosity=0):
    loader = unittest.TestLoader()
    try:
        suite = loader.loadTestsFromName(module_name)
    except Exception as e:
        print(red(f"  Could not load {module_name}: {e}"))
        return None, 0

    buf = open(os.devnull, "w") if verbosity == 0 else sys.stdout
    runner = unittest.TextTestRunner(verbosity=verbosity, stream=buf)
    start  = time.time()
    result = runner.run(suite)
    return result, time.time() - start

def print_suite_result(name, desc, result, elapsed):
    total   = result.testsRun
    failed  = len(result.failures) + len(result.errors)
    skipped = len(result.skipped)
    passed  = total - failed - skipped
    status  = green("PASS") if failed == 0 else red("FAIL")
    skip_s  = f"  {yellow(str(skipped)+' skipped')}" if skipped else ""

    print(f"  [{status}]  {desc}")
    print(f"          {passed}/{total} passed{skip_s}  ({elapsed:.2f}s)")

    for test, tb in result.failures + result.errors:
        print(red(f"\n    FAILED: {test}"))
        for line in tb.strip().split("\n")[-3:]:
            print(f"      {line}")
    print()

def print_summary(results):
    total_run  = sum(r.testsRun              for r in results if r)
    total_fail = sum(len(r.failures)+len(r.errors) for r in results if r)
    total_skip = sum(len(r.skipped)          for r in results if r)
    total_pass = total_run - total_fail - total_skip

    print(bold("-" * 60))
    print(bold("  Summary"))
    print(bold("-" * 60))
    print(f"  Tests run : {total_run}")
    print(f"  Passed    : {green(str(total_pass))}")
    print(f"  Failed    : {red(str(total_fail))   if total_fail  else '0'}")
    print(f"  Skipped   : {yellow(str(total_skip)) if total_skip else '0'}")
    print()
    if total_fail == 0:
        print(bold(green("  ALL TESTS PASSED")))
    else:
        print(bold(red(f"  {total_fail} TEST(S) FAILED")))
    print(bold("=" * 60))
    print()
    return total_fail == 0

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--verbose", "-v", action="store_true")
    parser.add_argument("--suite",   "-s", choices=list(SUITES.keys()))
    args = parser.parse_args()

    print()
    print(bold("=" * 60))
    print(bold("  EduBridge Test Suite"))
    print(bold("  MSc Software Engineering — University of Hertfordshire"))
    print(bold("=" * 60))
    print()

    to_run   = {args.suite: SUITES[args.suite]} if args.suite else SUITES
    results  = []

    for name, (module, desc) in to_run.items():
        print(cyan(f"  Running: {desc}"))
        result, elapsed = run_suite(module, verbosity=2 if args.verbose else 0)
        if result:
            results.append(result)
            print_suite_result(name, desc, result, elapsed)
        else:
            print(red(f"  Suite '{name}' failed to load.\n"))

    success = print_summary(results)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()