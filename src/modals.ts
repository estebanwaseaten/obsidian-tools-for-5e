import { App, Modal, Setting } from "obsidian";


export class ConfirmModal extends Modal
{
    constructor(app: App, private message: string, private onConfirm: () => void )
    {
        super(app);
    }

    onOpen()
    {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: "Confirmation" });
        contentEl.createEl("p", { text: this.message });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText("Cancel")
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText("OK")
                .setWarning() // Macht den Button rot
                .onClick(() => {
                    this.onConfirm();
                    this.close();
                }));
    }
}
