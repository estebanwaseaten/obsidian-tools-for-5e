import { MySpell } from "./spell";
import { Compendium } from './compendium';

import { pathExists, verify5eToolsPath, joinPath, listDirectoryPaths, readJSONFile, filterPathsRemove, filterPathsInclude } from "./utils/fileUtils";

interface SpellaryFile {
    spell?: SpellRaw[];
    spellFluff?: SpellFluffRaw[];

}

interface SourcesFile {
    [bookSource: string]: {
        // Das Innere: Zauber-Name (z.B. "Air Bubble")
        [spellName: string]: {
            class?: Array<{ name: string; source: string }>;
            classVariant?: Array<{ name: string; source: string; definedInSource: string }>;
        }
    }
}

interface SpellRaw {
    name: string;
    source: string;
    // only the fields you actually need
}

interface SpellFluffRaw {
    name: string;
    source: string;
    images?: { type?: string; href: {type: string; path: string; }; }[];
}


export class SpellCompendium extends Compendium<SpellRaw, MySpell>
{
    async build( absDataPath: string, absImgPath: string  )
    {
        this.data = new Map();

        if( absImgPath )
        {
            this._hasImages = true;
        }

        const spellsPath = joinPath( absDataPath, "spells" );

        try
        {
            const exists = await pathExists( spellsPath );
            if( !exists )
            {
                console.error( "Spells Directory not found: " + spellsPath );
                return;
            }

            const files = await listDirectoryPaths( spellsPath, ".json" );
            const filesNoIndex = await filterPathsRemove( files, "", "index.json" );    // remove index
            const statFiles = await filterPathsRemove( filesNoIndex, "fluff-" );        // remove fluff
            const fluffFiles = await filterPathsInclude(filesNoIndex, "fluff-" );       // only fluff
            const sourcesFilePath = await filterPathsInclude(filesNoIndex, "sources.json" );

            console.log( "building Spellary - stat files found: " + statFiles.length );
            console.log( "building Spellary - fluff files found: " + fluffFiles.length );
            console.log( "building Spellary - sources file: " + sourcesFilePath );

            //iterate over stat files FIRST!:
            for( const filePath of statFiles )
            {
                const spellFile = await readJSONFile<SpellaryFile>( filePath );

                if( spellFile.spell && Array.isArray( spellFile.spell ) )
                {
                    for( const spellSrc of spellFile.spell )
                    {
                        const spell = this.mapFromRaw( spellSrc );
                        if( !this.data.has( spell.source ) )                 //source does not exist yet
                        {
                            this.data.set( spell.source, new Map() );        //add new source map
                        }
                        this.data.get( spell.source )!.set( spell.name, spell ); //add the monster to the source
                    }
                }
            }

            //also extract info from sources file:
            const sourcesFile = await readJSONFile<SourcesFile>( sourcesFilePath[0] );
            for( const [source, spells] of Object.entries(sourcesFile) )
            {
                // source ist jetzt z.B. "AAG"
                // spells ist das Objekt mit allen Zaubern darin

                for (const [spellName, data] of Object.entries( spells ) )
                {
                    // spellName ist z.B. "Air Bubble"
                    // data.class ist dein Array mit den Klassen

                    // Jetzt suchst du in deiner vorhandenen Map:
                    const existing = this.data.get( source )?.get( spellName );
                    if( !existing )
                        continue;

                    if( data.class )    // spell existiert und
                    {
                        existing.classNames = new Set( data.class.map(c => c.name) );
                    }
                    if( data.classVariant )    // spell existiert und
                    {
                        existing.classVariantNames = new Set( data.classVariant.map(c => c.name) );
                    }
                }
            }

            //iterate over fluff files SECOND!:
            for( const filePath of fluffFiles )
            {
                const spellFile = await readJSONFile<SpellaryFile>( filePath );   //already returns as parsed json file

                if( spellFile.spellFluff && Array.isArray( spellFile.spellFluff ) )
                {
                    for( const spellFluff of spellFile.spellFluff )
                    {
                        //console.log( "adding fluff to: " + monsterFluff.source + ": " + monsterFluff.name );
                        const existing = this.data.get( spellFluff.source )?.get( spellFluff.name ); //does beast exist in our list?
                        if( existing )
                        {
                            existing.fluffImage = spellFluff.images?.[0]?.href?.path ?? "";
                        }
                    }
                }
            }
        }
        catch( e )
        {
            console.error("Error reading Spellary:", e);
        }

        /*for( const spell of this.getSpells() )
        {
            console.log( spell.name + ": " + Array.from(spell.classNames || []) + Array.from(spell.classVariantNames || []) );
        }*/

        this._isReady = true;
        this.trigger( "changed" ); //notifies all listeners
    }

    private mapFromRaw( raw: SpellRaw ): MySpell
    {
        const  spell: MySpell = {
            ...raw,

           // cr: m.cr,
           // map other fields you need
       };

       return spell;
    }

    getClasses(): string[]
    {
        //return this.#classes;
    }
}
