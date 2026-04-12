/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const {Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');
const { savePassword } = require('../helper');

async function main() {
    try {
        // load the network configuration
        const ccpPath = path.resolve(__dirname, '../..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        // const ccpPath = path.resolve(__dirname, '..', '..','HLF-Alpha_token-Faucet', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA.
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get('Doctor01');
        if (userIdentity) {
            console.log('An identity for the user "Doctor01" already exists in the wallet');
            return;
        }

        // Check to see if we've already enrolled the hospitalAdmin user.
        const adminIdentity = await wallet.get('hospitalAdmin');
        if (!adminIdentity) {
            console.log('An identity for the hospitalAdmin user "hospitalAdmin" does not exist in the wallet');
            console.log('Run the registerHospitalAdmin.js application before retrying');
            return;
        }

        // Enroll CA bootstrap admin to register new users (hospitalAdmin lacks hf.Registrar.Attributes)
        const bootstrapEnroll = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        const bootstrapIdentity = {
            credentials: {
                certificate: bootstrapEnroll.certificate,
                privateKey: bootstrapEnroll.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put('_caAdmin', bootstrapIdentity);
        const provider = wallet.getProviderRegistry().getProvider(bootstrapIdentity.type);
        const adminUser = await provider.getUserContext(bootstrapIdentity, '_caAdmin');

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({
            affiliation: 'org1.department1',
            enrollmentID: 'Doctor01',
            role: 'client',
            attrs: [
                { name: 'role', value: 'doctor', ecert: true },
                { name: 'uuid', value: 'Doctor01', ecert: true },
                { name: 'hospitalId', value: 'hospitalAdmin', ecert: true }
            ],
        }, adminUser);
        const enrollment = await ca.enroll({
            enrollmentID: 'Doctor01',
            enrollmentSecret: secret,
            attr_reqs: [
                { name: "role", optional: false },
                { name: "uuid", optional: false },
                { name: "hospitalId", optional: false }
            ]
        });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put('Doctor01', x509Identity);
        await wallet.remove('_caAdmin');
        await savePassword('Doctor01', '1234');
        console.log('Successfully registered and enrolled user "Doctor01" and imported it into the wallet');

        // -----------------------Create Wallet with default balance on ledger------------------ 
                // Create a new gateway for connecting to our peer node.
                const gateway = new Gateway();
                await gateway.connect(ccp, { wallet, identity: 'hospitalAdmin', discovery: { enabled: true, asLocalhost: true } });
        
                // Get the network (channel) our contract is deployed to.
                const network = await gateway.getNetwork('mychannel');
        
                // Get the contract from the network.
                const contract = network.getContract('ehrChainCode');



                const args = {
                    doctorId: "Doctor01",
                    name: "Hieu",
                    city: "QN"
                };  

                const res = await contract.submitTransaction('onboardDoctor', JSON.stringify(args));
                console.log("/n === Onboard Doctor success === /n", res.toString());
        
                // const result2 = await contract.evaluateTransaction('GetAllAssets');
                // console.log('/n === GetAllAssets === /n', result2.toString());

                // Disconnect from the gateway.
                gateway.disconnect();

    } catch (error) {
        console.error(`Failed to register user "Doctor01": ${error}`);
        process.exit(1);
      }
}

main();
