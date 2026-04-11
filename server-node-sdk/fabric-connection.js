'use strict';

const fs = require('fs');
const path = require('path');
const { Wallets, Gateway } = require('fabric-network');

const CHANNEL_NAME = 'mychannel';
const CHAINCODE_NAME = 'ehrChainCode';

// Xac dinh Org tu identity trong wallet (dua vao mspId)
const getOrgFromIdentity = (identity) => {
    if (identity.mspId === 'Org2MSP') return 'Org2';
    if (identity.mspId === 'Org3MSP') return 'Org3';
    return 'Org1';
};

/**
 * Connect to Fabric gateway and return { gateway, contract }.
 * Caller MUST call gateway.disconnect() when done (use try/finally).
 */
const connectGateway = async (userID) => {
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    const identity = await wallet.get(userID);
    if (!identity) {
        throw new Error(`Identity for user '${userID}' does not exist in wallet. Register first.`);
    }

    const orgID = getOrgFromIdentity(identity);
    console.log(`User ${userID} belongs to ${orgID} (${identity.mspId})`);

    const ccpPath = path.resolve(
        __dirname, '..', 'fabric-samples', 'test-network', 'organizations',
        'peerOrganizations', `${orgID}.example.com`.toLowerCase(),
        `connection-${orgID}.json`.toLowerCase()
    );
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: userID,
        discovery: { enabled: true, asLocalhost: true }
    });

    const network = await gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CHAINCODE_NAME);

    return { gateway, contract };
};

module.exports = { connectGateway };
