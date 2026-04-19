'use strict';

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');
const { savePassword } = require('../helper');

async function main() {
    try {
        // Load Org3 connection profile
        const ccpPath = path.resolve(__dirname, '../..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org3.example.com', 'connection-org3.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create CA client for Org3
        const caInfo = ccp.certificateAuthorities['ca.org3.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        // Wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check if doctor already enrolled
        const userIdentity = await wallet.get('Org3Doctor01');
        if (userIdentity) {
            console.log('An identity for the user "Org3Doctor01" already exists in the wallet');
            return;
        }

        // Check if hospital2Admin exists (cho onboardDoctor transaction)
        const hospital2AdminId = await wallet.get('hospital2Admin');
        if (!hospital2AdminId) {
            console.log('An identity for "hospital2Admin" does not exist in the wallet');
            console.log('Run registerHospital2Admin.js application before retrying');
            return;
        }

        // Enroll CA bootstrap admin de register doctor
        // (hospital2Admin co hf.Registrar.Roles nhung thieu hf.Registrar.Attributes,
        //  khong register duoc user voi custom attrs hospitalId/uuid/role.
        //  Dung bootstrap admin giong pattern Org1)
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
        const provider = wallet.getProviderRegistry().getProvider(bootstrapIdentity.type);
        const adminUser = await provider.getUserContext(bootstrapIdentity, '_caAdmin3');

        // Register the doctor, enroll, import into wallet
        const secret = await ca.register({
            // Bo affiliation - CA Org3 khong co org3.department1
            enrollmentID: 'Org3Doctor01',
            role: 'client',
            attrs: [
                { name: 'role', value: 'doctor', ecert: true },
                { name: 'uuid', value: 'Org3Doctor01', ecert: true },
                { name: 'hospitalId', value: 'hospital2Admin', ecert: true }
            ],
        }, adminUser);

        const enrollment = await ca.enroll({
            enrollmentID: 'Org3Doctor01',
            enrollmentSecret: secret,
            attr_reqs: [
                { name: 'role', optional: false },
                { name: 'uuid', optional: false },
                { name: 'hospitalId', optional: false }
            ]
        });

        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org3MSP',
            type: 'X.509',
        };
        await wallet.put('Org3Doctor01', x509Identity);
        await wallet.remove('_caAdmin3');
        await savePassword('Org3Doctor01', '1234');
        console.log('Successfully registered and enrolled user "Org3Doctor01" and imported it into the wallet');

        // Onboard doctor to blockchain (submit bang hospital2Admin)
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'hospital2Admin', discovery: { enabled: true, asLocalhost: true } });
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('ehrChainCode');

        const args = {
            doctorId: 'Org3Doctor01',
            name: 'BS. Nguyen Van B',
            city: 'Ha Noi'
        };

        const res = await contract.submitTransaction('onboardDoctor', JSON.stringify(args));
        console.log('\n === Onboard Org3 Doctor success === \n', res.toString());

        gateway.disconnect();

    } catch (error) {
        console.error(`Failed to register user "Org3Doctor01": ${error}`);
        process.exit(1);
    }
}

main();
