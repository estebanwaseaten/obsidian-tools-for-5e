import { ItemView, TFile, setIcon, Modal, Notice, WorkspaceLeaf } from "obsidian";
import type ToolsFor5e from "../main";     //only for default export

import { rollD20, rollDY, rollXDY } from "../utils/rollUtils"
//import { parseArmorClass } from "../utils/encounterUtils"
import { ConditionsModal, TextInputModal, NumInputModal, ConfirmModal } from "../utils/modalUtils"

import { CharacterYAML } from "../character"
import { MyBeast, BeastUtils } from "../beast"



export const ENCOUNTER_VIEW = "tools-for-5e-encounter-pane";

const CONDITIONS = [
    "blinded", "charmed", "deafened", "exhaustion",
    "frightened", "grappled", "incapacitated", "invisible",
    "paralyzed", "petrified", "poisoned", "prone",
    "restrained", "stunned", "unconscious"
];

//for rendering only!!!
interface StandardizedStatblock {
    name: string;
    subtitle: string;
    ac: number;
    hp: {
        current: number;
        max: number;
        percentage: number;
        display: string;
    }
    attributes: Array<{ label: string; score: number; mod: number; display: string; }>;
    infoLines:  Array<{ label: string; value: string }>;
    textBlocks: Array<{ sectionTitle: string; entries: Array<{ label: string; text: string; }>}>;
}

//the following participant data is to be saved back to the frontmatter in this form
interface encounterParticipantData
{
    name: string;
    initiative: number | null;

    conditions: string[];
    attitude: "friendly" | "neutral" | "hostile";   //towards the players

    ac?: string;            //could be modified for monsters, not so important for players
    hpMax?: number;         //needed for monsters and npcs, players can track themselves
    hpCurrent?: number;     //needed for monsters and npcs, players can track themselves
    iniBonus?: number;      // for simple re-roll...?

    showImage?: boolean;
}

//this is the whole data structure of the participant array in the List
export interface EncounterParticipantYAML {
    // 1. Die zwingend erforderlichen Basis-Daten (immer im YAML vorhanden)
    ref: string;                             // Z.B. "XMM:Bandit Captain" oder "NPCs/Lirael.md"
    kind: "monster" | "npc" | "character";   // Strikte Typisierung der erlaubten Arten

    // 2. Optionale Daten (existieren erst, wenn das Encounter läuft/gespeichert wurde)
    id?: string;                             // Eindeutige ID zur Unterscheidung gleicher Monster
    name?: string;

    // Die Live-Zustandsdaten (falls das Encounter ein geladener Spielstand ist)
    participantData?: encounterParticipantData;
}


//abstract live encounter participant class full of additional data
class EncounterParticipant       //data for live encounter
{
    //static does not need to be saved back!
    readonly id: string;         //important for several monsters of the same type!!
    readonly ref: string;        //source:name for beasts and path for NPCs and Players  -->reference to the monster template or character file
    readonly kind: string;

    //temporary not to be saved:
    icon: string;
    private rawEntity: Readonly<EncounterParticipantYAML>;
    public renderStatblock: StandardizedStatblock | null = null; //for rendering the details!

    //fixed read only:
    public readonly fixedData: Readonly<MyBeast> | Readonly<CharacterYAML> | null = null; //this is a reference and its contents are Readonly!

    //only participantData needs to be saved back to the frontmatter:
    public participantData: encounterParticipantData;

