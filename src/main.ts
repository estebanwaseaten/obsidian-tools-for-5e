import {App, MarkdownView, Modal, Notice, Plugin, TFile, TFolder, WorkspaceLeaf, View, requestUrl } from 'obsidian';
import {DEFAULT_SETTINGS, ToolsFor5eSettings, ToolsFor5eSettingsTab} from "./settings";
import { pathExists, verify5eToolsPath } from "./utils/fileUtils";
import { ENCOUNTER_FRONTMATTER, NPC_FRONTMATTER, CHARACTER_FRONTMATTER } from "./constants";

import { toolsPostProcessor } from './markdown';

import * as path from "path";
import * as fs from "fs";

import { ConditionsModal, TextInputModal, NumInputModal, ConfirmModal } from "./utils/modalUtils"

import { ITEM_VIEW, MyItemView } from "./views/itemview";
import { ItemCompendium } from "./itemary";
import { SPELL_VIEW, MySpellView } from "./views/spellview";
import { SpellCompendium } from "./spellary";
import { BeastUtils } from "./beast";
import { BEAST_VIEW, MyBeastView } from "./views/beastview";
import { BeastCompendium } from "./bestiary";

import { CHARACTER_VIEW, MyCharacterView } from "./views/characterview";
import { NPC_VIEW, MyNPCView } from "./views/npcview";

import { ENCOUNTER_VIEW, MyEncounterView } from "./views/encounterview";

import { DETAIL_VIEW, MyDetailView, DetailData } from "./views/detailview";

import { PLAYER_INFO_VIEW, MyPlayerInfoView, PlayerInfoState } from "./views/playerinfoview";

// Remember to rename these classes and interfaces!

export default class ToolsFor5e extends Plugin {
	settings: ToolsFor5eSettings;

    public absoluteDataPath: string = "";
    public absoluteImgPath: string = "";

	public myItemary!: ItemCompendium;
	public mySpellary!: SpellCompendium;
    public myBestiary!: BeastCompendium;

	private lastMdLeaf: WorkspaceLeaf | null = null;

