import { ItemView, Notice, WorkspaceLeaf } from "obsidian";

import type ToolsFor5e from "../main";

import { MyBeast, BeastUtils } from "../beast";
import { MySpell } from "../spell";
import { MyItem } from "../item";
import { MyCharacter, MyNPC } from "../character";
import { clean5eTags } from '../utils/convUtils';

export const DETAIL_VIEW = "tools-for-5e-detail-pane";

export type DetailData =
    | { kind: "beast"; data: MyBeast }
    | { kind: "spell"; data: MySpell }
    | { kind: "item";  data: MyItem  }
    | { kind: "npc";  data: MyNPC  }
    | { kind: "character";  data: MyCharacter  };

export class MyDetailView extends ItemView
{
    private currentData: DetailData | null = null;

    constructor( leaf: WorkspaceLeaf, public plugin: ToolsFor5e )
    {
       super(leaf);
    }

    getViewType()    { return DETAIL_VIEW; }
    getDisplayText() { return "5e Detail"; }
    getIcon()        { return "book-open"; }

/*    showItem( current: DetailData )
    {
        this.currentData = current;
        this.render();
    }*/

    async onOpen()
    {
         this.render();
    }

    async onClose() {}

    update( current: DetailData )
    {
        this.currentData = current;
        this.render();
    }

    private render()
    {
        const root = this.contentEl;
        root.empty();
        root.addClass("tools-for-5e-view-container");

        if (!this.currentData) {
           root.createDiv({
               text: "Select something from a list above.",
               cls: "tools-for-5e-detail-placeholder"
           });
           return;
       }

       const detailEl = root.createDiv({ cls: "tools-for-5e-detail-content" });

        switch( this.currentData.kind )
        {
            case "beast": this.renderBeast( detailEl, this.currentData.data ); break;
            case "spell": this.renderSpell( detailEl, this.currentData.data ); break;
            case "item":  this.renderItem( detailEl, this.currentData.data );  break;
            case "character":  this.renderCharacter( detailEl, this.currentData.data );  break;
            case "npc":  this.renderNPC( detailEl, this.currentData.data );  break;
        }
    }

    private renderBeast( el: HTMLElement, beast: MyBeast )    //temporaryFixedData = plugin.myBestiary.getDataItem( monsterName, source );
    {
        //el.createEl("h3", { text: beast.name });
        // ...

        // do this in BeastUtils, because we also need it for the encounter view
        BeastUtils.createStatBlock( el, beast, this.plugin );
    }

    private renderSpell( el: HTMLElement, spell: MySpell )
    {
        const spellContainer = el.createEl( "div", { cls: "tools-for-5e-detail-spell-container" } )
        spellContainer.createEl( "h3", { text: spell.name });
        //console.log( spell );


        const levelText = spell.levelInt === 0 ? "Cantrip" : `Level ${spell.level}`;

        spellContainer.createEl("div", {
            text: `${levelText} ${spell.school}`,
            cls: "tools-for-5e-detail-spell-subtitle"
            });

        const ritualText = spell.isritual ? " or Ritual" : "";


        this.createInlineStat( spellContainer, "Casting time", `${spell.castingtime}${ritualText}` );
        this.createInlineStat( spellContainer, "Range", `${spell.range}` );
        this.createInlineStat( spellContainer, "Components", `${spell.components}` );
        this.createInlineStat( spellContainer, "Duration", `${spell.duration}` );

        if( spell.entries )
        {
            this.renderEntries( spellContainer, spell.entries );
        }


    }


    private renderItem( el: HTMLElement, item: MyItem )
    {
        const itemContainer = el.createEl( "div", { cls: "tools-for-5e-detail-item-container" } )
        itemContainer.createEl("h3", { text: item.name });
        // ...
        console.log( item );

        let rarityText = "";
        if( item.rarity && item.rarity !== "none" )
        {
            rarityText = item.rarity;
        }
        else if( item.valueRarity )
        {
           rarityText = `${item.valueRarity} (Economic Value)`;
        }
        else
        {
           rarityText = "Common / Standard";
        }

        if( rarityText )
            this.createInlineStat( itemContainer, "Rarity", `${rarityText}` );

        if( item.value )
            this.createInlineStat( itemContainer, "Value", `${item.value}` );

        if( item.weight )
            this.createInlineStat( itemContainer, "Weight", `${item.weight}` );

        if( item.entries )
        {
            this.renderEntries( itemContainer, item.entries );
        }

        if( item.weapon )
        {
            let info = "";
            if( item.firearm )
            {
                info = " (Firearm)"
            }

            itemContainer.createEl("div", { cls: "tools-for-5e-detail-item-subtitle", text: `Weapon ${info}` });

            if( item.dmg1 )
                this.createInlineStat( itemContainer, "Damage", `${item.dmg1}` );

            if( item.range )
                this.createInlineStat( itemContainer, "Range", `${item.range}` );

            if( item.weaponCategory )
                this.createInlineStat( itemContainer, "Range", `${item.weaponCategory}` );

            if( item.mastery )
                this.createInlineStat( itemContainer, "Range", `${item.mastery}` );

            if( item.dmgType )
                this.createInlineStat( itemContainer, "Range", `${item.dmgType}` );

            if( item.ammoType )
                this.createInlineStat( itemContainer, "Ammo type", `${item.ammoType}` );

        }
    }

    private renderCharacter( el: HTMLElement, character: MyCharacter )
    {
        el.createEl("h3", { text: character.name });

        // ...
        console.log( character );

    }

    private renderNPC( el: HTMLElement, npc: MyNPC )
    {
        el.createEl("h3", { text: npc.name });
        // ...
        console.log( npc );

    }

    //helper functions
    //mainly spells, but also items
    private renderEntries( parent: HTMLElement, entries: any[] )
    {
        if( !Array.isArray(entries) )
            return;

        entries.forEach((entry) =>
        {
            if( typeof entry === "string" )
            {
                const p = parent.createEl("p", { cls: "tools-for-5e-spell-p" });
                p.innerHTML = clean5eTags( entry ); // Tags wie {@condition Invisible} säubern
            }
            else if (typeof entry === "object" && entry !== null)
            {
                if (entry.type === "list")
                {
                    const ul = parent.createEl("ul", { cls: "tools-for-5e-spell-list" });

                    if( Array.isArray( entry.items ) )
                    {
                        entry.items.forEach( (item: any) =>
                        {
                            const li = ul.createEl( "li", {cls: "tools-for-5e-list-item"} );
                            if( item.name )
                            {
                                li.createEl( "strong", { text: `${item.name}: `, cls: "tools-for-5e-list-name"} )
                            }

                            if( Array.isArray( item.entries ) )
                            {
                                const spanContainer = li.createEl( "span" );
                                this.renderEntries( spanContainer, item.entries );
                            }
                            else if( typeof item === "string" )
                            {
                                li.createEl( "span" ).innerHTML = clean5eTags( item );
                            }
                        });
                    }
                }
            }
        });
    }

    private createInlineStat( parent: HTMLElement, label: string, value: string)
    {
        const row = parent.createEl( "div", {cls: "tools-for-5e-inline-stat-row" });
        row.createEl( "strong", {text: `${label}: `, cls: "tools-for-5e-label" });
        row.createEl( "span", { text: value || "-" });
    }
}
