import {  WorkspaceLeaf, Menu, setIcon, Notice } from "obsidian";
import type { MenuItem } from "obsidian";
import { getIconSVG } from "../common";

import type ToolsFor5e from "../main";     //only for default export
import { MyListView } from "./listview"
import { MyVariant, MyItem } from "../item";       //general export
import { ItemCompendium } from "../itemary";


export const ITEM_VIEW = "tools-for-5e-item-pane";

export class MyItemView extends MyListView<MyItem>
{
    private filterRarityEl!: HTMLElement;

    //sets defined via: --> precalc indices in "itemaryChanged()"
    private rarityArray: string[] = ["common", "uncommon", "rare", "very rare", "legendary", "artifact" ];
    private rarityIndex = new Map<string, Set<number>>();
    private rarityFilter: string[] = [];

    getDisplayText(): string { return "D&D Items"; }
    getIcon(): string { return "sword"; }
    getViewType(): string { return ITEM_VIEW; }

    //populate UI:
    async setupUI()
    {
        super.addSearchBar( "Search items..." );
        super.addDefaultFilterElements();
        this.buildCustomFilters();
        super.addDefaultSortElement();
    }

    renderRow( row: HTMLElement, item: MyItem ): void
    {
        const td = row.createEl("td");
        td.createSpan({ text: item.name });
        const td2 = row.createEl("td");
        td2.createDiv( { text: "info", attr: { "data-action": "info" } } );
        const td3 = row.createEl("td");
        td3.createDiv( { text: "insert", attr: { "data-action": "insert" } } );
    }

    onItemSelected( item: MyItem, action: string ): void
    {
        //new Notice( "ItemView: " + item.name + ": " + action );

        if (action === "default")
        {
            this.plugin.showDetail({ kind: "item", data: item }, this.leaf );
        }
        // select and show in info window

        //copy or insert into .md

        //monster: add to ecounter?
    }

    rebuildCustomIndices(): void
    {
          //rarityIndex is a map of 'item.rarity' to a set of indices pointing into allItems
          this.rarityIndex.clear();
          //this.rarityArray = [];  //is fixed

          this.allItems.forEach(
              ( item, arrInd ) =>
              {
                  let raritySet = this.rarityIndex.get( item.rarity ?? "Common" );    //do we have this mapping yet?
                  if( !raritySet )                                        //if not we have to make it
                  {
                      raritySet = new Set<number>();                      //make an empty set
                      this.rarityIndex.set( item.rarity ?? "Common", raritySet );          //add this set to the map via .set() method *confusing* which is how you add things to a map.
                      //this.rarityArray.push( item.rarity );
                  }
                  raritySet.add( arrInd ); //add index of the current item to this set.
              });
    }

    buildCustomFilters(): void
    {
        //custom Filters: filters that are specific to monsters:
        this.filterRarityEl = this.headerEl.createDiv({ cls: "tools-for-5e-filter" });
        setIcon(this.filterRarityEl, "shield");
        this.filterRarityEl.addEventListener("click", (evt) => this.openFilterRarityMenu(evt));
    }

    private openFilterRarityMenu( evt: MouseEvent )
    {
        const m = new Menu();
        for( const rarity of this.rarityArray )
        {
            m.addItem( (item: MenuItem) => {
                item.setTitle(rarity)
                    .setChecked?.(this.rarityFilter.includes(rarity))
                    .onClick(() => {
                        const i = this.rarityFilter.indexOf(rarity);
                        i > -1 ? this.rarityFilter.splice(i, 1) : this.rarityFilter.push(rarity);
                        this.filterAndRender();
                    });
            });
        }
        m.showAtMouseEvent(evt);
    }

    //custom filtering
    applyCustomFilters( items: MyItem[]): MyItem[]   //none so far
    {
        let filteredSet = new Set<number>( items.keys() );
        if( this.rarityFilter.length > 0 )
        {
            let raritySet = new Set<number>();
            this.rarityFilter.forEach(
                rarity => {
                    if( this.rarityIndex.has( rarity ) )
                    {
                        //raritySet = raritySet.union( this.rarityIndex.get( rarity )! );
                        raritySet = new Set( [...raritySet, ...this.rarityIndex.get(rarity) ?? []]);
                    }
                }
            );
            //filteredSet = filteredSet.intersection( raritySet );
            filteredSet = new  Set([...filteredSet].filter( x => raritySet.has(x)));
        }

        return Array.from( filteredSet, i => items[i] ).filter( (item): item is MyItem => !!item );
    }
}