	async onload()
    {
        console.log( "starting" );

        await this.loadSettings();
        await this.generatePaths();
        await this.initializeFiles();

        //pass settings to utility class:
        BeastUtils.initialize( this.settings );

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab( new ToolsFor5eSettingsTab( this.app, this ) );

        this.myBestiary = new BeastCompendium( this );
        await this.myBestiary.build( this.absoluteDataPath, this.absoluteImgPath );
        await this.registerSources( this.myBestiary.getSources() );

        this.mySpellary = new SpellCompendium( this );
        await this.mySpellary.build( this.absoluteDataPath, this.absoluteImgPath );
        await this.registerSources( this.mySpellary.getSources() );

        this.myItemary = new ItemCompendium( this );
        await this.myItemary.build( this.absoluteDataPath, this.absoluteImgPath );
        await this.registerSources( this.myItemary.getSources() );

        // register views AFTER Compendii are built!
        this.registerView( ITEM_VIEW, (leaf) => new MyItemView( leaf, this, this.myItemary.getData() ) );   //, this.myItemary.getSources()
        this.registerView( SPELL_VIEW, (leaf) => new MySpellView( leaf, this, this.mySpellary.getData() ) );
        this.registerView( BEAST_VIEW, (leaf) => new MyBeastView( leaf, this, this.myBestiary.getData() ) );

        this.registerView( CHARACTER_VIEW, (leaf) => new MyCharacterView( leaf, this ) );   //list view for characters
        this.registerView( NPC_VIEW, (leaf) => new MyNPCView(leaf, this) );                 //list view for npcs
        this.registerView( ENCOUNTER_VIEW, (leaf) => new MyEncounterView(leaf, this) );     //view for encounter

        this.registerView( DETAIL_VIEW, (leaf) => new MyDetailView( leaf, this ) );
        this.registerView( PLAYER_INFO_VIEW, (leaf) => new MyPlayerInfoView( leaf ) );

        // ribbon icons:
        const colorMain = 'black';
        const bgcolorMain = '#FDF1DC';
		const itemIcon = this.addRibbonIcon('sword', 'D&D items', (evt: MouseEvent) => {
			this.openPane( ITEM_VIEW, MyItemView );
			//void this.openItemsPane();
		});
        itemIcon.style.color = colorMain; // Nutzt das Theme-Blau/Lila
        itemIcon.style.backgroundColor = bgcolorMain;

        const scrollIcon = this.addRibbonIcon('scroll', 'D&D spells', (evt: MouseEvent) => {
			this.openPane( SPELL_VIEW, MySpellView );
			//void this.openSpellsPane();
		});
        scrollIcon.style.color = colorMain;
        scrollIcon.style.backgroundColor = bgcolorMain;

        const monsterIcon = this.addRibbonIcon('skull', 'D&D monsters', (evt: MouseEvent) => {
			this.openPane( BEAST_VIEW, MyBeastView );
			//void this.openMonstersPane();
		});
        monsterIcon.style.color = colorMain;
        monsterIcon.style.backgroundColor = bgcolorMain;

        const characterIcon = this.addRibbonIcon('users', 'D&D characters', () => {
            this.openPane( CHARACTER_VIEW, MyCharacterView );
        });
        characterIcon.style.color = colorMain;
        characterIcon.style.backgroundColor = bgcolorMain;

        const npcIcon = this.addRibbonIcon('venetian-mask', 'D&D NPCs', () => {
            this.openPane( NPC_VIEW, MyNPCView );
        });
        npcIcon.style.color = colorMain;
        npcIcon.style.backgroundColor = bgcolorMain;

        //start encounters:
        const encounterIcon = this.addRibbonIcon("swords", "Start encounter", (evt) =>
        {
            const activeFile = this.app.workspace.getActiveFile();
            const cache = activeFile ? this.app.metadataCache.getFileCache(activeFile) : null;

            if (cache?.frontmatter?.type === "encounter")
            {
                this.openEncounterView( activeFile! );
            }
            else
            {
                new Notice("Current File is not an encounter.");
            }
        });
        encounterIcon.style.color = "#9c2b1b";
        encounterIcon.style.backgroundColor = bgcolorMain;

        const playerWinIcon = this.addRibbonIcon( "monitor", "Open player display window", async () =>
        {
            await this.openPlayerWindow();
        });

        playerWinIcon.style.color = "#090088";
        playerWinIcon.style.backgroundColor = bgcolorMain;

        const clearWinIcon =this.addRibbonIcon( "eraser", "Clear player display", async () =>
        {
            await this.clearPlayerWindow();
        });
        clearWinIcon.style.color = "#090088";
        clearWinIcon.style.backgroundColor = bgcolorMain;

        const sendWinIcon =this.addRibbonIcon( "paper-plane", "Send message to player screen", async () =>
        {
            new TextInputModal( this.app, "Message to Players", "Message", async (value: string) =>
                {
                    if( value.trim().length > 0 )
                    {
                        await this.showTextInPlayerWindow( value );
                        //await onChanged();
                    }
                } ).open();

        });
        sendWinIcon.style.color = "#090088";
        sendWinIcon.style.backgroundColor = bgcolorMain;


		//register markdown post-processor
		this.registerMarkdownPostProcessor( toolsPostProcessor( this ) );

		//whenever the edit leaf changes, write to tracker variable this.lastMdLeaf:
		this.registerEvent(
      		this.app.workspace.on("active-leaf-change", (leaf) => {
        		const mv = this.app.workspace.getActiveViewOfType( MarkdownView );
        		if (mv) this.lastMdLeaf = mv.leaf;
      		}));

        //righ click menu
        this.registerEvent(
            this.app.workspace.on("file-menu", ( menu, file ) =>
            {
				//check if it is a file
				if (file instanceof TFile)
				{
					const cache = this.app.metadataCache.getFileCache(file);
            		const type = cache?.frontmatter?.type;

					if (cache?.frontmatter?.type === "encounter")
	                {
	                    menu.addItem((item) => {
	                        item.setTitle("Start encounter")
	                            .setIcon("swords") // Obsidian Icon Name
	                            .onClick(async () => {
	                                this.openEncounterView( file );
	                            });
	                    });
	                }
				}


                const targetFolder = file instanceof TFolder ? file : file.parent;
                if( targetFolder )
                {
                     //menu.addSeparator();
                     menu.addItem((item) => {
                            item.setTitle("Create new encounter...")
                                .setIcon("swords") // Nutzt Obsidian-interne Icons
                                .onClick(async () => {
                                    await this.createNewNoteWithType( targetFolder.path, "encounter", "New Encounter");
                                });
                        });
                    menu.addItem((item) => {
                           item.setTitle("Create new character...")
                               .setIcon("user") // Nutzt Obsidian-interne Icons
                               .onClick(async () => {
                                   await this.createNewNoteWithType( targetFolder.path, "character", "New Character");
                               });
                       });
                   menu.addItem((item) => {
                          item.setTitle("Create new NPC...")
                              .setIcon("user-check") // Nutzt Obsidian-interne Icons
                              .onClick(async () => {
                                  await this.createNewNoteWithType( targetFolder.path, "npc", "New NPC");
                              });
                      });
                }
        }));


        // make file icons reflect frontmatter type:
        // update icons at startup
        this.app.workspace.onLayoutReady(() => { this.updateFileExplorerIcons(); });

        // update icons on frontmatter change
        this.registerEvent( this.app.metadataCache.on("changed", (file) => { this.updateFileExplorerIcons(); }) );
		this.registerEvent( this.app.metadataCache.on("resolve", (file) => { this.updateFileExplorerIcons(); }) );

        // update icons on rename... necessary???
        this.registerEvent( this.app.vault.on("rename", () => this.updateFileExplorerIcons()) );
	}

