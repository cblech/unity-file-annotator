import { CancellationToken, CodeLens, CodeLensProvider, Event, Position, ProviderResult, Range, TextDocument } from "vscode";
import { log } from "./logging";
import{annotator} from "./Annotator";

export class MyCodeLensProvider implements CodeLensProvider {
    onDidChangeCodeLenses?: Event<void> | undefined;

    provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<CodeLens[]> {
        let annotations = annotator.getAnnotations(document);

        return annotations;
    }

    resolveCodeLens(codeLens: CodeLens, token: CancellationToken): ProviderResult<CodeLens> {
        return codeLens;
    }

}