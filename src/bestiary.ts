import { Events, parseLinktext } from 'obsidian';
import type { FrontMatterCache, TFile, App } from 'obsidian';

import { pathExists, verify5eToolsPath, joinPath, listDirectoryPaths, readJSONFile, filterPathsRemove, filterPathsInclude } from "./utils/fileUtils";

import { MyBeast, MyBeastFluff } from "./beast";

// json import data structure
interface BestiaryFile {
    monster?: MonsterRaw[];
    monsterFluff?: MonsterFluffRaw[];
}

interface MonsterRaw {
    name: string;
    source: string;
    cr: string;
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

interface FluffEntry
{
    type: string;
    entries: string[];
}

interface MonsterFluffRaw {
    name: string;
    source: string;
    images: FluffImage[];
    entries: FluffEntry[];
    // only the fields you actually need
}

export class Bestiary extends Events
{
    #plugin: ToolsFor5e;

    #beasts: Map<string, Map<string, MyBeast>> = new Map(); // source -> name -> beast

    isReady: boolean = false;
    hasImages: boolean = false;             //absImgPath + relative path gives image

    constructor( app: App, plugin: ToolsFor5e )
    {
        super(app, plugin);
        this.#plugin = plugin;
    }

    async build( absDataPath: string, absImgPath: string )       //rebuild when loaded
    {
        this.#beasts = new Map(); // Reset

        if( absImgPath )
        {
            this.hasImages = true;
        }

        const bestiaryPath = joinPath( absDataPath, "bestiary" );   //path to folder

        try
        {
            const exists = await pathExists( bestiaryPath );
            if( !exists )
            {
                console.error( "Beastiary Directory not found: " + bestiaryPath );
                return;
            }

            const files = await listDirectoryPaths( bestiaryPath, ".json" );             //file listing
            const filesNoIndex = await filterPathsRemove( files, "", "index.json" );    // remove index
            const statFiles = await filterPathsRemove( filesNoIndex, "fluff-" );        // remove fluff
            const fluffFiles = await filterPathsInclude(filesNoIndex, "fluff-" );       // only fluff

            console.log( "building Bestiary - stat files found: " + statFiles.length);
            console.log( "building Bestiary - fluff files found: " + fluffFiles.length);

            //iterate over stat files FIRST!:
            for( const filePath of statFiles )
            {
                //console.log( fileName );
                const beastFile = await readJSONFile<BestiaryFile>( filePath );   //already returns as parsed json file

                if( beastFile.monster && Array.isArray( beastFile.monster ) )
                {
                    for( const monster of beastFile.monster )
                    {
                        //console.log( "adding: " + monster.source + ": " + monster.name );
                        const beast = this.mapToBeast( monster );
                        if( !this.#beasts.has( beast.source ) )                 //source does not exist yet
                        {
                            this.#beasts.set( beast.source, new Map() );        //add new source map
                        }
                        this.#beasts.get(beast.source)!.set( beast.name, beast ); //add the monster to the source
                    }
                }
            }

            //iterate over fluff files SECOND!:
            for( const filePath of fluffFiles )
            {
                const beastFile = await readJSONFile<BestiaryFile>( filePath );   //already returns as parsed json file

                if( beastFile.monsterFluff && Array.isArray( beastFile.monsterFluff ) )
                {
                    for( const monsterFluff of beastFile.monsterFluff )
                    {
                        //console.log( "adding fluff to: " + monsterFluff.source + ": " + monsterFluff.name );
                        const existing = this.#beasts.get( monsterFluff.source )?.get( monsterFluff.name ); //does beast exist in our list?
                        if( existing )
                        {
                            existing.fluffImage = monsterFluff.images?.[0]?.href?.path ?? "";
                            existing.fluffText = this.extractFluffText( monsterFluff.entries );
                        }
                    }
                }
            }

            //for testing print all that:
            //const temp = this.getBeasts();
            //for( const beast of temp )
            //{
            //    console.log( beast.source + ": " + beast.name + " img: " + beast.fluffImage + " text: " + beast.fluffText );
            //}

        }
        catch (e)
        {
            console.error("Error reading Bestiary:", e);
        }

        this.isReady = true;
        this.trigger( "changed" ); //notifies all listeners
    }

    private extractFluffText( entries: any[] ): string
    {
        if( !entries || !Array.isArray(entries) ) return '';

        return entries.map(entry =>
        {
            if( typeof entry === 'string' ) return entry;
            if( entry.entries ) return this.extractFluffText( entry.entries );
            if( entry.items ) return this.extractFluffText( entry.items );
            return '';
        })
        .filter(Boolean)
        .join('\n\n');
    }

    //convert json data to internal MyBeast  format
    private mapToBeast( m: MonsterRaw ): MyBeast
    {
        return {
           name: m.name,
           source: m.source,
           // cr: m.cr,
           // map other fields you need
       };
    }


    getBeasts(): MyBeast[]
    {
        return Array.from( this.#beasts.entries() )
             .filter( ([source]) => this.#plugin.settings.enabledSources[source] ?? true )
             .flatMap( ([, beasts]) => Array.from(beasts.values() ) );
    }

    getBeastsBySource( source: string ): MyBeast[]
    {
        return Array.from( this.#beasts.get(source)?.values() ?? [] );
    }

    getSources(): string[]
    {
        return Array.from( this.#beasts.keys() ).sort();
    }


}
