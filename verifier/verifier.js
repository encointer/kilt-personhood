import { config as envConfig } from "dotenv";

import * as Kilt from "@kiltprotocol/sdk-js";

import { createPresentation } from "../claimer/createPresentation.js";
import { generateKeypairs } from "../claimer/generateKeypairs.js";
import { generateLightDid } from "../claimer/generateLightDid.js";
import esMain from "es-main";

export function getChallenge() {
    return Kilt.Utils.UUID.generate();
}

// Verifies validity, ownership & attestation.
export async function verifyPresentation(
    api,
    presentation,
    challenge,
    trustedAttesterUris
) {
    try {
        const { revoked, attester } = await Kilt.Credential.verifyPresentation(
            presentation,
            { challenge }
        );

        if (revoked) {
            return false;
        }
        // Returns true if no trusted attester URI is provided or, if it is, if it matches the one that issued the presented credential.
        return trustedAttesterUris.includes(attester);
    } catch {
        return false;
    }
}

export async function verificationFlow(
    credential,
    signCallback,
    trustedAttesterUris = []
) {
    const api = Kilt.ConfigService.get("api");

    // Verifier sends a unique challenge to the claimer 🕊
    const challenge = getChallenge();

    // Create a presentation and send it to the verifier 🕊
    const presentation = await createPresentation(
        credential,
        signCallback,
        challenge
    );

    // The verifier checks the presentation.
    const isValid = await verifyPresentation(
        api,
        presentation,
        challenge,
        trustedAttesterUris
    );

    if (isValid) {
        console.log(
            "Verification successful! You are allowed to enter the club 🎉"
        );
    } else {
        console.log("Verification failed! 🚫");
    }
}

if (esMain(import.meta)) {
    (async () => {
        envConfig();

        try {
            await Kilt.connect(process.env.WSS_ADDRESS);
            const claimerDidMnemonic = process.env.CLAIMER_DID_MNEMONIC;
            const { authentication } = generateKeypairs(claimerDidMnemonic);
            const claimerDid = generateLightDid(claimerDidMnemonic);
            const attesterDid = process.env.ATTESTER_DID_URI;
            // Load credential and claimer DID
            const credential = JSON.parse(process.env.CLAIMER_CREDENTIAL);
            await verificationFlow(
                credential,
                async ({ data }) => ({
                    signature: authentication.sign(data),
                    keyType: authentication.type,
                    keyUri: `${claimerDid.uri}${claimerDid.authentication[0].id}`,
                }),
                [attesterDid]
            );
        } catch (e) {
            console.log("Error in the verification flow");
            throw e;
        }
    })();
}
