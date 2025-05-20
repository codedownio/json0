// DEPRECATED!
//
// This type works, but is not exported. Its included here because the JSON0
// embedded string operations use this library.


// A simple text implementation
//
// Operations are lists of components. Each component either inserts or deletes
// at a specified position in the document.
//
// Components are either:
//  {i:'str', p:100}: Insert 'str' at position 100 in the document
//  {d:'str', p:100}: Delete 'str' at position 100 in the document
//
// Components in an operation are executed sequentially, so the position of components
// assumes previous components have already executed.
//
// Eg: This op:
//   [{i:'abc', p:0}]
// is equivalent to this op:
//   [{i:'a', p:0}, {i:'b', p:1}, {i:'c', p:2}]

var text = module.exports = {
  name: 'text0',
  uri: 'http://sharejs.org/types/textv0',
  create: function(initial) {
    if ((initial != null) && typeof initial !== 'string') {
      throw new Error('Initial data must be a string');
    }
    return initial || '';
  }
};

/** Insert s2 into s1 at pos. */
text.strInject = function(s1, pos, s2) {
  // Quick check if we might have surrogate pairs
  const hasSurrogatePairs = /[\uD800-\uDFFF]/.test(s1);

  if (!hasSurrogatePairs) {
    // No surrogate pairs, use the original fast method
    return s1.slice(0, pos) + s2 + s1.slice(pos);
  }

  // For strings with surrogate pairs, we need to map character position to code unit position
  const charArray = [...s1];

  if (pos < 0 || pos > charArray.length) {
    throw new Error('Position out of bounds');
  }

  if (pos === 0) return s2 + s1;
  if (pos === charArray.length) return s1 + s2;

  // Find the code unit position for the given character position
  let codeUnitPos = 0;
  for (let i = 0; i < pos; i++) {
    // For surrogate pairs, add 2; for regular chars, add 1
    const code = s1.charCodeAt(codeUnitPos);
    codeUnitPos += (code >= 0xD800 && code <= 0xDBFF) ? 2 : 1;
  }

  return s1.slice(0, codeUnitPos) + s2 + s1.slice(codeUnitPos);
};

/** Delete string d from snapshot at p. */
var strDelete = function(snapshot, p, d) {
  // Quick check if surrogate pairs exist in either the snapshot or the delete text
  const hasSurrogatePairs = /[\uD800-\uDFFF]/.test(snapshot) || /[\uD800-\uDFFF]/.test(d);

  if (!hasSurrogatePairs) {
    // ASCII-only fast path
    let deleted = snapshot.slice(p, p + d.length);
    if (d !== deleted)
      throw new Error("Delete component '" + d + "' does not match deleted text '" + deleted + "'");

    return snapshot.slice(0, p) + snapshot.slice(p + d.length);
  }

  // Unicode-aware path
  const snapshotChars = [...snapshot];
  const deleteChars = [...d];

  if (p < 0 || p + deleteChars.length > snapshotChars.length) {
    throw new Error("Delete position out of bounds");
  }

  // Convert character position p to code unit position
  let codeUnitPos = 0;
  for (let i = 0; i < p; i++) {
    const code = snapshot.charCodeAt(codeUnitPos);
    codeUnitPos += (code >= 0xD800 && code <= 0xDBFF) ? 2 : 1;
  }

  // Calculate the end position in code units
  let endCodeUnitPos = codeUnitPos;
  for (let i = 0; i < deleteChars.length; i++) {
    const code = snapshot.charCodeAt(endCodeUnitPos);
    endCodeUnitPos += (code >= 0xD800 && code <= 0xDBFF) ? 2 : 1;
  }

  // Extract the text to be deleted
  let deleted = snapshot.slice(codeUnitPos, endCodeUnitPos);

  // Verify if deleted text matches the expected text
  if ([...deleted].join('') !== [...d].join('')) {
    throw new Error("Delete component '" + d + "' does not match deleted text '" + deleted + "'");
  }

  // Perform the deletion
  return snapshot.slice(0, codeUnitPos) + snapshot.slice(endCodeUnitPos);
};

text.unicodeLength = function(str) {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i);
    // If this is a high surrogate, skip the next code unit
    if (code > 0xFFFF) {
      i++;
    }
    count++;
  }
  return count;
};

