import {
    cryptoWaitReady,
    blake2AsHex,
    signatureVerify,
} from "@polkadot/util-crypto";
import assert from "assert";
import crypto from "crypto";
import base58 from "bs58";
import { BN } from "bn.js";

export async function parseEvents(api, blockHash) {
    const signedBlock = await api.rpc.chain.getBlock(blockHash);
    const allRecords = await api.query.system.events.at(blockHash);
    const result = [];
    // map between the extrinsics and events
    signedBlock.block.extrinsics.forEach(
        ({ method: { method, section } }, index) => {
            allRecords
                // filter the specific events based on the phase and then the
                // index of our extrinsic in the block
                .filter(
                    ({ phase }) =>
                        phase.isApplyExtrinsic &&
                        phase.asApplyExtrinsic.eq(index)
                )
                // test the events against the specific types we are looking for
                .forEach(({ event }) => {
                    if (api.events.system.ExtrinsicSuccess.is(event)) {
                        // extract the data for this event
                        // (In TS, because of the guard above, these will be typed)
                        const [dispatchInfo] = event.data;
                        result.push([
                            `${section}.${method}`,
                            "ExtrinsicSuccess",
                        ]);
                        console.log(
                            `${section}.${method}:: ExtrinsicSuccess:: ${JSON.stringify(
                                dispatchInfo.toHuman()
                            )}`
                        );
                    } else if (api.events.system.ExtrinsicFailed.is(event)) {
                        // extract the data for this event
                        const [dispatchError, dispatchInfo] = event.data;
                        let errorInfo;

                        // decode the error
                        if (dispatchError.isModule) {
                            // for module errors, we have the section indexed, lookup
                            // (For specific known errors, we can also do a check against the
                            // api.errors.<module>.<ErrorName>.is(dispatchError.asModule) guard)
                            const decoded = api.registry.findMetaError(
                                dispatchError.asModule
                            );

                            errorInfo = `${decoded.section}.${decoded.name}`;
                        } else {
                            // Other, CannotLookup, BadOrigin, no extra info
                            errorInfo = dispatchError.toString();
                        }

                        console.log(
                            `${section}.${method}:: ExtrinsicFailed:: ${errorInfo}`
                        );
                        result.push([
                            `${section}.${method}`,
                            `ExtrinsicFailed::${errorInfo}`,
                        ]);
                    }
                });
        }
    );
    return result;
}
function getXtPromise(xt, signer, nonce = -1) {
    return new Promise(async (resolve, reject) => {
        const unsub = await xt.signAndSend(
            signer,
            { nonce },
            ({ events = [], status }) => {
                if (status.isInBlock) {
                    unsub();
                    try {
                        const blockHash = status.asInBlock;
                        console.log(
                            `Txns in unfinalized block: ${blockHash} waiting...`
                        );
                        resolve(blockHash);
                    } catch (e) {
                        console.log(e);
                    }
                }
                if (status.isDropped) {
                    unsub();
                    reject("Block has been dropped!");
                }
                if (status.isFinalized) {
                    unsub();
                    resolve(status.asFinalized);
                }
            }
        );
    });
}

export function getCommitmentHash(did, salt) {
    return blake2AsHex(did + salt);
}
export function commitReputation(
    api,
    attendee,
    cid,
    cindex,
    purposeId,
    did,
    salt,
    nonce = -1
) {
    const commitmentHash = getCommitmentHash(did, salt);
    const commitReputationXt =
        api.tx.encointerReputationCommitments.commitReputation(
            cid,
            cindex,
            purposeId,
            commitmentHash
        );
    const promise = getXtPromise(commitReputationXt, attendee, nonce);

    return promise;
}

export async function verifyProofOfAttendanceSignature(api, proof) {
    const msg = api.registry.createType("(AccountId, CeremonyIndexType)", [
        proof.attendeePublic,
        proof.ceremonyIndex,
    ]);
    const { isValid } = signatureVerify(
        msg.toU8a(),
        proof.attendeeSignature.toHuman().Sr25519,
        proof.attendeePublic
    );
    return isValid;
}

