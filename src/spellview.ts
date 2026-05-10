import { EventRef, ItemView, WorkspaceLeaf, SearchComponent, Menu, prepareFuzzySearch, setIcon } from "obsidian";
import type { MenuItem } from "obsidian";
import type ToolsFor5e from "./main";     //only for default export
import { MySpell } from "./spell";       //general export
import { getIconSVG } from "./common";
//import type { MyVariant, MySpell } from "./spell";       //general export

export const SPELL_VIEW = "tools-for-5e-spell-pane";

type SortKey = "name" | "level";
type SortDir = "asc" | "desc";

export class MySpellView extends ItemView
{
    private unsubscribe?: () => void;
    // Keep a handle to the results container
    private resultsEl!: HTMLElement;
    private sortEl!: HTMLElement;
    private searchEl!: HTMLElement;

    private filterLevelEl!: HTMLElement;
    private filterClassEl!: HTMLElement;
    private filterSourceEl!: HTMLElement;

    //sets defined via: --> precalc indices in "spellaryChanged"
    private levelArray: string[] = ["Cantrip", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Level 6", "Level 7", "Level 8", "Level 9 "];
    private classArray: string[] = [];
    private sourceArray: string[] = [];

    //mapping level and class string to a Set if indices: can be joined with other sets later
    private levelIndex = new Map<number, Set<number>>();
    private classIndex = new Map<string, Set<number>>();
    private sourceIndex = new Map<string, Set<number>>();

    //keep track of search and filter parameters
    private searchQuery: string = "";
    private searchQueryTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly searchQueryDebounce = 200;
    private levelFilter: number[] = [];
    private classFilter: string[] = [];
    private sourceFilter: string[] = [];
    private filtered: boolean = false;
    private limit: number = 500;

    //sort parameters
    private sort: { key: SortKey; dir: SortDir } = { key: "name", dir: "asc" };

    private filteredSet = new Set<number>();

    private allSpells: MySpell[] = [];
    private results: MySpell[] = [];


    constructor(leaf: WorkspaceLeaf, public readonly plugin: ParseItemsToo )
    {
        super(leaf);
        console.debug("Parse Items too: MySpellView.constructor() ");
    }

    async onOpen()
    {
        console.debug("Parse Items too: MySpellView.onOpen()");
        const root = this.contentEl;
        root.empty();
        root.addClass( "parse-items-too-spell-view" );

        const header = root.createDiv("parse-items-too-header")
        this.searchEl = new SearchComponent( header.createDiv("parse-items-too-search-bar") );
            this.searchEl.setPlaceholder("Search for spells.....");
            this.searchEl.onChange( (q) => this.searchQueryChanged( q ) );

        this.filterClassEl = header.createDiv( { cls: "parse-items-too-filter" } );
        setIcon( this.filterClassEl, 'shield-question-mark');
        this.filterClassEl.addEventListener( "click", (evt) => this.openFilterClassMenu( evt ) );

        this.filterLevelEl = header.createDiv( { cls: "parse-items-too-filter" } );
        setIcon( this.filterLevelEl, 'book-plus');
        this.filterLevelEl.addEventListener( "click", (evt) => this.openFilterLevelMenu( evt ) );

        this.filterSourceEl = header.createDiv( { cls: "parse-items-too-filter" } );
        setIcon( this.filterSourceEl, 'book');
        this.filterSourceEl.addEventListener( "click", (evt) => this.openFilterSourceMenu( evt ) );

        this.sortEl = header.createDiv( { cls: "parse-items-too-filter" } );
        setIcon( this.sortEl,'sort-asc' );
        this.sortEl.addEventListener( "click", (evt) => this.openSortMenu( evt ) );

        this.resultsEl = root.createDiv({ cls: "parse-items-too-search-results" });



        // Auto-cleaned when the view unloads:
        // should this be done in the constructor?
        const ref: EventRef = this.plugin.mySpellary.on( "changed", () => this.spellaryChanged() );
        this.registerEvent(ref); // OK: ref is EventRef

        //have to render as soon as Spellary is ready:
        // - if spellary is not ready yet, it should trigger a render soon
        if( this.plugin.mySpellary.isReady ) this.spellaryChanged("");
    }



    private requestRender = (() => {
        let queued = false;
        return () => {
            if( queued ) return;
            queued = true;
            requestAnimationFrame( () => { queued = false; this.render(); });
        };
    })();

    private spellaryChanged()
    {
        //1. update data
        this.allSpells = this.plugin.mySpellary.getSpells();
        this.classArray = this.plugin.mySpellary.getClasses();         //should we ONLY get this when spellary is updated?
        this.sourceArray = this.plugin.mySpellary.getSources();

        //2. index data:
        this.rebuildIndices();

        //special case: set everything to default
        this.filteredSet.clear();
        this.searchQuery = ""
        //should also reset the search field for consistency

        this.updateResults();

        //x. render
        this.render();
    }

    private rebuildIndices()
    {
        console.log( 'spellview start building search indices...' );
        //see itemview.ts - rebuildIndices() for comments
        this.classIndex.clear();
        this.levelIndex.clear();
        this.sourceIndex.clear();

        this.allSpells.forEach( (spell, arrInd) => {
            spell.classArray.forEach( className => {
                let classSet = this.classIndex.get( className );
                if( !classSet )
                {
                    classSet = new Set<number>();
                    this.classIndex.set( className, classSet )
                }
                classSet.add( arrInd );
            });

            let levelSet = this.levelIndex.get( spell.levelInt ); //spell.level is a string, spell.levelInt is numeric
            if( !levelSet )
            {
                levelSet = new Set<number>();
                this.levelIndex.set( spell.levelInt, levelSet );
            }
            levelSet.add(arrInd);

            let sourceSet = this.sourceIndex.get( spell.source );
            if( !sourceSet )
            {
                sourceSet = new Set<number>();
                this.sourceIndex.set( spell.source, sourceSet );
            }
            sourceSet.add( arrInd );
        });

        console.log( 'spellview built search indices!' );
    }

    private filterChanged()
    {
        //console.log( 'filterChanged() - levelFilter: ' + this.levelFilter + ' classFilter: ' + this.classFilter );
        // if this.levelFilter is empty --> all levels
        // if this.classFilter is empty --> all Classes

        //this.filteredSet.clear(); //--> all
        this.filteredSet = new Set<number>(this.allSpells.keys());  //contains all keys

        if( this.levelFilter.length == 0 && this.classFilter.length == 0 && this.sourceFilter.length == 0 )
        {   //nothing to filter: full set? or flag?
            this.filtered = false;
        }
        else
        {
            this.filtered = true;
            //each filter category is a union (or)
            //separate filter categories form an intersection (and)

            if( this.levelFilter.length > 0 )
            {

                let levelFilterSet = new Set<number>();
                this.levelFilter.forEach( levelInt => {
                    if( this.levelIndex.has( levelInt ) )
                    { levelFilterSet = levelFilterSet.union( this.levelIndex.get( levelInt )); }});
                //console.log("levelFilter: " + levelFilterSet.size );
                this.filteredSet = this.filteredSet.intersection( levelFilterSet );
            }

            if( this.classFilter.length > 0 )
            {
                let classFilterSet = new Set<number>();
                this.classFilter.forEach( myClass => {
                    if( this.classIndex.has( myClass ) )
                    { classFilterSet = classFilterSet.union( this.classIndex.get( myClass )); }});
                //console.log("classFilter: " + classFilterSet.size );
                this.filteredSet = this.filteredSet.intersection( classFilterSet );
            }

            if( this.sourceFilter.length > 0 )
            {
                let sourceFilterSet = new Set<number>();
                this.sourceFilter.forEach( source => {  //loop through selected rarities
                    if( this.sourceIndex.has( source ) )
                    { sourceFilterSet = sourceFilterSet.union( this.sourceIndex.get( source )); }});
                //console.log("sourceFilter: " + sourceFilterSet.size );
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
        console.debug("spellview: searchQueryChanged()");
        //filter?
        this.searchQuery = q;

        this.updateResults();
        this.render();
    }

    private updateResults()
    {
        const dirMul = this.sort.dir === "asc" ? 1 : -1;

        if( this.filtered )
        {
            this.results = Array.from( this.filteredSet, i => this.allSpells[i] );
        }
        else
        {
            this.results = this.allSpells.slice();
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

    public render = (q: string ) =>  //arrow function. why??
    {
        console.debug("MySpellView.render()" );


        //display:
        if( this.sort.dir === "asc")
            setIcon( this.sortEl,'sort-asc');
        else
            setIcon( this.sortEl,'sort-desc');

        const container = this.resultsEl;
        container.empty();

        if( this.results.length == 0 ) return;

        const table = container.createEl("table", { cls: "parse-items-too-spell-table" });
        const tbody = table.createEl("tbody");

        tbody.empty();

        for( const i of this.results )
        {
            const detail = i.detail;

            const tr = tbody.createEl("tr", { cls: "parse-items-too-spell-row", attr: { tabindex: "0" } });
            const td = tr.createEl( "td", { cls: "parse-items-too-spell-cell" } );
            const name = td.createDiv( { cls: "parse-items-too-spell" } );
                td.createDiv( { text: detail, cls: "parse-items-too-spell-detail" } );
            name.createEl( "span", { text: i.name, cls: "parse-items-too-spell-name" } );
            if( i.school !== "" ) name.createEl( "span", { text: " (" + i.school + ")", cls: "parse-items-too-spell-detail" } );

            const insertLink = tr.createEl( "td", { text: "", cls: "parse-items-too-spell-cell-button" } );
            setIcon( insertLink,'link');
            const insertBox = tr.createEl( "td", { text: "", cls: "parse-items-too-spell-cell-button" } );
            setIcon(insertBox,'gallery-vertical');
            const go = tr.createEl( "td", { text: "", cls: "parse-items-too-spell-cell-button" } );
            setIcon( go,'external-link');

            td.addEventListener( "click", () => this.clickSpell( i ));
            td.addEventListener( "contextmenu", ( evt ) => this.rightclickSpell( i, evt ));
            //td.addEventListener( "keydown", (ev) => {
            //                    if (ev.key === "Enter") this.clickSpell(i); });

            insertLink.addEventListener( "click", () => this.clickLink( i ));
            insertLink.addEventListener( "contextmenu", ( evt ) => this.rightclickLink( i, evt ));

            insertBox.addEventListener( "click", () => this.clickBox( i ));
            //insertBox.addEventListener( "contextmenu", ( evt ) => this.rightclickBox( i, evt ));

            go.addEventListener( "click", () => this.clickGo( i ));
            go.addEventListener( "contextmenu", ( evt ) => this.rightclickGo( i, evt ));
        }
    };


    private clickSpell( i: MySpell )
    {
        console.debug( "click on: " + i.name );
        console.debug( "markdown link: " + i.markdownlink )
        console.debug( "file path: " + i.filePath )
        if( i.imagePath )
            console.debug( "image path: " + i.imagePath );
    }

    private rightclickSpell( i: MySpell, evt: MouseEvent )
    {
        console.debug( "rightclick on: " + i.name );
    }

    private clickLink( i: MySpell )
    {
        console.debug("click link...");
        void this.plugin.insertIntoEditor( i.markdownlink + '{icon=spell}' );
    }

    private rightclickLink( i: MySpell, evt: MouseEvent )
    {
        console.debug("rightclick link...");
    }

    private clickBox( i: MySpell )
    {   // cannot use createElement() or createDiv(), because it will throw an error because of the vault relative path in the <img> imgTag
        // the vault relative path is needed, though, so the paths dont break when synicing the vault to a different computer.
        // --> html block has to be created as a string:
        //const spellSVG = "x";

        const svgString = getIconSVG( 'scroll' );

        const header = '<div class="parse-items-too-editor-spell-header"><div class="parse-items-too-editor-spell-icon">' + svgString + '</div><div class="parse-items-too-editor-spell-name">' + i.name + '</div><div class="parse-items-too-editor-spell-school"> (' + i.school + ')</div></div>';

        const pre = '<div class="parse-items-too-editor-spell-box"><div class="parse-items-too-editor-textblock">' + header + '<div class="parse-items-too-editor-spell-text">' + i.detail + '</div><a class="internal-link" href="'+i.filePath+'">go to source</a></div>';
        const post = '</div>';
        let imgTag: string = '';
        if( i.imagePath !== "" )
        { imgTag = '<div class="parse-items-too-editor-imgblock"><div class="parse-items-too-editor-imgbgblock"><img src="' + i.imagePath + '"></div></div>'; }
        void this.plugin.insertIntoEditor( pre + imgTag + post );
    }


    private clickGo( i: MySpell )
    {
        console.debug("click go...");
        void this.plugin.openInEditor( i.markdownlink );
    }

    private rightclickGo( i: MySpell, evt: MouseEvent )
    {
        console.debug("rightclick go...");
    }


    private openFilterLevelMenu( evt: MouseEvent )
    {
        const m = new Menu( this.plugin );

        for( let i = 0; i < this.levelArray.length; i++ )
        {
            m.addItem( ( menuItem ) => {
                menuItem.setTitle(  this.levelArray[i] )
                     .onClick( () =>
                        {
                            const index = this.levelFilter.indexOf( i );
                            if( index > -1 )
                            {
                                this.levelFilter.splice( index, 1 );
                            }
                            else
                            {
                                console.log( "push levelFilter: " + i + this.levelFilter);
                                this.levelFilter.push( i )
                            }
                            this.filterChanged();
                        })
                     .setChecked?.( this.levelFilter.includes( i ) ); });
        }
        m.showAtMouseEvent(evt);
    }

    private openFilterClassMenu( evt: MouseEvent )
    {
        const m = new Menu( this.plugin );

        for( const characterClass of this.classArray )
        {
            m.addItem( ( menuItem ) => {
                menuItem.setTitle( characterClass )
                     .onClick( () => {
                         const index = this.classFilter.indexOf( characterClass );
                         if( index > -1 )
                         {
                             this.classFilter.splice( index, 1 );
                         }
                         else
                         {
                             this.classFilter.push( characterClass );
                         }
                         this.filterChanged(); })
                     .setChecked?.( this.classFilter.includes( characterClass ) ); });
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

    private openSortMenu(evt: MouseEvent)
    {
        const m = new Menu( this.plugin );

        const addSortKey = (title: string, key: SortKey, icon: string) => {
                m.addItem( (spell: MenuItem) => {
                     spell.setTitle(title).setIcon( icon );
                     // setChecked is available in recent Obsidian versions
                     spell.setChecked?.(this.sort.key === key);
                     spell.onClick(() => { this.sort.key = key; this.sortingChanged(); });
                });
            };

        addSortKey("Name", "name", "heading-glyph");
        addSortKey("Level", "level", "star");

        m.addSeparator();

        m.addItem((spell) => {
                const next = this.sort.dir === "asc" ? "desc" : "asc";
                const icon = next === "asc" ? "arrow-up" : "arrow-down";
                const label = next === "asc" ? "Ascending" : "Descending";
                spell.setTitle(`Direction: ${label}`).setIcon( icon ).onClick(() => {
                            this.sort.dir = next;
                            this.sortingChanged();
                        });
                    });

        m.showAtMouseEvent(evt);
    }

    async onClose()
    {
        console.debug("Parse Items too: close MySpellView...")
    }

    getDisplayText(): string {
        // eslint-disable-next-line obsidianmd/ui/sentence-case
        return "D&D Spells";
    }
    getIcon(): string {
        return "scroll";
    }
    getViewType(): string {
        return SPELL_VIEW;
    }
}

// Helper
function compareByKey(a: MySpell, b: MySpell, key: SortKey): number {
    switch( key )
    {
        case "name": return a.name.localeCompare( b.name, undefined, { sensitivity: "base", numeric: true });
        case "level": return a.levelInt < b.levelInt ? -1 : 1;//return (a.rarityInt ?? "").localeCompare(b.rarityInt ?? "", undefined, { sensitivity: "base", numeric: true });
    }
}
