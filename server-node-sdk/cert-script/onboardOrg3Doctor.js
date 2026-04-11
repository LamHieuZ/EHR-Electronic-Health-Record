'use strict';

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // Load Org3 connection profile
        const ccpPath = path.resolve(__dirname, '../..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org3.example.com', 'connection-org3.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create CA client for Org3
        const caURL = ccp.certificateAuthorities['ca.org3.example.com'].url;
        const ca = new FabricCAServices(caURL);

        // Wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check if doctor already enrolled
        const userIdentity = await wallet.get('Org3Doctor01');
        if (userIdentity) {
            console.log('An identity for "Org3Doctor01" already exists in the wallet');
            return;
        }

        // Check admin exists
        const adminIdentity = await wallet.get('hospital3Admin');
        if (!adminIdentity) {
            console.log('"hospital3Admin" does not exist in the wallet. Run registerHospital3Admin.js first.');
            return;
        }

        // Build admin user context
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'hospital3Admin');

        // Register and enroll the doctor identity
        const secret = await ca.register({
            affiliation: 'org3.department1',
            enrollmentID: 'Org3Doctor01',
            role: 'client',
            attrs: [
                { name: 'role', value: 'doctor', ecert: true },
                { name: 'uuid', value: 'Org3Doctor01', ecert: true },
                { name: 'hospitalId', value: 'hospital3Admin', ecert: true }
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
        console.log('Successfully registered and enrolled "Org3Doctor01" into the wallet');

        // Write doctor to blockchain
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'hospital3Admin', discovery: { enabled: true, asLocalhost: true } });
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('ehrChainCode');
        const args = { doctorId: 'Org3Doctor01', name: 'BS. Nguyen Van B', city: 'Ha Noi' };
        const res = await contract.submitTransaction('onboardDoctor', JSON.stringify(args));
        console.log('\n === Onboard Org3 Doctor success === \n', res.toString());
        gateway.disconnect();

    } catch (error) {
        console.error(`Failed to register "Org3Doctor01": ${error}`);
        process.exit(1);
    }
}

main();