/**
 * Slices a string by Unicode code points rather than UTF-16 code units.
 *
 * @param {string} str - The string to slice
 * @param {number} start - The starting code point position (inclusive)
 * @param {number} [end] - The ending code point position (exclusive), defaults to end of string
 * @return {string} The sliced substring
 */
text.unicodeSlice = function(str, start, end) {
  // Quick check if the string contains surrogate pairs
  const hasSurrogatePairs = /[\uD800-\uDFFF]/.test(str);

  // If no surrogate pairs, use the faster native slice
  if (!hasSurrogatePairs) {
    return str.slice(start, end);
  }

  // Convert to array of Unicode code points
  const chars = [...str];

  // Default end to array length if not provided
  if (end === undefined) {
    end = chars.length;
  }

  // Normalize negative indices
  if (start < 0) {
    start = Math.max(chars.length + start, 0);
  }

  if (end < 0) {
    end = Math.max(chars.length + end, 0);
  }

  // Ensure start and end are within bounds
  start = Math.min(start, chars.length);
  end = Math.min(end, chars.length);

  // If start > end, don't swap them - return empty string
  // This matches JavaScript's native behavior
  if (start > end) {
    return '';
  }

  // Return the sliced substring
  return chars.slice(start, end).join('');
};

/** Check that an operation component is valid. Throws if its invalid. */
var checkValidComponent = function(c) {
  if (typeof c.p !== 'number')
    throw new Error('component missing position field');

  if ((typeof c.i === 'string') === (typeof c.d === 'string'))
    throw new Error('component needs an i or d field');

  if (c.p < 0)
    throw new Error('position cannot be negative');
};

/** Check that an operation is valid */
var checkValidOp = function(op) {
  for (var i = 0; i < op.length; i++) {
    checkValidComponent(op[i]);
  }
};

/** Apply op to snapshot */
text.apply = function(snapshot, op) {
  var deleted;

  var type = typeof snapshot;
  if (type !== 'string')
    throw new Error('text0 operations cannot be applied to type: ' + type);

  checkValidOp(op);
  for (var i = 0; i < op.length; i++) {
    var component = op[i];
    if (component.i != null) {
      snapshot = text.strInject(snapshot, component.p, component.i);
    } else {
      snapshot = strDelete(snapshot, component.p, component.d);
    }
  }
  return snapshot;
};

/**
 * Append a component to the end of newOp. Exported for use by the random op
 * generator and the JSON0 type.
 */
var append = text._append = function(newOp, c) {
  if (c.i === '' || c.d === '') return;

  if (newOp.length === 0) {
    newOp.push(c);
  } else {
    var last = newOp[newOp.length - 1];

    if (last.i != null && c.i != null && last.p <= c.p && c.p <= last.p + text.unicodeLength(last.i)) {
      // Compose the insert into the previous insert
      newOp[newOp.length - 1] = {i: text.strInject(last.i, c.p - last.p, c.i), p: last.p};

    } else if (last.d != null && c.d != null && c.p <= last.p && last.p <= c.p + text.unicodeLength(c.d)) {
      // Compose the deletes together
      newOp[newOp.length - 1] = {d: text.strInject(c.d, last.p - c.p, last.d), p: c.p};

    } else {
      newOp.push(c);
    }
  }
};

/** Compose op1 and op2 together */
text.compose = function(op1, op2) {
  checkValidOp(op1);
  checkValidOp(op2);
  var newOp = op1.slice();
  for (var i = 0; i < op2.length; i++) {
    append(newOp, op2[i]);
  }
  return newOp;
};

/** Clean up an op */
text.normalize = function(op) {
  var newOp = [];

  // Normalize should allow ops which are a single (unwrapped) component:
  // {i:'asdf', p:23}.
  // There's no good way to test if something is an array:
  // http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
  // so this is probably the least bad solution.
  if (op.i != null || op.p != null) op = [op];

  for (var i = 0; i < op.length; i++) {
    var c = op[i];
    if (c.p == null) c.p = 0;

    append(newOp, c);
  }

  return newOp;
};

