import { setIcon, getIcon } from "obsidian";

export function getIconSVG( iconName: string): string
{
    let spellSVGelement = getIcon( iconName );

    if( !spellSVGelement )
    {
        const tmp = document.createElement("div");
        setIcon(tmp, iconName );
        spellSVGelement = tmp.querySelector("svg");
    }

    let svgString: string = 'x';
    if( spellSVGelement )
    {
        svgString = spellSVGelement.outerHTML;
    }
    return svgString;
}
