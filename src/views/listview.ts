import { EventRef, ItemView, SearchComponent, Menu, prepareFuzzySearch, setIcon, Notice } from "obsidian";
import type ToolsFor5e from "../main";     //only for default export
import type { Compendium } from '../compendium';
import type MenuItem from "obsidian";

export type SortDir = "asc" | "desc";

export abstract class MyListView<DataType> extends ItemView
{
    protected resultsEl!: HTMLElement;
    protected sortEl!: HTMLElement;
    protected searchEl!: HTMLElement;
    protected headerEl!: HTMLElement;
    protected filterSourceEl!: HTMLElement;

    protected sourceArray: string[] = [];
    protected sourceIndex = new Map<string, Set<number>>();
    protected sourceFilter: string[] = [];

    protected allItems: DataType[] = [];
    protected results: DataType[] = [];
    protected limit: number = 500;

    protected searchQuery: string = "";
    protected sort: { key: string; dir: SortDir } = { key: "name", dir: "asc" };

    //debounce timer:
    private searchQueryTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly searchQueryDebounce = 200;

    private isRenderQueued = false;

    // interface:
    protected abstract rebuildCustomIndices(): void;
    protected abstract buildCustomFilters(): void;
    protected abstract applyCustomFilters( items: DataType[] ): DataType[];

    protected abstract renderRow( row: HTMLElement, item: DataType ): void;
    protected abstract onItemSelected( item: DataType, action: string ): void;
    protected abstract setupUI(): void;

    constructor( leaf: WorkspaceLeaf,
                    public readonly plugin: ToolsFor5e,
                    data: DataType[] )

    {
        super(leaf);
        this.sort = { key: "name", dir: "asc" };
        this.allItems = data;        //fetch all data from enabled sources
    }

    async onOpen()
    {
        const root = this.contentEl;
        root.empty();
        root.addClass( "tools-for-5e-view-container" );

        this.headerEl = root.createDiv("tools-for-5e-header");

        this.setupUI();

        this.resultsEl = root.createDiv({ cls: "tools-for-5e-search-results" });
        this.resultsEl.addEventListener( "click", (evt) => this.handleResultClick(evt) );

        //const ref = this.compendium.on("changed", () => this.onDataChanged() );
        //this.registerEvent( ref );

        //if (this.compendium.isReady)
        this.onDataChanged();
    }

    //probably not even necessary
    public updateAllItems( newData: DataType[] )
    {
        this.allItems = newData;
        this.onDataChanged();
    }

    private rebuildDefaultIndices(): void  //for fast sorting
    {
        this.sourceIndex.clear();
        this.sourceArray = [];

        this.allItems.forEach( (item: any, i) =>
        {
           const source = item.source ?? "unknown";
           let set = this.sourceIndex.get( source );
           if( !set )
           {
               set = new Set<number>();
               this.sourceIndex.set(source, set);
               this.sourceArray.push(source);
           }
           set.add( i );
        });
        this.sourceArray.sort();
    }

    protected addDefaultFilterElements()
    {
        this.filterSourceEl = this.headerEl.createDiv({ cls: "tools-for-5e-filter" });
        setIcon( this.filterSourceEl, "book" );
        this.filterSourceEl.addEventListener("click", (evt) => this.openFilterSourceMenu( evt ));
    }

    private applyDefaultFilters( items: DataType[] ): DataType[]   //none so far
    {
        let filteredSet = new Set<number>( items.keys() );  //set for fast union/intersection...

        if( this.sourceFilter.length > 0 )
        {
            let sourceSet = new Set<number>();

            this.sourceFilter.forEach( s => {   //s is the source string
                if( this.sourceIndex.has(s) )
                    sourceSet = sourceSet.union( this.sourceIndex.get(s)! );
                });
            filteredSet = filteredSet.intersection( sourceSet );
        }

        return Array.from(filteredSet, i => items[i]);
    }

    protected addSearchBar( placeholder: string )
    {
        this.searchEl = new SearchComponent( this.headerEl.createDiv("tools-for-5e-search-bar"))
            .setPlaceholder( placeholder )
            .onChange((q) => this.searchQueryChanged(q));
    }

