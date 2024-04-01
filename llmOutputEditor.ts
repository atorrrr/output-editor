import Ajv from 'ajv';

const cssStyles = `
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
        }
        h1 {
            margin-bottom: 10px;
        }
        h2 {
            margin-top: 20px;
        }
        pre {
            background-color: #f4f4f4;
            padding: 10px;
            overflow-x: auto;
            color: black;
        }
        .error {
            color: red;
            margin-top: 10px;
        }
        textarea {
            width: 100%;
            height: 200px;
            padding: 10px;
            font-size: 14px;
            line-height: 1.5;
            border: 1px solid #ddd;
            border-radius: 4px;
            resize: vertical;
        }
    </style>
`;

const htmlTemplate = `
    <div>
        <h1>LLM Output Editor</h1>
        <p>Record {currentIndex} of {totalRecords}</p>
        <div>
            <h2>Input:</h2>
            <pre>{input}</pre>
        </div>
        <div>
            <h2>Output:</h2>
            <textarea id="outputEditor">{output}</textarea>
            {validationError}
        </div>
        <div>
            <button id="prevButton" {prevDisabled}>Previous</button>
            <button id="nextButton" {nextDisabled}>Next</button>
            <button id="saveButton">Save Changes</button>
        </div>
    </div>
`;

const scriptCode = `
    <script>
        const vscode = acquireVsCodeApi();

        // Event listeners for buttons
        document.getElementById('prevButton').addEventListener('click', () => {
            vscode.postMessage({ command: 'navigateRecord', index: -1 });
        });

        document.getElementById('nextButton').addEventListener('click', () => {
            vscode.postMessage({ command: 'navigateRecord', index: 1 });
        });

        document.getElementById('saveButton').addEventListener('click', () => {
            const output = document.getElementById('outputEditor').value;
            console.log('Save button clicked. Output:', output);
            vscode.postMessage({ command: 'saveChanges', output });
        });
    </script>
`;

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

export function getWebviewContent(record: string[], totalRecords: number, currentIndex: number, jsonSchema: any) {
    const input = record[0] || '';
    const output = record[1] || '';
    console.log('Generating webview content...');
    console.log('getWebviewContent called with record:', record, 'totalRecords:', totalRecords, 'currentIndex:', currentIndex);

    console.log('JSON output:', output);

    const validationResult = validateJsonSchema(output, jsonSchema);
    const isValid = validationResult.valid;
    const errorMessage = validationResult.errorMessage;

    console.log('Validation result:', validationResult);

    const validationError = !isValid ? `<p class="error">JSON Schema Validation Error: ${escapeHtml(errorMessage)}</p>` : '';

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LLM Output Editor</title>
            ${cssStyles}
        </head>
        <body>
            ${htmlTemplate
                .replace(/{currentIndex}/g, (currentIndex + 1).toString())
                .replace(/{totalRecords}/g, totalRecords.toString())
                .replace(/{input}/g, escapeHtml(input))
                .replace(/{output}/g, escapeHtml(output))
                .replace(/{validationError}/g, validationError)
                .replace(/{prevDisabled}/g, currentIndex === 0 ? 'disabled' : '')
                .replace(/{nextDisabled}/g, currentIndex === totalRecords - 1 ? 'disabled' : '')
            }
            ${scriptCode}
        </body>
        </html>
    `;

    return html;
}