import { EventRef, ItemView, WorkspaceLeaf, SearchComponent, Menu, prepareFuzzySearch, setIcon, Notice } from "obsidian";
import type { MenuItem } from "obsidian";
import { getIconSVG } from "../common";

import { crToNumber } from "../utils/convUtils";
import { addItemToEncounter } from "../utils/encounterUtils";

import { MyBeast } from "../beast";
import { BeastCompendium } from "../bestiary";
import { MyListView } from "./listview";

export const BEAST_VIEW = "tools-for-5e-beast-pane";


export class MyBeastView extends MyListView<MyBeast>
{
    private filterCrEl!: HTMLElement;

    private crArray: string[] = [];
    private crIndex = new Map<string, Set<number>>();
    private crFilter: string[] = [];

    getDisplayText(): string { return "D&D Monsters"; }
    getIcon(): string { return "skull"; }
    getViewType(): string { return BEAST_VIEW; }

    //populate elements
    async setupUI()
    {
        super.addSearchBar( "Search monsters..." );

        super.addDefaultFilterElements();

        this.buildCustomFilters();

        super.addDefaultSortElement();
    }

    renderRow( row: HTMLElement, item: MyBeast ): void
    {
        const td = row.createEl("td");
        td.createSpan({ text: item.name });
    //    const td1 = row.createEl("td");
    //    td1.createDiv( { text: item.hasFluff } );
    //    const td1b = row.createEl("td");
    //    td1b.createDiv( { text: item.hasFluffImages } );
        const td2 = row.createEl("td");
        td2.createDiv( { text: item.xp });
        const actionCellLink = row.createEl("td", {cls: "listview-action-cell"});
        const linkButton = actionCellLink.createDiv({
            cls: "clickable-icon",
            attr: { "data-action": "link" }
        });
        setIcon(linkButton, "link");

        const actionCellInsert = row.createEl("td", {cls: "listview-action-cell"});
        const insertButton = actionCellInsert.createDiv({
            cls: "clickable-icon",
            attr: { "data-action": "insert" }
        });
        setIcon(insertButton, "plus");

    //    const td3 = row.createEl("td");
    //    td3.createDiv( { text: "insert", attr: { "data-action": "insert" } } );
    }

    onItemSelected( item: MyBeast, action: string ): void
    {
        //new Notice( "BeastView: " + item.name + ": " + action );

        if (action === "default")
        {
            this.plugin.showDetail({ kind: "beast", data: item }, this.leaf );
        }
        else if( action === "link" )
        {
            this.plugin.insertIntoActiveFile( `[[5e:beast:${item.name}]]` );
        }
        else if( action === "insert" )
        {
            addItemToEncounter(
                this.plugin,
                {
                    ref: item.source+":"+item.name,
                    kind: "monster",
                    name: item.name
                });
        }
    }

    rebuildCustomIndices(): void  //for fast sorting
    {
        this.crIndex.clear();
        this.crArray = [];

        this.allItems.forEach(
            (item: any, i) =>
            {
                const cr = item.cr ?? "";
                let set = this.crIndex.get( cr );
                if( !set )
                {
                    set = new Set<number>();
                    this.crIndex.set( cr, set );
                    this.crArray.push( cr );
                }
                set.add( i );
            }
        );
        this.crArray.sort( (a, b) =>
            {
                const valA = crToNumber( a );
                const valB = crToNumber( b );
                return valA - valB;
            });    //sort by number...
    }

    buildCustomFilters(): void
    {
        //custom Filters: filters that are specific to monsters:
        this.filterCrEl = this.headerEl.createDiv({ cls: "tools-for-5e-filter" });
        setIcon(this.filterCrEl, "shield");
        this.filterCrEl.addEventListener("click", (evt) => this.openFilterCrMenu(evt));
    }

    private openFilterCrMenu( evt: MouseEvent )
    {
        const m = new Menu();
        for( const cr of this.crArray )
        {
            m.addItem((item: MenuItem) => {
                item.setTitle(cr)
                    .setChecked?.(this.crFilter.includes(cr))
                    .onClick(() => {
                        const i = this.crFilter.indexOf(cr);
                        i > -1 ? this.crFilter.splice(i, 1) : this.crFilter.push(cr);
                        this.filterAndRender();
                    });
            });
        }
        m.showAtMouseEvent(evt);
    }

    //custom filtering
    applyCustomFilters(items: MyBeast[]): MyBeast[]   //none so far
    {
        let filteredSet = new Set<number>( items.keys() );
        if( this.crFilter.length > 0 )
        {
            let crSet = new Set<number>();
            this.crFilter.forEach(
                cr => {
                    if( this.crIndex.has(cr) )
                    {
                        //crSet = crSet.union( this.crIndex.get(cr)! );
                        crSet = new Set([...crSet, ...this.crIndex.get(cr)!]);
                    }
                }
            );
            //filteredSet = filteredSet.intersection( crSet );
            filteredSet = new  Set([...filteredSet].filter( x => crSet.has(x)));
        }

        return Array.from( filteredSet, i => items[i] ).filter( (item): item is MyBeast => !!item);
    }

}
