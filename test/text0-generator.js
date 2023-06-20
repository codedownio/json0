/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// Random op generator for the embedded text0 OT type. This is used by the fuzzer
// test.

let genRandomOp;
const {randomReal, randomWord} = require('ot-fuzzer');
const text0 = require('../lib/text0');

module.exports = (genRandomOp = function(docStr) {
  let pct = 0.9;

  const op = [];

  while (randomReal() < pct) {
    //    console.log "docStr = #{i docStr}"
    var pos;
    pct /= 2;

    if (randomReal() > 0.5) {
      // Append an insert
      pos = Math.floor(randomReal() * (docStr.length + 1));
      var str = randomWord() + ' ';
      text0._append(op, {i:str, p:pos});
      docStr = docStr.slice(0, pos) + str + docStr.slice(pos);
    } else {
      // Append a delete
      pos = Math.floor(randomReal() * docStr.length);
      var length = Math.min(Math.floor(randomReal() * 4), docStr.length - pos);
      text0._append(op, {d:docStr.slice(pos, (pos + length)), p:pos});
      docStr = docStr.slice(0, pos) + docStr.slice((pos + length));
    }
  }

  //  console.log "generated op #{i op} -> #{i docStr}"
  return [op, docStr];
});