    constructor( encounterFrontmatterEntity: Readonly<EncounterParticipantYAML>, private plugin: ToolsFor5e )      //live instance created given the encounterFrontmatterEntity
    {
        if( !encounterFrontmatterEntity.id )
        {
            console.log( "participant ID missing!")
            this.id = "";   //or undefined?
            return;
        }

        this.kind = encounterFrontmatterEntity.kind;
        this.id = encounterFrontmatterEntity.id;
        this.ref = encounterFrontmatterEntity.ref;
        this.rawEntity = encounterFrontmatterEntity;

        let temporaryFixedData: Readonly<MyBeast> | Readonly<CharacterYAML> | null = null;

        if( this.kind === 'monster')
        {
            this.icon = "skull";
            const parts = this.ref.split(':');
            const source = parts[0] ?? "";
            const monsterName = parts[1] ?? "";

            temporaryFixedData = plugin.myBestiary.getDataItem( monsterName, source ) ?? null;
        }
        else if ( this.kind === 'character' || this.kind === 'npc' )
        {
            this.icon = this.kind === 'character' ? "user" : "user-check";
            const entityFile = plugin.app.vault.getAbstractFileByPath(this.ref);
            if (entityFile instanceof TFile)
            {
                const fileCache = plugin.app.metadataCache.getFileCache(entityFile);
                temporaryFixedData = (fileCache?.frontmatter as CharacterYAML) || null;
            }
        }
        this.fixedData = temporaryFixedData;        //strictly needs to be in main body of constructor because readonly.
        //console.log( this.fixedData );

        if( !encounterFrontmatterEntity.participantData )   //we need to first time generate the encounter participant data:
        {
            this.generateParticipantData( encounterFrontmatterEntity );
            //console.log( "createPArticpantdata for " + this.id );
            //console.log(encounterFrontmatterEntity);
        }
        else    //or just load that data:
        {
            //console.log( "load participant data for " + this.id );
            this.participantData = structuredClone( encounterFrontmatterEntity.participantData );
            if( !this.participantData.conditions )
            {
                this.participantData.conditions = [];
            }
            if( this.participantData.showImage === undefined )
            {
                this.participantData.showImage = true;
            }
        }
    }

    generateParticipantData( encounterFrontmatterEntity: Readonly<EncounterParticipantYAML> )
    {
        switch( encounterFrontmatterEntity.kind )
        {
            case "character":
                this.generateParticipantDataCharacter( encounterFrontmatterEntity );
                break;
            case "npc":
                this.generateParticipantDataNPC( encounterFrontmatterEntity );
                break;
            case "monster":
                this.generateParticipantDataMonster( encounterFrontmatterEntity );
                break;
            default:
                new Notice( "entity kind " + encounterFrontmatterEntity.kind + " unknown" );
                break;
        }
    }

    generateParticipantDataCharacter( encounterFrontmatterEntity: Readonly<EncounterParticipantYAML> )
    {
        console.log( "(re)generate character particiant data: " + encounterFrontmatterEntity.name);
        const character = this.fixedData as CharacterYAML | null;
        this.participantData =
        {
            name: character?.name || "Untitled Character",
            initiative: null,
            conditions: [],
            attitude: "friendly"
        };
    }

    //called when data is loaded from NPC file
    generateParticipantDataNPC( encounterFrontmatterEntity: Readonly<EncounterParticipantYAML> )
    {
        console.log( "(re)generate NPC particiant data: " + encounterFrontmatterEntity.name );
        const npc = this.fixedData as CharacterYAML | null;

        console.log( this.fixedData );

        const iniBonus = npc?.iniBonus ?? (npc as any)?.inibonus ?? 0;
        const ini = rollD20() + iniBonus;

        this.participantData =
        {
            name: npc?.name || "Untitled NPC",
            initiative: ini,
            conditions: [],
            attitude: npc?.attitude || "neutral",
            ac: npc?.ac?.toString() ?? "10",
            hpMax: npc?.hpMax ?? 20,          //this would overwrite a real 0
            hpCurrent: npc?.hpMax ?? 20,
            iniBonus: npc?.iniBonus ?? 0
        }
    }

    generateParticipantDataMonster( encounterFrontmatterEntity: Readonly<EncounterParticipantYAML> )
    {
        // get relevant settings
        const rollHealthpoints = this.plugin.settings.rollHealthpoints;
        const beast = this.fixedData as MyBeast | null;

        let ac = "10";
        let hp = 10;
        let iniBonus = 0;

        if( beast )
        {
            ac = BeastUtils.getArmorClass( beast );
            hp = BeastUtils.getHP( beast, this.plugin.settings.rollHealthpoints ).value;
            iniBonus = BeastUtils.getIniBonus( beast );
            console.log( "iniBonus: " + iniBonus );
            console.log( "ac: " + ac );
            console.log( hp );
        }

        this.participantData =
        {
            name: beast?.name || "Unknown Monster",
            initiative: rollD20() + iniBonus,
            conditions: [],
            attitude: "hostile",
            ac: ac,
            hpMax: hp,          //this would overwrite a real 0
            hpCurrent: hp,
            iniBonus: iniBonus,
            showImage: true,
        }

        console.log( "generate monster " + this.participantData.name + ": ini=" + this.participantData.initiative + " ("+ iniBonus+")" )
    }

