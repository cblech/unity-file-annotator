import { open, readFileSync } from "fs";
import path = require("path");
import { debugPort } from "process";
import { CodeLens, DocumentDropEdit, Position, Range, TextDocument, TextLine, Uri, workspace } from "vscode";

type ItemName = {
    number: string,
    name: string
};

enum ItemType {
    item,
    gameObjectItem,
    componentItem,
    monoBehaviourItem
}

type Item = {
    id: string,
    type: ItemType,
    fileName: string,
    filePath: string,
    fileUri: Uri,
    lineNumber: number,
    name: string
};

type GameObjectItem = {

} & Item;

type ComponentItem = {
    gameObject: string
} & Item;

type MonoBehaviourItem = {
    monoGuid: string,
    monoScriptName: string
} & ComponentItem;

type DocumentInfo = {
    document: TextDocument,
    guid: string,
    fileName: string,
    pathName: string
};

export class Annotator {
    private _document: TextDocument | null = null;
    //private _fileItems: ItemName[] = [];

    private _items: { [fileId: string]: Item } = {};

    private _fileIdInFileGuid: { [guid: string]: string } = {};

    private _hasIndexedEverything = false;

    getAnnotations(document: TextDocument): CodeLens[] {
        this._document = document;

        if(!this._hasIndexedEverything){
            this.indexAllFiles();
        }

        if (this.canAnnotateUri(document.uri)) {
            this.indexDocument(this._document);
            return this.makeAnnotations();
        }

        return [];
    }

    private async indexAllFiles() {
        this._hasIndexedEverything = true;

        workspace.getConfiguration("").update("diffEditor.codeLens",true);

        let uris = await workspace.findFiles("**/*.unity");
        
        for (const uri of uris) {
            if (this.canAnnotateUri(uri)) {
                var document = await workspace.openTextDocument(uri);
                this.indexDocument(document);
            }
        }

        uris = await workspace.findFiles("**/*.prefab");

        for (const uri of uris) {
            if (this.canAnnotateUri(uri)) {
                var document = await workspace.openTextDocument(uri);
                this.indexDocument(document);
            }
        }
    }

    private canAnnotateUri(uri: Uri): boolean {
        if (uri.scheme !== "file") {
            //console.log("Not annotating " + uri);
            return false;
        }

        if (uri.fsPath.endsWith(".unity")) {
            //console.log("Annotating " + uri);
            return true;
        }

        if (uri.fsPath.endsWith(".prefab")) {
            //console.log("Annotating " + uri);
            return true;
        }

        //console.log("Not annotating " + uri);
        return false;
    }

    private indexDocument(document: TextDocument) {
        console.log("indexing "+document.uri);

        let currentLine = 0;

        let documentInfo: DocumentInfo = {
            document: document,
            fileName: this.getFileNameFromPath(document.fileName),
            pathName: workspace.asRelativePath(document.uri),
            guid: this.getGuidFromPath(workspace.asRelativePath(document.uri))
        };

        while (true) {
            let nextObjectLineNumber = this.getNextLineNumberWith(document, /--- !u!\d* &/gi, currentLine + 1);

            if (nextObjectLineNumber < 0) {
                break;
            }

            currentLine = nextObjectLineNumber;

            let nextObjectIdRange = this.getWordRangeAfter(document, nextObjectLineNumber, /&/gi, 1);

            if (!nextObjectIdRange) {
                continue;
            }

            let nextObjectId = document.getText(nextObjectIdRange);

            let nextLineText = document!.lineAt(nextObjectLineNumber + 1).text;

            let nextLineCutText = nextLineText.substring(0, nextLineText.length - 1);

            let itemType =
                nextLineCutText === "GameObject" ?
                    ItemType.gameObjectItem :
                    nextLineCutText === "MonoBehaviour" ?
                        ItemType.monoBehaviourItem :
                        nextLineCutText === "PrefabInstance" ?
                            ItemType.item :
                            ItemType.componentItem;

            switch (itemType) {
                case ItemType.gameObjectItem: {
                    this.makeGameObjectItem(nextObjectId, documentInfo, nextObjectLineNumber, nextLineCutText);
                    break;
                }
                case ItemType.componentItem: {
                    this.makeComponentItem(documentInfo, nextObjectLineNumber, nextObjectId, nextLineCutText);
                    break;
                }
                case ItemType.monoBehaviourItem: {
                    this.makeComponentItem(documentInfo, nextObjectLineNumber, nextObjectId, nextLineCutText);
                    break;
                }
            }
        }
    }

    private getFileNameFromPath(documentPath: string) {
        let splitDocumentPath = documentPath.split("/");
        let documentFileName = splitDocumentPath.at(splitDocumentPath.length - 1)!;

        if (splitDocumentPath.length === 1) {
            splitDocumentPath = documentPath.split("\\");
            documentFileName = splitDocumentPath.at(splitDocumentPath.length - 1)!;
        }
        return documentFileName;
    }

    private getGuidFromPath(documentPath: string): string {
        try {
            let contents = readFileSync(documentPath + ".meta", "utf-8");
            let guidPosition = contents.search(/guid:/);
            let restContents = contents.substring(guidPosition + 5);
            let guidString = restContents.split("\n", 2)[0].trim();
            return guidString;
        } catch (e) {
            return "0";
        }
    }

