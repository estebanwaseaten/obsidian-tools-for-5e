import { EventRef, setIcon, WorkspaceLeaf, Notice, Modal, TFile } from "obsidian";

import ToolsFor5e from "../main";

import { addItemToEncounter } from "../utils/encounterUtils";

import { ConfirmModal } from "../modals";
import { MyListView } from "./listview"
import { MyNPC } from "../character"

export const NPC_VIEW = "tools-for-5e-npc-pane";

export class MyNPCView extends MyListView<MyNPC>
{
    getDisplayText(): string { return "D&D NPCs"; }
    getIcon(): string { return "venetian-mask"; }
    getViewType(): string { return NPC_VIEW; }

    constructor( leaf: WorkspaceLeaf, plugin: ToolsFor5e )
    {
        // daten müssen hier erst noch geladen werden
        super(leaf, plugin, [] );
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
            if( frontmatter && ( frontmatter.type === "npc") )
            {
                //console.log( "found: " + frontmatter.name);
                this.allItems.push( {
                    name: frontmatter.name || file.basename,
                    class: frontmatter.class || "Commoner",
                    level: frontmatter.level || 1,
                    ac: frontmatter.ac || 10,
                    // filePath speichern, damit wir die Datei später öffnen können!
                    filePath: file.path
                } as any);
            }
        }
        this.onDataChanged();
    }

    protected setupUI(): void
    {
        this.addSearchBar( "Search npcs..." );
        // Vielleicht kein Sort-Element nötig, wenn die Liste klein ist?
    }

    protected renderRow(row: HTMLElement, char: MyNPC): void
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
        //row.createEl("td", { text: `👁️ ${char.passivePerception}` });




        // Spalte 5: Aktionen (z.B. Info-Button)


        const actionCell2 = row.createEl("td", {cls: "listview-action-cell"});

        const editButton = actionCell2.createDiv({
            cls: "clickable-icon",
            attr: { "data-action": "edit" }
        });
        setIcon(editButton, "pencil");

        const actionCell = row.createEl("td", {cls: "listview-action-cell"});

        const insertButton = actionCell.createDiv({
            cls: "clickable-icon",
            attr: { "data-action": "insert" }
        });
        setIcon(insertButton, "plus");

    }

    onItemSelected( item: MyNPC, action: string ): void
    {
        if( action === "default" )
        {

        }
        else if( action === "edit" )
        {
            const file = this.app.vault.getAbstractFileByPath(item.filePath);
            if (file instanceof TFile)
            {
                this.app.workspace.getLeaf().openFile(file);
            }
        }
        else if( action === "insert" )
        {
            addItemToEncounter(this.plugin,
                {
                    ref: item.filePath,
                    kind: "npc",
                    name: item.name
                });
        }
    }

    // Leere Implementierung, wenn nicht benötigt:
    rebuildCustomIndices() {}
    buildCustomFilters() {}
    applyCustomFilters(items: MyNPC[]) { return items; }


    // ... onItemSelected etc.
}
