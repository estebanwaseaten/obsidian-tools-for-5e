

export function crToNumber(cr: string): number
{
    let val = typeof cr === 'object' ? cr.cr : cr;

    val = String(val || "0").trim();

    if (val.includes('/')) {
        const [num, den] = val.split('/').map(parseFloat);
        return num / den;
    }

    return parseFloat(val) || 0;
}

export function clean5eTags(text: string): string
{
    if( !text )
        return "";

    return text.replace(/\{@[a-z]+\s+([^|}]+)(?:\|[^}]+)?\}/gi, "$1");
}
