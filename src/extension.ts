import path = require('path');
import * as vscode from 'vscode';
import { MyCodeLensProvider } from './CodeLensProvider';

export function activate(context: vscode.ExtensionContext) {

	//console.log('Congratulations, your extension "unity-asset-annotator" is now active!');

	let disposable2 = vscode.commands.registerCommand('unity-asset-annotator.openFile', (file: vscode.Uri, position: vscode.Position) => {
		vscode.workspace.openTextDocument(file).then(doc => {
			vscode.window.showTextDocument(doc).then(editor=>{
				editor.selection = new vscode.Selection(position,position);
				editor.revealRange(new vscode.Range(position,position),vscode.TextEditorRevealType.InCenter);
			});
		});
	});

	let disposable3 = vscode.languages.registerCodeLensProvider("*", new MyCodeLensProvider);


	context.subscriptions.push(disposable2);
	context.subscriptions.push(disposable3);
}

export function deactivate() { }
