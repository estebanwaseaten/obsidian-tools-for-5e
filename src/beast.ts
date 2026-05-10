import { App, FuzzySuggestModal } from "obsidian";


export interface MyBeast
{
    id: string;
    raw: string;
    tags: string;
    name: string;
    markdownlink: string;
    imagePath: string;
    filePath: string;
    detail: string;
    infotext: string;
    cost: string | number;
    weight: string | number;
    damage: string | number;
    damage2: string | number;
    ac: string | number;
    range: string | number;
    rarity: string;
    rarityInt: number;
    type: string;
    variants: MyVariant[];
    source: string;

    fluffText?: string | null;
    fluffImage?: string | null;
}




export class BeastSuggestionModal extends FuzzySuggestModal<MyItem>
{
    constructor( plugin: App, private items: MyBeast[], private onPick: (i: MyBeast )=> void)
    {
        super(plugin);
        this.setPlaceholder("Pick a beast...")
    }

    getItemText(beast: MyBeast): string
    {
        return beast.name;
    }

    getItems(): MyBeast[]
    {
        return this.beast;
    }

    onChooseItem( beast: MyBeast ): void
    {
        this.onPick( beast );
    }
}
