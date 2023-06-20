/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let genRandomOp;
const json0 = require('../lib/json0');
const {randomInt, randomReal, randomWord} = require('ot-fuzzer');

// This is an awful function to clone a document snapshot for use by the random
// op generator. .. Since we don't want to corrupt the original object with
// the changes the op generator will make.
const clone = o => JSON.parse(JSON.stringify(o));

const randomKey = function(obj) {
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return undefined;
    } else {
      return randomInt(obj.length);
    }
  } else {
    let result;
    let count = 0;

    for (var key in obj) {
      if (randomReal() < (1/++count)) { result = key; }
    }
    return result;
  }
};

// Generate a random new key for a value in obj.
// obj must be an Object.
const randomNewKey = function(obj) {
  // There's no do-while loop in coffeescript.
  let key = randomWord();
  while (obj[key] !== undefined) { key = randomWord(); }
  return key;
};

// Generate a random object
var randomThing = function() {
  switch (randomInt(6)) {
    case 0: return null;
    case 1: return '';
    case 2: return randomWord();
    case 3:
      var obj = {};
      for (let i = 1, end = randomInt(5), asc = 1 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) { obj[randomNewKey(obj)] = randomThing(); }
      return obj;
    case 4: return (__range__(1, randomInt(5), true).map((j) => randomThing()));
    case 5: return randomInt(50);
  }
};

// Pick a random path to something in the object.
const randomPath = function(data) {
  const path = [];

  while ((randomReal() > 0.85) && (typeof data === 'object')) {
    var key = randomKey(data);
    if (key == null) { break; }

    path.push(key);
    data = data[key];
  }

  return path;
};


module.exports = (genRandomOp = function(data) {
  let pct = 0.95;

  const container = {data: clone(data)};

  const op = (() => {
    const result = [];
    while (randomReal() < pct) {
      var length, obj, p, pos;
      pct *= 0.6;

      // Pick a random object in the document operate on.
      var path = randomPath(container['data']);

      // parent = the container for the operand. parent[key] contains the operand.
      var parent = container;
      var key = 'data';
      for (p of Array.from(path)) {
        parent = parent[key];
        key = p;
      }
      var operand = parent[key];

      if ((randomReal() < 0.4) && (parent !== container) && Array.isArray(parent)) {
        // List move
        var newIndex = randomInt(parent.length);

        // Remove the element from its current position in the list
        parent.splice(key, 1);
        // Insert it in the new position.
        parent.splice(newIndex, 0, operand);

        result.push({p:path, lm:newIndex});

      } else if ((randomReal() < 0.3) || (operand === null)) {
        // Replace

        var newValue = randomThing();
        parent[key] = newValue;

        if (Array.isArray(parent)) {
          result.push({p:path, ld:operand, li:clone(newValue)});
        } else {
          result.push({p:path, od:operand, oi:clone(newValue)});
        }

      } else if (typeof operand === 'string') {
        // String. This code is adapted from the text op generator.

        var c, str;
        if ((randomReal() > 0.5) || (operand.length === 0)) {
          // Insert
          pos = randomInt(operand.length + 1);
          str = randomWord() + ' ';

          path.push(pos);
          parent[key] = operand.slice(0, pos) + str + operand.slice(pos);
          c = {p:path, si:str};
        } else {
          // Delete
          pos = randomInt(operand.length);
          length = Math.min(randomInt(4), operand.length - pos);
          str = operand.slice(pos, (pos + length));

          path.push(pos);
          parent[key] = operand.slice(0, pos) + operand.slice(pos + length);
          c = {p:path, sd:str};
        }

        if (json0._testStringSubtype) {
          // Subtype
          var subOp = {p:path.pop()};
          if (c.si != null) {
            subOp.i = c.si;
          } else {
            subOp.d = c.sd;
          }

          c = {p:path, t:'text0', o:[subOp]};
        }

        result.push(c);

      } else if (typeof operand === 'number') {
        // Number
        var inc = randomInt(10) - 3;
        parent[key] += inc;
        result.push({p:path, na:inc});

      } else if (Array.isArray(operand)) {
        // Array. Replace is covered above, so we'll just randomly insert or delete.
        // This code looks remarkably similar to string insert, above.

        if ((randomReal() > 0.5) || (operand.length === 0)) {
          // Insert
          pos = randomInt(operand.length + 1);
          obj = randomThing();

          path.push(pos);
          operand.splice(pos, 0, obj);
          result.push({p:path, li:clone(obj)});
        } else {
          // Delete
          pos = randomInt(operand.length);
          obj = operand[pos];

          path.push(pos);
          operand.splice(pos, 1);
          result.push({p:path, ld:clone(obj)});
        }
      } else {
        // Object
        var k = randomKey(operand);

        if ((randomReal() > 0.5) || (k == null)) {
          // Insert
          k = randomNewKey(operand);
          obj = randomThing();

          path.push(k);
          operand[k] = obj;
          result.push({p:path, oi:clone(obj)});
        } else {
          obj = operand[k];

          path.push(k);
          delete operand[k];
          result.push({p:path, od:clone(obj)});
        }
      }
    }
    return result;
  })();

  return [op, container.data];
});

function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}