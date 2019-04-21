let {
    web3,
    DHTContract,
    accounts
} = require('./ethereumSetup.js');

class DHT {

  constructor(contract=DHTContract, sender=accounts[0]) {
    this.instance = contract;
    this.sender = sender;
  }

  startOnboard(bond, pubKey, cert, ip, port, sender=null) {
    let nodeData = [pubKey, cert, ip, port];
    sender = sender || this.sender;
    return this.instance.methods.startOnboard(inputBytes, inputSig).send({from: sender, value: bond, gas: 5000000});
  }

  finalizeOnboard(sender=null) {
    sender = sender || this.sender;
    return this.instance.methods.finalizeOnboard().send({from: sender, gas: 5000000});
  }

  safeOffboard(sender=null) {
    sender = sender || this.sender;
    return this.instance.methods.safeOffboard().send({from: sender, gas: 5000000});
  }

  beginOffboardVote(nodeAddress, sender=null) {
    sender = sender || this.sender;
    return this.instance.methods.beginOffboardVote(nodeAddress).send({from: sender, gas: 5000000});
  }

  offboardVote(nodeAddress, remove, sender=null) {
    sender = sender || this.sender;
    return this.instance.methods.offboardVote(nodeAddress, remove).send({from: sender, gas: 5000000});
  }

  finalizeOffboardVote(nodeAddress, sender=null) {
    sender = sender || this.sender;
    return this.instance.methods.finalizeOffboardVote(nodeAddress).send({from: sender, gas: 5000000});
  }

  getNodeState(nodeAddress, sender=null) {
    sender = sender || this.sender;
    return this.instance.methods.getNodeState(nodeAddress).call({from: sender});
  }

  getNodeAddressByIndex(index, sender=null) {
    sender = sender || this.sender;
    return this.instance.methods.getNodeAddressByIndex(index).call({from: sender});
  }

  getNumNodes(sender=null) {
    sender = sender || this.sender;
    return this.instance.methods.getNumNodes().call({from: sender});
  }
}

const dht = DHT();

export default {dht};
export {DHT, dht};