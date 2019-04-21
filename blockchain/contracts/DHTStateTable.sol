pragma solidity ^0.5.0;

import "solidity-rlp/contracts/RLPReader.sol";

import "./libraries/ECDSA.sol";

contract DHTStateTable {
    using ECDSA for bytes32;
    using RLPReader for bytes;
    using RLPReader for RLPReader.RLPItem;

    uint256 gtc;
    uint256 numNodes;
    uint256 minBond;

    enum NodeState {NonExistent, OnboardPending, Onboarded, Offboarded, Banned}

    event Onboard(address nodeAddress, bytes32 pubKey, bytes32 certificate, bytes32 ip, uint256 port, uint256 nonce, uint256 numNodes);
    event SafeOffboard(address nodeAddress);
    event OffboardPoll(address nodeAddress);

    struct node {
        address addr;
        uint256 nodeIndex;

        bytes32 pubKey;
        bytes32 certificate;
        bytes32 ip;
        uint256 port;

        bytes32 h1;
        bytes32 seed;
        uint256 nonce;

        uint creationBlock;

        NodeState state;
    }
    mapping(address => node) nodes;
    mapping(uint256 => address) nodeIndexes;

    struct offBoardPoll {
        address nodeAddress;
        uint256 numVotesForRemove;

        uint256 createdAt;
    }
    mapping(address => offBoardPoll) polls;

    // A node can be begin onboarding only if it DNE
    modifier canStartOnboard() {
        require(nodes[msg.sender].state == NodeState.NonExistent, "cannot onboard a node that is already in the DHT");
        require(msg.value >= minBond, "cannot onboard with insufficient bond");
        _;
    }

    // A node can be onboarded only after 5 blocks.
    modifier canFinalizeOnboard() {
        require(nodes[msg.sender].state == NodeState.OnboardPending, "cannot finalize onboarding of a node that is in the wrong state");
        require(nodes[msg.sender].creationBlock + 5 <= block.number, "cannot finalize onboarding until 5 blocks have passed");
        _;
    }

    // If a node is Onboarded
    modifier isOnboarded(address nodeAddress) {
        require(nodes[msg.sender].state == NodeState.Onboarded, "the node is not in the onboarded state");
        _;
    }

    // If a poll is still occuring
    modifier canVote(address nodeAddress) {
        require(polls[nodeAddress].createdAt + 1 weeks >= block.timestamp, "cannot vote once the voting period has passed");
        _;
    }

    // Contract constructor.
    constructor()
        public
    {
        gtc = 0;
        numNodes = 0;
        minBond = 10000;
    }

    function bytesToBytes32(bytes memory source) internal pure returns (bytes32 result) {
        if (source.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(source, 32))
        }
    }

    // Begin the onboarding process.
    // @param pubKey            node's public key
    // @param certificate       certificate proving ownership of the public key
    // @param ip                node's ip address
    // @param port              node's port number
    function startOnboard(bytes memory inputBytes, bytes memory inputSig)
        canStartOnboard
        payable
        public
    {
        // Verify the input signature was signed by the caller
        bytes32 inputHash = keccak256(inputBytes);
        require(msg.sender == inputHash.recover(inputSig), "invalid certificate signature");

        // Decode the inputs
        RLPReader.RLPItem[] memory inputs = inputBytes.toRlpItem().toList();
        bytes32 pubKey = bytesToBytes32(inputs[0].toBytes());
        bytes32 certificate = bytesToBytes32(inputs[1].toBytes());
        bytes32 ip = bytesToBytes32(inputs[2].toBytes());
        uint256 port = inputs[3].toUint();

        nodes[msg.sender] = node({
            addr: msg.sender,
            nodeIndex: 0,

            pubKey: pubKey,
            certificate: certificate,
            ip: ip,
            port: port,

            h1: sha256(abi.encodePacked(pubKey, ip, port)),
            seed: sha256(abi.encodePacked(blockhash(block.number), gtc)),
            nonce: 0,

            creationBlock: block.number,

            state: NodeState.OnboardPending
        });
        gtc += 1;

        if (msg.value > minBond) {
            msg.sender.transfer(msg.value - minBond);
        }
    }

    // Finalize the onboarding process, where the node is assigned a nonce and a shard.
    // Finalization occurs 5 blocks after onboarding begins to prevent the predictability of pseudorandom nonce generation.
    function finalizeOnboard()
        canFinalizeOnboard
        public
    {
        bytes32 rng = sha256(abi.encodePacked(blockhash(block.number), nodes[msg.sender].seed));
        nodes[msg.sender].nonce = uint256(sha256(abi.encodePacked(nodes[msg.sender].h1, rng)));
        nodes[msg.sender].nodeIndex = numNodes;
        nodes[msg.sender].state = NodeState.Onboarded;

        nodeIndexes[numNodes] = msg.sender;

        emit Onboard(msg.sender, nodes[msg.sender].pubKey, nodes[msg.sender].certificate, nodes[msg.sender].ip, nodes[msg.sender].port, nodes[msg.sender].nonce, numNodes);
        numNodes += 1;
    }

    // Remove a node from nodeIndexes and reassign indexes if need be
    function removeNode(address nodeAddress)
        private
    {
        uint256 index = nodes[nodeAddress].nodeIndex;

        require(index < numNodes, "something is super wrong.");

        if (index == numNodes - 1) {
            delete nodeIndexes[index];
        } else {
            nodeIndexes[index] = nodeIndexes[numNodes - 1];
            delete nodeIndexes[numNodes - 1];

            nodes[nodeIndexes[index]].nodeIndex = index;
        }

        numNodes -= 1;
    }

    // A node can safely off board itself.
    function safeOffboard()
        public
    {
        require(nodes[msg.sender].state == NodeState.Onboarded);
        nodes[msg.sender].state = NodeState.Offboarded;
        emit SafeOffboard(msg.sender);

        removeNode(msg.sender);

        msg.sender.transfer(minBond);
    }

    // Begin the voting process to forcibly remove a node from the DHT.
    // Only other nodes can begin this process.
    // @param node             the node to be offboarded.
    function beginOffboardVote(address nodeAddress)
        isOnboarded(msg.sender)
        isOnboarded(nodeAddress)
        public
    {
        polls[nodeAddress] = offBoardPoll({
            nodeAddress: nodeAddress,
            numVotesForRemove: 0,
            createdAt: block.timestamp
        });

        emit OffboardPoll(nodeAddress);
    }

    // Nodes can vote to forcibly remove a node from the DHT within a week.
    // @param node             the node to be offboarded
    // @param remove           whether this node should be forcibly removed
    function offboardVote(address nodeAddress, bool remove)
        canVote(nodeAddress)
        public
    {
        if (remove == true) {
            polls[nodeAddress].numVotesForRemove += 1;
        }
    }

    // Finalize the voting process to forcibly remove a node from the DHT.
    // The node will be forcibly removed from the DHT if enough votes are placed.
    // @param node             the node to be offboarded.
    function finalizeOffboardVote(address nodeAddress) public
    {
        require(polls[nodeAddress].createdAt + 1 weeks < block.timestamp, "The poll is still occuring.");
        if (polls[nodeAddress].numVotesForRemove > numNodes / 2) {
            nodes[nodeAddress].state = NodeState.Banned;
            removeNode(nodeAddress);
        }
    }

    // Returns Node's State which has the following fields:
    //
    // address nodeAddress
    // bytes32 pubKey
    // bytes32 certificate
    // bytes32 ip
    // uint256 port
    // uint256 nonce
    function getNodeState(address nodeAddress) public view returns(address, bytes32, bytes32, bytes32, uint256, uint256, NodeState) {
        return (nodes[nodeAddress].addr, nodes[nodeAddress].pubKey, nodes[nodeAddress].certificate, nodes[nodeAddress].ip, nodes[nodeAddress].port, nodes[nodeAddress].nonce, nodes[nodeAddress].state);
    }

    function getNodeAddressByIndex(uint256 index) public view returns (address) {
        return nodeIndexes[index];
    }

    function getNumNodes() public view returns(uint256) {
        return numNodes;
    }
}
