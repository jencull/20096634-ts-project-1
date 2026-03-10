import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { MoviesTable } from './constructs/dynamodb-table';

// called Project Stack because a class can't start with a number
export class ProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new MoviesTable(this, 'MovieDatabase');

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, '20096634TsProject1Queue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
