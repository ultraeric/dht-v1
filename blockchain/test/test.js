let RLP = require('rlp');
let { catchError, toHex, fastForwardTime, fastForwardBlocks } = require('./utilities.js');

let DHTStateTable = artifacts.require("./DHTStateTable");

contract('DHT', async (accounts) => {
    let instance;
    let authority = accounts[0];

    let oneWeek = 604800; // in seconds

    let dummyInputs = [];
    let dummyInputsBytes;
    let dummyInputsHash;
    let dummyInputsSig;

    let dummyPubKey = "0x0123000000000000000000000000000000000000000000000000000000000000";
    let dummyCertificate = "0x1234000000000000000000000000000000000000000000000000000000000000";
    let dummyIPAddress = "0x2345000000000000000000000000000000000000000000000000000000000000";
    let dummyPortNumber = 8548;


    beforeEach(async () => {
        instance = await DHTStateTable.new({from: authority});

        dummyInputs[0] = dummyPubKey;
        dummyInputs[1] = dummyCertificate;
        dummyInputs[2] = dummyIPAddress;
        dummyInputs[3] = dummyPortNumber;

        dummyInputsBytes = toHex(RLP.encode(dummyInputs).toString('hex'));
        dummyInputsHash = toHex(web3.utils.soliditySha3(dummyInputsBytes));
        dummyInputsSig = toHex(await web3.eth.sign(dummyInputsHash, accounts[1]));
    });

    it("successfully onboards node", async () => {
        // Initiate start onboard
        await instance.startOnboard(dummyInputsBytes, dummyInputsSig, {from: accounts[1], value: 10000});
        // Fast forward 5 blocks
        await fastForwardBlocks(accounts[0], accounts[1], 5);
        // Finalize Onboarding
        await instance.finalizeOnboard({from: accounts[1]});

        // Verify Node information is correct
        let nodeState = await instance.getNodeState.call(accounts[1]);
        assert.equal(nodeState[0], accounts[1], "incorrect node address stored");
        assert.equal(toHex(nodeState[1]), dummyPubKey, "incorrect node pubKey stored");
        assert.equal(toHex(nodeState[2]), dummyCertificate, "incorrect node certificate stored");
        assert.equal(nodeState[3].toString(), dummyIPAddress, "incorrect node IP Address stored");
        assert.equal(nodeState[4].toNumber(), dummyPortNumber, "incorrect node port number stored");
        assert.equal(nodeState[6].toNumber(), 2, "incorrect node state");
        // Verify the DHT currently has 1 node
        let numNodes = (await instance.getNumNodes.call()).toNumber();
        assert.equal(numNodes, 1, "incorrect number of nodes.");
        // Verify the node at count 0 is the one just onboarded.
        let nodeAddress = (await instance.getNodeAddressByIndex.call(0)).toString();
        assert.equal(nodeAddress, accounts[1], "incorrect address");
    });

    it("fails on invalid startOnboards", async () => {
        let err;
        // An onboard with insufficient bonds will fail.
        [err] = await catchError(instance.startOnboard(dummyInputsBytes, dummyInputsSig, {from: accounts[1], value: 100}));
        if (!err)
            assert.fail("Onbarded started with insufficient bond.");

        // An onboard with insufficient bonds will fail.
        [err] = await catchError(instance.startOnboard(dummyInputsBytes, "0x0", {from: accounts[1], value: 10000}));
        if (!err)
            assert.fail("Onbarded started with invalid signature.");

        // A node cannot be onboarded twice.
        await instance.startOnboard(dummyInputsBytes, dummyInputsSig, {from: accounts[1], value: 10000});
        [err] = await catchError(instance.startOnboard(dummyInputsBytes, dummyInputsSig, {from: accounts[1], value: 10000}));
        if (!err)
            assert.fail("A node started onboarding twice.");
    });

    it("fails on invalid finalizeOnboards", async () => {
        let err;

        // Cannot finalize onboarding of a node in the incorrect state. (In this case, it DNE)
        [err] = await catchError(instance.finalizeOnboard({from: accounts[1]}));
        if (!err)
            assert.fail("Onbarded finalized while node is in an incorrect state.");

        // Initiate start onboard
        let tx1 = await instance.startOnboard(dummyInputsBytes, dummyInputsSig, {from: accounts[1], value: 10000});
        // Fast forward 5 blocks
        await fastForwardBlocks(accounts[0], accounts[1], 2);
        // A node can not finalize its onboarding until 5 additional blocks are created
        [err] = await catchError(instance.finalizeOnboard({from: accounts[1]}));
        if (!err)
            assert.fail("Onbarded finalized before 5 additional blocks are created.");
    });

    it("successfully safeOffboards node", async () => {
        // Initiate start onboard
        await instance.startOnboard(dummyInputsBytes, dummyInputsSig, {from: accounts[1], value: 10000});
        // Fast forward 5 blocks
        await fastForwardBlocks(accounts[0], accounts[1], 5);
        // Finalize Onboarding
        await instance.finalizeOnboard({from: accounts[1]});

        // Verify Node state is correct
        let nodeState = await instance.getNodeState.call(accounts[1]);
        assert.equal(nodeState[6].toNumber(), 2, "incorrect node state");
        // Verify the DHT currently has 1 node
        let numNodes = (await instance.getNumNodes.call()).toNumber();
        assert.equal(numNodes, 1, "incorrect number of nodes.");
        // Verify the node at count 0 is the one just onboarded.
        let nodeAddress = (await instance.getNodeAddressByIndex.call(0)).toString();
        assert.equal(nodeAddress, accounts[1], "incorrect address");

        // Safely Offboard Node
        await instance.safeOffboard({from: accounts[1]});

        // Verify Node state is correct
        let newNodeState = await instance.getNodeState.call(accounts[1]);
        assert.equal(newNodeState[6].toNumber(), 3, "node has not been offboarded");
        // Verify the DHT currently has 0 nodes
        let newNumNodes = (await instance.getNumNodes.call()).toNumber();
        assert.equal(newNumNodes, 0, "incorrect number of nodes");
        // Verify the node at count 0 has been removed
        let newNodeAddress = (await instance.getNodeAddressByIndex.call(0)).toString();
        assert.equal(newNodeAddress, "0x0000000000000000000000000000000000000000", "address not removed");
    });

    it("successfully vote out node if enough votes", async () => {
        // Initiate start onboard
        await instance.startOnboard(dummyInputsBytes, dummyInputsSig, {from: accounts[1], value: 10000});
        // Fast forward 5 blocks
        await fastForwardBlocks(accounts[0], accounts[1], 5);
        // Finalize Onboarding
        await instance.finalizeOnboard({from: accounts[1]});

        // Verify Node information is correct
        let nodeState = await instance.getNodeState.call(accounts[1]);
        assert.equal(nodeState[6].toNumber(), 2, "incorrect node state");
        // Verify the DHT currently has 1 node
        let numNodes = (await instance.getNumNodes.call()).toNumber();
        assert.equal(numNodes, 1, "incorrect number of nodes.");
        // Verify the node at count 0 is the one just onboarded.
        let nodeAddress = (await instance.getNodeAddressByIndex.call(0)).toString();
        assert.equal(nodeAddress, accounts[1], "incorrect address");

        // Begin process to vote out node
        await instance.beginOffboardVote(accounts[1], {from: accounts[1]});
        // Begin vote out node
        await instance.offboardVote(accounts[1], 1, {from: accounts[1]});
        // Fast forward time by 1 week.
        await fastForwardTime(oneWeek + 1000);
        // Finalize node vote
        await instance.finalizeOffboardVote(accounts[1], {from: accounts[1]});

        // Verify Node information is correct
        let newNodeState = await instance.getNodeState.call(accounts[1]);
        assert.equal(newNodeState[6].toNumber(), 4, "incorrect was not banned");
        // Verify the DHT currently has 0 nodes
        let newNumNodes = (await instance.getNumNodes.call()).toNumber();
        assert.equal(newNumNodes, 0, "incorrect number of nodes");
        // Verify the node at count 0 has been removed
        let newNodeAddress = (await instance.getNodeAddressByIndex.call(0)).toString();
        assert.equal(newNodeAddress, "0x0000000000000000000000000000000000000000", "address not removed");
    });

    it("won't vote out node if not enough votes", async () => {
        // Initiate start onboard
        await instance.startOnboard(dummyInputsBytes, dummyInputsSig, {from: accounts[1], value: 10000});
        // Fast forward 5 blocks
        await fastForwardBlocks(accounts[0], accounts[1], 5);
        // Finalize Onboarding
        await instance.finalizeOnboard({from: accounts[1]});

        // Verify Node information is correct
        let nodeState = await instance.getNodeState.call(accounts[1]);
        assert.equal(nodeState[6].toNumber(), 2, "incorrect node state");
        // Verify the DHT currently has 1 node
        let numNodes = (await instance.getNumNodes.call()).toNumber();
        assert.equal(numNodes, 1, "incorrect number of nodes");
        // Verify the node at count 0 is the one just onboarded.
        let nodeAddress = (await instance.getNodeAddressByIndex.call(0)).toString();
        assert.equal(nodeAddress, accounts[1], "incorrect address");

        // Begin process to vote out node
        await instance.beginOffboardVote(accounts[1], {from: accounts[1]});
        // Fast forward time by 1 week.
        await fastForwardTime(oneWeek + 1000);
        // Finalize node vote when no vote has been cast
        await instance.finalizeOffboardVote(accounts[1], {from: accounts[1]});

        // Verify Node information is correct
        let newNodeState = await instance.getNodeState.call(accounts[1]);
        assert.equal(newNodeState[6].toNumber(), 2, "node should not have banned");
        // Verify the DHT currently has 1 node
        let newNumNodes = (await instance.getNumNodes.call()).toNumber();
        assert.equal(newNumNodes, 1, "incorrect number of nodes");
        // Verify the node at count 0 hasn't changed.
        let newNodeAddress = (await instance.getNodeAddressByIndex.call(0)).toString();
        assert.equal(newNodeAddress, accounts[1], "incorrect address");
    });

    it("fails if poll is finalized before time limit", async () => {
        // Initiate start onboard
        await instance.startOnboard(dummyInputsBytes, dummyInputsSig, {from: accounts[1], value: 10000});
        // Fast forward 5 blocks
        await fastForwardBlocks(accounts[0], accounts[1], 5);
        // Finalize Onboarding
        await instance.finalizeOnboard({from: accounts[1]});

        // Verify Node information is correct
        let nodeState = await instance.getNodeState.call(accounts[1]);
        assert.equal(nodeState[6].toNumber(), 2, "incorrect node state");
        // Verify the DHT currently has 1 node
        let numNodes = (await instance.getNumNodes.call()).toNumber();
        assert.equal(numNodes, 1, "incorrect number of nodes");
        // Verify the node at count 0 is the one just onboarded.
        let nodeAddress = (await instance.getNodeAddressByIndex.call(0)).toString();
        assert.equal(nodeAddress, accounts[1], "incorrect address");

        // Begin process to vote out node
        await instance.beginOffboardVote(accounts[1], {from: accounts[1]});
        // Fast forward time by 1 week.
        await fastForwardTime(oneWeek/2);
        // Cannot finalize a poll before time limit
        let err;
        [err] = await catchError(instance.finalizeOffboardVote(accounts[1], {from: accounts[1]}));
        if (!err)
            assert.fail("Poll finalized while still open");

        // Verify Node information is correct
        let newNodeState = await instance.getNodeState.call(accounts[1]);
        assert.equal(newNodeState[6].toNumber(), 2, "node should not have banned");
        // Verify the DHT currently has 1 node
        let newNumNodes = (await instance.getNumNodes.call()).toNumber();
        assert.equal(newNumNodes, 1, "incorrect number of nodes");
        // Verify the node at count 0 hasn't changed.
        let newNodeAddress = (await instance.getNodeAddressByIndex.call(0)).toString();
        assert.equal(newNodeAddress, accounts[1], "incorrect address");
    });

    it("successfully onboards 5 nodes and offboards 2 nodes", async () => {
        var i;
        for (i = 1; i <= 5; i++) {
            dummyInputsSig = toHex(await web3.eth.sign(dummyInputsHash, accounts[i]));

            // Initiate start onboard
            await instance.startOnboard(dummyInputsBytes, dummyInputsSig, {from: accounts[i], value: 10000});
            // Fast forward 5 blocks
            await fastForwardBlocks(accounts[0], accounts[i], 5);
            // Finalize Onboarding
            await instance.finalizeOnboard({from: accounts[i]});

            // Verify Node information is correct
            let nodeState = await instance.getNodeState.call(accounts[i]);
            assert.equal(nodeState[0], accounts[i], "incorrect node address stored");
            assert.equal(toHex(nodeState[1]), dummyPubKey, "incorrect node pubKey stored");
            assert.equal(toHex(nodeState[2]), dummyCertificate, "incorrect node certificate stored");
            assert.equal(nodeState[3].toString(), dummyIPAddress, "incorrect node IP Address stored");
            assert.equal(nodeState[4].toNumber(), dummyPortNumber, "incorrect node port number stored");
            assert.equal(nodeState[6].toNumber(), 2, "incorrect node state");
            // Verify the DHT currently has 1 node
            let numNodes = (await instance.getNumNodes.call()).toNumber();
            assert.equal(numNodes, i, "incorrect number of nodes.");
            // Verify the node at count 0 is the one just onboarded.
            let nodeAddress = (await instance.getNodeAddressByIndex.call(i - 1)).toString();
            assert.equal(nodeAddress, accounts[i], "incorrect address");
        }

        // Safely Offboard Node
        await instance.safeOffboard({from: accounts[4]});
        // Verify Node state is correct
        let newNodeState = await instance.getNodeState.call(accounts[4]);
        assert.equal(newNodeState[6].toNumber(), 3, "node has not been offboarded");

        // Safely Offboard Node
        await instance.safeOffboard({from: accounts[2]});
        // Verify Node state is correct
        newNodeState = await instance.getNodeState.call(accounts[2]);
        assert.equal(newNodeState[6].toNumber(), 3, "node has not been offboarded");

        // Get all the active nodes in the DHT
        let numNodes = (await instance.getNumNodes.call()).toNumber();
        let remainingNodes = []
        for (i = 0; i < numNodes; i++)  {
            let nodeAddress = (await instance.getNodeAddressByIndex.call(i)).toString();
            // assert.equal(nodeAddress, accounts[i], "incorrect address");
            // console.log(nodeAddress);
            remainingNodes.push(nodeAddress);
        }

        assert.deepInclude(remainingNodes, accounts[1]);
        assert.deepInclude(remainingNodes, accounts[3])
        assert.deepInclude(remainingNodes, accounts[5])
    });
});
