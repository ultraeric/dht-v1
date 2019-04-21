import NodeRSA from "node-rsa";
import io from "socket.io-client";
import crypto from 'crypto';
import {encrypt, sha256buf, dhPrime} from "shared/crypto";
import {Guac} from 'guac-hoc/lib/Guac';

const DEFAULT_URL = 'http://localhost:8080';

class Session {
  static newSession(key, selfCert, url=DEFAULT_URL) {
    return new Promise((res, rej) => {
      new Session(key, selfCert, url, res); // Calls the result function and returns when the handshake is done.
    });
  }

  constructor(key, selfCert, url=DEFAULT_URL, res=() => {}) {
    this.url = url;
    this.socket = io(url);

    this.tempMsgQueue = [];

    this.key = key;
    this.selfCert = selfCert;

    this.state = 'AwaitServerPubKey';
    this.serverKey = null;
    this.dhParams = null;
    this.dhKey = null;

    this.bindAllMethods();

    // Respond with own certificate
    this.socket.on('ServerPubKeyBroadcast', (cert) => {
      if (this.state !== 'AwaitServerPubKey' || this.state === 'Closed') {
        this.state = 'Closed';
        return;
      }
      const serverPubKey = new NodeRSA(cert.serKey);
      if (!serverPubKey.verify(cert.serKey, cert.selfSig)) {
        this.state = 'Closed';
        return;
      }
      this.serverKey = serverPubKey;

      // Broadcast Client Public Key
      this.state = 'ClientPubKeyBroadcast';
      this.socket.emit('ClientPubKeyBroadcast', selfCert);
    });

    // Respond with own EDH PubKey
    this.socket.on('ServerEDHBroadcast', (data) => {
      if (this.state !== 'ClientPubKeyBroadcast' || this.state === 'Closed') {
        this.state = 'Closed';
        return;
      }
      if (!this.serverKey.verify(data.encSerDHParams, data.sig)) {
        this.state = 'Closed';
        return;
      }

      const serverDHParams = JSON.parse(key.decrypt(data.encSerDHParams));
      this.dhParams = crypto.createDiffieHellman(dhPrime, 'hex');

      const serverDHPubKey = serverDHParams.serverDHPubKey;

      const serDHParams = JSON.stringify({
        clientDHPubKey: this.dhParams.generateKeys('hex'),
      });

      this.dhKey = this.dhParams.computeSecret(serverDHPubKey, 'hex', 'hex');
      this.aesKey = sha256buf(this.dhKey);

      // Send information over and transition to 'Open'
      this.state = 'AwaitACK';
      const encSerDHParams = this.serverKey.encrypt(serDHParams);
      const dhParamSig = key.sign(encSerDHParams);
      this.socket.emit('ClientEDHBroadcast', {encSerDHParams, sig: dhParamSig});
    });

    this.socket.on('ServerACK', () => {
      if (this.state !== 'AwaitACK' || this.state === 'Closed') {
        this.state = 'Closed';
        return;
      }
      this.state = 'Open';
      for (let msgObj of this.tempMsgQueue) {
        this._send(msgObj);
      }
      res(this);
    })
  }

  send(obj) {
    if (this.state !== 'Open') {
      this.tempMsgQueue.push(obj);
    } else {
      this._send(obj);
    }
  }

  _send(obj) {
    let _ = encrypt(obj, this.aesKey);
    let encSerObj = _[0];
    let ivHex = _[1];
    let sig = this.key.sign(encSerObj);
    this.socket.emit('Data', {encSerObj, sig, ivHex});
  }
}

Session = Guac(Session);

export default Session;
export {Session};