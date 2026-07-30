
export interface CharacterYAML
{
    type: string;
    status: string;
    name: string;
    race?: string;
    class?: string;
    ac?: number || null;
    hpMax?: number || null;
    iniBonus?: number || null;
    source?: string;
}

export interface MyCharacter
{
    name: string;
    class: string;
    level: number;
    player: string;    // Name des Spielers am Tisch
    ac: number;
    hpMax: number;
    passivePerception: number;

    filePath: string;
}


export interface MyNPC
{
    name: string;
    class: string;
    level: number;
    player: string;    // Name des Spielers am Tisch
    ac: number;
    hpMax: number;
    passivePerception: number;

    attitude: "friendly" | "neutral" | "hostile";

    actions: {name: string; description: string; }[];

    filePath: string;
}
