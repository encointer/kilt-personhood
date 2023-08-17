import { config as envConfig } from "dotenv";

import * as Kilt from "@kiltprotocol/sdk-js";

import { generateAccount } from "../attester/generateAccount.js";
import { generateCredential } from "../claimer/generateCredential.js";
import { generateKeypairs } from "./generateKeypairs.js";
import { generateLightDid } from "../claimer/generateLightDid.js";
import esMain from 'es-main';

export async function attestCredential(
    attesterAccount,
    attesterDid,
    credential,
    signCallback
) {
    const api = Kilt.ConfigService.get("api");

    // Get CType and root hash from the provided credential.
    const { cTypeHash, claimHash } = Kilt.Attestation.fromCredentialAndDid(
        credential,
        attesterDid
    );

    // Create the tx and authorize it.
    const tx = api.tx.attestation.add(claimHash, cTypeHash, null);
    const extrinsic = await Kilt.Did.authorizeTx(
        attesterDid,
        tx,
        signCallback,
        attesterAccount.address
    );

    // Submit the tx to write the attestation to the chain.
    console.log("Attester -> create attestation...");
    await Kilt.Blockchain.signAndSubmitTx(extrinsic, attesterAccount);
}

export async function attestingFlow(
    claimerDid,
    attesterAccount,
    attesterDid,
    signCallback
) {
    // First the claimer.
    const credential = generateCredential(claimerDid, {
        uniqueness_confidence: 5,
        valid_until: "8.8.2023, 16:37:06",
        salt: "salterino",
    });

    // ... send the request to the attester

    // The attester checks the attributes and attests the provided credential.
    await attestCredential(
        attesterAccount,
        attesterDid,
        credential,
        signCallback
    );

    // Return the generated credential.
    return credential;
}

if (esMain(import.meta)) {
    (async () => {
        envConfig();

        try {
            await Kilt.connect(process.env.WSS_ADDRESS);

            const attesterAccountMnemonic =
                process.env.ATTESTER_ACCOUNT_MNEMONIC;
            const { account: attesterAccount } = generateAccount(
                attesterAccountMnemonic
            );

            const attesterDidMnemonic = process.env.ATTESTER_DID_MNEMONIC;
            const { authentication, assertionMethod } =
                generateKeypairs(attesterDidMnemonic);
            const attesterDidUri =
                Kilt.Did.getFullDidUriFromKey(authentication);

            const claimerDidMnemonic = process.env.CLAIMER_DID_MNEMONIC;
            const claimerDid = await generateLightDid(claimerDidMnemonic);

            const credential = await attestingFlow(
                claimerDid.uri,
                attesterAccount,
                attesterDidUri,
                async ({ data }) => ({
                    signature: assertionMethod.sign(data),
                    keyType: assertionMethod.type,
                })
            );

            console.log(
                "The claimer build their credential and now has to store it."
            );
            console.log("Add the following to your .env file. ");
            console.log(`CLAIMER_CREDENTIAL='${JSON.stringify(credential)}'`);
        } catch (e) {
            console.log("Error while going throw attesting workflow");
            throw e;
        }
    })();
}
