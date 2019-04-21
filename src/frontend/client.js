import {Session} from './ioManager';
import {key, selfCert} from "shared/crypto";
import {Message} from "shared/message";
import {dht} from 'blockchainSetup/DHTClass';

const SESSION_REFRESH_TIMER = 10000;

let sessions = {};
const _session = Session.newSession(key, selfCert).then((session) => { sessions[session.url] = session; });

function refreshSessions() {
  dht.getNumNodes()
    .then((numNodes) => {
      let nodePromises = [];
      for (let i=0; i<numNodes; i++) {
        nodePromises.push(dht.getNodeAddressByIndex(i));
      }
      return Promise.all(nodePromises);
    }).then((allNodes) => {
      for (let node of allNodes) {

      }
    }).then(() => window.setTimeout(refreshSessions, SESSION_REFRESH_TIMER));
}