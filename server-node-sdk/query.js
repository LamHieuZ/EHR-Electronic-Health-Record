/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');


// Xac dinh Org tu identity trong wallet (dua vao mspId)
const getOrgFromIdentity = (identity) => {
    if (identity.mspId === 'Org2MSP') return 'Org2';
    return 'Org1';
};

const getQuery = async (fcn, args, userId) => {

    const channelName = 'mychannel';
    const chaincodeName = 'ehrChainCode';

    // Lay identity tu wallet truoc de xac dinh Org
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    const identity = await wallet.get(userId);
    if (!identity) {
        console.log(`An identity for the user ${userId} does not exist in the wallet`);
        console.log('Run the registerUser.js application before retrying');
        return {
            statusCode: 200,
            status: false,
            message: `An identity for the user ${userId} does not exist.`
        };
    }

    // Tu dong chon Org dua vao mspId cua user
    const orgID = getOrgFromIdentity(identity);
    console.log(`User ${userId} belongs to ${orgID} (${identity.mspId})`);

    const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', `${orgID}.example.com`.toLowerCase(), `connection-${orgID}.json`.toLowerCase());
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
       
    // Create a new gateway for connecting to our peer node.
    const gateway = new Gateway();
   
    await gateway.connect(ccp, { wallet, identity: userId, discovery: { enabled: false } });
    
    // Get the network (channel) our contract is deployed to.
    const network = await gateway.getNetwork(channelName);
    
    // Get the contract from the network.
    const contract = network.getContract(chaincodeName);
    
    // Submit transaction
    let result = await contract.evaluateTransaction(fcn, JSON.stringify(args));
    result = JSON.parse(result);

    console.log(`Response from ${fcn} chaincode :: `, result);

    // Disconnect from the gateway.
    gateway.disconnect();
            
    return result;  

}


module.exports = {getQuery};