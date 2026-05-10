import { EventRef, ItemView, WorkspaceLeaf, SearchComponent, Menu, prepareFuzzySearch, setIcon, Notice } from "obsidian";
import type { MenuItem } from "obsidian";
import type ToolsFor5e from "./main";     //only for default export
import { MyVariant, MyItem } from "./item";       //general export
import { getIconSVG } from "./common";
//import type { MyVariant, MyItem } from "./item";       //general export

export const ITEM_VIEW = "tools-for-5e-item-pane";

type SortKey = "name" | "rarity";
type SortDir = "asc" | "desc";
type Query = {
    rarity?: string[];    // OR within this list
    text?: string;         // free text; space-separated = AND
};

export class MyItemView extends ItemView
{
    private unsubscribe?: () => void;

    // Keep a handle to the results container
    private resultsEl!: HTMLElement;
    private sortEl!: HTMLElement;
    private searchEl!: HTMLElement;

    private filterRarityEl!: HTMLElement;
    private filterSourceEl!: HTMLElement;

    //sets defined via: --> precalc indices in "itemaryChanged()"
    private rarityArray: string[] = ["common", "uncommon", "rare", "very rare", "legendary", "Artifact" ];
    private sourceArray: string[] = [];

    //mapping rarity string to a Set if indices: can be joined with other sets later
    private rarityIndex = new Map<string, Set<number>>();
    private sourceIndex = new Map<string, Set<number>>();


    //keep track of search and filter parameters
    private searchQuery: string= "";
    private searchQueryTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly searchQueryDebounce = 200;
    private rarityFilter: string[] = [];
    private sourceFilter: string[] = [];
    private filtered: boolean = false;
    private limit: number = 500;

    //sort parameters
    private sort: { key: SortKey; dir: SortDir } = { key: "name", dir: "asc" };

    private filteredSet = new Set<number>();

    private allItems: MyItem[] = [];    //only changes when itemary changes
    private results: MyItem[] = [];     //updated when itemary, rarityFilter or textQuery changes


    constructor(leaf: WorkspaceLeaf, public readonly plugin: ParseItemsToo)
    {
        super(leaf);
        console.debug("Parse Items too: MyItemView.constructor() ");
    }

    async onOpen()
    {
        console.debug("Parse Items too: MyItemView.onOpen()");
        const root = this.contentEl;
        root.empty();
        root.addClass( "parse-items-too-item-view" );

        const header = root.createDiv("parse-items-too-header")
        this.searchEl = new SearchComponent( header.createDiv("parse-items-too-search-bar") );
            this.searchEl.setPlaceholder("Search for items...");
            this.searchEl.onChange( (q) => this.searchQueryChanged( q ) );



        this.filterRarityEl = header.createDiv( { cls: "parse-items-too-filter" } );
        setIcon(this.filterRarityEl,'shield-question-mark');
        this.filterRarityEl.addEventListener( "click", (evt) => this.openFilterRarityMenu( evt ) );

        this.filterSourceEl = header.createDiv( { cls: "parse-items-too-filter" } );
        setIcon( this.filterSourceEl, 'book');
        this.filterSourceEl.addEventListener( "click", (evt) => this.openFilterSourceMenu( evt ) );


        this.sortEl = header.createDiv( { cls: "parse-items-too-filter" } );
        setIcon(this.sortEl,'sort-asc');
        this.sortEl.addEventListener( "click", (evt) => this.openSortMenu( evt ) );

        this.resultsEl = root.createDiv({ cls: "parse-items-too-search-results" });

        // Auto-cleaned when the view unloads:
        const ref: EventRef = this.plugin.myItemary.on( "changed", () => this.itemaryChanged() );
        this.registerEvent(ref); // OK: ref is EventRef

        //have to render if itemary is ready - or better: as soon as itemary is read
        // - if itemary is not ready yet, it should trigger a render soon
        if( this.plugin.myItemary.isReady ) this.itemaryChanged("");
    }

    private requestRender = (() => {
        let queued = false;
        return () => {
            if( queued ) return;
            queued = true;
            requestAnimationFrame( () => { queued = false; this.render(); });
        };
    })();


    private itemaryChanged()
    {
        //1. update item data - item data is otherwise static --> can use index as ID
        this.allItems = this.plugin.myItemary.getItems();   //fetches all...
        this.sourceArray = this.plugin.myItemary.getSources();

        //2. index data - only done once when item data changes
        this.rebuildIndices();

        //special case: set everything to default
        this.filteredSet.clear();
        this.searchQuery = ""
        //should also reset the search field for consistency

        this.updateResults();

        //this.filterChanged();
        //x. render
        this.render();
    }

