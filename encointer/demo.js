import { ApiPromise, WsProvider } from "@polkadot/api";
import { options } from "@encointer/node-api/options";
import { config as envConfig } from "dotenv";
import { generatePoPCredential } from "./claimer.js";
import { attestPopCredential } from "./attester.js";
import { getChallenge, verifyPresentation } from "../verifier/verifier.js";
import { createPresentation } from "../claimer/createPresentation.js";
import * as Kilt from "@kiltprotocol/sdk-js";
import { generateKeypairs } from "../claimer/generateKeypairs.js";
import { generateLightDid } from "../claimer/generateLightDid.js";
import { decodeObject } from "./lib.js";

let encointer_rpc_endpoint = "wss://kusama.api.encointer.org";
// encointer_rpc_endpoint = "wss://gesell.encointer.org";
encointer_rpc_endpoint = "ws://127.0.0.1:9944";
encointer_rpc_endpoint = "wss://gesell.encointer.org";
const wsProvider = new WsProvider(encointer_rpc_endpoint);

(async () => {
    const api = await ApiPromise.create({
        ...options(),
        provider: wsProvider,
        signedExtensions: {
            ChargeAssetTxPayment: {
                extrinsic: {
                    tip: "Compact<Balance>",
                    assetId: "Option<CommunityIdentifier>",
                },
                payload: {},
            },
        },
    });

    envConfig();

    /// SETUP
    /////////
    const cidString = "e5dvt5mjcem";
    const prefilledSalts = null;
    const signerMnemonic = process.env.SIGNER_MNEMONIC;

    const claimerDidMnemonic = process.env.CLAIMER_DID_MNEMONIC;

    const attesterAccountMnemonic = process.env.ATTESTER_ACCOUNT_MNEMONIC;
    const attesterDidMnemonic = process.env.ATTESTER_DID_MNEMONIC;

    const { authentication } = generateKeypairs(claimerDidMnemonic);
    const claimerDid = generateLightDid(claimerDidMnemonic);
    const attesterDid = process.env.ATTESTER_DID_URI;

    const COMMITMENTPURPOSE = 19;

    // CLAIMER
    /////////

    let credentialData = await generatePoPCredential(
        api,
        cidString,
        prefilledSalts,
        signerMnemonic,
        claimerDidMnemonic,
        COMMITMENTPURPOSE
    );
    console.log(credentialData);

    /// SAFE CREDENTIAL DATA
    ///////////////
    // let credentialData = {
    //   proofs: '0x10f611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365fdf0600006535647674baa9744af611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365f01b449aa2c1697a86fdc663dbef444d93fd1ad6f1b30794b0b7a8b6a0d32d05908e0ea77e8cce3a22a6566d21ba74c4f449f95d5a406e61b9efc17240c26b1e089f611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365fdd0600006535647674baa9744af611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365f010ad3efe0bf7aa477922a3a9da7d337bcdbc85e199416e0bc8385ed49e66c5e51fd4b88c5be6b1316808d8e3bdf5dd4dde6a0d80c1bdc19ea545dd96c0b799581f611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365fdc0600006535647674baa9744af611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365f0144e579d4176cd1b21bdf9af6fe6f18cdeb6e0214ae6503cadb09eb77b51876568ad8292aa2f44928d244194fe75b767803809e44b609bc8e3866693a42ebab8cf611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365fdb0600006535647674baa9744af611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365f0140802e4d90b624895d6a17614a831f448666bd291f5c110361277e76bdd31951f507742f156e16e4ce6714ee8244d56b96bea1e8f7d51a8da162e7ebfd776288',
    //   salts: 'eyJlNWR2dDVtamNlbSI6eyIxNzU1IjoicnM5OVFtSmJuRzBsSll1eHYrTnJ5UT09IiwiMTc1NiI6InhnWnlabVpmTkIwUXhNbFVScEhyMGc9PSIsIjE3NTciOiJXdTBZSXFhU2ZxMUllTUJGbEYvTkVnPT0iLCIxNzU5Ijoiam1KUXJjQzk2SUxZUjlVbWVUR0JzQT09In19',
    //   credential: 'eyJjbGFpbSI6eyJjVHlwZUhhc2giOiIweGViMDVlNGIzNjMzZmNmMTZkY2RkYzdjNzIxYTk4OTA1YjNjYjUxN2MwNjFkNjc4NDc1MjdmNjI1MzY1M2FhNTMiLCJjb250ZW50cyI6eyJ1bmlxdWVuZXNzX2NvbmZpZGVuY2UiOjQsInZhbGlkX3VudGlsIjoiMTY5MjQ4OTYwMDAwMCJ9LCJvd25lciI6ImRpZDpraWx0OmxpZ2h0OjAwNHQyemRyWUZ1MW1RaW1melo0VU5xSjJneVlaNUZOUWZmcG14NlVHQ2h2N3hMUVhiOnoxNWRaU1J1ekVQVEZuQkVyUHhxSmllNENtbThNalB3enVkVVhmUTc1ZDR6aURvb3FZdVFnWjVxVUxWdTRRcld3Sm1zZ3RyRENOMWFZOE5FTXBIZXZaTkJwQXFYNGJFaWVzY0VKNFhBWktIVXB6NWNEUkhqRk1OUUhpazJYU0NFMTVwNlFlN2dNVkxTa3RjenVobmVBdCJ9LCJsZWdpdGltYXRpb25zIjpbXSwiY2xhaW1IYXNoZXMiOlsiMHgxZDJlMjRhZmRlMjM3ZmJiNWI1NTJlYTJmZmI1OGJiNWQ4NTcyODg4NTkwODgwY2MyN2UyN2UzMDVhMWI1OGJjIiwiMHg1ZTkxZjljZTc0OTExNjE5ODdhNDI2ZTRmMmFkNTBiM2U0ZTBhY2U2MDA1NTc2YTFjZmJiMDdhODAwMzJjYjFjIiwiMHg3ZjVjODg4NmFmOGM1ZTc1NGE2YzA5NDU4ZjQ1MmNkYTgyYmFiOTY1NGZhMzRjNmM0Mjc1Y2RlOWIxNDZlOGUzIl0sImNsYWltTm9uY2VNYXAiOnsiMHgxNDQxOGI4YmQyMDY1NTg1NmMyZjM2MWExMDA3M2M1ZDU3ODMxNmVhOWZiYmI0N2IzZDUyYjAxYjFjNjRjM2QzIjoiYjRkNGI1YzgtYzAwOS00MWVkLWI2OTItYmU0NWJlNDYyNGExIiwiMHhmZjI3MzkwNzY1YmQxZjk1MjA2MTYwN2ZmZjZmOWU0OGM1OThkZGEzMDBlMzVlMGEzMTg5ZDIxOThmOGUzNTJmIjoiNTNiYzg5NWEtZmQ1YS00YjIyLTkyYTYtN2EzMzE4NzA5YzRlIiwiMHgyY2MwNjRkOGYyNzE2MTJjMzRmZTczZTc4N2ZkYjQwNGEzZGI5MWU4M2MxMjU4NjEyYTQ1MjBmODczMWQ3MGYyIjoiMWZmNzI2MWYtYjM4OS00NDAyLTljNzItZTMzMzEzYzk4ZGI4In0sInJvb3RIYXNoIjoiMHg3Yjc4MjQ0NDM2NjJhOGE5Y2Y5NGI3YTI3NzgxMWYwYzkxNjlkYWZjOTNjNzhjNjg1ZTFjMGU2OWRhMjdkNWYyIiwiZGVsZWdhdGlvbklkIjpudWxsfQ=='
    // }

    ///////////////

    /// ATTESTER
    ///////////////

    let { proofs, credential, salts } = credentialData;
    await attestPopCredential(
        api,
        proofs,
        credential,
        salts,
        attesterAccountMnemonic,
        attesterDidMnemonic,
        COMMITMENTPURPOSE
    );

    //////VERIFICATION
    ////////

    await Kilt.connect(process.env.KILT_WSS_ADDRESS);

    credential = decodeObject(credential);

    const kiltApi = Kilt.ConfigService.get("api");

    // Verifier sends a unique challenge to the claimer 🕊
    const challenge = getChallenge();

    // Create a presentation and send it to the verifier 🕊
    const presentation = await createPresentation(
        credential,
        async ({ data }) => ({
            signature: authentication.sign(data),
            keyType: authentication.type,
            keyUri: `${claimerDid.uri}${claimerDid.authentication[0].id}`,
        }),
        challenge
    );

    // The verifier checks the presentation.
    const isValid = await verifyPresentation(kiltApi, presentation, challenge, [
        attesterDid,
    ]);

    if (isValid) {
        console.log(
            "Verification successful! You are allowed to enter the club 🎉"
        );
    } else {
        console.log("Verification failed! 🚫");
    }
})();
