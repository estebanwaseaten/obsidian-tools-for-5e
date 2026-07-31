import { App, FuzzySuggestModal } from "obsidian";

export interface MySpell
{
    name: string;
    markdownlink: string;
    imagePath: string;
    filePath: string;
    castingtime: string;
    isritual: boolean;
    range: string;
    components: string;
    duration: string;
    level: string;
    levelInt: number;
    detail: string;
    infotext: string;
    school: string;
    source: string;

    entries: any[];

    //from fluff
    fluffImage?: string;

    //from sources.json
    classNames?: Set<string>;
    classVariantNames?: Set<string>;
}


export class SpellSuggestionModal extends FuzzySuggestModal<MySpell>
{
    constructor( plugin: App, private spells: MySpell[], private onPick: (i: MySpell )=> void)
    {
        super(plugin);
        this.setPlaceholder("Pick an spell...")
    }
    getItemText(spell: MySpell): string
    {
        return spell.name;
    }
    getItems(): MySpell[]
    {
        return this.spells;
    }
    onChooseItem( spell: MySpell ): void
    {
        this.onPick( spell );
    }
}
