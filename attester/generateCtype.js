import { config as envConfig } from "dotenv";

import * as Kilt from "@kiltprotocol/sdk-js";

import { generateAccount } from "./generateAccount.js";
import { generateKeypairs } from "./generateKeypairs.js";
import { getCtypeSchema } from "./ctypeSchema.js";
import esMain from "es-main";

export async function ensureStoredCtype(
    attesterAccount,
    attesterDid,
    signCallback
) {
    const api = Kilt.ConfigService.get("api");

    // Get the CTYPE and see if it's stored, if yes return it.
    const ctype = getCtypeSchema();
    try {
        await Kilt.CType.verifyStored(ctype);
        console.log("Ctype already stored. Skipping creation");
        return ctype;
    } catch {
        console.log("Ctype not present. Creating it now...");
        // Authorize the tx.
        const encodedCtype = Kilt.CType.toChain(ctype);
        const tx = api.tx.ctype.add(encodedCtype);
        const extrinsic = await Kilt.Did.authorizeTx(
            attesterDid,
            tx,
            signCallback,
            attesterAccount.address
        );

        // Write to chain then return the CType.
        await Kilt.Blockchain.signAndSubmitTx(extrinsic, attesterAccount);

        return ctype;
    }
}

if (esMain(import.meta)) {
    (async () => {
        envConfig();

        try {
            await Kilt.connect(process.env.WSS_ADDRESS);

            const accountMnemonic = process.env.ATTESTER_ACCOUNT_MNEMONIC;
            const { account } = generateAccount(accountMnemonic);

            const didMnemonic = process.env.ATTESTER_DID_MNEMONIC;
            const { authentication, assertionMethod } =
                generateKeypairs(didMnemonic);
            const attesterDidUri =
                Kilt.Did.getFullDidUriFromKey(authentication);

            const ctype = await ensureStoredCtype(
                account,
                attesterDidUri,
                async ({ data }) => ({
                    signature: assertionMethod.sign(data),
                    keyType: assertionMethod.type,
                })
            );
            console.log(ctype);
        } catch (e) {
            console.log("Error while checking on chain ctype");
            throw e;
        }
    })();
}