    private updateFileExplorerIcons()
    {
        const fileElements = document.querySelectorAll(".nav-file");

        fileElements.forEach((el) =>
        {
            const titleEl = el.querySelector(".nav-file-title");
            if( !titleEl ) return;

            const filePath = titleEl.getAttribute("data-path");
            if( !filePath ) return;

            const file = this.app.vault.getAbstractFileByPath( filePath );
            if( !(file instanceof TFile) ) return;

            // get frontmatter from cache
            const cache = this.app.metadataCache.getFileCache( file );
            const type = cache?.frontmatter?.type;

            // 1. remove classes
            el.removeClass("is-encounter", "is-npc", "is-character");

            // 2. set classes
            if (type === "encounter")
            {
                el.addClass("is-encounter");
            }
            else if (type === "npc")
            {
                el.addClass("is-npc");
            }
            else if (type === "character")
            {
                el.addClass("is-character");
            }
        });
    }

    private async createNewNoteWithType( folderPath: string, type: "encounter" | "npc" | "character", defaultName: string )
    {
        let fileName = `${folderPath}/${defaultName}.md`;
        let counter = 1;
        while (this.app.vault.getAbstractFileByPath(fileName))
        {
            fileName = `${folderPath}/${defaultName} ${counter}.md`;
            counter++;
        }

        let frontmatter = "";
        if( type === "encounter" )
        {
            frontmatter = ENCOUNTER_FRONTMATTER;
        }
        else if( type === "character" )
        {
            frontmatter = CHARACTER_FRONTMATTER;
        }
        else if( type === "npc" )
        {
            frontmatter = NPC_FRONTMATTER;
        }
        const newFile = await this.app.vault.create(fileName, frontmatter);
        await this.app.workspace.getLeaf(false).openFile(newFile);

		let attempts = 0;
    	const interval = setInterval(() =>
		{
        	this.updateFileExplorerIcons();
        	attempts++;

	        // stop as soon icon is set
	        const success = document.querySelector(`.nav-file [data-path="${fileName}"]`);
	        if (success || attempts > 15)
			{
	            clearInterval(interval);
	        }
    	}, 100); // Alle 100 Millisekunden prüfen

    }

    async initializeFiles()
    {
        const files = ["characters.json", "npcs.json"];
        for (const file of files)
        {
            if( !(await this.app.vault.adapter.exists(file)) )
            {
                await this.app.vault.adapter.write(file, JSON.stringify([], null, 2));
                console.log(`${file} wurde erstellt.`);
            }
        }
    }

