import { config as envConfig } from "dotenv";

import { mnemonicGenerate } from "@polkadot/util-crypto";

import * as Kilt from "@kiltprotocol/sdk-js";

import { generateKeypairs } from "./generateKeypairs.js";
import esMain from "es-main";

export function generateLightDid(mnemonic) {
    const { authentication, keyAgreement } = generateKeypairs(mnemonic);
    return Kilt.Did.createLightDidDocument({
        authentication: [authentication],
        keyAgreement: [keyAgreement],
    });
}

if (esMain(import.meta)) {
    (async () => {
        envConfig();

        try {
            await Kilt.init();

            const mnemonic = mnemonicGenerate();
            console.log("\nsave following to .env to continue\n");
            console.log(`CLAIMER_DID_MNEMONIC="${mnemonic}"`);
        } catch (e) {
            console.log("Error while setting up claimer DID");
            throw e;
        }
    })();
}
