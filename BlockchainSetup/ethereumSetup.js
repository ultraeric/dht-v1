const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

const instanceData = require('./instanceData.json');
const DHTStateTableABI = JSON.parse(JSON.stringify(require('./DHTABI.json')));
let DHTContract = new web3.eth.Contract(DHTStateTableABI, instanceData.DHTAddress);

let accounts = instanceData.ganacheAccounts;

module.exports = {
  web3,
  DHTContract,
  accounts
};