    public resetLiveValues()
    {
        const preservedName = this.participantData.name;    //want to keep the name
        const preservedShowImage = this.participantData.showImage;

        this.generateParticipantData( this.rawEntity );

        this.participantData.name = preservedName;
        this.participantData.showImage = preservedShowImage;
    }

    private openConditionsModal( onChanged: () => Promise<void> )
    {
        new ConditionsModal(
            this.plugin.app,
            `Set conditions for ${this.participantData.name}`,
            CONDITIONS,
            this.participantData.conditions,
            async ( conditions: string[] ) =>
            {
                this.participantData.conditions = conditions;
                await onChanged();
            }
        ).open();
    }

    private openEditModal(type: "damage" | "heal" | "initiative" | "name", onChanged: () => Promise<void>)
    {
        let title: string;
        let label: string;
        let defaultValue = 0;

        switch( type )
        {
            case "damage":
                if( (this.participantData.hpCurrent === undefined || this.participantData.hpMax === undefined) ) return;
                title = `💥 Damage for ${this.participantData.name}`;
                label = "Damage:";
                break;
            case "heal":
                if( (this.participantData.hpCurrent === undefined || this.participantData.hpMax === undefined) ) return;
                title =  `✨ Healing for ${this.participantData.name}`;
                label = "Healing:";
                break;
            case "initiative":
                title =  `Set initiative for ${this.participantData.name}`;
                label = "Initiative:";
                defaultValue = this.participantData.initiative ?? 0;
                break;
            case "name":
                title = `Change Name:`;
                label = "Name:";
                break;
        }

        //1. text input
        if( type === "name" )
        {
            new TextInputModal( this.plugin.app, title, label, async (value: string) =>
                {
                    if( value.trim().length> 0 )
                    {
                        this.participantData.name =value.trim();
                        await onChanged();
                    }
                }, this.participantData.name ).open();
            return;
        }

        //2. numeric input
        new NumInputModal( this.plugin.app, title, label, async (amount: number) =>
            {
                // 1. Mathematische Berechnung durchführen
                switch( type )
                {
                    case "damage":
                        this.participantData.hpCurrent = Math.max(0, (this.participantData.hpCurrent ?? 0) - amount);
                        break;
                    case "heal":
                        this.participantData.hpCurrent = Math.min(this.participantData.hpMax ?? 10, (this.participantData.hpCurrent ?? 0) + amount);
                        break;
                    case "initiative":
                        this.participantData.initiative = amount;
                        break;
                }
                await onChanged();
            },
            defaultValue
        ).open();
    }

    public fillStatblockData( forceUpdate: boolean = false ): void
    {
        const isMonster = this.kind === "monster";
        const fixedData: any = this.fixedData;

         if (this.renderStatblock && !forceUpdate) return;

    }


    getHPObject()
    {
        const current = this.participantData?.hpCurrent ?? 0;
        const max = this.participantData?.hpMax ?? 0;
        const pct = max > 0 ? (current / max) * 100 : 0;

        return {
            hpCurrent: current,
            hpCurrentValid: this.participantData?.hpCurrent !== undefined,
            hpMax: max,
            hpMaxValid: this.participantData?.hpMax !== undefined,
            percentage: Math.max(0, Math.min(100, pct)),
            percentageValid:  max > 0
        }
    }

