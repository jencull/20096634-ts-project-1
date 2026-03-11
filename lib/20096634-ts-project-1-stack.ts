import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { MoviesTable } from './constructs/dynamodb-table';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AuthApi } from './constructs/auth-api';
import { AppApi } from './constructs/app-api';

// called Project Stack because a class can't start with a number
export class ProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // db
    const moviesTable = new MoviesTable(this, 'MovieDatabase');

    // lamda shared layer. command: below transpiles the ts to js because AWS can't read
    // ts, only js.  esbuild translates the ts to js and bundling packages the new code
    // in a format that aws accepts.
    // esbuild https://shawntorsitano.com/blog/cdk-lambda-layers/
    // bundling https://docs.aws.amazon.com/cdk/api/v2/python/aws_cdk.aws_lambda_nodejs/README.html
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset('layers/shared', {
        bundling: {
          image: lambda.Runtime.NODEJS_18_X.bundlingImage,
          command: [
            'bash', '-c',
            'mkdir -p /asset-output/nodejs && ' +
            'cp -r node_modules package.json /asset-output/nodejs/ && ' +
            'npx esbuild nodejs/utils.ts --bundle --platform=node --outfile=/asset-output/nodejs/utils.js'
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
    });

    const userPool = new UserPool(this, "UserPool", {
      signInAliases: { username: true, email: true },
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolId = userPool.userPoolId;

    const appClient = userPool.addClient("AppClient", {
      authFlows: { userPassword: true },
    });

    const userPoolClientId = appClient.userPoolClientId;

    new AuthApi(this, 'AuthServiceApi', {
      userPoolId: userPoolId,
      userPoolClientId: userPoolClientId,
      sharedLayer: sharedLayer,
    });

    new AppApi(this, 'AppApi', {
      userPoolId: userPoolId,
      userPoolClientId: userPoolClientId,
      sharedLayer: sharedLayer,
      moviesTable: moviesTable.table,
    } );
  }
}
