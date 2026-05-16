

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
