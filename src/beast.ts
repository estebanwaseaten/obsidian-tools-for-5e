import { App, FuzzySuggestModal } from "obsidian";

/*name: string;
source: string;
page?: string;
size?: string;
type?: string;
ac?: string[];  //can be an array
hp?: {
    special?: string;
    average?: string;
    formula?: string; };
speed?: {
    walk?: string;
    swim?: string;
    canHover?: boolean;
    fly?: { number?: string; condition?: string } | string;
};

str?: string;
dex?: string;
con?: string;
int?: string;
wis?: string;
cha?: string;

//skill
//senses
passive?: string;

immune?: string[];
conditionImmune?: string[];
languages?: string[];

cr?: string;

trait?: {name: string; entries: string[]; }[];
action?: {name: string; entries: string[]; }[];

hasToken?: boolean;
hasFluff?: boolean;
hasFluffImages?: boolean;*/

export interface MyBeast
{
    name: string;
    source: string;
    page?: string;

    str?: string;
    dex?: string;
    con?: string;
    int?: string;
    wis?: string;
    cha?: string;

    raw?: string;
    tags?: string;

    ac?: string | number;

    //hasFluff?: boolean;
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
