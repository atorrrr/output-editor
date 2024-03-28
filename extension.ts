import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import parse = require('csv-parse/lib/sync');
import { getWebviewContent } from './llmOutputEditor';

let currentPanel: vscode.WebviewPanel | undefined;
let csvData: string[][] = [];
let currentRecordIndex = 0;

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('llmOutputEditor.openEditor', () => {
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'llmOutputEditor',
                'LLM Output Editor',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
                }
            );

            currentPanel = panel;

            panel.webview.onDidReceiveMessage(
                async (message) => {
                    switch (message.command) {
                        case 'navigateRecord':
                            navigateRecord(message.index);
                            break;
                        case 'saveChanges':
                            await saveChanges(message.output);
                            break;
                    }
                },
                undefined,
                context.subscriptions
            );

            panel.onDidDispose(() => {
                currentPanel = undefined;
            }, null, context.subscriptions);

            loadCSVFile();
        }
    });

    context.subscriptions.push(disposable);
}
function loadCSVFile() {
    if (!currentPanel) {
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder is open.');
        return;
    }

    const workspaceFolder = workspaceFolders[0].uri.fsPath;
    const csvFilePath = path.join(workspaceFolder, 'llm_output.csv');

    fs.access(csvFilePath, fs.constants.F_OK, (err) => {
        if (err) {
            vscode.window.showErrorMessage(`File not found: ${csvFilePath}`);
            return;
        }

        fs.readFile(csvFilePath, 'utf-8', (err, data) => {
            if (err) {
                vscode.window.showErrorMessage(`Failed to read the CSV file: ${err instanceof Error ? err.message : "unknown error"}`);
                return;
            }

            try {
                const records = parse(data, { columns: false });
                csvData = records;
                currentRecordIndex = 0;
                updateWebview();
            } catch (parseErr) {
                // Handle parsing errors
                vscode.window.showErrorMessage(`Failed to parse the CSV file: ${parseErr instanceof Error ? parseErr.message : "unknown error"}`);
            }
        });
    });
}


function navigateRecord(index: number) {
    if (index >= 0 && index < csvData.length) {
        currentRecordIndex = index;
        updateWebview();
    }
}

async function saveChanges(output: string) {
    csvData[currentRecordIndex][1] = output;
    await saveCsvFile();
}

async function saveCsvFile() {
    if (!currentPanel || !vscode.workspace.workspaceFolders) {
        return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const csvFilePath = path.join(workspaceFolder, 'llm_output.csv');
    const csvContent = csvData.map(row => row.join(',')).join('\n');

    try {
        await fs.promises.writeFile(csvFilePath, csvContent);
        vscode.window.showInformationMessage('Changes saved successfully.');
    } catch (err) {
        // Type-checking the error
        if (err instanceof Error) {
            vscode.window.showErrorMessage(`Failed to save the CSV file: ${err.message}`);
        } else {
            vscode.window.showErrorMessage('Failed to save the CSV file for an unknown reason.');
        }
    }
}


function updateWebview() {
    if (!currentPanel || csvData.length === 0) {
        return;
    }

    const record = csvData[currentRecordIndex];
    const totalRecords = csvData.length;
    // Assuming scriptUri is not needed or its usage is handled elsewhere
    currentPanel.webview.html = getWebviewContent(record, currentRecordIndex, totalRecords, "");
}