    renderRow( root: HTMLElement, isActive: boolean, onChanged: () => Promise<void> )
    {
        const row = root.createEl("tr", { cls: "tools-for-5e-encounter-row " + this.kind + " " + this.participantData.attitude + (isActive ? " is-active" : "")});

        //1. icon
        const iconCell  = row.createEl( "td", { cls: "col-icon"} );
        setIcon( iconCell, this.icon );

        //2. ini
        const iniText = this.participantData.initiative !== null ? String(this.participantData.initiative) : "—";
        const iniCell = row.createEl( "td", {cls: "col-ini" });
        iniCell.createEl( "div", {text: iniText} );
        const btnWrapper = iniCell.createDiv({ cls: "row-action-buttons" });
        const iniBtn = btnWrapper.createEl("button", { cls: "clickable-icon tools-for-5e-row-btn btn-damage",  title: "Add damage" });
        setIcon(iniBtn, "edit");
        iniBtn.addEventListener("click", () => this.openEditModal( "initiative", onChanged ));



        //3. name
        const nameCell = row.createEl("td", { cls: "col-name" });
        nameCell.createEl("div", { text: this.participantData.name });

        const nameBtnWrapper = nameCell.createDiv({ cls: "row-action-buttons" });
        const nameEditBtn = nameBtnWrapper.createEl("button", { cls: "clickable-icon tools-for-5e-row-btn", title: "Rename" });
        setIcon(nameEditBtn, "pencil");
        nameEditBtn.addEventListener("click", () => this.openEditModal( "name", onChanged ));
        //4. actions

        const actionsCell = row.createEl( "td", { cls: "col-actions" });
        if( this.kind === "monster" || this.kind === "npc" )
        {
            const btnWrapper = actionsCell.createDiv({ cls: "row-action-buttons" });
            const dmgBtn = btnWrapper.createEl("button", { cls: "clickable-icon tools-for-5e-row-btn btn-damage",  title: "Add damage" });
            setIcon(dmgBtn, "swords");
            dmgBtn.addEventListener("click", () => this.openEditModal( "damage", onChanged ));

            const healBtn = btnWrapper.createEl("button", { cls: "clickable-icon tools-for-5e-row-btn btn-damage",  title: "Add healing" });
            setIcon(healBtn, "sparkles");
            healBtn.addEventListener("click", () => this.openEditModal( "heal", onChanged ));
        }
        else
        {
            actionsCell.createEl("span", { cls: "actions-empty", text: "" });
        }





        //5. HP
        const hpCell = row.createEl("td", { cls: "col-hp" });
        const hp = this.getHPObject();

        let hpString: string = "";
        if( hp.hpCurrentValid )
        {
            hpString = String( hp.hpCurrent );

            if( hp.hpCurrent === 0 )
                row.addClass("is-defeated");
        }

        if( hp.hpMaxValid )
        {
            hpString += ` (${hp.hpMax})`
        }

        if( hp.percentageValid)
        {
            hpCell.style.setProperty("--hp-percent", `${ hp.percentage}%`);
            if( hp.percentage <= 50 )
                hpCell.addClass("is-bloodied");
        }

        hpCell.createEl("span", { cls: "hp-display-text", text: hpString });

        // 6. show
        const showCell = row.createEl("td", { cls: "col-show" });
        if( this.kind === "monster" )
        {
            const showImageToggle = showCell.createEl("input", {
                type: "checkbox",
                cls: "tools-for-5e-row-checkbox",
                attr: { title: "Show image in player display" }
            }) as HTMLInputElement;
            showImageToggle.checked = this.participantData.showImage ?? true;
            showImageToggle.addEventListener("change", async () =>
            {
                this.participantData.showImage = showImageToggle.checked;
                await onChanged();
            });
        }

        //7. status
        const statusCell = row.createEl("td", { cls: "col-status" });
        if( (this.participantData.conditions?.length ?? 0) > 0 )
        {
            const conditionsWrapper = statusCell.createEl( "div", { cls: "conditions-list"} );
            for( const condition of this.participantData.conditions )
            {
                conditionsWrapper.createEl( "span", { cls: "conditions-badge", text: condition } );
            }
        }
        const statusButtonWrapper = statusCell.createEl( "div", {cls: "row-action-buttons"});
        const statusEditButton = statusButtonWrapper.createEl( "button", {cls: "clickable-icon tools-for-5e-row-btn", title: "Set conditions" } );
        setIcon( statusEditButton, "sparkle" );
        statusEditButton.addEventListener("click", () => this.openConditionsModal( onChanged ) );
    }

