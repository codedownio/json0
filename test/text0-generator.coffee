# Random op generator for the embedded text0 OT type. This is used by the fuzzer
# test.

{randomReal} = require 'ot-fuzzer'
text0 = require '../lib/text0'

# Generate a random string with both ASCII and Unicode surrogate pairs
# with a randomized length between 0 and maxLength
# @param {Number} maxLength - The maximum length of the string (default: 10)
# @param {Number} unicodeProbability - Probability (0-1) of including Unicode surrogate pairs
# @return {String} A random string that may contain surrogate pairs
randomWord = (maxLength = 10, unicodeProbability = 0.05) ->
  # Randomize the string length between 0 and maxLength
  length = Math.floor(Math.random() * (maxLength + 1))

  # Handle empty string case
  return "" if length is 0

  result = []

  for i in [0...length]
    # Decide whether to insert a regular character or a Unicode surrogate pair
    if Math.random() < unicodeProbability
      # Generate a random Unicode character from Supplementary Planes
      # (requires surrogate pairs in UTF-16)
      # These are in ranges: 0x10000 to 0x10FFFF
      codePoint = Math.floor(Math.random() * (0x10FFFF - 0x10000)) + 0x10000

      # Convert to a JavaScript string (will automatically use surrogate pairs)
      char = String.fromCodePoint(codePoint)
    else
      # Generate a random ASCII character (excluding control characters)
      # Using common readable characters (32-126)
      codePoint = Math.floor(Math.random() * (127 - 32)) + 32
      char = String.fromCharCode(codePoint)

    result.push(char)

  # Return the combined string
  result.join('')


module.exports = genRandomOp = (docStr) ->
  pct = 0.9

  op = []

  originalDocStr = docStr

  # console.log("originalDocStr", originalDocStr)

  while randomReal() < pct
    pct /= 2

    if randomReal() > 0.5
      # Append an insert
      pos = Math.floor(randomReal() * (text0.unicodeLength(docStr) + 1))
      str = randomWord()
      text0._append op, {i:str, p:pos}
      docStr = text0.strInject(docStr, pos, str)
    else
      # Append a delete
      pos = Math.floor(randomReal() * text0.unicodeLength(docStr))
      length = Math.min(Math.floor(randomReal() * 4), text0.unicodeLength(docStr) - pos)
      text0._append op, {d: text0.unicodeSlice(docStr, pos, pos + length), p: pos}
      docStr = text0.unicodeSlice(docStr, 0, pos) + text0.unicodeSlice(docStr, pos + length);

    # console.log("Got updated docStr and op #{JSON.stringify(op)} -> #{docStr}", docStr, JSON.stringify(op))

  # console.log "generated op #{originalDocStr} -> #{JSON.stringify(op)} -> #{docStr}"
  [op, docStr]
