import { MarkdownPostProcessor, setIcon, TFile, Notice } from 'obsidian';
import ToolsFor5e from "./main";

import { SPELL_VIEW } from "./views/spellview";
import { BEAST_VIEW } from "./views/beastview";
import { ITEM_VIEW } from "./views/itemview";
import { NPC_VIEW } from "./views/npcview";
import { CHARACTER_VIEW } from "./views/characterview";


export function toolsPostProcessor( plugin: ToolsFor5e  ): MarkdownPostProcessor
{
    //const { app } = plugin; // access app, settings, etc.
    return (el, ctx) =>
    {
        el.querySelectorAll('a.internal-link').forEach( (a) =>
        {
            //make sure we only process once:
            if (!(a instanceof HTMLAnchorElement)) return;
            if (a.getAttribute('data-icon-decorated')) return;

            const href = a.getAttribute('data-href') || "";
            if( href.startsWith("5e:") )
            {
                const parts = href.split(":"); // ["5e", "beast", "Goblin"]
                if (parts.length >= 3)
                {
                    const kind = parts[1];
                    const entityName = parts[2] || "";    //or whatever is after |?

                    a.classList.add('tools-for-5e-db-link');

                    a.classList.remove('internal-link');
                    a.classList.remove('is-unresolved'); // Verhindert die standardmäßige rote Einfärbung
                    a.setAttribute("aria-label", `show info for ${entityName}`);


                    a.textContent = entityName || "";;
                    const iconSpan = a.createSpan({ cls: 'tools-for-5e-db-link-icon' });
                    if( kind === "spell" )
                    {
                        setIcon(iconSpan, "wand-2");
                    }
                    else if( kind === "item" )
                    {
                        setIcon(iconSpan, "sword");
                    }
                    else if( kind === "beast" )
                    {
                        setIcon(iconSpan, "skull");
                    }
                    else
                    {
                        setIcon(iconSpan, "skull");
                    }
                    a.prepend(iconSpan);

                    let anchorLeaf = plugin.app.workspace.getLeavesOfType(SPELL_VIEW)[0]
                    || plugin.app.workspace.getLeavesOfType(BEAST_VIEW)[0]
        			|| plugin.app.workspace.getLeavesOfType(ITEM_VIEW)[0]
        			|| plugin.app.workspace.getLeavesOfType(NPC_VIEW)[0]
        			|| plugin.app.workspace.getLeavesOfType(CHARACTER_VIEW)[0];
                    const finalLeaf = anchorLeaf || plugin.app.workspace.getRightLeaf(false);

                    a.addEventListener("click", (evt) =>
                    {
                        evt.preventDefault();
                        evt.stopPropagation();

                        if( kind === "spell" )
                        {
                            if (plugin.mySpellary )
                            {
                                const dataItem = plugin.mySpellary.getDataItem(entityName, "");
                                plugin.showDetail({ kind: "spell", data: dataItem as any}, finalLeaf! );
                                //console.log(dataItem);
                            }
                        }
                        else if( kind === "item" )
                        {
                            if (plugin.myItemary )
                            {
                                const dataItem = plugin.myItemary.getDataItem(entityName, "");
                                plugin.showDetail({ kind: "item", data: dataItem as any}, finalLeaf! );
                                //console.log(dataItem);
                            }
                        }
                        else if( kind === "beast" )
                        {
                            if (plugin.myBestiary )
                            {
                                const dataItem = plugin.myBestiary.getDataItem(entityName, "");
                                plugin.showDetail({ kind: "beast", data: dataItem as any}, finalLeaf! );
                                //console.log(dataItem);
                            }
                        }
                    });

                    // Als fertig dekoriert markieren, damit Obsidian den Link nicht mehr anfasst
                    a.setAttribute('data-icon-decorated', '1');
                    return;
                }
            }



            //this is old code we probably dont need anymore
            const iconFromTrailing = consumeTrailingIconMarker(a);
            if( !iconFromTrailing ) return;
            const iconName = mapIcon( iconFromTrailing ); // map key -> registered icon id

            a.classList.add( 'parse-items-too-editor-link-text');
            const containerEl = a.createSpan( {cls: 'parse-items-too-editor-link-container'});
            const iconEl = containerEl.createSpan({ cls: 'parse-items-too-editor-link-icon' });
            setIcon(iconEl, iconName);
            a.replaceWith( containerEl );
            containerEl.append(a);
            a.setAttribute('data-icon-decorated', '1');
        });
    }
}

function mapIcon( key: string): string
{
   // Map your logical keys to registered icon ids
   if (key === 'armor') return 'shield-half';
   if (key === 'weapon') return 'sword';
   if (key === 'item') return 'circle-star';
   if (key === 'spell') return 'scroll';
   if (key === 'beast') return 'skull';
   return '';
 }

function consumeTrailingIconMarker( a: Element ): string | null
{
  const sib = a.nextSibling;
  if (!sib || sib.nodeType !== Node.TEXT_NODE)
      return null;

  const text = sib.textContent ?? '';
  const m = text.match(/^\s*\{icon[:=]([\w-]+)\}\s*/);

  if (!m)
      return null;

  sib.textContent = text.replace(m[0], ''); // strip marker from output
  return m[1] ?? null;
}
