'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const { savePassword } = require('../helper');

async function main() {
    try {
        const ccpPath = path.resolve(__dirname, '../..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org3.example.com', 'connection-org3.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const caInfo = ccp.certificateAuthorities['ca.org3.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check if already registered
        const existing = await wallet.get('hospital2Admin');
        if (existing) {
            console.log('"hospital2Admin" already exists in the wallet');
            return;
        }

        // Step 1: Enroll CA bootstrap admin (temporary)
        console.log('Enrolling Org3 CA bootstrap admin...');
        const bootstrapEnroll = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        const bootstrapIdentity = {
            credentials: {
                certificate: bootstrapEnroll.certificate,
                privateKey: bootstrapEnroll.key.toBytes(),
            },
            mspId: 'Org3MSP',
            type: 'X.509',
        };
        await wallet.put('_caAdmin3', bootstrapIdentity);

        // Step 2: Use bootstrap admin to register hospital2Admin with full attributes
        console.log('Registering hospital2Admin with cert attributes...');
        const provider = wallet.getProviderRegistry().getProvider(bootstrapIdentity.type);
        const adminUser = await provider.getUserContext(bootstrapIdentity, '_caAdmin3');

        const secret = await ca.register({
            // Bo affiliation - CA Org3 default config khong co org3.department1
            // Admin bootstrap co root affiliation nen user moi se thua ke root
            enrollmentID: 'hospital2Admin',
            role: 'client',
            attrs: [
                { name: 'hf.Registrar.Roles', value: 'client', ecert: true },
                { name: 'role', value: 'hospital', ecert: true },
                { name: 'uuid', value: 'hospital2Admin', ecert: true },
                { name: 'hospitalId', value: 'hospital2Admin', ecert: true },
            ],
        }, adminUser);

        const enrollment = await ca.enroll({
            enrollmentID: 'hospital2Admin',
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
            mspId: 'Org3MSP',
            type: 'X.509',
        };
        await wallet.put('hospital2Admin', x509Identity);

        // Step 3: Remove temporary CA admin
        await wallet.remove('_caAdmin3');
        await savePassword('hospital2Admin', '1234');

        // Step 4: Onboard hospital to blockchain
        console.log('Onboarding Org3 hospital to blockchain...');
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'hospital2Admin', discovery: { enabled: true, asLocalhost: true } });
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('ehrChainCode');
        const args = { hospitalId: 'hospital2Admin', name: 'Benh Vien 2', city: 'Ha Noi' };
        const res = await contract.submitTransaction('onboardHospital', JSON.stringify(args));
        console.log('\n=== Onboard Org3 Hospital success ===\n', res.toString());
        gateway.disconnect();

        console.log('\nDone! "hospital2Admin" can now register users AND submit chaincode.');

    } catch (error) {
        console.error(`Failed to setup hospital2Admin: ${error}`);
        process.exit(1);
    }
}

main();
