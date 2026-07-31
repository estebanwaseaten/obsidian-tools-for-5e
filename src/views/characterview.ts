import { EventRef, setIcon, Notice, Modal, TFile, WorkspaceLeaf } from "obsidian";

import type ToolsFor5e from "../main";

import { addItemToEncounter } from "../utils/encounterUtils";

import { ConfirmModal } from "../modals";
import { MyListView } from "./listview"
import { MyCharacter } from "../character"
//import { MyEncounterParticipant } from "./encounterview"

export const CHARACTER_VIEW = "tools-for-5e-character-pane";


export class MyCharacterView extends MyListView<MyCharacter>
{
    getDisplayText(): string { return "D&D characters"; }
    getIcon(): string { return "users"; }
    getViewType(): string { return CHARACTER_VIEW; }

    constructor( leaf: WorkspaceLeaf, plugin: ToolsFor5e )
    {
        // daten müssen hier erst noch geladen werden
        super( leaf, plugin, [] );
        this.loadCharacters();

        this.registerEvent(
            this.app.metadataCache.on( "changed", (file) =>
            {
                this.loadCharacters();
            }));
    }

    private async loadCharacters()
    {
        const files = this.app.vault.getMarkdownFiles();
        this.allItems = [];
        //console.log( "loadCharacters()" + files);

        for( const file of files )
        {
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;
            //console.log( frontmatter );
            // Prüfen, ob es ein NPC/Charakter ist (z.B. über ein Tag)
            if( frontmatter && ( frontmatter.type === "character") )
            {
                //console.log( "found: " + frontmatter.name);
                this.allItems.push( {
                    name: frontmatter.name || file.basename,
                    class: frontmatter.class || "Commoner",
                    level: frontmatter.level || 1,
                    ac: frontmatter.ac || 10,
                    inibonus: frontmatter.inibonus,
                    hpMax: frontmatter.hpMax || "",
                    // filePath speichern, damit wir die Datei später öffnen können!
                    filePath: file.path
                } as any);
            }
        }
        this.onDataChanged();
    }

    protected setupUI(): void
    {
        this.addSearchBar( "Search characters..." );
        this.addHeaderButton( "list-plus", "Add all to encounter", () => this.addAllToEncounter() );
        // Vielleicht kein Sort-Element nötig, wenn die Liste klein ist?
    }

    private async addAllToEncounter()
    {
        if( this.allItems.length === 0 )
        {
            new Notice("No characters to add.");
            return;
        }

        for( const item of this.allItems )
        {
           await addItemToEncounter( this.plugin,
               {
                   ref: item.filePath,
                   kind: "character",
                   name: item.name
               });
        }
    }

    protected renderRow(row: HTMLElement, char: MyCharacter): void
    {
        // Spalte 1: Name & Spieler (fett)
        const nameCell = row.createEl("td");
        nameCell.createEl("b", { text: char.name });
        nameCell.createEl("div", {
            text: char.player,
            cls: "tools-for-5e-subtext" // Für kleineren Text im CSS
        });

        // Spalte 2: Klasse & Level
        const classCell = row.createEl("td");
        classCell.createEl("div", { text: `Lvl ${char.level}` });
        classCell.createEl("div", { text: `${char.class}` })

        // Spalte 3: Rüstungsklasse (AC)
        row.createEl("td", { text: `🛡️ ${char.ac}` });

        // Spalte 4: Passive Wahrnehmung
        row.createEl("td", { text: `👁️ ${char.passivePerception}` });



        // Spalte 5: Aktionen (z.B. Info-Button)
        const actionCell = row.createEl("td");

        const editButton = actionCell.createDiv({
            cls: "clickable-icon",
            attr: { "data-action": "edit" }
        });
        setIcon(editButton, "pencil");
    }

    onItemSelected( item: MyCharacter, action: string ): void
    {
        if( action === "default" )
        {
            addItemToEncounter(
                this.plugin,
                {
                    ref: item.filePath,
                    kind: "character",
                    name: item.name
                });
        }
        else if( action === "edit" )
        {
            const file = this.app.vault.getAbstractFileByPath( item.filePath );
            if( file instanceof TFile )
            {
                this.app.workspace.getLeaf().openFile( file );
            }
        }
    }



    // Leere Implementierung, wenn nicht benötigt:
    rebuildCustomIndices() {}
    buildCustomFilters() {}
    applyCustomFilters(items: MyCharacter[]) { return items; }

    // ... onItemSelected etc.
}
