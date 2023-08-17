import { Keyring } from "@polkadot/keyring";
import {
    commitReputation,
    decodeObject,
    encodeObject,
    getProofOfAttendance,
    getReputationCindexes,
    getSalts,
    getTimestampOfNextRegisteringPhase,
    parseCid,
    parseEvents,
} from "./lib.js";

import { cryptoWaitReady } from "@polkadot/util-crypto";
import { generateCredential } from "../claimer/generateCredential.js";
import { generateLightDid } from "../claimer/generateLightDid.js";

export async function generatePoPCredential(
    api,
    cidString,
    prefilledSalts,
    signerMnemonic,
    didMnemonic,
    commitment_purpose
) {
    await cryptoWaitReady();

    const claimerDid = generateLightDid(didMnemonic);

    const keyring = new Keyring({ type: "sr25519" });
    const account = keyring.addFromUri(signerMnemonic);

    const cid = parseCid(cidString);
    const reputationCindexes = await getReputationCindexes(api, cid, account);

    prefilledSalts = prefilledSalts ? decodeObject(prefilledSalts) : {};
    const salts = getSalts(prefilledSalts, cidString, reputationCindexes);

    let nonce = await api.rpc.system.accountNextIndex(account.address);
    const commitReputations = reputationCindexes.map((cindex, idx) =>
        commitReputation(
            api,
            account,
            cid,
            cindex,
            commitment_purpose,
            claimerDid.uri,
            salts[cidString][cindex],
            nonce.addn(idx)
        )
    );

    let blockHashes = await Promise.all(commitReputations);

    for (let blockHash of blockHashes) {
        let eventDetails = await parseEvents(api, blockHash);
        eventDetails.filter(
            (e) => e[0] === "encointerReputationCommitments.commitReputation"
        );
        for (let eventDetail of eventDetails) {
            const commitReputationStatus = eventDetail[1];
            if (
                ![
                    "ExtrinsicSuccess",
                    "ExtrinsicFailed::encointerReputationCommitments.AlreadyCommited",
                ].includes(commitReputationStatus)
            ) {
                throw new Error(
                    `Commiting reputation failed.\n${commitReputationStatus}`
                );
            }
        }
    }
    const proofs = await Promise.all(
        reputationCindexes.map((cindex) =>
            getProofOfAttendance(api, account, cid, cindex)
        )
    );
    const validUntil = await getTimestampOfNextRegisteringPhase(api);
    console.log(validUntil.toString());

    const proofsHex = api.registry
        .createType("Vec<ProofOfAttendance>", proofs)
        .toHex();

    const credential = generateCredential(claimerDid.uri, {
        uniqueness_confidence: proofs.length,
        valid_until: validUntil.toString(),
    });

    return {
        proofs: proofsHex,
        salts: encodeObject(salts),
        credential: encodeObject(credential)
    }
}
