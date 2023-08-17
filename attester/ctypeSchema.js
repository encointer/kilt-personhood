import * as Kilt from "@kiltprotocol/sdk-js";

// Return CType with the properties matching a given schema.
export function getCtypeSchema() {
    return Kilt.CType.fromProperties("Encointer Unique Personhood", {
        uniqueness_confidence: {
            type: "number",
        },
        valid_until: {
            type: "string",
        },
    });
}
