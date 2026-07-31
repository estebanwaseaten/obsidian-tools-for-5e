
import { EventRef, ItemView, WorkspaceLeaf, SearchComponent, Menu, prepareFuzzySearch, setIcon } from "obsidian";
import type { MenuItem } from "obsidian";
import type ToolsFor5e from "../main";     //only for default export
import { MySpell } from "../spell";       //general export
import { getIconSVG } from "../common";
//import type { MyVariant, MySpell } from "./spell";       //general export
import { MyListView } from "./listview"
export const SPELL_VIEW = "tools-for-5e-spell-pane";


export class MySpellView extends MyListView<MySpell>
{

    //sets defined via: --> precalc indices in "spellaryChanged"
    private levelArray: string[] = ["Cantrip", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Level 6", "Level 7", "Level 8", "Level 9 "];
    private levelIndex = new Map<number, Set<number>>();
    private levelFilter: number[] = [];

    //mapping level and class string to a Set if indices: can be joined with other sets later
    private classArray: string[] = [];
    private classIndex = new Map<string, Set<number>>();
    private classFilter: string[] = [];

    protected filterLevelEl!: HTMLElement;
    protected filterClassEl!: HTMLElement;

    getDisplayText(): string { return "D&D Spells"; }
    getIcon(): string { return "scroll"; }
    getViewType(): string { return SPELL_VIEW; }

    async setupUI()
    {
        super.addSearchBar( "Search spells..." );

        super.addDefaultFilterElements();

        this.buildCustomFilters();

        super.addDefaultSortElement();
    }

    renderRow( row: HTMLElement, item: MySpell ): void
    {
        const td = row.createEl("td");
        td.createSpan({ text: item.name });
        const td2 = row.createEl("td");
        td2.createDiv( { text: "info", attr: { "data-action": "info" } } );
        const td3 = row.createEl("td");
        td3.createDiv( { text: "insert", attr: { "data-action": "insert" } } );
    }

    onItemSelected( item: MySpell, action: string ): void
    {
        //new Notice( "SpellView: " + item.name + ": " + action );
        if (action === "default")
        {
            this.plugin.showDetail({ kind: "spell", data: item }, this.leaf );
        }
    }

    rebuildCustomIndices(): void  //for fast sorting
    {
        this.levelIndex.clear();
        //this.levelArray = [];     //is fixed

        this.classIndex.clear();
        this.classArray = [];

        this.allItems.forEach(
            (spell: any, i) =>
            {
                //spell levels
                const spellLevel = spell.level ?? "";
                let set = this.levelIndex.get( spellLevel );
                if( !set )
                {
                    set = new Set<number>();
                    this.levelIndex.set( spellLevel, set );
                    //this.levelArray.push( spellLevel );
                }
                set.add( i );

                //classes:
                const spellClasses = Array.from( spell.classNames );
                if( spell.classVariantNames ) {    spellClasses.concat(Array.from(spell.classVariantNames  )); }
                for( const spellClass of spellClasses )
                {
                    set = this.classIndex.get( spellClass as string );
                    if( !set )
                    {
                        set = new Set<number>();
                        this.classIndex.set( spellClass as string , set );
                        this.classArray.push( spellClass  as string );
                    }
                    set.add( i );
                }
            }
        );

        this.classArray.sort();
        this.levelArray.sort();
        //console.log( this.levelArray );
        //console.log( this.classArray );
        //sorting???
    }

    buildCustomFilters(): void
    {
        //custom Filters: filters that are specific to monsters:
        this.filterLevelEl = this.headerEl.createDiv({ cls: "tools-for-5e-filter" });
        setIcon(this.filterLevelEl, "shield-question-mark");
        this.filterLevelEl.addEventListener("click", (evt) => this.openFilterLevelMenu(evt));

        this.filterClassEl = this.headerEl.createDiv({ cls: "tools-for-5e-filter" });
        setIcon(this.filterClassEl, "book-plus");
        this.filterClassEl.addEventListener("click", (evt) => this.openFilterClassMenu(evt));
    }

    //private levelArray fixed array of names
    //private levelIndex = new Map<number, Set<number>>();
    //private levelFilter: number[] = [];
    private openFilterLevelMenu( evt: MouseEvent )
    {
        const m = new Menu();
        this.levelArray.forEach( ( spellLevel: string, index: number ) =>   //loop through all possible spell levels
        {
            //console.log(spellLevel + ": " + index);

            m.addItem( ( item: MenuItem ) => {
                item.setTitle( spellLevel )
                    .setChecked?.( this.levelFilter.includes( index ) )
                    .onClick( () => {
                        const i = this.levelFilter.indexOf( index );
                        i > -1 ? this.levelFilter.splice(i, 1) : this.levelFilter.push( index );
                        this.filterAndRender();
                    });
            });
        });
        m.showAtMouseEvent(evt);
    }

    private openFilterClassMenu( evt: MouseEvent )
    {
        const m = new Menu();
        for( const spellClass of this.classArray )
        {
            m.addItem((item: MenuItem) => {
                item.setTitle(spellClass)
                    .setChecked?.(this.classFilter.includes(spellClass))
                    .onClick(() => {
                        const i = this.classFilter.indexOf(spellClass);
                        i > -1 ? this.classFilter.splice(i, 1) : this.classFilter.push(spellClass);
                        this.filterAndRender();
                    });
            });
        }
        m.showAtMouseEvent(evt);
    }

    //custom filtering
    applyCustomFilters(items: MySpell[]): MySpell[]   //none so far
    {
        let filteredSet = new Set<number>( items.keys() );
        if( this.levelFilter.length > 0 )
        {
            let levelSet = new Set<number>();
            this.levelFilter.forEach(       //contains indices
                spellLevel => {
                    if( this.levelIndex.has( spellLevel ) )
                    {
                        //levelSet = levelSet.union( this.levelIndex.get(spellLevel)! );
                        levelSet = new Set( [...levelSet, ...this.levelIndex.get(spellLevel) ?? []]);
                    }
                }
            );
            //filteredSet = filteredSet.intersection( levelSet );
            filteredSet = new  Set([...filteredSet].filter( x => levelSet.has(x)));

        }


        if( this.classFilter.length > 0 )
        {
            //console.log(this.classFilter);
            let classSet = new Set<number>();
            this.classFilter.forEach(
                spellClass => {
                    if( this.classIndex.has(spellClass) )
                    {
                        //classSet = classSet.union( this.classIndex.get(spellClass)! );
                        classSet = new Set( [...classSet, ...this.classIndex.get(spellClass) ?? []]);
                    }
                }
            );
            //filteredSet = filteredSet.intersection( classSet );
            filteredSet = new  Set([...filteredSet].filter( x => classSet.has(x)));

        }

        return Array.from( filteredSet, i => items[i] ).filter(Boolean) as MySpell[];
    }
}
