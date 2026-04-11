'use strict';

const { connectGateway } = require('./fabric-connection');

const invokeTransaction = async (fcn, args, userID) => {
    const { gateway, contract } = await connectGateway(userID);
    try {
        console.log("arguments at invoke: ", JSON.stringify(args));
        let result = await contract.submitTransaction(fcn, JSON.stringify(args));
        result = JSON.parse(result);
        console.log(`Response from ${fcn} chaincode:`, result);
        return result;
    } finally {
        gateway.disconnect();
    }
};

module.exports = { invokeTransaction };
