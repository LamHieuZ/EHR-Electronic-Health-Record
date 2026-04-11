'use strict';

const { connectGateway } = require('./fabric-connection');

const getQuery = async (fcn, args, userId) => {
    const { gateway, contract } = await connectGateway(userId);
    try {
        let result = await contract.evaluateTransaction(fcn, JSON.stringify(args));
        result = JSON.parse(result);
        console.log(`Response from ${fcn} chaincode :: `, result);
        return result;
    } finally {
        gateway.disconnect();
    }
};

module.exports = { getQuery };
