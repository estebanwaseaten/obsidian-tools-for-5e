import { ItemView, TFile, setIcon } from "obsidian";
import type ToolsFor5e from "../main";     //only for default export

import { MyCharacter, MyNPC } from "../character"

export const ENCOUNTER_VIEW = "tools-for-5e-encounter-pane";

const CONDITIONS = [
    "blinded", "charmed", "deafened", "exhaustion",
    "frightened", "grappled", "incapacitated", "invisible",
    "paralyzed", "petrified", "poisoned", "prone",
    "restrained", "stunned", "unconscious"
];

export class EncounterParticipant       //data for live encounter
{
    id: string;         //important for several monsters of the same type!!
    ref: string;        //source:name for beasts and path for NPCs and Players  -->reference to the monster template or character file
    kind: string;
    icon: string;

    stat_ac: number;
    stat_hpMax: number;
    stat_iniBonus: number;
    stat_hpFormula?: string;    //click to re-roll

    set_ac: number;
    set_hpMax: number;
    set_iniBonus: number;

    set_name: string; // z.B. "Goblin Boss" statt nur "Goblin"
    set_attitude : "friendly" | "neutral" | "hostile";


    dyn_hpCurrent: number;
    dyn_initiative: number;
    dyn_conditions: string[] = []; // Optional: für Zustände wie 'Prone'


    constructor( encounterFM: any, plugin: ToolsFor5e )
    {
        this.kind = encounterFM.kind;
        //read ID or create it:
        //if we create here, where to save it??
        if( !encounterFM.id )
        {
            console.log( "participant ID missing!")
            this.id = "";   //or undefined?
            return;
        }

        this.id = encounterFM.id;

        if( encounterFM.kind === 'character' || encounterFM.kind === 'npc' )    // p
        {
            const charFile = plugin.app.vault.getAbstractFileByPath( encounterFM.ref );
            if (charFile instanceof TFile)
            {   //extract from character or npc file
                const charCache = plugin.app.metadataCache.getFileCache( charFile );
                const charFm = charCache?.frontmatter;
                console.log( "encounter: character or npc: " + charFm.name );
                this.ref = encounterFM.ref;
                this.kind = charFm.kind;
                this.set_name = charFm.name;

                if( encounterFM.kind === 'character' )
                {
                    this.icon = "user";
                    this.set_attitude = "friendly"
                }
                else
                {
                    this.icon = "message-square";
                    this.set_attitude = charFm?.attitude | "neutral";
                }
            }
        }
        else if( encounterFM.kind === 'monster' )
        {
            const source = encounterFM.ref.split(':')[0];
            const name = encounterFM.ref.split(':')[1];

            const beastData = plugin.myBestiary.getDataItem( name, source );

            console.log( "encounter: monster: " + name + " from " + source + ": " + beastData.name );

            this.ref = encounterFM.ref;
            this.kind = beastData.source + ":" + beastData.name;
            this.icon = "skull";
            this.set_attitude = "hostile"
            this.set_name = beastData.name;

        }
    }

    renderRow( root: HTMLElement, isActive: boolean )
    {
        const row = root.createEl("div", { cls: "tools-for-5e-encounter-row-container " + this.kind + " " + this.set_attitude + (isActive ? " is-active" : "")});

        const iconContainer = row.createEl( "div", { cls: "tools-for-5e-encounter-row-icon"} );
        setIcon( iconContainer, this.icon );

        row.createEl("div", { text: this.set_name });
        //console.log( "active: " + isActive );
    }
}


export abstract class MyEncounterView extends ItemView
{
    private file: TFile;    //encounter file, important for saving!

    //encounter data
    name: string;
    current_round: number;
    current_pos: number;

    participants: EncounterParticipant[] = [];

    private contentDiv!: HTMLElement;

    constructor( leaf: WorkspaceLeaf, public plugin: ToolsFor5e )
    {
       super(leaf);
    }

    getViewType() { return ENCOUNTER_VIEW; }
    getDisplayText() { return this.data?.name ?? "Encounter Tracker"; }
    getIcon() { return "swords"; }

