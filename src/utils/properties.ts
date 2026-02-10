/**
 * Parses a property flag string in the format "key=value".
 *
 * Splits on the first "=" only, so values may contain additional "=" characters.
 * An empty value (e.g. "key=") signals property deletion.
 *
 * @param raw - The raw flag string (e.g. "code=1010", "address=Rua paulo afonso 1096")
 * @returns A tuple of [key, value]
 * @throws If the string has no "=" or the key is empty
 */
export function parsePropertyFlag(raw: string): [string, string] {
    const eqIndex = raw.indexOf('=');
    if (eqIndex === -1) {
        throw new Error(`Invalid property format: "${raw}". Expected key=value`);
    }
    const key = raw.substring(0, eqIndex);
    if (key.trim() === '') {
        throw new Error(`Invalid property format: "${raw}". Key cannot be empty`);
    }
    const value = raw.substring(eqIndex + 1);
    return [key, value];
}
