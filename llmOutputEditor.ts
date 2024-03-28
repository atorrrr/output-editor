export function getWebviewContent(record: string[], index: number, totalRecords: number, scriptUri: string) {
    // Ensure the scriptUri is passed as a parameter for the preload script and used appropriately

    return `<!DOCTYPE html>
<html>
<head>
        <title>LLM Output Editor</title>
        <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f4f4f4;
        }
        
        h1 {
            margin-bottom: 20px;
            color: #333;
        }
        
        .navigation {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .navigation button {
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .container {
            display: flex;
        }
        
        .input-container,
        .output-container {
            flex: 1;
            padding: 10px;
        }
        
        .input-container label,
        .output-container label {
            display: block;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .input-container input[type="text"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        
        #output-editor {
            width: 100%;
            height: 400px;
            border: 1px solid #ccc;
        }
        
        .button-container {
            text-align: right;
            margin-top: 20px;
        }
        
        .button-container button {
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
    </style>
    </head>
    <body>
    <h1>LLM Output Editor</h1>
    <div class="navigation">
        <button id="prev-button" ${index === 0 ? 'disabled' : ''} onclick="navigateRecord(${index - 1})">Prev</button>
        <span>Record ${index + 1} of ${totalRecords}</span>
        <button id="next-button" ${index === totalRecords - 1 ? 'disabled' : ''} onclick="navigateRecord(${index + 1})">Next</button>
    </div>
    <div class="container">
        <div class="input-container">
            <label for="input-field">Input:</label>
            <input type="text" id="input-field" value="${record[0]}" readonly>
        </div>
        <div class="output-container">
            <label for="output-editor">Output:</label>
            <div id="output-editor" style="height: 400px;"></div>
        </div>
    </div>
    <div class="button-container">
        <button id="save-button" onclick="saveChanges()">Save Changes</button>
    </div>
    
    <script src="https://unpkg.com/monaco-editor@0.26.1/min/vs/loader.js"></script>
    <script>
        require.config({
            paths: { 'vs': 'https://unpkg.com/monaco-editor@0.26.1/min/vs' }
        });
        require(['vs/editor/editor.main'], function() {
            var editor = monaco.editor.create(document.getElementById('output-editor'), {
                value: \`${record[1] || ''}\`,
                language: 'json',
                theme: 'vs-dark'
            });
            
            window.navigateRecord = function(index) {
                vscode.postMessage({
                    command: 'navigateRecord',
                    index: index
                });
            };

            window.saveChanges = function() {
                const updatedOutput = editor.getValue();
                vscode.postMessage({
                    command: 'saveChanges',
                    output: updatedOutput
                });
            };
        });
    </script>
    <script>
        const vscode = acquireVsCodeApi();
    </script>
</body>

    </html>`;
}