    renderDetail( root: HTMLElement )
    {
        //console.log( this.fixedData );

        root.empty();

        if( this.kind === "monster" )
        {
            if( !this.fixedData )
            {
                 root.createEl("p", { text: "Failed loading stat block." });
                 return;
            }

            const hp = this.getHPObject();

            //console.log( hp );
            BeastUtils.createStatBlock( root, (this.fixedData as MyBeast), this.plugin,
                {   hp: String( hp.hpCurrentValid ? hp.hpCurrent : "?" ),
                    name: this.participantData.name,
                    conditions: "",
                    ...(this.participantData.ac !== undefined && { ac: this.participantData.ac }) } );

        }
        else
        {
            const statblock = root.createEl( "div", { cls: "tools-for-5e-statblock-container" });
            const header = statblock.createEl( "div", { cls: "tools-for-5e-statblock-header" });
            const headerLeft = header.createEl( "div",  { cls: "tools-for-5e-statblock-header-left" });

            const level = (this.fixedData as any)?.level ?? "?";
            const className = (this.fixedData as any)?.["class"] || "class unknown";
            const race = (this.fixedData as any)?.race || "";
            const temp = `Level ${level} ${className}, ${race}`;

            headerLeft.createEl( "div", { cls: "title", text: `${this.participantData.name}` } );
            headerLeft.createEl( "hr", { attr: { style: "border-color: #9c2b1b; margin: 5px 0;" } });
            headerLeft.createEl( "div", { cls: "subtitle", text: `${temp}` });

            const acWrapper = header.createEl("div", { cls: "stat-badge-stacked ac-badge" });
            const acIconContainer  = acWrapper.createEl("div", { cls: "stat-icon-stacked" });
            const acValueBox = acWrapper.createEl("div", { cls: "stat-value-overlay", text: String( (this.fixedData as any)?.ac ?? "") });
            setIcon( acIconContainer, "shield" );

            const hp = this.getHPObject();
            const hpWrapper = header.createEl("div", { cls: "stat-badge-stacked hp-badge" });
            const hpIconContainer  = hpWrapper.createEl("div", { cls: "stat-icon-stacked" });
            const hpValueBox = hpWrapper.createEl("div", { cls: "stat-value-overlay", text: String( hp.hpCurrentValid ? hp.hpCurrent : "?" ) });
            setIcon( hpIconContainer, "heart" );



            this.createProperty( headerLeft, "AC: " , (this.fixedData as any)?.ac );
            this.createProperty( headerLeft, "Ini Bonus: " , (this.fixedData as any)?.iniBonus );

            //also add the rest of the file?

        }
    }

    createProperty( container: HTMLElement, title: string, content: string )
    {
        let propertyDiv = container.createEl( "div", { cls: "" } );
        propertyDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-emph", text: `${title}`})
        propertyDiv.createEl( "span", {cls: "tools-for-5e-statblock-smalltext-red", text: `${content}` })
    }

}

// main encounter view - responsible for loading the encounter!
export class MyEncounterView extends ItemView
{
    //global encounter data
    private encounter_file: TFile | null = null;    //encounter file, important for saving!
    private encounter_name: string;
    private encounter_round: number;
    private encounter_pos: number;

    //live participant array:
    liveParticipants: EncounterParticipant[] = [];

    constructor( leaf: WorkspaceLeaf, public plugin: ToolsFor5e )
    {
       super(leaf);
       //this.encounter_name = "test";
    }


    getViewType() { return ENCOUNTER_VIEW; }
    getDisplayText() { return this.encounter_name ?? "Encounter Tracker"; }
    getIcon() { return "swords"; }

