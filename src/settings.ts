import {App, Notice, PluginSettingTab, Setting } from "obsidian";

import * as fs from "fs";
import * as path from "path";

import ToolsFor5e from "./main";
import { BeastCompendium } from "./bestiary"


import { pathExists, verify5eToolsPath } from "./utils/fileUtils";

//
async function pickFolder(): Promise<string | null>
{
    // @ts-ignore
    const electron = require("electron");
      const result = await electron.remote.dialog.showOpenDialog(
          {
              properties: ["openDirectory"],
          });

      if( result.canceled || result.filePaths.length === 0 ) return null;
      return result.filePaths[0];
}

// only save relative to vault paths to data and images
export interface ToolsFor5eSettings
{
    useMetricUnits: boolean;
    rollHealthpoints: boolean;
    useLiveImages: boolean;
    liveImageBaseURL: string;
    liveImageURLParam: string;
    fiveEtoolsExternalDir: string;
    enabledSources: Record<string, boolean>;

}

export const DEFAULT_SETTINGS: ToolsFor5eSettings =
{
    useMetricUnits: true,
    rollHealthpoints: false,
    useLiveImages: false,
    liveImageBaseURL: '',
    liveImageURLParam: '',
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
            .setName('use metric units?')
            .setDesc('use metric units in statblocks')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useMetricUnits) // Aktuellen Boolean-Wert laden
                .onChange(async (value: boolean) => {
                    this.plugin.settings.useMetricUnits = value; // Wert im Plugin-State aktualisieren
                    await this.plugin.saveSettings();           // In der data.json von Obsidian speichern
                })
            );

        new Setting( containerEl )
            .setName('roll monster healthpoints?')
            .setDesc('roll monster healthpoints when encounter is generated')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.rollHealthpoints) // Aktuellen Boolean-Wert laden
                .onChange(async (value: boolean) => {
                    this.plugin.settings.rollHealthpoints = value; // Wert im Plugin-State aktualisieren
                    await this.plugin.saveSettings();           // In der data.json von Obsidian speichern
                })
            );

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
                                   this.plugin.myBestiary = new BeastCompendium( this.plugin );
                                   await this.plugin.myBestiary.build( this.plugin.absoluteDataPath, this.plugin.absoluteImgPath );
                                   await this.plugin.registerSources( this.plugin.myBestiary.getSources() );

                                   new Notice("Located 5etools Folder ✓ " );
                               }
                               else
                               {
                                   new Notice("Located some Folder, but cannot build Beastary." );
                               }
                               //await this.plugin.saveSettings();
                            }
                            catch( e: any )
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

                new Setting( containerEl )
                    .setName('use live images?')
                    .setDesc('use live images (URL is needed)')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.useLiveImages) // Aktuellen Boolean-Wert laden
                        .onChange(async (value: boolean) => {
                            this.plugin.settings.useLiveImages = value; // Wert im Plugin-State aktualisieren
                            await this.plugin.saveSettings();           // In der data.json von Obsidian speichern
                            this.display();
                        })
                    );

                if( this.plugin.settings.useLiveImages )
                {
                    const urlSetting = new Setting( containerEl )
                        .setName('Live image URL')
                        .setDesc( 'Live image URL of books that you own' )
                        .addText(text => text
                            .setPlaceholder('URL...')
                            .setValue(this.plugin.settings.liveImageBaseURL ?? '')
                            .onChange(async (value) => {
                                // 1. Wert in den Settings speichern
                                this.plugin.settings.liveImageBaseURL = value.trim();
                                await this.plugin.saveSettings();
                            })
                        );

                    urlSetting.settingEl.style.flexDirection = 'column';
                    urlSetting.settingEl.style.alignItems = 'stretch';
                    urlSetting.settingEl.style.gap = '10px';
                    const inputEl = urlSetting.controlEl.querySelector('input');
                    if (inputEl)
                    {
                        inputEl.style.width = '100%';
                        inputEl.style.marginTop = '4px';
                    }

                    new Setting( containerEl )
                        .setName('Live image URL parameter')
                        .setDesc( 'Parameter at the end of the live image URL' )
                        .addText(text => text
                            .setPlaceholder('param...')
                            .setValue(this.plugin.settings.liveImageURLParam ?? '')
                            .onChange(async (value) => {
                                // 1. Wert in den Settings speichern
                                this.plugin.settings.liveImageURLParam = value.trim();
                                await this.plugin.saveSettings();
                            })
                        );
                }


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
