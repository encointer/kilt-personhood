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

    const COMMITMENTPURPOSE = 18;

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
    //   proofs: '0x10f611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365fdf0600006535647674baa9744af611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365f010664d9b016244b6ad7d0b286f889ec46f8eb52d466cd3f9253e37a77a4f33537075a339cd7d8ae360f26226b241984ad3b24f99e674b1728db98e92553513481f611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365fdd0600006535647674baa9744af611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365f0158a2dcd933ae486b7d1e9e87d3f98c8a0dcc34c2d42b1b3efc79de47ab46ec0366ce8aabafba2c9b2d09121b2ff0c89add2370beb6de2088f88721f32cb9e781f611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365fdc0600006535647674baa9744af611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365f016428ac2ffe1e937aec31d92a861fc2f8afae6d50a9f72f3ea8c7959bcec47e118289cc36420c51668a34f8948819c86f9c7bbf7ce4bfc2b46cc00cd10854558bf611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365fdb0600006535647674baa9744af611d4e5518667c2b6e2d56cd51da315d37c220d7c39cbf0510d7dce8130365f018a1a5318304e73a2cbdecc61ba4f0cfc771daed967f81218705b26202e9b021bf88d7a6791b5193b3d360b4db1c19917e76852f5188fc5fb3a5ea68b32465b81',
    //   salts: 'eyJlNWR2dDVtamNlbSI6eyIxNzU1IjoiVk42dCtNWjNjaWQrNWJ6UWhLOFhkUT09IiwiMTc1NiI6Inc1Y1FGUVZTOTU4SHFVMmxwVVFYVVE9PSIsIjE3NTciOiJOR3hxUm90a2Y2VmdQaUtBbU0rOWRnPT0iLCIxNzU5Ijoic3NkU0V1VzBJK1NFV2VkMmRFRmhxZz09In19',
    //   credential: 'eyJjbGFpbSI6eyJjVHlwZUhhc2giOiIweGViMDVlNGIzNjMzZmNmMTZkY2RkYzdjNzIxYTk4OTA1YjNjYjUxN2MwNjFkNjc4NDc1MjdmNjI1MzY1M2FhNTMiLCJjb250ZW50cyI6eyJ1bmlxdWVuZXNzX2NvbmZpZGVuY2UiOjQsInZhbGlkX3VudGlsIjoiTmFOIn0sIm93bmVyIjoiZGlkOmtpbHQ6bGlnaHQ6MDA0dDJ6ZHJZRnUxbVFpbWZ6WjRVTnFKMmd5WVo1Rk5RZmZwbXg2VUdDaHY3eExRWGI6ejE1ZFpTUnV6RVBURm5CRXJQeHFKaWU0Q21tOE1qUHd6dWRVWGZRNzVkNHppRG9vcVl1UWdaNXFVTFZ1NFFyV3dKbXNndHJEQ04xYVk4TkVNcEhldlpOQnBBcVg0YkVpZXNjRUo0WEFaS0hVcHo1Y0RSSGpGTU5RSGlrMlhTQ0UxNXA2UWU3Z01WTFNrdGN6dWhuZUF0In0sImxlZ2l0aW1hdGlvbnMiOltdLCJjbGFpbUhhc2hlcyI6WyIweDEzMTBjMWY5MTQ5NGUwZDM4M2JmMzdmZTBhYTRjNGQ4ZmUzZTQwZjg3YWMyYmMwZTk1OTBiODg0MjhhODk3YjUiLCIweDRhNTVkNTVmYmQzMzliMzE4MmYxZjY2OGNkYTNjOWM0OWUxY2E5ZTc4MDAwMmM4ODdkYTM4MWMxZWZiN2EzOGMiLCIweDU0OTk1MzZiNmU3OGFiODEyMGJhNWIyY2FkN2Q4OWIwNTAzMjE1MTE2ODk4MjJkMzEzZjZhZWZjZmFlMzE3ODciXSwiY2xhaW1Ob25jZU1hcCI6eyIweDE0NDE4YjhiZDIwNjU1ODU2YzJmMzYxYTEwMDczYzVkNTc4MzE2ZWE5ZmJiYjQ3YjNkNTJiMDFiMWM2NGMzZDMiOiI1ZjIxYTA4Mi1mYzZhLTQ3MTItYjViNS0xNmYyYzU1YzA0ZDQiLCIweGZmMjczOTA3NjViZDFmOTUyMDYxNjA3ZmZmNmY5ZTQ4YzU5OGRkYTMwMGUzNWUwYTMxODlkMjE5OGY4ZTM1MmYiOiIzYThkMjc5YS0wY2RlLTQzNjQtYjUyOC00YzA5Nzg3ZmYzNDkiLCIweDEyZGFlMTZjY2IzZTEwZjdlODcwZWM1YTU2YTZjYWM3YjJmZWVlZjdmYTM3NDBkYzAxY2VhMTZlYWY0YmUyZGYiOiI4ZTc0OWQzMC1hYzUzLTQwYWEtYWEwYS0xMjgxOWE0MmEzMzkifSwicm9vdEhhc2giOiIweGI1MzNhOGZlOTliNTI5MjNmOGM5YTZhNDU5ZDI5MDE2OTRjZWJiZjQ2ZjQ0YzY2ZDE1NTNkMmYyYzM1Nzk2NjciLCJkZWxlZ2F0aW9uSWQiOm51bGx9'
    // };

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
