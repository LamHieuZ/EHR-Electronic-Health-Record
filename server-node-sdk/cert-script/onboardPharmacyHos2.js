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

        // Check if pharmacy already enrolled
        const userIdentity = await wallet.get('Pharmacy02');
        if (userIdentity) {
            console.log('An identity for the user "Pharmacy02" already exists in the wallet');
            return;
        }

        // Check if hospital2Admin exists
        const hospital2AdminId = await wallet.get('hospital2Admin');
        if (!hospital2AdminId) {
            console.log('An identity for "hospital2Admin" does not exist in the wallet');
            console.log('Run registerHospital2Admin.js application before retrying');
            return;
        }

        // Enroll CA bootstrap admin de register pharmacy
        // (hospital2Admin thieu hf.Registrar.Attributes, dung bootstrap admin giong pattern Org1)
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

        // Register the pharmacy, enroll, import into wallet
        const secret = await ca.register({
            // Bo affiliation - CA Org3 khong co org3.department1
            enrollmentID: 'Pharmacy02',
            role: 'client',
            attrs: [
                { name: 'role', value: 'pharmacy', ecert: true },
                { name: 'uuid', value: 'Pharmacy02', ecert: true },
                { name: 'hospitalId', value: 'hospital2Admin', ecert: true }
            ],
        }, adminUser);

        const enrollment = await ca.enroll({
            enrollmentID: 'Pharmacy02',
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
        await wallet.put('Pharmacy02', x509Identity);
        await wallet.remove('_caAdmin3');
        await savePassword('Pharmacy02', '1234');
        console.log('Successfully registered and enrolled "Pharmacy02" and imported it into the wallet');

        // Onboard pharmacy to blockchain (submit bang hospital2Admin)
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'hospital2Admin', discovery: { enabled: true, asLocalhost: true } });
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('ehrChainCode');

        const args = {
            pharmacyId: 'Pharmacy02',
            name: 'Nha Thuoc So 2',
            city: 'Ha Noi'
        };

        const res = await contract.submitTransaction('onboardPharmacy', JSON.stringify(args));
        console.log('\n === Onboard Org3 Pharmacy success === \n', res.toString());

        gateway.disconnect();

    } catch (error) {
        console.error(`Failed to register user "Pharmacy02": ${error}`);
        process.exit(1);
    }
}

main();
