import { Notice, TFile } from "obsidian";

export async function addItemToEncounter( data: { ref: string, name?: string, ini?: number, hpMax: number, source?: string; kind: string } )
{
    const activeFile = this.app.workspace.getActiveFile();

    if( !(activeFile instanceof TFile) )
    {
        new Notice("No active file found.");
        return;
    }

    await this.app.fileManager.processFrontMatter( activeFile, (fm) =>
    {
        const currentType = fm['type'];

        if (currentType && currentType !== 'encounter')
        {
            new Notice(`Error: This file is "${currentType}", not encounter!`);
            return;
        }

        // Initialisiere Encounter, falls neu
        if( !currentType )
        {
            fm['type'] = 'encounter';
            fm['name'] = activeFile.basename;
            fm['current_round'] = 0;
            fm['current_pos'] = 0;
            fm['participants'] = [];
        }

        const participants = fm['participants'] || [];



        // Erstelle den Eintrag basierend auf dem Typ
        const newEntry: any =
        {
            ref: data.ref,
            kind: data.kind,
            name: data.name,
            hp_max: data.hpMax,
            hp_current: data.hpMax,
            initiative: data.ini || 0,
        };

        participants.push( newEntry );
        fm['participants'] = participants;

        new Notice(`${data.name || "Entity"} added to encounter.`);
    });
}