    //this is called after the view is displayed ad put in focus    --> load data from file and everything else. references to players and npcs via file path and to monsters via source&name
    async loadEncounter( file: TFile )
    {
        console.log( "I have access to " + this.plugin.myBestiary.getItemCount() + " monsters" );
        this.file = file;

        // 0. make sure IDs exist:
        await this.app.fileManager.processFrontMatter( this.file,
            (fm) =>
            {
                if( !fm || fm.type !=== "encounter" || !fm.participants ) return;

                const fmParticipants = fm.participants as any[];

                fmParticipants.forEach(
                    (p, i) =>
                    {
                        p.id = "id_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now() + "_" + i;
                        console.log(`ID generiert für Eintrag ${i} (${p.name || p.ref})`);
                    });
            });

        // 1. load encounter.md
        const fm = this.app.metadataCache.getFileCache( this.file )?.frontmatter;
        if( !fm ) return;

        if( fm.type !== "encounter" )
        {
            console.log( "no encounter" );
            return;
        }

        console.log( fm );

        this.name = fm?.name ?? file.basename;
        this.current_pos = fm?.current_pos ?? 0;
        this.current_round = fm?.current_round ?? 0;

        // 2. load participants data
        const loadedParticipants: EncounterParticipant[] = [];

        for( const p of ( fm.participants || []) )      // loop through frontmatter
        {
            console.log( p );
            //if it has no id --> create one!!
            let newParticipant = new EncounterParticipant( p, this.plugin );   //<-- gets
            this.participants.push( newParticipant );
        }

        await this.save(); //--> so we are saving the newly generated ID
        this.render();
    }

    async onOpen()
    {
        this.render();
    }

    async onClose()
    {
        //save stuff here!
        await this.save();
        this.particiants = [];
    }

    private render()
    {
        const root = this.contentEl;
        root.empty();
        root.addClass("tools-for-5e-encounter-container");

        //1. display encounter information: name, current round, maybe a note?
        if( this.participants.length === 0 )
        {
            root.createEl("div", { text: "no participants!" });
        }

        const header = root.createEl("div", { cls: "tools-for-5e-encounter-header" } );

        header.createEl( "span", { text: this.name, cls: "tools-for-5e-encounter-header-title"} )

        const controlsContainer = header.createDiv({ cls: "tools-for-5e-encounter-controls" });

            const prevBtn = controlsContainer.createEl("button", { cls: "clickable-icon tools-for-5e-control-btn" });
            setIcon(prevBtn, "arrow-left" );
            prevBtn.addEventListener( "click", () => this.previousTurn() );

            controlsContainer.createSpan({ text: `Runde ${this.current_round}`,  cls: "tools-for-5e-round-display" });

            const nextBtn = controlsContainer.createEl("button", { cls: "clickable-icon tools-for-5e-control-btn" });
            setIcon(nextBtn, "arrow-right" );
            nextBtn.addEventListener( "click", () => this.nextTurn() );

        //this.resultsEl.addEventListener( "click", (evt) => this.handleResultClick(evt) );


        //2. display this.participants in a list with the current_pos marked


        for( const index in this.participants )
        {
            this.participants[index].renderRow( root, index == this.current_pos );
        }

    }

    private async nextTurn()
    {
        this.current_pos++;
        if( this.current_pos >= this.participants.length )
        {
            this.current_pos = 0;
            this.current_round++;
        }

        await this.save();
        this.render();
    }

    private async previousTurn()
    {
        this.current_pos--;
        if( this.current_pos < 0 )
        {
            if( this.current_round >= 1 )
            {
                this.current_round--;
                this.current_pos = this.participants.length - 1;
            }
            else
            {
                this.current_pos = 0;
                new Notice( "The encounter just started - cannot go back!" );
                return;
            }
        }
        await this.save();
        this.render();
    }

    //saves back to file
    private async save()
    {
        if (!this.file)
        {
            console.log( "save(): file not found");
            return;
        }

        await this.app.fileManager.processFrontMatter( this.file, (fm) =>
        {

            // Sicherheitscheck: Nur speichern, wenn der Typ stimmt
            if( fm.type !== "encounter" )
            {
                console.error("No encounter file. Abort! Abort!");
                return;
            }

            //save current state of the encounter in this.file's frontmatter
            fm.current_pos = this.current_pos;
            fm.current_round = this.current_round;

            const fmParticipants = fm.participants as any[];   //participants from frontmatter

            //loop through currently loaded participants
            this.participants.forEach( ( liveParticipant ) =>
            {
                // MATCHING ÜBER DIE EINDEUTIGE ID
                const existingFmEntry = fmParticipants.find( p => p.id === liveParticipant.id );

                if( existingFmEntry )
                {
                    // UPDATE: Parameter aktualisieren
                    existingFmEntry.hp_current = liveParticipant.dyn_hpCurrent;
                    existingFmEntry.initiative = liveParticipant.dyn_initiative;
                    existingFmEntry.id = liveParticipant.id;
                }
    /*            else    //this should not be necessary?
                {
                    // ADD: Komplett neuer Eintrag (inklusive der ID!)
                    existingFmEntry.push({
                        id: liveParticipant.id, // Wichtig: Damit er beim nächsten Mal gefunden wird
                        ref: liveParticipant.ref,
                        kind: liveParticipant.kind,
                        name: liveParticipant.set_name,
                        hp_current: liveParticipant.dyn_hpCurrent,
                        initiative: liveParticipant.dyn_initiative
                    });
                }*/
            });

        });
    }
}
