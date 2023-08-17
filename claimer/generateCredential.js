import { config as envConfig } from "dotenv";

import * as Kilt from "@kiltprotocol/sdk-js";

import { createClaim } from "./createClaim.js";
import { generateLightDid } from "./generateLightDid.js";
import { getCtypeSchema } from "../attester/ctypeSchema.js";
import esMain from "es-main";

export function generateCredential(claimerDid, claimAttributes) {
    // Create claim.
    const ctype = getCtypeSchema();
    const claim = createClaim(claimerDid, ctype, claimAttributes);

    // Create credential and request attestation.
    console.log("Claimer -> create request");
    return Kilt.Credential.fromClaim(claim);
}

if (esMain(import.meta)) {
    (async () => {
        envConfig();

        try {
            await Kilt.init();

            const claimerDidMnemonic = process.env.CLAIMER_DID_MNEMONIC;
            const claimerDid = generateLightDid(claimerDidMnemonic);

            const request = generateCredential(claimerDid.uri, {
                uniqueness_confidence: 5,
                valid_until: "8.8.2023, 16:37:06",
                salt: "salterino",
            });
            console.log(
                "⚠️  save this to ./claimer/_credential.json for testing  ⚠️\n\n"
            );

            console.log(JSON.stringify(request, null, 2));
        } catch (e) {
            console.log("Error while building credential");
            throw e;
        }
    })();
}
