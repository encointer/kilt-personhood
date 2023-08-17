import * as Kilt from '@kiltprotocol/sdk-js'
import {
  blake2AsU8a,
  keyExtractPath,
  keyFromPath,
  mnemonicGenerate,
  mnemonicToMiniSecret,
  sr25519PairFromSeed,
} from '@polkadot/util-crypto'
import { generateAccount } from './generateAccount.js'

// Because there is no first-class support for this class of keys,
// we need to use a workaround to generate a key we can use for encryption/decryption.
function generateKeyAgreement(mnemonic) {
  const secretKeyPair = sr25519PairFromSeed(mnemonicToMiniSecret(mnemonic))
  const { path } = keyExtractPath('//did//keyAgreement//0')
  const { secretKey } = keyFromPath(secretKeyPair, path, 'sr25519')
  return Kilt.Utils.Crypto.makeEncryptionKeypairFromSeed(blake2AsU8a(secretKey))
}

export function generateKeypairs(mnemonic = mnemonicGenerate()) {
  const { account } = generateAccount(mnemonic)

  const authentication = {
    ...account.derive('//did//0'),
    type: 'sr25519',
  }

  const assertionMethod = {
    ...account.derive('//did//assertion//0'),
    type: 'sr25519',
  }

  const capabilityDelegation = {
    ...account.derive('//did//delegation//0'),
    type: 'sr25519',
  }

  const keyAgreement = generateKeyAgreement(mnemonic)

  return {
    authentication: authentication,
    keyAgreement: keyAgreement,
    assertionMethod: assertionMethod,
    capabilityDelegation: capabilityDelegation,
  }
}