const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(relPath, imports = {}) {
  const filename = path.resolve(__dirname, relPath);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(
    (key) => imports[key] ?? require(key),
    module,
    module.exports
  );
  return module.exports;
}

const q = loadTs('../src/components/delivery/quantityHelper.ts');

test('validateQuantity: valid positive integers from 1 up to 2147483647', () => {
  assert.deepEqual(q.validateQuantity('1'), { valid: true, value: 1 });
  assert.deepEqual(q.validateQuantity(' 5 '), { valid: true, value: 5 });
  assert.deepEqual(q.validateQuantity('100'), { valid: true, value: 100 });
  assert.deepEqual(q.validateQuantity('2147483647'), { valid: true, value: 2147483647 });
});

test('validateQuantity: rejects empty, null, or whitespace-only', () => {
  assert.equal(q.validateQuantity('').valid, false);
  assert.equal(q.validateQuantity('   ').valid, false);
});

test('validateQuantity: rejects 0 and negative numbers', () => {
  const zero = q.validateQuantity('0');
  assert.equal(zero.valid, false);
  assert.match(zero.error, /Số lượng tối thiểu là 1/);

  const doubleZero = q.validateQuantity('00');
  assert.equal(doubleZero.valid, false);

  const negative = q.validateQuantity('-1');
  assert.equal(negative.valid, false);
  assert.match(negative.error, /Số lượng phải lớn hơn 0/);
});

test('validateQuantity: rejects decimals (1.5, 2,0)', () => {
  const decDot = q.validateQuantity('1.5');
  assert.equal(decDot.valid, false);
  assert.match(decDot.error, /Số lượng phải là số nguyên/);

  const decComma = q.validateQuantity('2,5');
  assert.equal(decComma.valid, false);
  assert.match(decComma.error, /Số lượng phải là số nguyên/);
});

test('validateQuantity: rejects scientific notation (1e3), hex (0x10), and letters', () => {
  assert.equal(q.validateQuantity('1e3').valid, false);
  assert.equal(q.validateQuantity('0x10').valid, false);
  assert.equal(q.validateQuantity('abc').valid, false);
  assert.equal(q.validateQuantity('5kg').valid, false);
});

test('validateQuantity: rejects overflow beyond 2147483647', () => {
  const overflow = q.validateQuantity('2147483648');
  assert.equal(overflow.valid, false);
  assert.match(overflow.error, /vượt quá giới hạn/);

  const huge = q.validateQuantity('99999999999999999999');
  assert.equal(huge.valid, false);
});

test('incrementQuantity and decrementQuantity handle limits and rapid changes accurately', () => {
  assert.equal(q.incrementQuantity('1'), '2');
  assert.equal(q.incrementQuantity('99'), '100');
  // At limit, does not overflow
  assert.equal(q.incrementQuantity('2147483647'), '2147483647');

  assert.equal(q.decrementQuantity('5'), '4');
  assert.equal(q.decrementQuantity('2'), '1');
  // At limit 1, does not decrease further
  assert.equal(q.decrementQuantity('1'), '1');

  // Fallback for invalid input
  assert.equal(q.incrementQuantity('invalid'), '1');
  assert.equal(q.decrementQuantity('invalid'), '1');
});

test('normalizeQuantityOnCommit removes leading zeros for valid numbers', () => {
  assert.equal(q.normalizeQuantityOnCommit('05'), '5');
  assert.equal(q.normalizeQuantityOnCommit('0012'), '12');
  assert.equal(q.normalizeQuantityOnCommit(' 7 '), '7');
  // Leaves invalid unchanged for user to edit
  assert.equal(q.normalizeQuantityOnCommit('abc'), 'abc');
});

test('getItemCategoryAndUnit correctly maps task types to category and Vietnamese unit', () => {
  assert.deepEqual(q.getItemCategoryAndUnit(['van_chuyen_thuoc']), {
    category: 'MEDICATION',
    unit: 'Hộp',
  });
  assert.deepEqual(q.getItemCategoryAndUnit(['van_chuyen_mau']), {
    category: 'LAB_SAMPLE',
    unit: 'Ống nghiệm',
  });
  assert.deepEqual(q.getItemCategoryAndUnit(['van_chuyen_vat_tu']), {
    category: 'SUPPLIES',
    unit: 'Gói',
  });
  assert.deepEqual(q.getItemCategoryAndUnit(['van_chuyen_tai_lieu']), {
    category: 'DOCUMENT',
    unit: 'Bộ',
  });
  assert.deepEqual(q.getItemCategoryAndUnit([]), {
    category: 'DOCUMENT',
    unit: 'Bộ',
  });
});