    //this is called after the view is displayed ad put in focus    --> load data from file and everything else. references to players and npcs via file path and to monsters via source&name
    async loadEncounter( file: TFile )
    {
        //console.log( "I have access to " + this.plugin.myBestiary.getItemCount() + " monsters" );
        this.encounter_file = file;
        this.liveParticipants = [];
        this.encounter_name = this.encounter_file.basename;
        this.updateTabTitle();


        // 1. make sure later base data exist, if not create it. especially id is needed for saving changes to the correct entry.
        // EDIT FRONTMATTER DIRECTLY:
        await this.plugin.app.fileManager.processFrontMatter( this.encounter_file,
        ( fm ) =>
        {
            if( !fm || fm.type !== "encounter" || !fm.participants )
            {
                console.log("no encounter!")
                return;
            }
            this.encounter_name = fm?.name ?? file.basename;
            this.updateTabTitle();
            this.encounter_pos = fm?.current_pos ?? 0;
            this.encounter_round = fm?.current_round ?? 0;

            if (!fm.participants || !Array.isArray(fm.participants))
            {
                console.log("no participants!")
                return;
            }

            const fmParticipants = fm.participants as any[];
            fmParticipants.forEach(
            (p, i) =>
            {
                if( !p.id )
                {
                    p.id = "id_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
                }
                if( !p.name )
                {
                    p.name = "participant_" + i;
                }
                if( !p.kind )
                {
                    p.kind = "undefined";   //--> ignore?
                }
                if( !p.ref )
                {
                    p.ref = "undefined";
                }

                if (p.kind === 'character' || p.kind === 'npc')
                {
                    const file = this.plugin.app.vault.getAbstractFileByPath(p.ref);
                    if( !file )
                    {
                        console.warn( "file not found for " + p.ref );
                        return; // Springt im forEach zum nächsten Eintrag
                    }
                }

                console.log( "loadEncounter(): load participant: " + p.name );
                const newParticipant = new EncounterParticipant( p, this.plugin );   //<-- gets
                this.liveParticipants.push( newParticipant );
            });
        });

        await this.save();
        this.sortParticipantsByInitiative();
        this.render();
    }

    private updateTabTitle()
    {
        (this.leaf as any).updateHeader?.();

        // View-Header (oben mittig im View selbst) aktualisieren:
        const titleEl = this.containerEl.querySelector( ".view-header-title" );
        if( titleEl )
        {
            titleEl.textContent = this.getDisplayText();
        }
    }

    private sortParticipantsByInitiative(): void
    {
        this.liveParticipants.sort(
            (a, b) =>
            {
                const initA = a.participantData.initiative ?? -99;
                const initB = b.participantData.initiative ?? -99;

                if (initA !== initB)    //decreasing (highest ini @ top!)
                {
                    return initB - initA;
                }

                const bonusA = a.participantData.iniBonus ?? 0;
                const bonusB = b.participantData.iniBonus ?? 0;
                if (bonusA !== bonusB)  //decresing iniBonus
                {
                    return bonusB - bonusA;
                }

                //prefer characters
                if (a.kind === "character" && b.kind !== "character") return -1;
                if (b.kind === "character" && a.kind !== "character") return 1;

                return a.id.localeCompare( b.id );  //final deterministic fallback
            }
        );
    }

    async onOpen()
    {
        this.render();
    }

    async onClose()
    {
        //save stuff here!
        this.plugin.clearPlayerWindow( "black" );
        await this.save();
        this.liveParticipants = [];
    }

