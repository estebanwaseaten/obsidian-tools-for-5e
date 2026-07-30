import { Notice, TFile } from "obsidian";

export async function addItemToEncounter( plugin: ToolsFor5e, data: { ref: string, kind: string, name?: string } )
{
    const activeFile = plugin.app.workspace.getActiveFile();
    if( !(activeFile instanceof TFile) )
    {
        new Notice("No active file found.");
        return;
    }

    await plugin.app.fileManager.processFrontMatter( activeFile, ( frontmatter ) =>
    {
        const currentType = frontmatter[ 'type' ];

        if (currentType && currentType !== 'encounter')
        {
            new Notice(`Error: This file is "${currentType}", not encounter!`);
            return;
        }

        // initialise encounter if this is a file without other type. (--> does not overwrite characters)
        if( !currentType )
        {
            frontmatter['type'] = 'encounter';
            frontmatter['name'] = activeFile.basename;
            frontmatter['current_round'] = 0;
            frontmatter['current_pos'] = 0;
            frontmatter['participants'] = [];
        }

        const participants = frontmatter['participants'] || [];

        const alreadyExists = participants.some( (p: any) => p && p.ref === data.ref && p.kind === data.kind );
        if( alreadyExists )
          {
              new Notice(`${data.name || "Entity"} is already in this encounter.`);
              return;
          }

        // Erstelle den Eintrag basierend auf dem Typ
        const newEntry: any =
        {
            ref: data.ref,
            kind: data.kind,
            name: data.name,
        };

        participants.push( newEntry );
        frontmatter['participants'] = participants;

        new Notice(`${data.name || "Entity"} added to encounter.`);
    });
}
