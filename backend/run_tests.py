import os
import sys
import time
import argparse
import unittest

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

# ── Colour output ──────────────────────────────────────────────────────────────

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def green(s):  return f"{GREEN}{s}{RESET}"
def red(s):    return f"{RED}{s}{RESET}"
def yellow(s): return f"{YELLOW}{s}{RESET}"
def cyan(s):   return f"{CYAN}{s}{RESET}"
def bold(s):   return f"{BOLD}{s}{RESET}"


# ── Suites ─────────────────────────────────────────────────────────────────────

SUITES = {
    "utils":  "tests.test_utils",
    "models": "tests.test_models",
    "api":    "tests.test_api",
    "fusion": "tests.test_fusion",
}

SUITE_DESCRIPTIONS = {
    "utils":  "Utility Functions     (base64 decode, MFCC, class index)",
    "models": "ML Model Tests        (face, voice, chatbot inference)",
    "api":    "API Endpoint Tests    (all 7 Flask endpoints)",
    "fusion": "Stress Fusion Tests   (formula, boundaries, API integration)",
}


# ── Runner ─────────────────────────────────────────────────────────────────────

def run_suite(module_name, verbosity=1):
    """Load and run a single test suite. Returns (result, elapsed_seconds)."""
    loader = unittest.TestLoader()
    try:
        suite = loader.loadTestsFromName(module_name)
    except Exception as e:
        print(red(f"  Failed to load {module_name}: {e}"))
        return None, 0

    runner = unittest.TextTestRunner(
        verbosity=verbosity,
        stream=open(os.devnull, "w") if verbosity == 0 else sys.stdout
    )

    start = time.time()
    result = runner.run(suite)
    elapsed = time.time() - start

    return result, elapsed


def print_header():
    print()
    print(bold("=" * 60))
    print(bold("  EduBridge Test Suite"))
    print(bold("  MSc Software Engineering — University of Hertfordshire"))
    print(bold("=" * 60))
    print()


def print_suite_result(name, result, elapsed):
    desc    = SUITE_DESCRIPTIONS.get(name, name)
    total   = result.testsRun
    failed  = len(result.failures) + len(result.errors)
    skipped = len(result.skipped)
    passed  = total - failed - skipped

    status = green("PASS") if failed == 0 else red("FAIL")
    skip_str = f"  {yellow(f'{skipped} skipped')}" if skipped > 0 else ""

    print(f"  [{status}]  {desc}")
    print(f"          {passed}/{total} passed{skip_str}  ({elapsed:.2f}s)")

    if result.failures:
        for test, traceback in result.failures:
            print(red(f"\n    FAILED: {test}"))
            # Print just the last line of the traceback for brevity
            lines = traceback.strip().split("\n")
            for line in lines[-3:]:
                print(f"      {line}")

    if result.errors:
        for test, traceback in result.errors:
            print(red(f"\n    ERROR: {test}"))
            lines = traceback.strip().split("\n")
            for line in lines[-3:]:
                print(f"      {line}")

    print()


def print_summary(results):
    total_tests   = sum(r.testsRun for r in results.values() if r)
    total_failed  = sum(len(r.failures) + len(r.errors) for r in results.values() if r)
    total_skipped = sum(len(r.skipped) for r in results.values() if r)
    total_passed  = total_tests - total_failed - total_skipped

    print(bold("-" * 60))
    print(bold("  Summary"))
    print(bold("-" * 60))
    print(f"  Tests run:    {total_tests}")
    print(f"  Passed:       {green(str(total_passed))}")
    print(f"  Failed:       {red(str(total_failed))   if total_failed  > 0 else '0'}")
    print(f"  Skipped:      {yellow(str(total_skipped)) if total_skipped > 0 else '0'}")
    print()

    if total_failed == 0:
        print(bold(green("  ALL TESTS PASSED")))
    else:
        print(bold(red(f"  {total_failed} TEST(S) FAILED")))

    print(bold("=" * 60))
    print()

    return total_failed == 0


def main():
    parser = argparse.ArgumentParser(description="EduBridge test runner")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Show detailed test output")
    parser.add_argument("--suite", "-s", choices=list(SUITES.keys()),
                        help="Run a single suite only")
    args = parser.parse_args()

    verbosity = 2 if args.verbose else 0

    print_header()

    suites_to_run = {args.suite: SUITES[args.suite]} if args.suite else SUITES
    results = {}

    for name, module in suites_to_run.items():
        print(cyan(f"  Running: {SUITE_DESCRIPTIONS.get(name, name)}"))
        result, elapsed = run_suite(module, verbosity=verbosity)
        if result:
            results[name] = result
            print_suite_result(name, result, elapsed)
        else:
            print(red(f"  Suite '{name}' could not be loaded.\n"))

    success = print_summary(results)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