    private render()
    {
        const root = this.contentEl;
        root.empty();

        const container = root.createEl( "div", { cls: "tools-for-5e-encounter-container" } );

        const header = container.createEl("div", { cls: "tools-for-5e-encounter-header" } );
        header.createEl( "span", { text: this.encounter_name, cls: "tools-for-5e-encounter-header-title"} )

        const controlsContainer = header.createDiv({ cls: "tools-for-5e-encounter-controls" });

        const prevBtn = controlsContainer.createEl("button", { cls: "clickable-icon tools-for-5e-control-btn" });
        setIcon(prevBtn, "arrow-left" );
        prevBtn.addEventListener( "click", () => this.previousTurn() );

        controlsContainer.createSpan({ text: `Runde ${this.encounter_round}`,  cls: "tools-for-5e-round-display" });

        const nextBtn = controlsContainer.createEl("button", { cls: "clickable-icon tools-for-5e-control-btn" });
        setIcon(nextBtn, "arrow-right" );
        nextBtn.addEventListener( "click", () => this.nextTurn() );

        const displayBtn = controlsContainer.createEl("button", { cls: "clickable-icon tools-for-5e-control-btn", title: "Display for player" });
        setIcon(displayBtn, "eye");
        displayBtn.addEventListener("click", async () =>
        {
            await this.plugin.openPlayerWindow();
            await this.showParticipantForPlayer( this.encounter_pos );
        });

        const reloadBtn = controlsContainer.createEl("button", { cls: "clickable-icon tools-for-5e-control-btn btn-reload", title: "Reload encounter" });
        setIcon(reloadBtn, "refresh-cw");
        reloadBtn.addEventListener("click", async () =>
        {
            if( this.encounter_file )
                await this.loadEncounter( this.encounter_file );
        });

        const resetBtn = controlsContainer.createEl("button", { cls: "clickable-icon tools-for-5e-control-btn btn-reset", text: "reset", title: "reset" });
        //setIcon( resetBtn, "refresh-cw" );
        resetBtn.addEventListener("click", () =>
        {
            this.resetEncounter();
        });


        //1. display encounter information: name, current round, maybe a note?
        if( this.liveParticipants.length === 0 )
        {
            container.createEl("div", { text: "no participants!" });
            return;
        }

        const mainLayout = container.createEl("div", { cls: "tools-for-5e-encounter-layout" });

        const listSection = mainLayout.createEl("div", { cls: "tools-for-5e-encounter-list-container" });

        //create table header:
        const table = listSection.createEl("table", { cls: "tools-for-5e-encounter-table" });
        const thead = table.createEl( "thead" );
        //1. ini
        //2. icon
        //3. name
        //4. actions
        //5. HP
        //6. show
        //7. status
        const headerRow = thead.createEl( "tr" );
        headerRow.createEl( "th", { text: "", cls: "col-icon" } );
        headerRow.createEl( "th", { text: "ini", cls: "col-ini" } );
        headerRow.createEl( "th", { text: "name", cls: "col-name" } );
        headerRow.createEl( "th", { text: "actions", cls: "col-actions" } );
        headerRow.createEl( "th", { text: "HP", cls: "col-hp" } );
        headerRow.createEl( "th", { text: "show", cls: "col-show" } );
        headerRow.createEl( "th", { text: "status", cls: "col-status" } );

        const tbody = table.createEl( "tbody" );

        //2. display this.participants in a list with the encounter_pos marked
        this.sortParticipantsByInitiative();
        for( const index in this.liveParticipants )
        {
            // [index]?. --> checkt vorher ob index existiert
            this.liveParticipants[index]?.renderRow( tbody, Number( index ) === this.encounter_pos, async () => { await this.save(); this.render() } ); //add what is called after
        }

        const detailSection = mainLayout.createEl("div", { cls: "tools-for-5e-encounter-detail-container" });
        const activeParticipant = this.liveParticipants[ this.encounter_pos ];
        if( activeParticipant )
        {
            activeParticipant.renderDetail( detailSection );
            //this.showParticipantForPlayer( this.encounter_pos );     //update that only when button is pressed
        }
        else
        {
            detailSection.createEl("div", { cls: "no-active-combatant", text: "No participant" });
        }
    }

    private async nextTurn()
    {
        this.encounter_pos++;
        if( this.encounter_pos >= this.liveParticipants.length )
        {
            this.encounter_pos = 0;
            this.encounter_round++;
        }

        await this.save();
        this.render();

        this.showParticipantForPlayer( this.encounter_pos );
    }