    protected addDefaultSortElement()
    {
        //sort button:
        this.sortEl = this.headerEl.createDiv({ cls: "tools-for-5e-filter" });
        setIcon(this.sortEl, "sort-asc");
        this.sortEl.addEventListener("click", (evt) => this.openSortMenu(evt));
    }

    protected onDataChanged()
    {
        //this.allItems = this.compendium.getData();
        this.rebuildDefaultIndices();
        this.rebuildCustomIndices();
        this.searchQuery = "";
        if (this.searchEl) this.searchEl.setValue("");
        this.filterAndRender();
    }

    // Kombiniert Filter, Fuzzy-Search und Sortierung
    protected filterAndRender()
    {
        // 1. Spezifische Filter der Child-Klasse anwenden
        let workingData = this.applyCustomFilters( this.allItems );

        // 1.5 applyDefaultFilter

        workingData = this.applyDefaultFilters( workingData );

        // 2. Globale Fuzzy-Search über Obsidian API
        if( this.searchQuery.trim().length > 0 )
        {
            const fuzzySearch = prepareFuzzySearch( this.searchQuery );
            workingData = workingData.filter( item => {
               const name = (item as any).name || "";
               return fuzzySearch(name) !== null;
            });
        }

        // 3. Globale Sortierung
        workingData.sort((a: any, b: any) => {
            const valA = a[this.sort.key]?.toString().toLowerCase() || "";
            const valB = b[this.sort.key]?.toString().toLowerCase() || "";
            if (valA < valB) return this.sort.dir === "asc" ? -1 : 1;
            if (valA > valB) return this.sort.dir === "asc" ? 1 : -1;
            return 0;
    });

    // 4. In "results" schreiben und Limit beachten
    this.results = workingData.slice( 0, this.limit );
    this.requestRender();
   }



   // Flüssiges Rendering via RequestAnimationFrame
   protected requestRender(): void
   {
       if (this.isRenderQueued) return;

       this.isRenderQueued = true;
       requestAnimationFrame(() => {
           this.isRenderQueued = false;
           this.render();
       });
   }

    // Zentralisiertes Tabellen-Rendering
    protected render(): void
    {
        if( this.sortEl )
        {
            setIcon( this.sortEl, this.sort.dir === "asc" ? 'sort-asc' : 'sort-desc' );
        }

        this.resultsEl.empty();

        if( this.results.length === 0 )
        {
            this.resultsEl.createDiv( { text: "No entries found.", cls: "tools-for-5e-no-results" } );
            return;
        }

        const table = this.resultsEl.createEl( "table", { cls: "tools-for-5e-item-table" } );
        const tbody = table.createEl( "tbody" );

        this.results.forEach( (item, i) =>
        {
            const row = tbody.createEl("tr", { cls: "tools-for-5e-item-row" });
            row.setAttribute( "data-index", i.toString() );
            this.renderRow( row, item );
        });
    }

    private handleResultClick(evt: MouseEvent)
    {
        const target = evt.target as HTMLElement;
        const row = target.closest(".tools-for-5e-item-row");
        if( row )
        {
            const index = parseInt( row.getAttribute("data-index") ?? "-1" );
            const item = this.results[index];
            const action = target.closest("[data-action]")?.getAttribute("data-action") || "default";
            if( item ) this.onItemSelected( item, action );
        }
    }

    // Wird von der Suchleiste getriggert
    protected searchQueryChanged(q: string)
    {
        if (this.searchQueryTimer) clearTimeout(this.searchQueryTimer);
        this.searchQueryTimer = setTimeout(() => {
            this.searchQuery = q;
            this.filterAndRender();
        }, this.searchQueryDebounce);
    }

    protected openSortMenu()
    {

    }

    private openFilterSourceMenu( evt: MouseEvent )
    {
        const m = new Menu(this.plugin);
        for( const source of this.sourceArray )
        {
            m.addItem((item: MenuItem) => {
                item.setTitle(source)
                    .setChecked?.(this.sourceFilter.includes( source ))
                    .onClick(() => {
                        const i = this.sourceFilter.indexOf( source );
                        i > -1 ? this.sourceFilter.splice(i, 1) : this.sourceFilter.push(source);
                        this.filterAndRender();
                    });
            });
        }
        m.showAtMouseEvent(evt);
    }
}
