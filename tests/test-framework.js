/**
 * CosyUI - Zero-Dependency Test Framework
 * Dual-environment (Node.js & Browser) test runner with deep assertions.
 */

export class CosyTestRunner {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  describe(name, fn) {
    const suite = { name, tests: [] };
    this.suites.push(suite);
    this.currentSuite = suite;
    fn();
    this.currentSuite = null;
  }

  it(name, fn) {
    if (this.currentSuite) {
      this.currentSuite.tests.push({ name, fn });
    }
  }

  assertEqual(actual, expected, msg = '') {
    if (actual !== expected) {
      throw new Error(`${msg} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  assertDeepEqual(actual, expected, msg = '') {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) {
      throw new Error(`${msg} Expected deep equality: \nExpected: ${b}\nActual:   ${a}`);
    }
  }

  assertTrue(val, msg = '') {
    if (!val) {
      throw new Error(`${msg} Expected truthy value, got ${val}`);
    }
  }

  assertFalse(val, msg = '') {
    if (val) {
      throw new Error(`${msg} Expected falsy value, got ${val}`);
    }
  }

  assertApprox(actual, expected, tolerance = 0.001, msg = '') {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`${msg} Value ${actual} is not within ${tolerance} of ${expected}`);
    }
  }

  async runAll() {
    console.log('\n===========================================');
    console.log('⚡ CosyUI Test Suite Execution');
    console.log('===========================================\n');

    const startTime = Date.now();
    for (const suite of this.suites) {
      console.log(`\n📦 Suite: ${suite.name}`);
      for (const test of suite.tests) {
        try {
          await test.fn();
          this.passed++;
          console.log(`  ✅ ${test.name}`);
        } catch (err) {
          this.failed++;
          console.error(`  ❌ ${test.name}`);
          console.error(`     Error: ${err.message}`);
          this.errors.push({ suite: suite.name, test: test.name, error: err });
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log('\n-------------------------------------------');
    console.log(`Results: ${this.passed} Passed, ${this.failed} Failed (${duration}ms)`);
    console.log('-------------------------------------------\n');

    return {
      passed: this.passed,
      failed: this.failed,
      duration,
      errors: this.errors
    };
  }
}
