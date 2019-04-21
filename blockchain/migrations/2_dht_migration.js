let fs = require('fs');

let DHTStateTable = artifacts.require("./DHTStateTable");

module.exports = function(deployer, network, accounts) {

  let truffleMigrationData = {};

  deployer.deploy(DHTStateTable, {from: accounts[0]}).then(() => {
    truffleMigrationData['DHTAddress'] = DHTStateTable.address;
    truffleMigrationData['ganacheAccounts'] = accounts;

    let json = JSON.stringify(truffleMigrationData);
    fs.writeFile('../BlockchainSetup/instanceData.json', json, 'utf8', function(err) {} );
  });
};
