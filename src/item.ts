import { App, FuzzySuggestModal } from "obsidian";

export interface MyVariant
{
    name: string,
    markdownlink: string,
}

export interface MyItem
{
    name: string;
    source: string;

    markdownlink?: string;
    imagePath?: string;
    detail?: string;
    infotext?: string;
    cost?: string | number;
    weight?: string | number;
    damage?: string | number;
    damage2?: string | number;
    ac?: string | number;
    range?: string | number;
    rarity?: string;
    rarityInt?: number;
    type?: string;
    variants?: MyVariant[];

    value?: number;
    valueRarity?: number;

    dmg1?: number | string;
    dmgType?: string;
    ammoType?: string;

    entries?: any[];

    weapon?: boolean;
    firearm?: boolean;

    weaponCategory?: string;
    mastery?: string;


    //from fluff
    fluffImage?: string | "";
    fluffText?: string | null;
}


export class ItemSuggestionModal extends FuzzySuggestModal<MyItem>
{
    constructor( plugin: App, private items: MyItem[], private onPick: (i: MyItem )=> void)
    {
        super( plugin );
        this.setPlaceholder("Pick an item...")
    }
    getItemText(item: MyItem): string
    {
        return item.name;
    }

    getItems(): MyItem[]
    {
        return this.items;
    }

    onChooseItem( item: MyItem ): void
    {
        this.onPick( item );
    }
}
