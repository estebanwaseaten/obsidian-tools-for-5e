import { Compendium } from './compendium';
import { MyBeast, MyBeastFluff } from "./beast";

import { pathExists, verify5eToolsPath, joinPath, listDirectoryPaths, readJSONFile, filterPathsRemove, filterPathsInclude } from "./utils/fileUtils";




// json import data structure
interface BestiaryFile {
    monster?: MonsterRaw[];
    monsterFluff?: MonsterFluffRaw[];
}

interface MonsterRaw {
    name: string;
    source: string;
    page?: string;
    size?: string;
    type?: string;
    ac?: { special: string; }[] | string[];  //can be an array
    hp?: {
        special?: string;
        average?: string;
        formula?: string; };
    speed?: {
        walk?: string;
        swim?: string;
        canHover?: boolean;
        fly?: { number?: string; condition?: string } | string;
    };

    str?: string;
    dex?: string;
    con?: string;
    int?: string;
    wis?: string;
    cha?: string;

    //skill
    //senses
    passive?: string;

    immune?: string[];
    conditionImmune?: string[];
    languages?: string[];

    cr?: {cr: string; xpLair: string; } | string;

    trait?: {name: string; entries: string[]; }[];
    action?: {name: string; entries: string[]; }[];

    hasToken?: boolean;
    hasFluff?: boolean;
    hasFluffImages?: boolean;

    // only the fields you actually need
}

//additional info is stored in the monster fluff:
interface MonsterFluffRaw {
    name: string;
    source: string;
    images: { type: string; href: { type: string; path: string; }; } [];
    entries: { type: string; entries: string[]; }[];
    // only the fields you actually need
}

export class BeastCompendium extends Compendium<MonsterRaw, MyBeast>
{
    async build( absDataPath: string, absImgPath: string )       //rebuild when loaded
    {
        this.data = new Map(); // Reset

        if( absImgPath )
        {
            this._hasImages = true;
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
                        const beast = this.mapFromRaw( monster );
                        if( !this.data.has( beast.source ) )                 //source does not exist yet
                        {
                            this.data.set( beast.source, new Map() );        //add new source map
                        }
                        this.data.get(beast.source)!.set( beast.name, beast ); //add the monster to the source
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
                        const existing = this.data.get( monsterFluff.source )?.get( monsterFluff.name ); //does beast exist in our list?
                        if( existing )
                        {
                            existing.fluffImage = monsterFluff.images?.[0]?.href?.path ?? "";
                            existing.fluffText = this.extractFluffText( monsterFluff.entries );
                        }
                    }
                }
            }
        }
        catch (e)
        {
            console.error("Error reading Bestiary:", e);
        }

        this._isReady = true;
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
    private mapFromRaw( m: MonsterRaw ): MyBeast
    {
        //console.log("Mapping Monster:", m.name);
        const  beast: MyBeast = {
            ...m,   //copies identical names
           ac: Array.isArray(m.ac) ? m.ac.map( a => typeof a === 'object' ? a.special :  a ).join( "/") : (m.ac || ""),
           hp: m.hp?.special ? m.hp.special : (m.hp?.average || "") + (m.hp?.formula ? ` (${m.hp.formula})` : ""),
           cr: typeof m.cr === 'object' ? m.cr.cr : (m.cr || "" ),
       };

       return beast;
    }
}
