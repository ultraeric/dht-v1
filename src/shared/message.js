import {encrypt} from "shared/crypto";
import {hts, sth} from "shared/serde";
import secrets from 'secret-sharing.js';

class Message {
  constructor(data) {
    this.data = data;

    this._meta = {
      N: 1,
      recovery: 1
    }
  }

  split(N, recovery=0.2) {
    this._meta.N = N;
    this._meta.recovery=0.2;
    return this;
  }

  recover(pieces) {

  }

  export() {
    let serData = sth(JSON.stringify(this.data));
    let pieces = secrets.share(serData, this._meta.N, Math.ceil(this._meta.N * this._meta.recovery));
    return pieces;
  }
}


export default Message;
export {Message};