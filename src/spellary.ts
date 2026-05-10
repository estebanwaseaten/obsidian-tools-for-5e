import { Events, parseLinktext } from 'obsidian';
import type { FrontMatterCache, TFile, App } from 'obsidian';
import { pathExists, verify5eToolsPath, joinPath, listDirectoryPaths, readJSONFile, filterPathsRemove, filterPathsInclude } from "./utils/fileUtils";

import { MySpell } from "./spell";

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

//additional info is stored in the monster fluff:
interface FluffHREF
{
    type: string;
    path: string;
}

interface FluffImage
{
    type: string;
    href: FluffHREF;
}

interface SpellFluffRaw {
    name: string;
    source: string;
    images: FluffImage[];
}


export class Spellary extends Events
{
    #plugin: ToolsFor5e;

    #spells: Map<string, Map<string, MyBeast>> = new Map();

    isReady: boolean = false;
    hasImages: boolean = false;

    constructor( app: App, plugin: ToolsFor5e )
    {
        super(app, plugin);
        this.#plugin = plugin;
    }

    async build( absDataPath: string, absImgPath: string  )
    {
        this.#spells = new Map();

        if( absImgPath )
        {
            this.hasImages = true;
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
                        const spell = this.mapToSpell( spellSrc );
                        if( !this.#spells.has( spell.source ) )                 //source does not exist yet
                        {
                            this.#spells.set( spell.source, new Map() );        //add new source map
                        }
                        this.#spells.get( spell.source )!.set( spell.name, spell ); //add the monster to the source
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
                    const existing = this.#spells.get( source )?.get( spellName );
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
                        const existing = this.#spells.get( spellFluff.source )?.get( spellFluff.name ); //does beast exist in our list?
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

        this.isReady = true;
        this.trigger( "changed" ); //notifies all listeners
    }

    private mapToSpell( m: SpellRaw ): MySpell
    {
        return {
           name: m.name,
           source: m.source,
           // cr: m.cr,
           // map other fields you need
       };
    }

    getSpells(): MySpell[]
    {
        return Array.from( this.#spells.entries() )
             .filter( ([source]) => this.#plugin.settings.enabledSources[source] ?? true )
             .flatMap( ([, spells]) => Array.from( spells.values() ) );
    }

    getSpellsBySource( source: string ): MySpell[]
    {
        return Array.from( this.#spells.get( source )?.values() ?? [] );
    }

    getSources(): string[]
    {
        return Array.from( this.#spells.keys() ).sort();
    }

    getClasses(): string[]
    {
        //return this.#classes;
    }
}
