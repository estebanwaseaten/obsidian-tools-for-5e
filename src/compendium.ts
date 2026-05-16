import type { App } from 'obsidian';
import { Events } from 'obsidian';
import type ToolsFor5e from './main';

export class Compendium<DataRaw, DataInternal> extends Events
{
    protected plugin: ToolsFor5e;
    protected data: Map<string, Map<string, DataInternal>> = new Map();
    protected _isReady: boolean = false;
    protected _hasImages: boolean = false;

    constructor( plugin: ToolsFor5e )
    {
        super();
        this.plugin = plugin;
    }

    abstract build( absDataPath: string, absImgPath: string ): Promise<void>;
    abstract mapFromRaw( raw: DataRaw ): DataInternal;

    getData(): DataInternal[]
    {
        return Array.from( this.data.entries() )
             .filter( ([source]) => this.plugin.settings.enabledSources[source] ?? true )
             .flatMap( ([, items]) => Array.from( items.values() ) );
    }

    getDataBySource( source: string ): DataInternal[]
    {
        return Array.from( this.data.get( source )?.values() ?? [] );
    }

    getDataItem( name: string, source?: string ): DataInternal | undefined
    {
        if( source )
        {
            return this.data.get(source)?.get(name);
        }
        // Falls keine Source bekannt ist, alle durchsuchen:
        for (const sourceMap of this.data.values() )
        {
            const item = sourceMap.get(name);
            if (item) return item;
        }
        return undefined;
    }

    getItemCount(): number
    {
        let count = 0;

        for( const [source, items] of this.data.entries() )
        {
            // Prüfen, ob die Quelle in den Settings aktiviert ist
            if (this.plugin.settings.enabledSources[source] ?? true)
            {
                count += items.size;
            }
        }
        return count;
    }

    getSources(): string[]
    {
        return Array.from( this.data.keys() )
            .filter( source => this.plugin.settings.enabledSources[source] ?? true )
            .sort();
    }

    get isReady(): boolean
    {
        return this._isReady;
    }

    get hasImages(): boolean
    {
        return this._hasImages;
    }

}
