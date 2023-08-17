import { config as envConfig } from "dotenv";

import { mnemonicGenerate } from "@polkadot/util-crypto";

import * as Kilt from "@kiltprotocol/sdk-js";

import { generateAccount } from "./generateAccount.js";
import { generateKeypairs } from "./generateKeypairs.js";
import esMain from "es-main";

export async function createFullDid(submitterAccount) {
    const api = Kilt.ConfigService.get("api");

    const mnemonic = mnemonicGenerate();
    const {
        authentication,
        keyAgreement,
        assertionMethod,
        capabilityDelegation,
    } = generateKeypairs(mnemonic);
    // Get tx that will create the DID on chain and DID-URI that can be used to resolve the DID Document.
    const fullDidCreationTx = await Kilt.Did.getStoreTx(
        {
            authentication: [authentication],
            keyAgreement: [keyAgreement],
            assertionMethod: [assertionMethod],
            capabilityDelegation: [capabilityDelegation],
        },
        submitterAccount.address,
        async ({ data }) => ({
            signature: authentication.sign(data),
            keyType: authentication.type,
        })
    );

    await Kilt.Blockchain.signAndSubmitTx(fullDidCreationTx, submitterAccount);

    const didUri = Kilt.Did.getFullDidUriFromKey(authentication);
    const encodedFullDid = await api.call.did.query(Kilt.Did.toChain(didUri));
    const { document } = Kilt.Did.linkedInfoFromChain(encodedFullDid);

    if (!document) {
        throw new Error("Full DID was not successfully created.");
    }

    return { mnemonic, fullDid: document };
}

if (esMain(import.meta)) {
    (async () => {
        envConfig();

        try {
            await Kilt.connect(process.env.WSS_ADDRESS);

            // Load attester account
            const accountMnemonic = process.env.ATTESTER_ACCOUNT_MNEMONIC;
            const { account } = generateAccount(accountMnemonic);
            const { mnemonic, fullDid } = await createFullDid(account);

            console.log("\nsave following to .env to continue\n");
            console.error(`ATTESTER_DID_MNEMONIC="${mnemonic}"\n`);
            console.error(`ATTESTER_DID_URI="${fullDid.uri}"\n`);
        } catch (e) {
            console.log("Error while creating attester DID");
            throw e;
        }
    })();
}
