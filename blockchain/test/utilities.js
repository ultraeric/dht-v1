/*
 How to avoid using try/catch blocks with promises' that could fail using async/await
 - https://blog.grossman.io/how-to-write-async-await-without-try-catch-blocks-in-javascript/
 */

// Catches contract reverts
let catchError = function(promise) {
  return promise.then(result => [null, result])
      .catch(err => [err]);
};

let toHex = function(buffer) {
    buffer = buffer.toString('hex');
    if (buffer.substring(0, 2) == '0x')
        return buffer;
    return '0x' + buffer;
};

// Fast forward a given amount of time in seconds
let fastForwardTime = async function(time) {
    let oldTime = (await web3.eth.getBlock("latest")).timestamp;

    // fast forward
    try {
        await sendRPC({jsonrpc: "2.0", method: "evm_increaseTime", params: [time], id: 0});
        await sendRPC({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});
    } catch (err) {
        assert.fail("failed to increase the evm time");
    }

    let newTime = (await web3.eth.getBlock("latest")).timestamp;
    assert.isAtLeast(newTime - oldTime, time, `Did not fast forward at least ${time} seconds`);
}

let sendRPC = async function(payload) {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send(payload, (err, result) => {
            if (err) reject(err)
            else resolve(result)
        })
    })
}

// Forces blockchain to append a specified number of blocks.
let fastForwardBlocks = async function(account0, account1, numBlocks) {
    let i;
    for(i = 0; i < numBlocks; i++) {
        let tx = await web3.eth.sendTransaction({from: account0, to: account1, value: 1});
    }
}

module.exports = {
    catchError,
    toHex,
    fastForwardTime,
    fastForwardBlocks
};
