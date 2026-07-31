// utilities for conversion and cleanup

export function crToNumber( cr: string | { cr: string } ): number
{
    let val = (typeof cr === 'object' && cr !== null) ? cr.cr : cr;

    val = String(val || "0").trim();

    if( val.includes('/') )
    {
        const [num, den] = val.split('/').map( parseFloat );
        if (num === undefined || den === undefined || den === 0)
        {
            return 0;
        }

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