    async registerSources( sources: Iterable<string>  )     //includes Set and Array
    {
        for (const source of sources)
        {
            if( !( source in this.settings.enabledSources ) )
            {
                this.settings.enabledSources[ source ] = false; //default disabled
            }
        }
        await this.saveSettings();
    }

	onunload() {
		console.debug("unloading Tools for 5e...");
		this.app.workspace
		   .getLeavesOfType(ITEM_VIEW)
		   .forEach((leaf) => leaf.detach());

        this.app.workspace
           .getLeavesOfType(SPELL_VIEW)
           .forEach((leaf) => leaf.detach());

	   this.app.workspace
		  .getLeavesOfType(BEAST_VIEW)
		  .forEach((leaf) => leaf.detach());

      this.app.workspace
          .getLeavesOfType(DETAIL_VIEW)
		  .forEach((leaf) => leaf.detach());
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ToolsFor5eSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

    async showDetail( payload: DetailData, sourceLeaf: WorkspaceLeaf )
    {
        let detailLeaf = this.app.workspace.getLeavesOfType(DETAIL_VIEW)[0];

        if( !detailLeaf )
        {
            // Öffnet den View in der rechten Sidebar
            //unter dem aktiven ListView
            detailLeaf = this.app.workspace.createLeafBySplit( sourceLeaf, 'horizontal', false );
            await detailLeaf.setViewState({ type: DETAIL_VIEW, active: true });
        }

        const view = detailLeaf.view as MyDetailView;
        view.update( payload );

        // Macht den View sichtbar
        this.app.workspace.revealLeaf(detailLeaf);
    }

    async openEncounterView( file: TFile )
    {
        //console.log( "activateEncounterView " );
        const { workspace } = this.app;

        let leaf = workspace.getLeavesOfType( ENCOUNTER_VIEW ).first();
        if( !leaf )
        {
            leaf = workspace.openPopoutLeaf();
            await leaf.setViewState( {type: ENCOUNTER_VIEW, active: true } );
        }

        if( leaf.view instanceof MyEncounterView )
        {
            await leaf.view.loadEncounter( file );  //,  this.getAllItems );

            workspace.setActiveLeaf( leaf, { focus: true });
            const win = (leaf.view.containerEl.ownerDocument?.defaultView) as any;

            if (win) win.focus();
        }
    }

	async openPane( viewType: string, viewClass: new (...args: any[]) => View )		//( ITEM_VIEW, MyItemView )
	{
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		let presentLeaf = workspace.getLeavesOfType( viewType ).first();

		if( presentLeaf && presentLeaf.view instanceof viewClass )
		{
			console.debug( "Pane of type " + viewType + " already there." );
			leaf = presentLeaf;
		}
		else
		{
			leaf = workspace.getRightLeaf(false);
            await leaf?.setViewState({ type: viewType, active: true });
		}
        if( leaf )
        {
            await workspace.revealLeaf( leaf );
        }
    }

    public getBase64ImageAsSrcData( relImgPath: string ): string | null
    {
        if( !relImgPath )
            return null;

        if( this.settings.useLiveImages )
        {
            const webRelPath = relImgPath.replace(/\\/g, '/');
            const baseUrl = this.settings.liveImageBaseURL.endsWith('/') ? this.settings.liveImageBaseURL : this.settings.liveImageBaseURL + '/';
            const urlParam = this.settings.liveImageURLParam;
            const sanitizedPath = webRelPath.replace(/ /g, '%20');

            return `${baseUrl}${sanitizedPath}${urlParam}`;   //?raw=true
        }

        const cleanFluffPath = relImgPath.replace(/\//g, path.sep);
        const absoluteImgPath = path.join( this.absoluteImgPath, cleanFluffPath );

        if( !fs.existsSync(absoluteImgPath) )
        {
            console.warn("could not find image path: " + absoluteImgPath);
            return null;
        }

        const imageBuffer = fs.readFileSync( absoluteImgPath );
        const base64Image = imageBuffer.toString( 'base64' );

        return `data:image/webp;base64,${base64Image}`;
    }

    public getImgPath()
    {
        return this.absoluteImgPath;
    }

    public getDataPath()
    {
        return this.absoluteDataPath;
    }


    private async generatePaths()
    {
        // generate external absolute paths
        if( this.settings.fiveEtoolsExternalDir )
        {
            console.log( "ext dir: " + this.settings.fiveEtoolsExternalDir );
            const vaultRoot = (this.app.vault.adapter as any).basePath;

            this.absoluteDataPath = path.resolve( vaultRoot, path.join( this.settings.fiveEtoolsExternalDir, 'data/' ) );
            this.absoluteImgPath = path.resolve( vaultRoot, path.join( this.settings.fiveEtoolsExternalDir, 'img/' ) );

            if( await pathExists( this.absoluteDataPath ) )
            {
                console.log( "absolute data path exists: " + this.absoluteDataPath );
                //check if it has a /data/books.json or /books.json
            }
            else
            {
                console.log( "no absolute data path" );
                this.absoluteDataPath = '';
            }

            if( await pathExists( this.absoluteImgPath ) )
            {
                console.log( "absolute img path exists: " + this.absoluteImgPath );
                //check if it has a /data/books.json or /books.json
            }
            else
            {
                console.log( "no absolute img path" );
                this.absoluteImgPath = '';
            }
        }
        else
        {
            new Notice( "No 5etools data selected..." );
            //console.log( "No 5etools data selected..." );
        }
    }

    public async openPlayerWindow()
    {
        const existingLeaves = this.app.workspace.getLeavesOfType( PLAYER_INFO_VIEW );

        if( existingLeaves && existingLeaves.length > 0 )
        {
            this.app.workspace.revealLeaf( existingLeaves[0]! );
            return;
        }

        const leaf = this.app.workspace.openPopoutLeaf();
        await leaf.setViewState( { type: PLAYER_INFO_VIEW, active: true, state: undefined } );
    }

    //only if open
    public async showInPlayerWindow( state: PlayerInfoState )
    {
        const existingLeaves =  this.app.workspace.getLeavesOfType( PLAYER_INFO_VIEW );

        if( existingLeaves && existingLeaves.length > 0 )
        {
            const view = existingLeaves[0]!.view as MyPlayerInfoView;
            await view.setState( state, { history: false } );
            return;
        }
    }

    public async showImageInPlayerWindowSrc( imageSrc: string | null, altText?: string, backgroundColor?: string )
    {
        await this.showInPlayerWindow({ mode: "image", imageSrc, altText, backgroundColor });
    }

    public async showImageInPlayerWindowPath( imagePath: string | null, altText?: string, backgroundColor?: string )
    {
         await this.showInPlayerWindow({ mode: "image", imagePath, altText, backgroundColor });
    }

    public async showTextInPlayerWindow( text: string, backgroundColor?: string )
    {
        await this.showInPlayerWindow({ mode: "text", text, backgroundColor });
    }

    public async showCustomInPlayerWindow( html: string, backgroundColor?: string )
    {
        // not very safe setting inner HTML directly
        await this.showInPlayerWindow({ mode: "custom", html, backgroundColor });
    }

    public async clearPlayerWindow( backgroundColor?: string )
    {
        await this.showInPlayerWindow({ mode: "empty", backgroundColor });
    }

    public useMetricUnits() : boolean
    {
        return this.settings?.useMetricUnits ?? false;
    }

	public insertIntoActiveFile( insert: string )
	{
	    const activeLeaf = this.app.workspace.getMostRecentLeaf();
		//console.log( activeLeaf );

		if( activeLeaf && activeLeaf.view instanceof MarkdownView )
		{
			const markdownView = activeLeaf.view;
			if (markdownView.getMode() === "preview")
			{
            	new Notice("Please change note mode to edit");
            	return;
        	}

        	const editor = activeLeaf.view.editor;
        	editor.replaceSelection(insert);
        	editor.focus();
    	}
		else
		{
        	new Notice("Please have a note active to insert into.");
    	}
	}

}
