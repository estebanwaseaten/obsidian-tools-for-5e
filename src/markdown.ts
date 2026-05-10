import type { MarkdownPostProcessor } from 'obsidian';
import { setIcon } from 'obsidian';
import type { Plugin } from 'obsidian';


export function toolsPostProcessor( plugin: Plugin ): MarkdownPostProcessor
{
    //const { app } = plugin; // access app, settings, etc.
    return (el, ctx) =>
    {
        el.querySelectorAll('a.internal-link').forEach( (a) =>
        {
            //make sure we only process once:
            if (!(a instanceof Element)) return;
            if (a.getAttribute('data-icon-decorated')) return;

            // Strategy 1: trailing text marker, e.g. [[Note]] {icon=wip}
            const iconFromTrailing = consumeTrailingIconMarker(a);

        //    console.log( "icon id: " + iconFromTrailing );
            if( !iconFromTrailing ) return;

            const iconName = mapIcon( iconFromTrailing ); // map key -> registered icon id

            //console.log( "icon name: " + iconName );

            a.classList.add( 'parse-items-too-editor-link-text');
            const containerEl = a.createSpan( {cls: 'parse-items-too-editor-link-container'});
            const iconEl = containerEl.createSpan({ cls: 'parse-items-too-editor-link-icon' });
            setIcon(iconEl, iconName);
            //setIcon(containerEl, iconName);
            //containerEl.append( a );
            a.replaceWith( containerEl );
            containerEl.append(a);
            //a.before(iconEl);
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
  if (!sib || sib.nodeType !== Node.TEXT_NODE) return null;
  const text = sib.textContent ?? '';
  const m = text.match(/^\s*\{icon[:=]([\w-]+)\}\s*/);
  if (!m) return null;
  sib.textContent = text.replace(m[0], ''); // strip marker from output
  return m[1];
}
