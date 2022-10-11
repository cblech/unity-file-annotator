// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path = require('path');
import * as vscode from 'vscode';
import { MyCodeLensProvider } from './CodeLensProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "unity-asset-annotator" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('unity-asset-annotator.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		//vscode.window.showInformationMessage('Hello World Change');

		let p =  path.join(vscode.workspace.workspaceFolders![0].uri.fsPath,"/Layout.pdf");

		const openPath = vscode.Uri.file(p);
		
		vscode.workspace.openTextDocument(openPath).then(doc => {
			vscode.window.showTextDocument(doc).then(editor=>{
				editor.selection = new vscode.Selection(99,0,99,0);
				editor.revealRange(new vscode.Range(100,0,100,0),vscode.TextEditorRevealType.InCenter);
			});
		});
	});

	let disposable2 = vscode.commands.registerCommand('unity-asset-annotator.openFile', (file: vscode.Uri, position: vscode.Position) => {
		vscode.workspace.openTextDocument(file).then(doc => {
			vscode.window.showTextDocument(doc).then(editor=>{
				editor.selection = new vscode.Selection(position,position);
				editor.revealRange(new vscode.Range(position,position),vscode.TextEditorRevealType.InCenter);
			});
		});
	});

	let disposable3 = vscode.languages.registerCodeLensProvider("*", new MyCodeLensProvider);


	context.subscriptions.push(disposable);
	context.subscriptions.push(disposable2);
	context.subscriptions.push(disposable3);
}

// This method is called when your extension is deactivated
export function deactivate() { }
