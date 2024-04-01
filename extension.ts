import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import parse = require('csv-parse/lib/sync');
import { getWebviewContent } from './llmOutputEditor';
import Ajv from 'ajv';

let currentPanel: vscode.WebviewPanel | undefined;
let csvData: string[][] = [];
let currentRecordIndex = 0;
let jsonSchema: any = {}; // Preset JSON schema

export function activate(context: vscode.ExtensionContext) {
    console.log('LLM Output Editor extension activation started.');

    let disposable = vscode.commands.registerCommand('llmOutputEditor.openEditor', () => {
        console.log('Command "llmOutputEditor.openEditor" triggered.');

        const columnToShowIn = vscode.ViewColumn.Beside || vscode.ViewColumn.One;

        if (currentPanel) {
            console.log('Current panel exists. Revealing the panel.');
            currentPanel.reveal(columnToShowIn);
        } else {
            console.log('Creating new webview panel.');
            currentPanel = vscode.window.createWebviewPanel('llmOutputEditor', 'LLM Output Editor', columnToShowIn, { enableScripts: true });

            currentPanel.webview.onDidReceiveMessage(async (message) => {
                console.log('Received message from webview:', message);
                try {
                    switch (message.command) {
                        case 'navigateRecord':
                            console.log('Navigating to record:', message.index);
                            navigateRecord(message.index);
                            break;
                        case 'saveChanges':
                            console.log('Saving changes:', message.output);
                            await saveChanges(message.output);
                            break;
                        case 'loadCsv':
                            console.log('Loading CSV file.');
                            await promptCsvFileSelection();
                            break;
                        default:
                            console.warn('Unknown command received:', message.command);
                    }
                } catch (error) {
                    console.error('Error processing webview message:', error);
                    vscode.window.showErrorMessage('An error occurred while processing the request. Please check the console for more details.');
                }
            });

            currentPanel.onDidDispose(() => {
                console.log('Webview panel disposed.');
                currentPanel = undefined;
            }, null, context.subscriptions);

            console.log('Loading last session.');
            loadLastSession();
        }
    });

    context.subscriptions.push(disposable);
    console.log('LLM Output Editor extension activated.');

    function getLastSessionFilePath(): string | undefined {
        const lastSessionFilePath = context.globalState.get<string>('lastSessionFilePath');
        console.log('Retrieved last session file path:', lastSessionFilePath);
        return lastSessionFilePath;
    }

    function saveLastSession(filePath: string) {
        context.globalState.update('lastSessionFilePath', filePath);
        console.log('Last session saved with file path:', filePath);
    }

    async function promptCsvFileSelection() {
        try {
            const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                openLabel: 'Load',
                filters: { 'CSV files': ['csv'] }
            };

            const fileUri = await vscode.window.showOpenDialog(options);
            if (fileUri && fileUri[0]) {
                loadCSVFile(fileUri[0].fsPath);
            } else {
                console.log('No CSV file selected.');
            }
        } catch (error) {
            console.error('Error prompting CSV file selection:', error);
            vscode.window.showErrorMessage('Failed to prompt CSV file selection. Please try again.');
        }
    }

    function loadCSVFile(filePath: string) {
        fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) {
                console.error('Failed to read the CSV file:', err);
                vscode.window.showErrorMessage('Failed to read the CSV file. Please make sure the file exists and try again.');
                return;
            }
            try {
                csvData = parse(data, { columns: false });
                console.log('Loaded CSV data:', csvData);
                currentRecordIndex = 0;
                loadJsonSchema(filePath)
                    .then(() => {
                        updateWebview();
                        saveLastSession(filePath);
                    })
                    .catch((error) => {
                        console.error('Error loading JSON schema:', error);
                        vscode.window.showErrorMessage('Failed to load JSON schema. Please check the schema file and try again.');
                    });
            } catch (err) {
                console.error('Failed to parse the CSV file:', err);
                vscode.window.showErrorMessage('Failed to parse the CSV file. Please make sure the file is in the correct format and try again.');
            }
        });
    }

    function navigateRecord(indexChange: number) {
        console.log('navigateRecord called with indexChange:', indexChange);
        console.log('Current record index:', currentRecordIndex);
        console.log('Total records:', csvData.length);

        const newIndex = currentRecordIndex + indexChange;
        if (newIndex >= 0 && newIndex < csvData.length) {
            currentRecordIndex = newIndex;
            console.log('Current record index updated to', currentRecordIndex);
            updateWebview();
        } else {
            console.warn('Invalid record index:', newIndex);
        }
    }

    async function saveChanges(output: string) {
        console.log('saveChanges called with output:', output);
        console.log('Current csvData:', csvData);
        console.log('Current record index:', currentRecordIndex);

        if (csvData.length === 0) {
            console.warn('No CSV file loaded. Cannot save changes.');
            vscode.window.showWarningMessage('No CSV file loaded. Please load a CSV file before saving changes.');
            return;
        }

        try {
            const validationResult = validateJsonSchema(output, jsonSchema);
            if (!validationResult.valid) {
                console.warn('JSON schema validation failed:', validationResult.errorMessage);
                const confirmation = await vscode.window.showWarningMessage(
                    `JSON schema validation failed: ${validationResult.errorMessage}. Do you still want to save the changes?`,
                    'Yes', 'No'
                );
                if (confirmation !== 'Yes') {
                    return;
                }
            }

            csvData[currentRecordIndex][1] = output;
            await saveCsvFile();
        } catch (error) {
            console.error('Failed to save changes:', error);
            vscode.window.showErrorMessage('Failed to save changes. Please try again.');
        }
    }

    async function saveCsvFile() {
        const filePath = getLastSessionFilePath();
        if (!filePath) {
            console.warn('No CSV file loaded.');
            vscode.window.showWarningMessage('No CSV file loaded. Please load a CSV file before saving changes.');
            return;
        }
        const csvContent = csvData.map(row => row.join(',')).join('\n');
        fs.writeFile(filePath, csvContent, 'utf-8', (err) => {
            if (err) {
                console.error('Failed to save the CSV file:', err);
                vscode.window.showErrorMessage('Failed to save the CSV file. Please try again.');
            } else {
                console.log('CSV file saved successfully.');
                vscode.window.showInformationMessage('CSV file saved successfully.');
            }
        });
    }

    function updateWebview() {
        if (!currentPanel) {
            console.warn('No current webview panel.');
            return;
        }
        if (csvData.length === 0) {
            console.warn('Empty CSV data.');
            currentPanel.webview.html = getWebviewContent([], 0, 0, jsonSchema);
            return;
        }
        const record = csvData[currentRecordIndex];
        const totalRecords = csvData.length;
        console.log('Updating webview with record:', record, 'Total records:', totalRecords);
        try {
            currentPanel.webview.html = getWebviewContent(record, totalRecords, currentRecordIndex, jsonSchema);
        } catch (error) {
            console.error('Error updating webview:', error);
            vscode.window.showErrorMessage('Failed to update the webview. Please try again.');
        }
    }

    function loadLastSession() {
        const lastSessionFilePath = getLastSessionFilePath();
        if (lastSessionFilePath) {
            console.log('Loading last session from:', lastSessionFilePath);
            loadCSVFile(lastSessionFilePath);
        } else {
            console.log('No last session found. Prompting user to select a CSV file...');
            promptCsvFileSelection();
        }
    }

    async function loadJsonSchema(csvFilePath: string) {
        const schemaFilePath = path.join(path.dirname(csvFilePath), 'schema.json');
        try {
            const schemaContent = await fs.promises.readFile(schemaFilePath, 'utf-8');
            jsonSchema = JSON.parse(schemaContent);
            console.log('Loaded JSON schema:', jsonSchema);
        } catch (error) {
            console.error('Error loading JSON schema:', error);
            console.error('Schema file path:', schemaFilePath);
            throw error;
        }
    }

    function validateJsonSchema(json: string, schema: any): { valid: boolean, errorMessage: string } {
        if (typeof json !== 'string' || !json.trim()) {
            return { valid: false, errorMessage: 'Input is not a valid JSON string' };
        }

        try {
            JSON.parse(json);
        } catch (error) {
            return { valid: false, errorMessage: 'Invalid JSON format' };
        }

        const ajv = new Ajv();
        const validate = ajv.compile(schema);
        const parsedJson = JSON.parse(json);
        const valid = validate(parsedJson);

        if (!valid) {
            return { valid: false, errorMessage: ajv.errorsText(validate.errors) };
        }

        return { valid: true, errorMessage: '' };
    }
}

export function deactivate() {
    console.log('LLM Output Editor extension deactivated.');
}