    private async previousTurn()
    {
        this.encounter_pos--;
        if( this.encounter_pos < 0 )
        {
            if( this.encounter_round >= 1 )
            {
                this.encounter_round--;
                this.encounter_pos = this.liveParticipants.length - 1;
            }
            else
            {
                this.encounter_pos = 0;
                new Notice( "The encounter just started - cannot go back!" );
                return;
            }
        }
        if( this.encounter_round < 0 )
            this.encounter_round = 0;
        if( this.encounter_pos < 0 )
            this.encounter_pos = 0;

        await this.save();
        this.render();

        this.showParticipantForPlayer( this.encounter_pos );
    }

    private async showParticipantForPlayer( index: number )
    {
        console.log( index );
        const activeParticipant = this.liveParticipants[ index ];
            console.log( activeParticipant );
        if( activeParticipant )
        {
           await this.showParticipantImage( activeParticipant );
        }
    }

    private async resetEncounter()
    {
        const title = "Reset encounter";
        const message = "Would you really like to reset this encounter? All HP's will be reset to max and all conditions cleared.";

        new ConfirmModal( this.plugin.app, title, message, async () =>
        {
            //this will only be executed upon "OK"
            this.encounter_pos = 0;
            this.encounter_round = 0;

            this.liveParticipants.forEach( (participant) =>
            {
                participant.resetLiveValues();
            });

            this.sortParticipantsByInitiative();

            if( !this.encounter_file )
            {
                console.warn( "no active encounter file");
                return;
            }

            await this.plugin.app.fileManager.processFrontMatter( this.encounter_file, (fm) =>
            {
                if( !fm || fm.type !== "encounter" )
                    return;

                fm.current_round = 0;
                fm.current_pos = 0;

                // resets variable data
                if( fm.participants && Array.isArray( fm.participants ) )
                {
                    fm.participants.forEach( (fmParticipant: any) =>
                    {
                        const liveParticipant = this.liveParticipants.find(p => p.id === fmParticipant.id);
                        if( liveParticipant )
                        {
                             fmParticipant.participantData = { ...liveParticipant.participantData };
                        }
                    });
                }
            });

            this.render();
        }).open();
    }

    private async showParticipantImage( participant: EncounterParticipant )
    {
        // not a monster
        if( participant.kind !== "monster" )
        {
            await this.plugin.showTextInPlayerWindow( participant.participantData.name );
            return;   // maybe show name?
        }

        // not shown at all
        if( participant.participantData.showImage === false )
        {
            await this.plugin.clearPlayerWindow();
            return;   // Flag deaktiviert -> nichts tun, Fenster bleibt wie es ist
        }


        const beast = participant.fixedData as MyBeast | null;
        const srcData = this.plugin.getBase64ImageAsSrcData( beast?.fluffImage ?? "" )

        if( !srcData )
        {
            await this.plugin.showTextInPlayerWindow( participant.participantData.name );
            return;
        }

        await this.plugin.showImageInPlayerWindowSrc( srcData, participant.participantData.name );
    }

    //saves back to frontmatter:
    // a) global encounter variables
    // b) liveParticipants.participantsData
    private async save()
    {
        if (!this.encounter_file)
        {
            console.log( "save(): file not found");
            return;
        }

        await this.app.fileManager.processFrontMatter( this.encounter_file, ( encounterFrontmatter ) =>
        {

            // only save if correct type
            if( encounterFrontmatter.type !== "encounter" )
            {
                console.error("No encounter file. Abort! Abort!");
                return;
            }

            //save current state of the encounter in this.file's frontmatter
            encounterFrontmatter.current_pos = this.encounter_pos;
            encounterFrontmatter.current_round = this.encounter_round;

            const fmParticipants = encounterFrontmatter.participants as any[];   //participants from frontmatter
            //loop through currently loaded participants
            this.liveParticipants.forEach( ( liveParticipant ) =>
            {
                // matching via id
                const existingFmEntry = fmParticipants.find( p => p.id === liveParticipant.id );    //this is a reference, so it can be used to save data

                if( existingFmEntry )
                {
                    // UPDATE: Parameter aktualisieren
                    existingFmEntry.participantData = {...liveParticipant.participantData};
                }
            });

            //encounterFrontmatter.participants = fmParticipants; //just in case somehow its not saved... or so...
        });
    }
}