    private rebuildIndices()
    {
        console.log( 'itemview start building search indices...' );
          //rarityIndex is a map of 'item.rarity' to a set of indices pointing into allItems
          this.rarityIndex.clear();
          this.sourceIndex.clear();

          this.allItems.forEach( (item, arrInd) => {
              let raritySet = this.rarityIndex.get( item.rarity );    //do we have this mapping yet?
              if( !raritySet )                                        //if not we have to make it
              {
                  //console.log( "create set for rarity: " + item.rarity )
                  raritySet = new Set<number>();                      //make an empty set
                  this.rarityIndex.set( item.rarity, raritySet );          //add this set to the map via .set() method *confusing* which is how you add things to a map.
              }
              raritySet.add( arrInd ); //add index of the current item to this set.

              let sourceSet = this.sourceIndex.get( item.source );
              if( !sourceSet )
              {
                  sourceSet = new Set<number>();
                  this.sourceIndex.set( item.source, sourceSet );
              }
              sourceSet.add( arrInd );
          });

          //console.log( "common: " + this.rarityIndex.get('common').size );
          //each entry in the map connects one rarity with all the indices of the items with that rarity
          console.log( 'itemview built search indices!' );
    }

    //whenever a filter changes
    private filterChanged()
    {
        //console.log( 'filterChanged(): '  + this.rarityFilter + ' length: ' + this.rarityFilter.length )
        // if this.rarityFilter is empty --> all rarities

        //this.filteredSet.clear();
        this.filteredSet = new Set<number>(this.allItems.keys());   //contains all keys

        if( this.rarityFilter.length == 0 && this.sourceFilter.length == 0 )
        {   //nothing to filter: full set? or flag?
            this.filtered = false;
        }
        else  // --> we have to filter
        {
            this.filtered = true;

            if( this.rarityFilter.length > 0 )
            {
                let rarityFilterSet = new Set<number>();
                this.rarityFilter.forEach( rarity => {  //loop through selected rarities
                    if( this.rarityIndex.has( rarity ) )
                    { rarityFilterSet = rarityFilterSet.union( this.rarityIndex.get( rarity )); }});
                this.filteredSet = this.filteredSet.intersection( rarityFilterSet );
            }

            if( this.sourceFilter.length > 0 )
            {
                let sourceFilterSet = new Set<number>();
                this.sourceFilter.forEach( source => {  //loop through selected rarities
                    if( this.sourceIndex.has( source ) )
                    { sourceFilterSet = sourceFilterSet.union( this.sourceIndex.get( source )); }});
                this.filteredSet = this.filteredSet.intersection( sourceFilterSet );
            }
        }

        this.updateResults();
        this.render();
    }

    private sortingChanged()
    {
        console.log("sorting changed");
        this.updateResults();
        this.render();
    }

    private searchQueryChanged( q: string )
    {
        if (this.searchQueryTimer)
            clearTimeout(this.searchQueryTimer);

        this.searchQueryTimer = setTimeout(
            () => {
                this.searchQuery = q.trim();

                this.updateResults();
                this.render();

                this.searchQueryTimer = null;
            } , this.searchQueryDebounce );
    }

    private updateResults()
    {
        const dirMul = this.sort.dir === "asc" ? 1 : -1;

        if( this.filtered )
        {
            this.results = Array.from( this.filteredSet, i => this.allItems[i] );
        }
        else
        {
            this.results = this.allItems.slice();
        }

        if( !this.searchQuery || this.searchQuery === "" )
        {
            this.results = this.results.sort( (a, b) => compareByKey(a, b, this.sort.key) * dirMul)
                    .slice( 0, this.limit );
        }
        else
        {
            const score = prepareFuzzySearch( this.searchQuery );
            this.results = this.results.map(i => ({ i, m: score(i.name) }))            //add score to MyItem object
                    .filter( x => x.m )
                    .sort( (a, b) => (b.m!.score - a.m!.score) || (compareByKey(a.i, b.i, this.sort.key) * dirMul) )          //sort by score and sorting direction
                    .map( x => x.i )                                    //map back to MyItem object
                    .slice( 0, this.limit );                            //maximum 50 items shown
        }
    }

