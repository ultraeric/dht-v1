import NodeRSA from 'node-rsa';
import crypto from 'crypto';
import {sha256buf, decrypt, dhPrime} from "shared/crypto";

//TODO: Make sure that client checks for integrity of server IP-Port-Pubkey-Sig with the blockchain

function connectIO(server, key, selfCert) {
  let io = require('socket.io')(server);

  console.log('Connecting Socket I/O');

  io.on('connection',
    (socket) => {
      console.log('Client connected.');

      let session = {};
      session.state = 'ServerPubKeyBroadcast';

      // Broadcast initial pubkey info. GOTCHA: Client must verify against blockchain
      socket.emit('ServerPubKeyBroadcast', selfCert);

      // Respond to client's self-signed public key. Note that you must rely
      // on the client to notice when the server is not responding with valid
      // encryption/signatures.
      socket.on('ClientPubKeyBroadcast', (cert) => {
        if (session.state !== 'ServerPubKeyBroadcast' || session.state === 'Closed') {
          session.state = 'Closed';
          return;
        }
        const clientPubKey = new NodeRSA(cert.serKey);
        if (!clientPubKey.verify(cert.serKey, cert.selfSig)) {
          session.state = 'Closed';
          return;
        }
        session.clientKey = clientPubKey;

        // Transition to EDH phase of SSL
        session.state = 'ServerEDHBroadcast';
        session.dhParams = crypto.createDiffieHellman(dhPrime, 'hex');

        // Serialize, encrypt, then sign DHParams
        const serDHParams = JSON.stringify({
          serverDHPubKey: session.dhParams.generateKeys('hex'),
        });
        const encSerDHParams = session.clientKey.encrypt(serDHParams);
        const dhParamSig = key.sign(encSerDHParams);

        // Send the info to the client
        socket.emit('ServerEDHBroadcast', {encSerDHParams, sig: dhParamSig});
      });


      // Fully set up the Diffie-Hellman key exchange
      socket.on('ClientEDHBroadcast', (data) => {
        if (session.state !== 'ServerEDHBroadcast' || session.state === 'Closed') {
          session.state = 'Closed';
          return;
        }
        if (!session.clientKey.verify(data.encSerDHParams, data.sig)) {
          session.state = 'Closed';
          return;
        }
        const clientDHParams = JSON.parse(key.decrypt(data.encSerDHParams));
        const clientDHPubKey = clientDHParams.clientDHPubKey;
        session.dhKey = session.dhParams.computeSecret(clientDHPubKey, 'hex', 'hex');
        session.aesKey = sha256buf(session.dhKey);

        console.log('Finishing secure handshake with client.');

        // Transition to 'Open' state
        session.state = 'Open';
        socket.emit('ServerACK', {});
      });

      socket.on('Data', (data) => {
        if (!session.clientKey.verify(data.encSerObj, data.sig) || session.state !== 'Open') { return; }
        let obj = decrypt(data.encSerObj, session.aesKey, data.ivHex);
        if (!session.count) {
          session.count = 0;
          session.start = new Date().getTime();
        } else if (new Date().getTime() - session.start > 1000 && !session.finished) {
          console.log(session.count);
          session.finished = true;
        }
        session.count += 1;
      })
    }
  );

}

export default connectIO;
export {connectIO};