export async function getProofOfAttendance(api, attendee, cid, cindex) {
    await cryptoWaitReady();
    assert(attendee && attendee.address, "Invalid attendee");
    assert(attendee.sign, "Attendee should have sign method");
    assert(cid, "Invalid Community Identifier");
    assert(cindex > 0, "Invalid Ceremony index");
    const attendeePublic = api.registry
        .createType("AccountId", attendee.address)
        .toU8a();
    // !Prover has same address as attendee, will be changed in future!
    const proverPublic = attendeePublic;
    const communityIdentifier = api.registry.createType(
        "CommunityIdentifier",
        cid
    );
    const msg = api.registry.createType("(AccountId, CeremonyIndexType)", [
        proverPublic,
        cindex,
    ]);
    const signature = attendee.sign(msg.toU8a(), { withType: true });
    const proof = api.registry.createType("ProofOfAttendance", {
        proverPublic: proverPublic,
        ceremonyIndex: cindex,
        communityIdentifier: communityIdentifier,
        attendeePublic: attendeePublic,
        attendeeSignature: signature,
    });
    return api.registry.createType("ProofOfAttendance", proof);
}

export async function getTimestampOfNextRegisteringPhase(api) {
    let phaseDurations =
        await api.query.encointerScheduler.phaseDurations.multi([
            "Assigning",
            "Attesting",
        ]);

    let currentPhase = (
        await api.query.encointerScheduler.currentPhase()
    ).toPrimitive();
    let nextPhaseTimestamp = (
        await api.query.encointerScheduler.nextPhaseTimestamp()
    ).toString();
    nextPhaseTimestamp = new BN(nextPhaseTimestamp);
    if (currentPhase === "Attesting") return nextPhaseTimestamp;
    if (currentPhase === "Assigning")
        return nextPhaseTimestamp.add(phaseDurations[1]);
    return nextPhaseTimestamp.add(phaseDurations[0]).add(phaseDurations[1]);
}

export const getCurrentCindex = async (api) =>
    (await api.query.encointerScheduler.currentCeremonyIndex()).toPrimitive();

export const getReputationLifetime = async (api) =>
    (await api.query.encointerCeremonies.reputationLifetime()).toPrimitive();

export async function getReputationCindexes(api, cid, account) {
    const currentCindex = await getCurrentCindex(api);

    let reputationLifetime = await getReputationLifetime(api);

    reputationLifetime = 5;
    const queries = [];
    for (let i = 0; i <= reputationLifetime; i++) {
        queries.push([[cid, currentCindex - i], account.address]);
    }

    let reputations =
        await api.query.encointerCeremonies.participantReputation.multi(
            queries
        );

    return reputations
        .map((r, idx) =>
            ["VerifiedUnlinked", "VerifiedLinked"].includes(r.toHuman())
                ? currentCindex - idx
                : null
        )
        .filter((r) => r);
}

export async function verifyReputaionCommitment(
    api,
    cid,
    cindex,
    address,
    purpose_id,
    commitment_hash
) {
    const res = await api.query.encointerReputationCommitments.commitments(
        [cid, cindex],
        [purpose_id, address]
    );
    return res.toString() === commitment_hash;
}

const convert = (from, to) => (str) => Buffer.from(str, from).toString(to);
const utf8ToHex = convert("utf8", "hex");
const hexToUtf8 = convert("hex", "utf8");

export function parseCid(cid) {
    return {
        geohash: cid.substring(0, 5),
        digest:
            "0x" +
            Buffer.from(base58.decode(cid.substring(5, 11))).toString("hex"),
    };
}

export function encodeCid(cid) {
    return (
        hexToUtf8(cid.geohash.substring(2)) +
        base58.encode(Buffer.from(cid.digest.substring(2), "hex"))
    );
}

export function getSalts(prefilledSalts, cid, cindexes) {
    const salts = {};
    salts[cid] = {};

    for (const cindex of cindexes) {
        salts[cid][cindex] =
            prefilledSalts[cid]?.[cindex] ||
            crypto.randomBytes(16).toString("base64");
    }
    return salts;
}

export function encodeObject(obj) {
    return btoa(JSON.stringify(obj));
}

export function decodeObject(obj) {
    return JSON.parse(atob(obj));
}
