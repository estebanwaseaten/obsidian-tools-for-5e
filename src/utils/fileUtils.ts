// utils/fileUtils.ts
import * as fs from "fs";
import * as path from "path";

export async function pathExists( p: string ): Promise<boolean>
{
    return fs.promises.access( p )
        .then(() => true)
        .catch(() => false);
}

export async function verify5eToolsPath( toolsPath: string ): Promise<boolean>
{
    const booksPath = path.join( toolsPath, "data/books.json" );
    console.log( "verify5eToolsPath: " + booksPath );
    return fs.promises.access( booksPath )
        .then(() => true)
        .catch(() => false);
}

export function joinPath( basePath: string, morePath: string ): string
{
    return path.join( basePath, morePath );
}

export async function listDirectoryPaths( dirPath: string, filterEnding?: string): Promise<string[]>
{
    const dirList = await fs.promises.readdir( dirPath );  //need await to apply filter later

    const filtered = filterEnding ? dirList.filter( f => f.endsWith( filterEnding ) ) : dirList;

    return filtered.map( f => path.join( dirPath, f ) );
}

export async function readJSONFile<T>( filePath: string ): Promise<T>   //T defines the return type
{
    const content = await fs.promises.readFile( filePath, "utf-8" );
    return JSON.parse( content ) as T;
}

export async function filterPathsRemove( filePaths: string[], starts?: string, ends?: string ): Promise<string[]>
{
    if( starts && ends )
    {
        return filePaths.filter( f => !path.basename(f).startsWith( starts ).endsWith( ends ) );
    }
    else if ( starts )
    {
        return filePaths.filter( f => !path.basename(f).startsWith( starts ) );
    }
    else if ( ends )
    {
        return filePaths.filter( f => !path.basename(f).endsWith( ends ) );
    }
    else
    {
        return filePaths;
    }
}

export async function filterPathsInclude( filePaths: string[], starts?: string, ends?: string ): Promise<string[]>
{
    if( starts && ends )
    {
        return filePaths.filter( f => path.basename(f).startsWith( starts ).endsWith( ends ) );
    }
    else if ( starts )
    {
        return filePaths.filter( f => path.basename(f).startsWith( starts ) );
    }
    else if ( ends )
    {
        return filePaths.filter( f => path.basename(f).endsWith( ends ) );
    }
    else
    {
        return filePaths;
    }
}
