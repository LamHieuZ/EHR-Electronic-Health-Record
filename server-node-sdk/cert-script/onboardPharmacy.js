'use strict';

const {Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        const ccpPath = path.resolve(__dirname, '../..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const caURL = ccp.certificateAuthorities['ca.org1.example.com'].url;
        const ca = new FabricCAServices(caURL);

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        const userIdentity = await wallet.get('Pharmacy01');
        if (userIdentity) {
            console.log('An identity for the user "Pharmacy01" already exists in the wallet');
            return;
        }

        const adminIdentity = await wallet.get('hospitalAdmin');
        if (!adminIdentity) {
            console.log('An identity for the hospitalAdmin user does not exist in the wallet');
            console.log('Run registerOrg1Admin.js first');
            return;
        }

        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'hospitalAdmin');

        const secret = await ca.register({
            affiliation: 'org1.department1',
            enrollmentID: 'Pharmacy01',
            role: 'client',
            attrs: [
                { name: 'role', value: 'pharmacy', ecert: true },
                { name: 'uuid', value: 'Pharmacy01', ecert: true },
                { name: 'hospitalId', value: 'hospitalAdmin', ecert: true }
            ],
        }, adminUser);
        const enrollment = await ca.enroll({
            enrollmentID: 'Pharmacy01',
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
        await wallet.put('Pharmacy01', x509Identity);
        console.log('Successfully registered and enrolled "Pharmacy01" and imported it into the wallet');

        // Ghi nha thuoc len blockchain
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'hospitalAdmin', discovery: { enabled: true, asLocalhost: true } });
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('ehrChainCode');

        const args = {
            pharmacyId: "Pharmacy01",
            name: "Nha Thuoc So 1",
            city: "Ho Chi Minh"
        };

        const res = await contract.submitTransaction('onboardPharmacy', JSON.stringify(args));
        console.log("\n === Onboard Pharmacy success === \n", res.toString());
        gateway.disconnect();

    } catch (error) {
        console.error(`Failed to register user "Pharmacy01": ${error}`);
        process.exit(1);
    }
}

main();
