import * as Kilt from '@kiltprotocol/sdk-js'

export async function createPresentation(credential, signCallback, challenge) {
  // Create the presentation from credential, DID and challenge.
  return Kilt.Credential.createPresentation({
    credential,
    signCallback,
    challenge,
  })
}