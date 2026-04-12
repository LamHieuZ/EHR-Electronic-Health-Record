'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const { savePassword } = require('../helper');

async function main() {
    try {
        const ccpPath = path.resolve(__dirname, '../..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check if already registered
        const existing = await wallet.get('hospitalAdmin');
        if (existing) {
            console.log('"hospitalAdmin" already exists in the wallet');
            return;
        }

        // Step 1: Enroll CA bootstrap admin (temporary)
        console.log('Enrolling CA bootstrap admin...');
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

        // Step 2: Use bootstrap admin to register hospitalAdmin with full attributes
        console.log('Registering hospitalAdmin with cert attributes...');
        const provider = wallet.getProviderRegistry().getProvider(bootstrapIdentity.type);
        const adminUser = await provider.getUserContext(bootstrapIdentity, '_caAdmin');

        const secret = await ca.register({
            affiliation: 'org1.department1',
            enrollmentID: 'hospitalAdmin',
            role: 'client',
            attrs: [
                { name: 'hf.Registrar.Roles', value: 'client', ecert: true },
                { name: 'role', value: 'hospital', ecert: true },
                { name: 'uuid', value: 'hospitalAdmin', ecert: true },
                { name: 'hospitalId', value: 'hospitalAdmin', ecert: true },
            ],
        }, adminUser);

        const enrollment = await ca.enroll({
            enrollmentID: 'hospitalAdmin',
            enrollmentSecret: secret,
            attr_reqs: [
                { name: 'role', optional: false },
                { name: 'uuid', optional: false },
                { name: 'hospitalId', optional: false },
            ],
        });

        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put('hospitalAdmin', x509Identity);

        // Step 3: Remove temporary CA admin
        await wallet.remove('_caAdmin');
        await savePassword('hospitalAdmin', '1234');

        // Step 4: Onboard hospital to blockchain
        console.log('Onboarding hospital to blockchain...');
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'hospitalAdmin', discovery: { enabled: true, asLocalhost: true } });
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('ehrChainCode');
        const args = { hospitalId: 'hospitalAdmin', name: 'Benh Vien Bạch Mai', city: 'Ho Chi Minh' };
        const res = await contract.submitTransaction('onboardHospital', JSON.stringify(args));
        console.log('\n=== Onboard Hospital success ===\n', res.toString());
        gateway.disconnect();

        console.log('\nDone! "hospitalAdmin" can now register users AND submit chaincode.');

    } catch (error) {
        console.error(`Failed to setup hospitalAdmin: ${error}`);
        process.exit(1);
    }
}

main();
