'use strict';

const fs = require('fs');
const path = require('path');
const FabricCAServices = require('fabric-ca-client');
const { Wallets, Gateway } = require('fabric-network');

// ===========================================================================================
// REGISTER USER - Dang ky user voi Fabric CA va luu vao wallet
// Ho tro them attribute: hospitalId, companyId
// ===========================================================================================
// Xac dinh Org tu role: insurance-related → Org2, con lai → Org1
const getOrgFromRole = (userRole) => {
    const org2Roles = ['insuranceAdmin', 'agent'];
    if (org2Roles.includes(userRole)) return 'Org2';
    return 'Org1';
};

const registerUser = async (adminID, submitterId, userID, userRole, args, extraAttrs = {}) => {
    const orgID = getOrgFromRole(userRole);

    const ccpPath = path.resolve(__dirname, '..', 'fabric-samples','test-network', 'organizations', 'peerOrganizations', `${orgID}.example.com`.toLowerCase(), `connection-${orgID}.json`.toLowerCase());
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const orgMSP = ccp.organizations[orgID].mspid;

    // Create a new CA client for interacting with the CA.
    const caOrg = ccp.organizations[orgID].certificateAuthorities[0]
    const caURL = ccp.certificateAuthorities[caOrg].url;
    const ca = new FabricCAServices(caURL);

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    // Check to see if we've already enrolled the user.
    const userIdentity = await wallet.get(userID);
    if (userIdentity) {
        console.log(`An identity for the user ${userID} already exists in the wallet.`);
        return {
            statusCode: 200,
            message: `${userID} has already been enrolled.`
        };
    } else {
        console.log(`An identity for the user ${userID} does not exist so creating one in the wallet.`);
    }

    // Check to see if we've already enrolled the admin user.
    const adminIdentity = await wallet.get(adminID);
    if (!adminIdentity) {
        console.log(`An identity for the admin user ${adminID} does not exist in the wallet.`);
        console.log('Run the enrollAdmin.js application before retrying.');
        return {
            statusCode: 200,
            message: `An identity for the admin user does not exist in the wallet`
        };
    }

    // build a user object for authenticating with the CA
    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, adminID);

    // Build certificate attributes
    const attrs = [
        {name: 'role', value: userRole, ecert: true},
        {name: 'uuid', value: userID, ecert: true},
    ];
    // Them hospitalId neu co
    if (extraAttrs.hospitalId) {
        attrs.push({name: 'hospitalId', value: extraAttrs.hospitalId, ecert: true});
    }
    // Them companyId neu co
    if (extraAttrs.companyId) {
        attrs.push({name: 'companyId', value: extraAttrs.companyId, ecert: true});
    }

    // Register the user, enroll the user, and import the new identity into the wallet.
    const attrReqs = attrs.map(a => ({name: a.name, optional: false}));

    const secret = await ca.register({
        affiliation: `${orgID}.department1`.toLowerCase(),
        enrollmentID: userID,
        role: 'client',
        attrs: attrs
    }, adminUser);
    const enrollment = await ca.enroll({
        enrollmentID: userID,
        enrollmentSecret: secret,
        attr_reqs: attrReqs
    });
    const x509Identity = {
        credentials: {
            certificate: enrollment.certificate,
            privateKey: enrollment.key.toBytes(),
        },
        mspId: orgMSP,
        type: 'X.509',
    };
    await wallet.put(userID, x509Identity);
    console.log(`Successfully registered and enrolled user ${userID} and imported it into the wallet`);

    // Neu co chaincode function can goi (vd: onboardPatient, onboardDoctor...)
    if (args && args.chaincodeFcn) {
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: submitterId, discovery: { enabled: false } });
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('ehrChainCode');

        const chaincodeArgs = { ...args };
        delete chaincodeArgs.chaincodeFcn;

        const buffer = await contract.submitTransaction(args.chaincodeFcn, JSON.stringify(chaincodeArgs));
        gateway.disconnect();

        return {
            statusCode: 200,
            userID: userID,
            role: userRole,
            message: `${userID} registered and enrolled successfully.`,
            chaincodeRes: buffer.toString()
        };
    }

    return {
        statusCode: 200,
        userID: userID,
        role: userRole,
        message: `${userID} registered and enrolled successfully.`
    };
}

const getRoleFromCert = (certPem) => {
    try {
        const der = Buffer.from(
            certPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''),
            'base64'
        );
        const str = der.toString('binary');
        // Search directly for "role":"value" pattern in the cert binary
        const match = str.match(/"role":"([^"]+)"/);
        if (match) return match[1];
    } catch (e) { /* ignore */ }
    return null;
};

const login = async (userID) => {

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    // Check to see if we've already enrolled the user.
    const identity = await wallet.get(userID);
    if (!identity) {
        console.log(`An identity for the user ${userID} does not exist in the wallet`);
        throw new Error(`User ${userID} not found. Please register first.`);
    }

    const role = getRoleFromCert(identity.credentials.certificate);
    if (!role) throw new Error(`Cannot determine role for user ${userID}. Please re-register.`);

    return {
        statusCode: 200,
        userID: userID,
        role: role,
        message: `User login successful:: ${userID} .`
    };
}

module.exports = {registerUser, login};