    private makeComponentItem(document: DocumentInfo, nextObjectLineNumber: number, nextObjectId: string, nextLineCutText: string) {
        let goLineNumber = this.getNextLineNumberWith(document.document, /m_GameObject:/gi, nextObjectLineNumber);

        if (goLineNumber < 0) {
            return;
        }

        let goFileIdRange = this.getWordRangeAfter(document.document, goLineNumber, /fileID:/gi, 8);

        if (!goFileIdRange) {
            return;
        }

        let goFileId = document.document.getText(goFileIdRange);

        this._items[nextObjectId] = {
            id: nextObjectId,
            type: ItemType.componentItem,
            fileName: document.fileName,
            filePath: document.pathName,
            fileUri: document.document.uri,
            lineNumber: nextObjectLineNumber,
            name: nextLineCutText,
            gameObject: goFileId
        } as Item;

        this._fileIdInFileGuid[document.guid] = nextObjectId;
    }

    private makeGameObjectItem(nextObjectId: string, document: DocumentInfo, nextObjectLineNumber: number, nextLineCutText: string) {
        let goName = this.getOptionInItem(document.document, /m_Name:/gi, nextObjectLineNumber);

        this._items[nextObjectId] = {
            id: nextObjectId,
            type: ItemType.gameObjectItem,
            fileName: document.fileName,
            filePath: document.pathName,
            fileUri: document.document.uri,
            lineNumber: nextObjectLineNumber,
            name: `${goName} (GameObject)`
        };

        this._fileIdInFileGuid[document.guid] = nextObjectId;
    }

    private getOptionInItem(document: TextDocument, optionName: RegExp, itemLine: number): any {
        let optionLineNumber = this.getNextLineNumberWith(document, optionName, itemLine + 1);

        if (optionLineNumber < 0) {
            return;
        }

        let optionLine = document.lineAt(optionLineNumber);

        let valueStart = optionLine.text.search(/:/gi);

        let valueText = optionLine.text.substring(valueStart + 1).trim();

        let value;

        try {
            value = JSON.parse(valueText);
        } catch (e) {
            value = JSON.parse(`"${valueText}"`);
        }

        return value;
    }

    private getNextLineNumberWith(document: TextDocument, regex: RegExp, start: number = 0): number {
        for (let i = start; i < document.lineCount; i++) {
            let line = document.lineAt(i);

            if (line.text.search(regex) >= 0) {
                return i;
            }
        }

        return -1;
    }

    private getWordRangeAfter(document: TextDocument, line: number, regex: RegExp, offset: number): Range | undefined {
        let actualLine = document.lineAt(line);

        let pos = actualLine.text.search(regex);

        if (pos >= 0) {
            return document.getWordRangeAtPosition(new Position(line, pos + offset));
        }

        return;
    }

    private makeAnnotations(): CodeLens[] {
        let out: CodeLens[] = [];

        for (let i = 0; i < this._document!.lineCount; i++) {
            let line = this._document!.lineAt(i);

            let regex = /fileID:/gi;

            let fileIdPos = line.text.search(regex);

            if (fileIdPos >= 0) {

                fileIdPos += 8;

                let range = this._document!.getWordRangeAtPosition(new Position(i, fileIdPos));

                let numberString = line.text.substring(range?.start.character ?? 0, range?.end.character);

                if (numberString === "0") {
                    continue;
                }

                //let item = this._fileItems.find(value => value.number === numberString);
                let item = Object.values(this._items).find(value => value.id === numberString);

                if (item) {
                    if (item.type === ItemType.componentItem || item.type === ItemType.monoBehaviourItem) {
                        let compItem = item as ComponentItem;

                        if (compItem.gameObject === "0") {
                            out.push(this.makeCodeLens(`fileID: ${item.name}`, i, 0, item));
                            out.push(this.makeCodeLens(`in ${item.fileName}`, i, 0, item));
                        } else {
                            let goItem = Object.values(this._items).find(value => value.id === compItem.gameObject) as GameObjectItem;

                            out.push(this.makeCodeLens(`fileID: ${item.name}`, i, 0, item));
                            out.push(this.makeCodeLens(`in ${goItem.name}`, i, 0, goItem));
                            out.push(this.makeCodeLens(`in ${item.fileName}`, i, 0, goItem));
                        }
                    } else {
                        out.push(this.makeCodeLens(`fileID: ${item.name}`, i, 0, item));
                        out.push(this.makeCodeLens(`in ${item.fileName}`, i, 0, item));
                    }
                }
            }
        }

        return out;
    }

    private makeCodeLens(title: string, line: number, sorting: number, linkedItem: Item): CodeLens {
        return new CodeLens(
            new Range(line, sorting, line, sorting),
            {
                command: 'unity-asset-annotator.openFile',
                title: title,
                arguments: [
                    linkedItem.fileUri,
                    new Position(linkedItem.lineNumber, 0)
                ]
            }
        );
    }
}

export let annotator = new Annotator;

