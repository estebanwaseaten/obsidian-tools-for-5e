import {App, Editor, MarkdownView, Modal, Notice, Plugin, normalizePath, TFile, TFolder} from 'obsidian';
import {DEFAULT_SETTINGS, ToolsFor5eSettings, ToolsFor5eSettingsTab} from "./settings";

import { pathExists, verify5eToolsPath, verify5eImgPath } from "./utils/fileUtils";

import { toolsPostProcessor } from './markdown';

import * as path from "path";
import * as fs from "fs";

import { ITEM_VIEW, MyItemView } from "./itemview";
import { Itemary } from "./itemary"
import { SPELL_VIEW, MySpellView } from "./spellview";
import { Spellary } from "./spellary"
import { BEAST_VIEW, MyBeastView } from "./beastview";
import { Bestiary } from "./bestiary"

// Remember to rename these classes and interfaces!

export default class ToolsFor5e extends Plugin {
	settings: ToolsFor5eSettings;

    private absoluteDataPath!: string = "";
    private absoluteImgPath!: string = "";

//	private pathDataFolder!: string = '';
//	private dataFolder!: TFile;
//	private pathBooksJSON!: string = '';
//	private booksJSON: TFile;

	public myItemary!: Itemary;
	public mySpellary!: Spellary;
	public myBestiary!: Bestiary;

	private lastMdLeaf: WorkspaceLeaf | null = null;

	async onload()
    {
        console.log( "starting" );
        //some testing:
        await this.loadSettings();

        const vaultRoot = (this.app.vault.adapter as any).basePath;

        //generate external absolute paths
        if( this.settings.fiveEtoolsExternalDir )
        {
            this.absoluteDataPath = path.resolve( vaultRoot, path.join( this.settings.fiveEtoolsExternalDir, 'data/' ) );
            this.absoluteImgPath = path.resolve( vaultRoot, path.join( this.settings.fiveEtoolsExternalDir, 'img/' ) );

            if( await pathExists( this.absoluteDataPath ) )
            {
                console.log( "absolute data path exists: " + this.absoluteDataPath );
                //check if it has a /data/books.json or /books.json
            }
            else
            {
                this.absoluteDataPath = '';
            }

            if( await pathExists( this.absoluteImgPath ) )
            {
                console.log( "absolute img path exists: " + this.absoluteImgPath );
                //check if it has a /data/books.json or /books.json
            }
            else
            {
                this.absoluteImgPath = '';
            }
        }
        else
        {
            new Notice( "No 5etools data selected..." );
            //console.log( "No 5etools data selected..." );
        }

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab( new ToolsFor5eSettingsTab( this.app, this ) );

        this.myBestiary = new Bestiary( this.app, this );
        await this.myBestiary.build( this.absoluteDataPath, this.absoluteImgPath );
        await this.registerSources( this.myBestiary.getSources() );

        this.mySpellary = new Spellary( this.app, this );
        await this.mySpellary.build( this.absoluteDataPath, this.absoluteImgPath );
        await this.registerSources( this.mySpellary.getSources() );

        this.myItemary = new Itemary( this.app, this );
        await this.myItemary.build( this.absoluteDataPath, this.absoluteImgPath );
        await this.registerSources( this.myItemary.getSources() );


		this.addRibbonIcon('sword', 'D&D items', (evt: MouseEvent) => {
			void this.openPane( ITEM_VIEW, MyItemView );
			//void this.openItemsPane();
		});

        this.addRibbonIcon('scroll', 'D&D spells', (evt: MouseEvent) => {
			void this.openPane( SPELL_VIEW, MySpellView );
			//void this.openSpellsPane();
		});

		this.addRibbonIcon('skull', 'D&D monsters', (evt: MouseEvent) => {
			void this.openPane( BEAST_VIEW, MyBeastView );
			//void this.openMonstersPane();
		});


		// register views
		this.registerView( ITEM_VIEW, ( leaf: WorkspaceLeaf ) => new MyItemView( leaf, this ) );
        this.registerView( SPELL_VIEW, ( leaf: WorkspaceLeaf ) => new MySpellView( leaf, this ) );
		this.registerView( BEAST_VIEW, ( leaf: WorkspaceLeaf ) => new MyBeastView( leaf, this ) );


        //this.app.workspace.onLayoutReady( () => this.build() );


		//register markdown post-processor
		this.registerMarkdownPostProcessor( toolsPostProcessor( this ) );

		//whenever the edit leaf changes, write to tracker variable this.lastMdLeaf:
		this.registerEvent(
      		this.app.workspace.on("active-leaf-change", (leaf) => {
        		const mv = this.app.workspace.getActiveViewOfType( MarkdownView );
        		if (mv) this.lastMdLeaf = mv.leaf;
      		}));

	}

    async registerSources( sources: Set<string> )
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
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ToolsFor5eSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async openPane( viewType: string, instance: MyItemView | MySpellView | MyBeastView )		//( ITEM_VIEW, MyItemView )
	{
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		let presentLeaf = workspace.getLeavesOfType( viewType ).first();

		if( presentLeaf && presentLeaf.view instanceof instance )
		{
			console.debug( "Pane of type " + viewType + " already there." );
			leaf = presentLeaf;
		}
		else
		{
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: viewType, active: true });
		}
		await workspace.revealLeaf( leaf );
	}
}
