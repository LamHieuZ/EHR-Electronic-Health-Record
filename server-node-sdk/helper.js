'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const FabricCAServices = require('fabric-ca-client');
const { Wallets, Gateway } = require('fabric-network');

// ===========================================================================================
// PASSWORD STORE - Luu hash password vao file JSON (khong luu tren blockchain)
// ===========================================================================================
const passwordStorePath = path.join(process.cwd(), 'wallet', 'passwords.json');

const loadPasswords = () => {
    try {
        if (fs.existsSync(passwordStorePath)) {
            return JSON.parse(fs.readFileSync(passwordStorePath, 'utf8'));
        }
    } catch { /* ignore */ }
    return {};
};

const savePassword = async (userId, plainPassword) => {
    const store = loadPasswords();
    store[userId] = await bcrypt.hash(plainPassword, 10);
    fs.writeFileSync(passwordStorePath, JSON.stringify(store, null, 2));
};

const verifyPassword = async (userId, plainPassword) => {
    const store = loadPasswords();
    if (!store[userId]) return false;
    return bcrypt.compare(plainPassword, store[userId]);
};

// ===========================================================================================
// REGISTER USER - Dang ky user voi Fabric CA va luu vao wallet
// Ho tro them attribute: hospitalId, companyId
// ===========================================================================================
// Xac dinh Org tu role: insurance-related → Org2, con lai → Org1
// orgOverride cho phep chi dinh Org cu the (vd: Org3 cho benh vien moi)
const getOrgFromRole = (userRole, orgOverride) => {
    if (orgOverride) return orgOverride;
    const org2Roles = ['insuranceAdmin', 'agent'];
    if (org2Roles.includes(userRole)) return 'Org2';
    return 'Org1';
};

const registerUser = async (adminID, submitterId, userID, userRole, args, extraAttrs = {}, orgId = null) => {
    const orgID = getOrgFromRole(userRole, orgId);

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
        // Neu da co identity nhung van can goi chaincode (vd: onboardPatient da dang ky CA nhung chua co tren chain)
        if (args && args.chaincodeFcn) {
            const gateway = new Gateway();
            await gateway.connect(ccp, { wallet, identity: submitterId, discovery: { enabled: true, asLocalhost: true } });
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
                message: `${userID} already enrolled, chaincode called successfully.`,
                chaincodeRes: buffer.toString()
            };
        }
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
        throw new Error(`Admin identity '${adminID}' not found in wallet. Run enrollAdmin.js first.`);
    }

    // Enroll CA bootstrap admin to register new users (hospitalAdmin/insuranceAdmin lack hf.Registrar.Attributes)
    const caInfo = ccp.certificateAuthorities[caOrg];
    const caTLSCACerts = caInfo.tlsCACerts ? caInfo.tlsCACerts.pem : null;
    const caWithTLS = new FabricCAServices(caInfo.url, caTLSCACerts ? { trustedRoots: caTLSCACerts, verify: false } : null, caInfo.caName);
    const bootstrapEnroll = await caWithTLS.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
    const bootstrapIdentity = {
        credentials: {
            certificate: bootstrapEnroll.certificate,
            privateKey: bootstrapEnroll.key.toBytes(),
        },
        mspId: orgMSP,
        type: 'X.509',
    };
    await wallet.put('_caAdmin', bootstrapIdentity);
    const provider = wallet.getProviderRegistry().getProvider(bootstrapIdentity.type);
    const adminUser = await provider.getUserContext(bootstrapIdentity, '_caAdmin');

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
    await wallet.remove('_caAdmin');
    console.log(`Successfully registered and enrolled user ${userID} and imported it into the wallet`);

    // Neu co chaincode function can goi (vd: onboardPatient, onboardDoctor...)
    if (args && args.chaincodeFcn) {
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: submitterId, discovery: { enabled: true, asLocalhost: true } });
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

// Fallback: derive role from userId for CA-enrolled admins that have no cert attrs
// (wallet cu hoac insuranceAdmin van dung CA bootstrap truc tiep)
const deriveRoleFromUserId = (userId) => {
    const map = {
        hospitalAdmin: 'hospital',
        hospital3Admin: 'hospital',
        insuranceAdmin: 'insurance',
    };
    return map[userId] || null;
};

const login = async (userID, password) => {
    userID = userID.trim();

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

    // Verify password (neu user co password)
    const store = loadPasswords();
    if (store[userID]) {
        if (!password) throw new Error('Password is required.');
        const valid = await verifyPassword(userID, password);
        if (!valid) throw new Error('Wrong password.');
    }

    const role = getRoleFromCert(identity.credentials.certificate) || deriveRoleFromUserId(userID);
    if (!role) throw new Error(`Cannot determine role for user ${userID}. Please re-register.`);

    return {
        statusCode: 200,
        userID: userID,
        role: role,
        message: `User login successful:: ${userID} .`
    };
}

module.exports = {registerUser, login, savePassword, verifyPassword};
