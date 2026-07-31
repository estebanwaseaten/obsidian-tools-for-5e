import { Compendium } from './compendium';
import { MyVariant, MyItem } from "./item";
import { pathExists, verify5eToolsPath, joinPath, listDirectoryPaths, readJSONFile } from "./utils/fileUtils";

// json import data structure
// json import data structure
interface ItemaryFile {
    item?: ItemRaw[];
    baseitem?: ItemRaw[];
    itemGroup?: ItemGroupRaw[];
}

interface ItemRaw {
    name: string;
    source: string;

    rarity?: string;
    page?: string;

    baseItem?: string;
    type?: string;
    dmg1?: string;
    dmgType?: string;
}

interface BaseItemRaw {
    name: string;
    source: string;

    rarity: string;
    page: string;

    weight?: string;
    value?: string;
    dmg1?: string;
    dmgType?: string;
    sword?: boolean;
    weapon?: boolean;
}
interface ItemGroupRaw {
    name: string;
    source: string;
    // only the fields you actually need
}

interface FluffHREF
{
    type: string;
    path: string;
}

interface FluffImage
{
    type: string;
    href: FluffHREF;
    credit?: string;
}

interface ItemFluffRaw {
    name: string;
    source: string;
    images?: FluffImage[];
}

export class ItemCompendium extends Compendium<ItemRaw, MyItem>
{
    async build( absDataPath: string, absImgPath: string )
    {
        this.data = new Map();

        if( absImgPath )
        {
            this._hasImages = true;
        }

        const baseItemsPath = joinPath( absDataPath, "items-base.json" );
        const itemsPath = joinPath( absDataPath, "items.json" );
        const fluffPath = joinPath( absDataPath, "fluff-items.json" );

        console.log( "building Itemary - base items file: " + baseItemsPath );
        console.log( "building Itemary - items file: " + itemsPath );
        console.log( "building Itemary - fluff file: " + fluffPath );

        try
        {
            const existsBase = await pathExists( baseItemsPath );
            if( !existsBase )
            {
                console.error( "Base Items file not found: " + baseItemsPath );
                return;
            }
            const baseItemFile = await readJSONFile<ItemaryFile>( baseItemsPath );   //already returns as parsed json file

            for( const item of baseItemFile.baseitem ?? [] )
            {
                const newItem = this.mapFromRaw( item ); //translate from json structure to my own

                if( !this.data.has( newItem.source ) )                 //source does not exist yet
                {
                    this.data.set( newItem.source, new Map() );        //add new source map
                }
                this.data.get( newItem.source )!.set( newItem.name, newItem ); //add the monster to the source
            }


            const exists = await pathExists( itemsPath );
            if( !exists )
            {
                console.error( "Items file not found: " + itemsPath );
                return;
            }

            const itemFile = await readJSONFile<ItemaryFile>( itemsPath );   //already returns as parsed json file
            //console.log( itemFile );

            for( const item of itemFile.item ?? [])
            {
                //console.log( "adding: " + item.source + ": " + item.name );
                const newItem = this.mapFromRaw( item ); //translate from json structure to my own

                if( !this.data.has( newItem.source ) )                 //source does not exist yet
                {
                    this.data.set( newItem.source, new Map() );        //add new source map
                }
                this.data.get( newItem.source )!.set( newItem.name, newItem ); //add the monster to the source
            }
        }
        catch (e)
        {
            console.error("Error reading Bestiary:", e);
        }

        this._isReady = true;
        this.trigger( "changed" ); //notifies all listeners
    }

    //convert json data to internal MyBeast  format
    public mapFromRaw( raw: ItemRaw ): MyItem
    {
        //console.log(raw.name + ": " + raw.rarity );
        return {
            ...raw,

           // map other fields you need
       };
    }
}
