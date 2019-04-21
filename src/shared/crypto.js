import crypto from 'crypto';
import NodeRSA from 'node-rsa';

const algorithm = 'aes-256-cbc';
const dhPrime = 'ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404ddef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a637ed6b0bff5cb6f406b7edee386bfb5a899fa5ae9f24117c4b1fe649286651ece45b3dc2007cb8a163bf0598da48361c55d39a69163fa8fd24cf5f83655d23dca3ad961c62f356208552bb9ed529077096966d670c354e4abc9804f1746c08ca18217c32905e462e36ce3be39e772c180e86039b2783a2ec07a28fb5c55df06f4c52c9de2bcbf6955817183995497cea956ae515d2261898fa051015728e5a8aacaa68ffffffffffffffff';

const key = new NodeRSA({b: 2048});
const _serPubKey = key.exportKey('public');
const _pubKeySelfSig = key.sign(_serPubKey);
const selfCert = {serKey: _serPubKey, selfSig: _pubKeySelfSig};

function encrypt(obj, key) {
  const serObj = JSON.stringify(obj);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encSerObj = cipher.update(serObj, 'utf8', 'hex');
  encSerObj += cipher.final('hex');
  return [encSerObj, iv.toString('hex')];
}

function decrypt(encSerObj, key, ivHex) {
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivHex, 'hex'));
  let serObj = decipher.update(encSerObj, 'hex', 'utf8');
  serObj += decipher.final('utf8');
  return JSON.parse(serObj);
}

function sha256(str) {
  const hash = crypto.createHash('sha256');
  hash.update(str);
  return hash.digest('hex');
}

function sha256buf(str) {
  const hash = crypto.createHash('sha256');
  hash.update(str);
  return hash.digest();
}

export default encrypt;
export {encrypt, decrypt, sha256, sha256buf, key, selfCert, dhPrime};