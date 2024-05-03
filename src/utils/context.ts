import { App } from 'aws-cdk-lib';
import { readFileSync } from 'fs';

export interface StageParameters {
	region: string;
}
export class ContextParameters {
	systemName: string;
	env: string;
	stage: string;
	version: string;
	stageParameters: StageParameters;

	constructor(app: App) {
		this.systemName = app.node.tryGetContext('systemName');
		this.env = app.node.tryGetContext('env');
		this.stage = app.node.tryGetContext('stage');
		this.version = app.node.tryGetContext('version');
		console.log(`systemName: ${this.systemName}`);
		console.log(`env: ${this.env}`);
		console.log(`stage: ${this.stage}`);
		console.log(`version: ${this.version}`);

		const filePath = __dirname + `/../cdk.${this.env}.${this.stage}.json`;
		this.stageParameters = JSON.parse(readFileSync(filePath).toString()) as StageParameters;
		console.log('StageParameters: ');
		console.log(this.stageParameters);
	}

	public getResourceId = (resourceName: string): string => {
		return this.systemName + '-' + this.env + '-' + this.stage + '-' + resourceName;
	};
}
