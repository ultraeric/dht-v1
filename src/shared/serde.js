/**
 * Transforms string to hexstring.
 * @param str
 */
function sth(str) {
  return Buffer.from(str).toString('hex');
}

function hts(hex) {
  return Buffer.from(hex, 'hex').toString();
}

export default sth;
export {sth};