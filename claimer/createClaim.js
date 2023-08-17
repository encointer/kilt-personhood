import * as Kilt from '@kiltprotocol/sdk-js'

// Create a Claim object from light DID, CType and given content.
export function createClaim(lightDid, ctype, content) {
  const claim = Kilt.Claim.fromCTypeAndClaimContents(ctype, content, lightDid)

  return claim
}