    public render = (q: string) =>  //arrow function
    {
        console.debug("MyItemView.render()" );
        //compile the filtered and searched data:
        //display:

        //this.filterSourceEl.empty()

        if( this.sort.dir === "asc")
            setIcon(this.sortEl,'sort-asc');
        else
            setIcon(this.sortEl,'sort-desc');

        const container = this.resultsEl;
        container.empty();

        if( this.results.length == 0 ) return;

        const table = container.createEl("table", { cls: "parse-items-too-item-table" });
        const tbody = table.createEl("tbody");

        tbody.empty();

        for( const i of this.results )
        {
            const tr = tbody.createEl("tr", { cls: "parse-items-too-item-row", attr: { tabindex: "0" } });
            const td = tr.createEl( "td", { cls: "parse-items-too-item-cell" } );
                td.createDiv( { text: i.name + " - " + i.rarity, cls: "parse-items-too-item-name" } );
                td.createDiv( { text: i.detail, cls: "parse-items-too-item-detail" } );

            const insertLink = tr.createEl( "td", { text: "", cls: "parse-items-too-item-cell-button" } );
            setIcon(insertLink,'link');
            const insertBox = tr.createEl( "td", { text: "", cls: "parse-items-too-item-cell-button" } );
            setIcon(insertBox,'gallery-vertical');
            const go = tr.createEl( "td", { text: "", cls: "parse-items-too-item-cell-button" } );
            setIcon(go,'external-link');

            td.addEventListener( "click", () => this.clickItem( i ));
            td.addEventListener( "contextmenu", ( evt ) => this.rightclickItem( i, evt ));
            //td.addEventListener( "keydown", (ev) => {
            //                    if (ev.key === "Enter") this.clickItem(i); });
            insertLink.addEventListener( "click", () => this.clickLink( i ));
            insertLink.addEventListener( "contextmenu", ( evt ) => this.rightclickLink( i, evt ));

            insertBox.addEventListener( "click", () => this.clickBox( i ));

            go.addEventListener( "click", () => this.clickGo( i ));
            go.addEventListener( "contextmenu", ( evt ) => this.rightclickGo( i, evt ));
        }
    };


    private clickItem( i: MyItem )
    {
        console.debug( "click on: " + i.name );
        console.debug( "markdown link: " + i.markdownlink )
        console.debug( "file path: " + i.filePath )
        if( i.imagePath )
            console.debug( "image path: " + i.imagePath );

        //console.debug( "variants: " + i.variants );
        //if( i.variants.length > 0 )
            //new Notice( i.variants );
    }

    private rightclickItem( i: MyItem, evt: MouseEvent )
    {
        console.debug( "rightclick on: " + i.name );
    }

    private clickLink( i: MyItem )
    {
        console.debug("click link...");
        if( i.variants?.length > 0 )
            new Notice( "Right click vor variants..." );

        void this.plugin.insertIntoEditor( i.markdownlink + '{icon=' + i.type + '}' );
    }

    private rightclickLink( i: MyItem, evt: MouseEvent )
    {
        console.debug("rightclick link...");
        this.makeVariantMenu( i, evt, (variant) => { void this.plugin.insertIntoEditor( variant.markdownlink ); } );
    }

    private makeVariantMenu( i: MyItem, evt: MouseEvent, clickMethod: (variant: MyVariant) => void  )
    {
        if( i.variants.length > 0 )
        {
            const m = new Menu( this.plugin );

            i.variants.forEach( variant => {
                m.addItem((item) => {
                     item.setTitle(variant.name);
                     item.onClick(() => { clickMethod( variant ); });
                });
            });

            m.showAtMouseEvent(evt);
        }
    }

    private clickGo( i: MyItem )
    {
        console.debug("click go...");
        if( i.variants?.length > 0 )
            new Notice( "Right click vor variants..." );
        void this.plugin.openInEditor( i.markdownlink );
    }

    private rightclickGo( i: MyItem, evt: MouseEvent )
    {
        console.debug("rightclick go...");
         this.makeVariantMenu( i, evt, (variant) => { void this.plugin.openInEditor( variant.markdownlink ); } );
    }

