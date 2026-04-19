'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const { savePassword } = require('../helper');

async function main() {
    try {
        const ccpPath = path.resolve(__dirname, '../..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org2.example.com', 'connection-org2.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const caInfo = ccp.certificateAuthorities['ca.org2.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check if already registered
        const existing = await wallet.get('insuranceAdmin');
        if (existing) {
            console.log('"insuranceAdmin" already exists in the wallet');
            return;
        }

        // Step 1: Enroll CA bootstrap admin (temporary)
        console.log('Enrolling Org2 CA bootstrap admin...');
        const bootstrapEnroll = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        const bootstrapIdentity = {
            credentials: {
                certificate: bootstrapEnroll.certificate,
                privateKey: bootstrapEnroll.key.toBytes(),
            },
            mspId: 'Org2MSP',
            type: 'X.509',
        };
        await wallet.put('_caAdmin2', bootstrapIdentity);

        // Step 2: Register insuranceAdmin voi custom attrs
        console.log('Registering insuranceAdmin with cert attributes...');
        const provider = wallet.getProviderRegistry().getProvider(bootstrapIdentity.type);
        const adminUser = await provider.getUserContext(bootstrapIdentity, '_caAdmin2');

        const secret = await ca.register({
            affiliation: 'org2.department1',
            enrollmentID: 'insuranceAdmin',
            role: 'client',
            attrs: [
                // hf.Registrar.Roles cho phep insuranceAdmin register user khac (agent)
                { name: 'hf.Registrar.Roles', value: 'client', ecert: true },
                { name: 'role', value: 'insurance', ecert: true },
                { name: 'uuid', value: 'insuranceAdmin', ecert: true },
                { name: 'companyId', value: 'insuranceAdmin', ecert: true },
            ],
        }, adminUser);

        const enrollment = await ca.enroll({
            enrollmentID: 'insuranceAdmin',
            enrollmentSecret: secret,
            attr_reqs: [
                { name: 'role', optional: false },
                { name: 'uuid', optional: false },
                { name: 'companyId', optional: false },
            ],
        });

        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org2MSP',
            type: 'X.509',
        };
        await wallet.put('insuranceAdmin', x509Identity);

        // Step 3: Remove temporary CA admin
        await wallet.remove('_caAdmin2');
        await savePassword('insuranceAdmin', '1234');

        console.log('\nDone! "insuranceAdmin" registered with role=insurance and can register agents.');
    } catch (error) {
        console.error(`Failed to setup insuranceAdmin: ${error}`);
        process.exit(1);
    }
}

main();
