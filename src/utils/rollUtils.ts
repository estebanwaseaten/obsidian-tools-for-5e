

export function rollD20(): number
{
    return rollDY( 20 );
}

export function rollDY( Y: number ): number
{
    return Math.floor(Math.random() * Y) + 1;
}

export function rollXDY( X: number, Y: number): number
{
    let result = 0;
    for( let i = 0; i < X; i++ )
    {
        result += rollDY( Y );
    }
    return result;
}

export function rollDiceFormula( formula: string ) : number
{
    const cleanFormula = formula.replace(/\s+/g, "").toLowerCase();
    const match = cleanFormula.match(/^(\d+)d(\d+)([+-]\d+)?$/);

    const diceCount = parseInt(match[1] );
    const diceSides = parseInt(match[2] );
    const modifier = match[3] ? parseInt( match[3] ) : 0;

    if( diceCount <= 0 || diceSides <= 0 )
    {
        return 0;
    }

    return rollXDY( diceCount, diceSides ) + modifier;
}