// This helper method transforms a position by an op component.
//
// If c is an insert, insertAfter specifies whether the transform
// is pushed after the insert (true) or before it (false).
//
// insertAfter is optional for deletes.
var transformPosition = function(pos, c, insertAfter) {
  // This will get collapsed into a giant ternary by uglify.
  if (c.i != null) {
    if (c.p < pos || (c.p === pos && insertAfter)) {
      return pos + text.unicodeLength(c.i);
    } else {
      return pos;
    }
  } else {
    // I think this could also be written as: Math.min(c.p, Math.min(c.p -
    // otherC.p, otherC.d.length)) but I think its harder to read that way, and
    // it compiles using ternary operators anyway so its no slower written like
    // this.
    if (pos <= c.p) {
      return pos;
    } else if (pos <= c.p + text.unicodeLength(c.d)) {
      return c.p;
    } else {
      return pos - text.unicodeLength(c.d);
    }
  }
};

// Helper method to transform a cursor position as a result of an op.
//
// Like transformPosition above, if c is an insert, insertAfter specifies
// whether the cursor position is pushed after an insert (true) or before it
// (false).
text.transformCursor = function(position, op, side) {
  var insertAfter = side === 'right';
  for (var i = 0; i < op.length; i++) {
    position = transformPosition(position, op[i], insertAfter);
  }

  return position;
};

// Transform an op component by another op component. Asymmetric.
// The result will be appended to destination.
//
// exported for use in JSON type
var transformComponent = text._tc = function(dest, c, otherC, side) {
  //var cIntersect, intersectEnd, intersectStart, newC, otherIntersect, s;

  checkValidComponent(c);
  checkValidComponent(otherC);

  if (c.i != null) {
    // Insert.
    append(dest, {i:c.i, p:transformPosition(c.p, otherC, side === 'right')});
  } else {
    // Delete
    if (otherC.i != null) {
      // Delete vs insert
      var s = c.d;
      if (c.p < otherC.p) {
        append(dest, {d: text.unicodeSlice(s, 0, otherC.p - c.p), p: c.p});
        s = text.unicodeSlice(s, otherC.p - c.p);
      }
      if (s !== '')
        append(dest, {d: s, p: c.p + text.unicodeLength(otherC.i)});

    } else {
      // Delete vs delete
      if (c.p >= otherC.p + text.unicodeLength(otherC.d))
        append(dest, {d: c.d, p: c.p - text.unicodeLength(otherC.d)});
      else if (c.p + text.unicodeLength(c.d) <= otherC.p)
        append(dest, c);
      else {
        // They overlap somewhere.
        var newC = {d: '', p: c.p};

        if (c.p < otherC.p)
          newC.d = text.unicodeSlice(c.d, 0, otherC.p - c.p);

        if (c.p + text.unicodeLength(c.d) > otherC.p + text.unicodeLength(otherC.d))
          newC.d += text.unicodeSlice(c.d, otherC.p + text.unicodeLength(otherC.d) - c.p);

        // This is entirely optional - I'm just checking the deleted text in
        // the two ops matches
        var intersectStart = Math.max(c.p, otherC.p);
        var intersectEnd = Math.min(c.p + text.unicodeLength(c.d), otherC.p + text.unicodeLength(otherC.d));
        var cIntersect = text.unicodeSlice(c.d, intersectStart - c.p, intersectEnd - c.p);
        var otherIntersect = text.unicodeSlice(otherC.d, intersectStart - otherC.p, intersectEnd - otherC.p);
        if (cIntersect !== otherIntersect)
          throw new Error('Delete ops delete different text in the same region of the document');

        if (newC.d !== '') {
          newC.p = transformPosition(newC.p, otherC);
          append(dest, newC);
        }
      }
    }
  }

  return dest;
};

var invertComponent = function(c) {
  return (c.i != null) ? {d:c.i, p:c.p} : {i:c.d, p:c.p};
};

// No need to use append for invert, because the components won't be able to
// cancel one another.
text.invert = function(op) {
  // Shallow copy & reverse that sucka.
  op = op.slice().reverse();
  for (var i = 0; i < op.length; i++) {
    op[i] = invertComponent(op[i]);
  }
  return op;
};

require('./bootstrapTransform')(text, transformComponent, checkValidOp, append);
