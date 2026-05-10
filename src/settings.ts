import {App, Notice, PluginSettingTab, Setting } from "obsidian";
import { remote } from "electron";

import * as fs from "fs";
import * as path from "path";

import ToolsFor5e from "./main";
import { Bestiary } from "./bestiary"


import { pathExists, verify5eToolsPath, verify5eImgPath } from "./utils/fileUtils";

//
async function pickFolder(): Promise<string | null>
{
      const result = await remote.dialog.showOpenDialog(
          {
              properties: ["openDirectory"],
          });

      if( result.canceled || result.filePaths.length === 0 ) return null;
      return result.filePaths[0];
}

// only save relative to vault paths to data and images
export interface ToolsFor5eSettings
{
    fiveEtoolsExternalDir: string;
    enabledSources: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: ToolsFor5eSettings =
{
    fiveEtoolsExternalDir: '',
    enabledSources: {},
}

export class ToolsFor5eSettingsTab extends PluginSettingTab
{
	plugin: ToolsFor5e;

	constructor(app: App, plugin: ToolsFor5e) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void
    {
		const {containerEl} = this;
        const vaultRoot = (this.plugin.app.vault.adapter as any).basePath;

		containerEl.empty();

        new Setting( containerEl )
            .setName('Locate 5etools folder')
            .setDesc(this.plugin.settings.fiveEtoolsExternalDir
                        ? `Folder location: ${this.plugin.settings.fiveEtoolsExternalDir}`
                        : 'Locate 5etools folder of books that you own')
            .addButton( button => button
                .setButtonText('Clear')
                .setDisabled(!this.plugin.settings.fiveEtoolsExternalDir)
                .onClick( async () =>
                    {
                        this.plugin.settings.fiveEtoolsExternalDir = '';
                        this.plugin.settings.enabledSources = {};
                        new Notice("Cleared");
                        await this.plugin.saveSettings();
                        this.display();
                    }))
            .addButton( button => button
                .setButtonText('Locate')
                .onClick( async () =>
                    {
                        const folder = await pickFolder();
                        if( folder )
                        {
                            //this.plugin.settings.fiveEtoolsDir = folder;
                            //await this.plugin.saveSettings();
                            try
                            {
                               this.plugin.settings.fiveEtoolsExternalDir = path.relative( vaultRoot, folder );
                               this.plugin.settings.enabledSources = {};
                               await this.plugin.saveSettings();

                               if( await verify5eToolsPath( folder ) )
                               {
                                   this.plugin.myBeastary = new Beastary();
                                   await this.plugin.myBeastary.build(this.plugin.app, this.plugin.absoluteDataPath, this.plugin.absoluteImgPath);
                                   await this.plugin.registerSources(this.plugin.myBeastary.getSources());
                                   new Notice("Located 5etools Folder ✓ " );
                               }
                               else
                               {
                                   new Notice("Located some Folder ?" );
                               }
                               await this.plugin.saveSettings();
                            }
                            catch( e )
                            {
                                this.plugin.settings.fiveEtoolsExternalDir = '';
                                this.plugin.settings.enabledSources = {};
                                new Notice("Error locating: " + e.message);
                                console.error(e);
                            }

                          this.display();
                        }
                    }
                ));

                containerEl.createEl('h2', {text: 'Sources (only select what you own!)'});
                const sources = Object.keys( this.plugin.settings.enabledSources ).sort();
                if( sources.length === 0 )
                {
                    containerEl.createEl('p', {text: 'No sources found. Make sure your 5etools folder is set correctly.'});
                    return;
                }

                const grid = containerEl.createEl( 'div', {} );
                grid.style.display = 'grid';
                grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
                grid.style.gap = '4px';

                for( const source of sources )
                {
                    const cell = grid.createEl( 'div', {} );
                    cell.style.display = 'flex';
                    cell.style.alignItems = 'center';
                    cell.style.gap = '8px';

                    const toggle = cell.createEl('input', {type: 'checkbox'});
                    toggle.checked = this.plugin.settings.enabledSources[source] ?? true;
                    toggle.addEventListener('change', async () =>
                    {
                        this.plugin.settings.enabledSources[source] = toggle.checked;
                        await this.plugin.saveSettings();
                    });

                    cell.createEl('span', {text: source});
                }

	}
}
