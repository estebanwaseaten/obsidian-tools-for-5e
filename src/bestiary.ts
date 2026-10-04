
import { Compendium } from './compendium';
import { MyBeast } from "./beast";

import { pathExists, verify5eToolsPath, joinPath, listDirectoryPaths, readJSONFile, filterPathsRemove, filterPathsInclude } from "./utils/fileUtils";

const CR_TO_XP: Record<string, number> = {
    "0": 10,
    "1/8": 25,
    "1/4": 50,
    "1/2": 100,
    "1": 200,
    "2": 450,
    "3": 700,
    "4": 1100,
    "5": 1800,
    "6": 2300,
    "7": 2900,
    "8": 3900,
    "9": 5000,
    "10": 5900,
    "11": 7200,
    "12": 8400,
    "13": 10000,
    "14": 11500,
    "15": 13000,
    "16": 15000,
    "17": 18000,
    "18": 20000,
    "19": 22000,
    "20": 25000,
    "21": 33000,
    "22": 41000,
    "23": 50000,
    "24": 62000,
    "25": 75000,
    "26": 90000,
    "27": 105000,
    "28": 120000,
    "29": 135000,
    "30": 155000
};


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
                const fluffCache = new Map<string, any>();  //for lookup of _copy

                if( beastFile.monsterFluff && Array.isArray( beastFile.monsterFluff ) )
                {
                    for( const monsterFluff of beastFile.monsterFluff )
                    {
                        fluffCache.set( monsterFluff.name, monsterFluff );    //cache current montser fluff

                        //console.log( "adding fluff to: " + monsterFluff.source + ": " + monsterFluff.name );
                        const existing = this.data.get( monsterFluff.source )?.get( monsterFluff.name ); //does beast exist in our list?
                        if( existing )
                        {
                            existing.fluffImage = monsterFluff.images?.[0]?.href?.path
                                ?? (monsterFluff as any)._copy?._mod?.images?.items?.[0]?.href?.path
                                ?? "";
                            existing.fluffText = this.extractFluffText( monsterFluff.entries );
                        }
                        else
                        {
                            //console.log("no match for fluff:", monsterFluff.source, monsterFluff.name);
                        }
                    }

                    //second run to resolve _copy for fluffs (image is saved with a main object "Bandits" for its children "Bandit", ... )
                    for( const monsterFluff of beastFile.monsterFluff )
                    {
                        const existing = this.data.get( monsterFluff.source )?.get( monsterFluff.name ); //does beast exist in our list?
                        if( existing )
                        {
                            //need to lookup:
                            if( existing.hasFluffImages && !existing.fluffImage )   //has no image yet, but should have
                            {
                                //console.log( "need to copy fluff: " + existing.name + existing + " copy:" + monsterFluff._copy.name)
                                const parentFluff = fluffCache.get( (monsterFluff as any)._copy.name );
                                existing.fluffImage =  parentFluff.images?.[0]?.href?.path ?? "";
                            }
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
    public mapFromRaw( m: MonsterRaw ): MyBeast
    {
        let resolvedCr = "";
        if (m.cr)
        {
            resolvedCr = typeof m.cr === 'object' ? m.cr.cr : m.cr;
        }
        const resolvedXp = CR_TO_XP[resolvedCr] ?? 0;
        //console.log("Mapping Monster:", m.name);
        const  beast: MyBeast = {
            ...m,   //copies identical names
           ac: Array.isArray(m.ac) ? m.ac.map( a => typeof a === 'object' ? a.special :  a ).join( "/") : (m.ac || ""),
           cr: resolvedCr,
           xp: resolvedXp
       };

       return beast;
    }
}
