import { MarkdownPostProcessor, setIcon, TFile, Notice } from 'obsidian';
import ToolsFor5e from "./main";

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


            if( href.startsWith("5e:") )
            {
                const parts = href.split(":"); // ["5e", "beast", "Goblin"]
                if (parts.length >= 3)
                {

                }
            }

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