    private clickBox( i: MyItem )
    {   // cannot use createElement() or createDiv(), because it will throw an error because of the vault relative path in the <img> imgTag
        // the vault relative path is needed, though, so the paths dont break when synicing the vault to a different computer.
        // --> html block has to be created as a string:
        let svgString: string = '';
        if( i.type === 'item' )
        {
            svgString = getIconSVG( 'circle-star' );
        }
        else if ( i.type === 'weapon' )
        {
            svgString = getIconSVG( 'sword' );
        }
        else if ( i.type === 'armor' )
        {
            svgString = getIconSVG( 'shield-half' );
        }

        const pre = '<div class="parse-items-too-editor-item-box"><div class="parse-items-too-editor-textblock"><div class="parse-items-too-editor-item-header"><div class="parse-items-too-editor-item-icon">'+ svgString +'</div><div class="parse-items-too-editor-item-name">' + i.name + '</div></div><div class="parse-items-too-editor-item-text">' + i.detail + " " + i.infotext + '</div><a class="internal-link" href="'+i.filePath+'">go to source</a></div>';
        const post = '</div>';
        let imgTag: string = '';
        if( i.imagePath !== "" )
        { imgTag = '<div class="parse-items-too-editor-imgblock"><div class="parse-items-too-editor-imgbgblock"><img src="' + i.imagePath + '"></div></div>'; }
        void this.plugin.insertIntoEditor( pre + imgTag + post );
    }

    private openSortMenu(evt: MouseEvent)
    {
        const m = new Menu( this.plugin );

        const addSortKey = (title: string, key: SortKey, icon: string) => {
                m.addItem( (item: MenuItem) => {
                     item.setTitle(title).setIcon(icon);
                     // setChecked is available in recent Obsidian versions
                     item.setChecked?.( this.sort.key === key);
                     item.onClick(() => { this.sort.key = key; this.sortingChanged(); });
                });
            };

        addSortKey("Name", "name", "heading-glyph");
        addSortKey("Rarity", "rarity", "star");

        m.addSeparator();

        m.addItem((item) => {
                const next = this.sort.dir === "asc" ? "desc" : "asc";
                const icon = next === "asc" ? "arrow-up" : "arrow-down";
                const label = next === "asc" ? "Ascending" : "Descending";
                item.setTitle(`Direction: ${label}`).setIcon(icon).onClick(() => {
                            this.sort.dir = next;
                            this.sortingChanged();
                        });
                    });

        m.showAtMouseEvent(evt);
    }

    private openFilterRarityMenu( evt: MouseEvent )
    {
        const m = new Menu( this.plugin );
        for( const rarity of this.rarityArray )
        {
            m.addItem( ( menuItem ) => {
                menuItem.setTitle( rarity )
                     .onClick( () => {
                         const index = this.rarityFilter.indexOf( rarity );
                         if( index > -1 )
                         {  //item exists --> remove it
                             this.rarityFilter.splice(index, 1);
                         }
                         else
                         {
                             this.rarityFilter.push( rarity );
                         }
                        this.filterChanged(); })
                     .setChecked?.( this.rarityFilter.includes( rarity ) ); });
        }

        m.showAtMouseEvent(evt);
    }

    private openFilterSourceMenu( evt: MouseEvent )
    {
        const m = new Menu( this.plugin );
        if( this.sourceArray.length == 0 )
        {
            m.addItem( ( menuItem ) => { menuItem.setTitle( "no sources" ) });
            m.showAtMouseEvent(evt);
            return;
        }
        for( const source of this.sourceArray )
        {
            m.addItem( ( menuItem ) => {
                menuItem.setTitle( source )
                     .onClick( () => {
                         const index = this.sourceFilter.indexOf( source );
                         if( index > -1 )
                         {  //item exists --> remove it
                             this.sourceFilter.splice(index, 1);
                         }
                         else
                         {
                             this.sourceFilter.push( source );
                         }
                        this.filterChanged(); })
                     .setChecked?.( this.sourceFilter.includes( source ) ); });
        }
        m.showAtMouseEvent(evt);
    }

    async onClose()
    {
        console.debug("Parse Items too: close MyItemView...")
    }

    getDisplayText(): string {
        // eslint-disable-next-line obsidianmd/ui/sentence-case
        return "D&D Items";
    }
    getIcon(): string {
        return "sword";
    }
    getViewType(): string {
        return ITEM_VIEW;
    }
}

// Helper
function compareByKey(a: MyItem, b: MyItem, key: SortKey): number {
    switch( key )
    {
        case "name": return a.name.localeCompare( b.name, undefined, { sensitivity: "base" });
        case "rarity": return a.rarityInt < b.rarityInt ? -1 : 1;//return (a.rarityInt ?? "").localeCompare(b.rarityInt ?? "", undefined, { sensitivity: "base", numeric: true });
        default: return 0;
    }
}
