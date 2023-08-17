import {
    decodeObject,
    encodeCid,
    getCommitmentHash,
    getCurrentCindex,
    getReputationLifetime,
    getTimestampOfNextRegisteringPhase,
    verifyProofOfAttendanceSignature,
    verifyReputaionCommitment,
} from "./lib.js";
import * as Kilt from "@kiltprotocol/sdk-js";
import { attestCredential } from "../attester/attestCredential.js";
import { generateAccount } from "../attester/generateAccount.js";
import { generateKeypairs } from "../attester/generateKeypairs.js";

export async function attestPopCredential(
    api,
    proofs,
    credential,
    salts,
    attesterAccountMnemonic,
    attesterDidMnemonic,
    commitment_purpose
) {
    proofs = api.registry.createType("Vec<ProofOfAttendance>", proofs);
    if (!proofs.every((p) => verifyProofOfAttendanceSignature(api, p)))
        throw new Error("Invalid Proofs");

    salts = decodeObject(salts);
    credential = decodeObject(credential);

    const currentCindex = await getCurrentCindex(api);
    const reputationLifetime = await getReputationLifetime(api);

    for (let proof of proofs) {
        if (!verifyProofOfAttendanceSignature(api, proof))
            throw new Error("Invalid Proof");

        proof = JSON.parse(proof.toString());
        const { proverPublic, ceremonyIndex, communityIdentifier } = proof;
        const cidString = encodeCid(communityIdentifier);
        const salt = salts[cidString][ceremonyIndex];
        if (ceremonyIndex < currentCindex - reputationLifetime - 1)
            throw new Error("Outdated cindex");

        if (
            !(await verifyReputaionCommitment(
                api,
                communityIdentifier,
                ceremonyIndex,
                proverPublic,
                commitment_purpose,
                getCommitmentHash(credential.claim.owner, salt)
            ))
        ) {
            throw new Error("Reputation not commited");
        }
    }

    const validUntil = await getTimestampOfNextRegisteringPhase(api);

    if (credential.claim.contents.valid_until !== validUntil.toString())
        throw new Error("Invalid valid_until");
    if (credential.claim.contents.uniqueness_confidence !== proofs.length)
        throw new Error("Invalid uniqueness_confidence");

    console.log("credential is valid");

    await Kilt.connect(process.env.KILT_WSS_ADDRESS);

    console.log("connected to kilt chain");
    const { account: attesterAccount } = generateAccount(
        attesterAccountMnemonic
    );
    const { authentication, assertionMethod } =
        generateKeypairs(attesterDidMnemonic);
    const attesterDidUri = Kilt.Did.getFullDidUriFromKey(authentication);

    await attestCredential(
        attesterAccount,
        attesterDidUri,
        credential,
        async ({ data }) => ({
            signature: assertionMethod.sign(data),
            keyType: assertionMethod.type,
        })
    );

    console.log("credential attested");
}
